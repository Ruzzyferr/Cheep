import { prisma } from '../../utils/prisma.client.js';
import { notFound } from '../../utils/app-error.js';
import { buildStoreUrl } from '../../services/affiliate-url.js';

interface TrackArgs {
    userId: number;
    storeId: number;
    listId?: number | null;
    productId?: number | null;
    context?: string;
}

/**
 * Bir "markete git / sepeti tamamla" tıklamasını kaydeder ve açılacak URL'yi döndürür.
 * URL üretimi sunucuda (affiliate-url) yapılır; mobil yalnızca dönen URL'yi açar.
 */
export const trackClick = async ({ userId, storeId, listId, productId, context }: TrackArgs) => {
    const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, website_url: true },
    });
    if (!store) {
        throw notFound('Mağaza bulunamadı.');
    }

    let productName: string | null = null;
    if (productId) {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { name: true },
        });
        productName = product?.name ?? null;
    }

    const url = buildStoreUrl(store.name, store.website_url, productName);

    await prisma.affiliateClick.create({
        data: {
            user_id: userId,
            store_id: storeId,
            list_id: listId ?? null,
            product_id: productId ?? null,
            context: context ?? 'store',
        },
    });

    return { url, store: { id: store.id, name: store.name } };
};
