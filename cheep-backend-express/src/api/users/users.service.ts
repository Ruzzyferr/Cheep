import { prisma } from '../../utils/prisma.client.js';

/**
 * Kullanıcı bilgilerini günceller
 */
export const updateUser = async (
    userId: number,
    data: { name?: string }
) => {
    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            name: data.name,
        },
        select: {
            id: true,
            email: true,
            name: true,
            created_at: true,
            updated_at: true,
        },
    });

    return user;
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
        throw new Error('Bu market zaten favorilerinizde');
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
        throw new Error('Bu market favorilerinizde değil');
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

