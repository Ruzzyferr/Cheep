import { prisma } from '../../utils/prisma.client.js';

export const getAllStores = async () => {
    return await prisma.store.findMany();
};

export const getStoreById = async (id: number) => {
    return await prisma.store.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    store_prices: true,
                },
            },
        },
    });
};

export const getStoreByName = async (name: string) => {
    return await prisma.store.findFirst({
        where: { name },
    });
};

export const createStore = async (data: {
    name: string;
    logo_url?: string;
    address?: string;
    lat?: number;
    lon?: number;
}) => {
    // Aynı isimde market varsa güncelle
    const existing = await getStoreByName(data.name);
    if (existing) {
        return existing;
    }

    return await prisma.store.create({
        data,
    });
};

export const updateStore = async (
    id: number,
    data: {
        name?: string;
        logo_url?: string;
        address?: string;
        lat?: number;
        lon?: number;
    }
) => {
    return await prisma.store.update({
        where: { id },
        data,
    });
};

export const deleteStore = async (id: number) => {
    return await prisma.store.delete({
        where: { id },
    });
};