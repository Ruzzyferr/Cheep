import logger from '../../utils/logger.js';
import { prisma } from '../../utils/prisma.client.js';
import { Decimal } from '@prisma/client/runtime/library';
import {productMatcher} from "../products/product-matcher.service.js";

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

// ++ GÜNCELLENMİŞ FONKSİYON: Artık hem ürünü hem fiyatı yönetiyor
export const upsertStorePrice = async (data: UpsertData) => {
    const { store_id, store_sku, price, unit, source, confidence_score, ...productData } = data;

    if (!store_sku) {
        throw new Error('Import işlemi için store_sku zorunludur.');
    }

    // 1. Yeni Product Matcher'ı kullanarak ürünü bul veya oluştur.
    const { product } = await productMatcher.findOrCreateProduct(productData);

    const numericStoreId = Number(store_id);

    const existingByProduct = await prisma.storePrice.findUnique({
        where: {
            store_id_product_id: {
                store_id: numericStoreId,
                product_id: product.id,
            },
        },
    });

    if (existingByProduct) {
        return prisma.storePrice.update({
            where: {
                id: existingByProduct.id,
            },
            data: {
                store_sku,
                price: new Decimal(price),
                unit,
                last_updated_at: new Date(),
            },
        });
    }

    return prisma.storePrice.upsert({
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
            price: new Decimal(price),
            unit,
            source,
            confidence_score,
        },
        update: {
            product_id: product.id,
            price: new Decimal(price),
            unit,
            last_updated_at: new Date(),
        },
    });
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

