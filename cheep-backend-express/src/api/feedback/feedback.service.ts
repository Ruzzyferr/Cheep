import { prisma } from '../../utils/prisma.client.js';

/**
 * Kullanıcının bir fiyat için verdiği geri bildirimi oluşturur
 */
export const createPriceFeedback = async (data: {
    user_id: number;
    store_price_id: number;
    is_accurate: boolean;
    suggested_price?: number | null;
    comment?: string | null;
}) => {
    // Aynı kullanıcı ve store_price için birden fazla feedback olmamalı
    const existing = await prisma.priceFeedback.findFirst({
        where: {
            user_id: data.user_id,
            store_price_id: data.store_price_id,
        },
    });

    if (existing) {
        // Varsa güncelle
        return await prisma.priceFeedback.update({
            where: { id: existing.id },
            data: {
                is_accurate: data.is_accurate,
                suggested_price: data.suggested_price,
                comment: data.comment,
            },
            include: {
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
            },
        });
    }

    // Yoksa oluştur
    return await prisma.priceFeedback.create({
        data,
        include: {
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
        },
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
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                },
            },
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
        throw new Error('Feedback bulunamadı');
    }

    if (feedback.user_id !== userId) {
        throw new Error('Bu feedback size ait değil');
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
        .map((f) => f.suggested_price as number);

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

