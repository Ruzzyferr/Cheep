import { prisma } from '../../utils/prisma.client.js';
import { getCountryIdByCode } from '../../utils/country.js';

export const getAllStores = async (countryId?: number) => {
    return await prisma.store.findMany({
        where: countryId ? { country_id: countryId } : undefined,
    });
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
    city?: string;
    lat?: number;
    lon?: number;
    country_id?: number;
    country_code?: string;
}) => {
    // Aynı isimde market varsa güncelle
    const existing = await getStoreByName(data.name);
    if (existing) {
        return existing;
    }

    const { country_code, country_id, ...rest } = data;
    const resolvedCountryId = country_id ?? (await getCountryIdByCode(country_code));

    return await prisma.store.create({
        data: { ...rest, country_id: resolvedCountryId },
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