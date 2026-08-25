import { prisma } from '../../utils/prisma.client.js';
import { notFound, forbidden } from '../../utils/app-error.js';

const feedbackInclude = {
    user: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
    store_price: {
        include: {
            product: true,
            store: true,
        },
    },
} as const;

/**
 * Kullanıcının bir fiyat için verdiği geri bildirimi oluşturur (veya günceller).
 *
 * NOT: Eşzamanlı çift istek yarışını önlemek için (user_id, store_price_id) çifti
 * üzerinde bir unique constraint gerekir. Migration eklendi:
 * prisma/migrations/.../migration.sql — DB'ye uygulanınca aşağıdaki upsert
 * gerçekten atomik (race-free) olur. Constraint henüz uygulanmadıysa transaction
 * yine de okuma-yazma penceresini daraltır.
 */
export const createPriceFeedback = async (data: {
    user_id: number;
    store_price_id: number;
    is_accurate: boolean;
    suggested_price?: number | null;
    comment?: string | null;
}) => {
    // store_price gerçekten var mı? (yoksa 404 — FK hatası 500'e düşmesin)
    const storePrice = await prisma.storePrice.findUnique({
        where: { id: data.store_price_id },
        select: { id: true },
    });
    if (!storePrice) {
        throw notFound('Fiyat kaydı bulunamadı');
    }

    // Tek transaction: var olanı güncelle, yoksa oluştur (yarış penceresini daraltır).
    return await prisma.$transaction(async (tx) => {
        const existing = await tx.priceFeedback.findFirst({
            where: {
                user_id: data.user_id,
                store_price_id: data.store_price_id,
            },
        });

        if (existing) {
            return await tx.priceFeedback.update({
                where: { id: existing.id },
                data: {
                    is_accurate: data.is_accurate,
                    suggested_price: data.suggested_price,
                    comment: data.comment,
                },
                include: feedbackInclude,
            });
        }

        return await tx.priceFeedback.create({
            data,
            include: feedbackInclude,
        });
    });
};

/**
 * Kullanıcının verdiği tüm feedback'leri getirir
 */
export const getUserFeedbacks = async (userId: number) => {
    return await prisma.priceFeedback.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        include: {
            store_price: {
                include: {
                    product: true,
                    store: true,
                },
            },
        },
    });
};

/**
 * Bir fiyatın tüm feedback'lerini getirir
 */
export const getPriceFeedbacks = async (storePriceId: number) => {
    return await prisma.priceFeedback.findMany({
        where: { store_price_id: storePriceId },
        orderBy: { created_at: 'desc' },
        // KULLANICI KIMLIGI DISARI VERILMEZ. Ekranda yalnizca "kac kisi dogru/
        // yanlis dedi" gosteriliyor; kimin dedigi ne gerekli ne paylasilabilir.
        // Yalnizca ISTEK SAHIBININ kendi satirini tanimasi icin user_id kaliyor.
        select: {
            id: true,
            store_price_id: true,
            is_accurate: true,
            suggested_price: true,
            comment: true,
            created_at: true,
            user_id: true,
        },
    });
};

/**
 * Feedback'i siler
 */
export const deleteFeedback = async (feedbackId: number, userId: number) => {
    const feedback = await prisma.priceFeedback.findUnique({
        where: { id: feedbackId },
    });

    if (!feedback) {
        throw notFound('Feedback bulunamadı');
    }

    if (feedback.user_id !== userId) {
        throw forbidden('Bu feedback size ait değil');
    }

    await prisma.priceFeedback.delete({
        where: { id: feedbackId },
    });
};

/**
 * Bir fiyatın doğruluk istatistiklerini hesaplar
 */
export const getPriceAccuracyStats = async (storePriceId: number) => {
    const feedbacks = await prisma.priceFeedback.findMany({
        where: { store_price_id: storePriceId },
    });

    const totalFeedbacks = feedbacks.length;
    const accurateFeedbacks = feedbacks.filter((f) => f.is_accurate).length;
    const inaccurateFeedbacks = totalFeedbacks - accurateFeedbacks;

    const suggestedPrices = feedbacks
        .filter((f) => f.suggested_price !== null)
        .map((f) => Number(f.suggested_price));

    const avgSuggestedPrice =
        suggestedPrices.length > 0
            ? suggestedPrices.reduce((sum, price) => sum + price, 0) / suggestedPrices.length
            : null;

    return {
        total_feedbacks: totalFeedbacks,
        accurate: accurateFeedbacks,
        inaccurate: inaccurateFeedbacks,
        accuracy_rate: totalFeedbacks > 0 ? (accurateFeedbacks / totalFeedbacks) * 100 : 0,
        avg_suggested_price: avgSuggestedPrice,
    };
};

