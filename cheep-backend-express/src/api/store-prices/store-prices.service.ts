import logger from '../../utils/logger.js';
import { prisma } from '../../utils/prisma.client.js';
import { Decimal } from '@prisma/client/runtime/library';
import {productMatcher} from "../products/product-matcher.service.js";
import { badRequest } from '../../utils/app-error.js';

// ++ YENİ: Ürün ve fiyat bilgilerini bir arada içeren tip tanımı
interface UpsertData {
    store_id: number; // Integer olarak bekle
    store_sku?: string;
    price: number | string;
    unit?: string;
    source?: string;
    confidence_score?: number;

    // Ürün bilgileri
    name: string;
    brand?: string;
    image_url?: string;
    category_id?: number | string | null; // Hem string hem number kabul et
    ean_barcode?: string;
    muadil_grup_id?: string;
}

/**
 * Fiyat geçmişine bir kayıt ekler. Sadece fiyat gerçekten değiştiğinde (veya ilk
 * kez kaydedildiğinde) çağrılmalıdır; böylece zaman serisi tablosu şişmez.
 */
const recordPriceHistory = async (
    storeId: number,
    productId: number,
    price: Decimal
): Promise<void> => {
    try {
        await prisma.priceHistory.create({
            data: { store_id: storeId, product_id: productId, price },
        });
    } catch (err) {
        // Geçmiş kaydı kritik değil; ana akışı bozmadan logla.
        logger.warn(`[PriceHistory] Kayıt eklenemedi (product ${productId}): ${(err as Error).message}`);
    }
};

// ++ GÜNCELLENMİŞ FONKSİYON: Artık hem ürünü hem fiyatı yönetiyor
export const upsertStorePrice = async (data: UpsertData) => {
    const { store_id, store_sku, price, unit, source, confidence_score, ...productData } = data;

    if (!store_sku) {
        throw badRequest('Import işlemi için store_sku zorunludur.');
    }

    // 1. Yeni Product Matcher'ı kullanarak ürünü bul veya oluştur.
    const { product } = await productMatcher.findOrCreateProduct(productData);

    const numericStoreId = Number(store_id);
    const newPrice = new Decimal(price);

    const existingByProduct = await prisma.storePrice.findUnique({
        where: {
            store_id_product_id: {
                store_id: numericStoreId,
                product_id: product.id,
            },
        },
    });

    if (existingByProduct) {
        const priceChanged = !existingByProduct.price.equals(newPrice);
        const updated = await prisma.storePrice.update({
            where: { id: existingByProduct.id },
            data: {
                store_sku,
                price: newPrice,
                unit,
                last_updated_at: new Date(),
            },
        });
        if (priceChanged) {
            await recordPriceHistory(numericStoreId, product.id, newPrice);
        }
        return updated;
    }

    // Bu ürün için bu markette henüz fiyat yok → store_sku ile upsert et.
    const existingBySku = await prisma.storePrice.findUnique({
        where: { store_id_store_sku: { store_id: numericStoreId, store_sku } },
    });

    const result = await prisma.storePrice.upsert({
        where: {
            store_id_store_sku: {
                store_id: numericStoreId,
                store_sku,
            },
        },
        create: {
            store_id: numericStoreId,
            product_id: product.id,
            store_sku,
            price: newPrice,
            unit,
            source,
            confidence_score,
        },
        update: {
            product_id: product.id,
            price: newPrice,
            unit,
            last_updated_at: new Date(),
        },
    });

    // Yeni kayıt veya fiyat değişimi ise geçmişe yaz.
    if (!existingBySku || !existingBySku.price.equals(newPrice)) {
        await recordPriceHistory(numericStoreId, product.id, newPrice);
    }

    return result;
};

// ++ PERFORMANS İYİLEŞTİRMESİ YAPILAN FONKSİYON ++
export const bulkUpsertStorePrices = async (prices: UpsertData[]) => {
    const upsertPromises = prices.map(priceData => upsertStorePrice(priceData));
    const outcomes = await Promise.allSettled(upsertPromises);

    logger.info('[StorePriceService] Bulk upsert tamamlandı. Sonuçlar işleniyor...');

    // ... (geri kalan hata yönetimi kısmı aynı kalabilir)
    const results = outcomes.map((outcome, index) => {
        if (outcome.status === 'fulfilled') {
            return { success: true, data: outcome.value };
        }

        const reason = outcome.reason as Error;
        logger.error(`[StorePriceService] Hata: Ürün #${index + 1} (${prices[index]?.name}) işlenemedi. Sebep: ${reason.message}`);

        return {
            success: false,
            error: reason.message || 'Unknown error',
            data: prices[index]
        };
    });

    logger.info(`[StorePriceService] İşlem özeti: Başarılı`);

    return {
        total: prices.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
    };
};

