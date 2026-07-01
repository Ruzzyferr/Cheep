import { prisma } from '../../utils/prisma.client.js';
import { notFound, conflict, badRequest } from '../../utils/app-error.js';
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

