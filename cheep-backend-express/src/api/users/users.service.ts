import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/prisma.client.js';
import { AppError, notFound, conflict, badRequest } from '../../utils/app-error.js';
import { getCountryByCode } from '../../utils/country.js';

/** Desteklenen arayüz dilleri. */
export const SUPPORTED_LANGUAGES = ['tr', 'en', 'de', 'pl', 'sv'] as const;

/**
 * Kullanıcı bilgilerini günceller (ad, ülke, dil tercihi)
 */
export const updateUser = async (
    userId: number,
    data: { name?: string; country_code?: string; language?: string }
) => {
    const patch: { name?: string; country_id?: number; language?: string } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.language !== undefined) {
        if (!SUPPORTED_LANGUAGES.includes(data.language as any)) {
            throw badRequest(`Desteklenmeyen dil: ${data.language}`);
        }
        patch.language = data.language;
    }
    if (data.country_code !== undefined) {
        patch.country_id = (await getCountryByCode(data.country_code)).id;
    }

    return await prisma.user.update({
        where: { id: userId },
        data: patch,
        select: {
            id: true,
            email: true,
            name: true,
            language: true,
            country_id: true,
            created_at: true,
            updated_at: true,
            country: { select: { code: true, currency: true } },
        },
    });
};

/**
 * Hesabı ve TÜM ilişkili verileri kalıcı olarak siler (giriş yapmış kullanıcı yolu).
 *
 * User'ın tüm alt kayıtları (listeler, favori marketler, fiyat feedback'leri,
 * sohbet thread'leri, profil, affiliate tıklamaları) şemada `onDelete: Cascade`
 * olduğundan tek `user.delete` çağrısı hepsini temizler. Refresh token'lar ayrı
 * tabloda değil (`token_version`) — satır silinince tüm oturumlar geçersiz olur.
 * KVKK/GDPR "silme hakkı" ve Google Play hesap-silme zorunluluğunu karşılar.
 */
export const deleteUser = async (userId: number) => {
    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
};

/**
 * Hesabı e-posta + şifre doğrulayarak siler (uygulamasız web formu yolu:
 * cheep.live/delete). Uygulamayı kaldırmış kullanıcıların da verilerini
 * silebilmesi için. Bilinmeyen e-posta ve yanlış şifre AYNI 401'i döner
 * (hesap sıralama/enumeration'ı önlemek için).
 */
export const deleteAccountByCredentials = async (email: string, pass: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new AppError('Geçersiz e-posta veya şifre.', 401);
    }
    const ok = await bcrypt.compare(pass, user.password_hash);
    if (!ok) {
        throw new AppError('Geçersiz e-posta veya şifre.', 401);
    }
    await prisma.user.delete({ where: { id: user.id } });
    return { success: true };
};

/**
 * Kullanıcının favori marketlerini getirir
 */
export const getFavoriteStores = async (userId: number) => {
    const favorites = await prisma.userFavoriteStore.findMany({
        where: { user_id: userId },
        include: {
            store: true,
        },
    });

    return favorites.map(f => f.store);
};

/**
 * Favori market ekler
 */
export const addFavoriteStore = async (userId: number, storeId: number) => {
    // Zaten favori mi kontrol et
    const existing = await prisma.userFavoriteStore.findUnique({
        where: {
            user_id_store_id: {
                user_id: userId,
                store_id: storeId,
            },
        },
    });

    if (existing) {
        throw conflict('Bu market zaten favorilerinizde');
    }

    await prisma.userFavoriteStore.create({
        data: {
            user_id: userId,
            store_id: storeId,
        },
    });

    return { success: true, message: 'Market favorilere eklendi' };
};

/**
 * Favori marketten çıkarır
 */
export const removeFavoriteStore = async (userId: number, storeId: number) => {
    const existing = await prisma.userFavoriteStore.findUnique({
        where: {
            user_id_store_id: {
                user_id: userId,
                store_id: storeId,
            },
        },
    });

    if (!existing) {
        throw notFound('Bu market favorilerinizde değil');
    }

    await prisma.userFavoriteStore.delete({
        where: {
            user_id_store_id: {
                user_id: userId,
                store_id: storeId,
            },
        },
    });

    return { success: true, message: 'Market favorilerden çıkarıldı' };
};

