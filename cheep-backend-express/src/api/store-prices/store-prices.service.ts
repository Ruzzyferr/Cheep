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
    category_slug?: string;
    ean_barcode?: string;
    muadil_grup_id?: string;
    country_id?: number;
    country_code?: string;
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
export const upsertStorePrice = async (data: UpsertData, countryId?: number) => {
    const { store_id, store_sku, price, unit, source, confidence_score, ...productData } = data;

    if (!store_sku) {
        throw badRequest('Import işlemi için store_sku zorunludur.');
    }

    // 1. Yeni Product Matcher'ı kullanarak ürünü bul veya oluştur.
    // req.country (x-country header'ından) her zaman öncelikli: yabancı scrape'ler
    // (CH/SE/DE/PL) payload'da country_id taşımaz, threadlenmezse yanlışlıkla TR'ye düşer.
    const { product } = await productMatcher.findOrCreateProduct({
        ...productData,
        country_id: countryId ?? productData.country_id,
    });

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
                raw_name: productData.name,
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
            raw_name: productData.name,
            source,
            confidence_score,
        },
        update: {
            product_id: product.id,
            price: newPrice,
            unit,
            raw_name: productData.name,
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
/**
 * Bayat fiyat süpürmesi — kaldırılan ürünleri/fiyatları temizler.
 * Kaynak (marketfiyati 'api' + yabancı ülke scraper'ları 'scrape') artık
 * vermeyen fiyatlar tazelenmez → last_updated_at eskir.
 * ttlDays'ten eski 'api'/'scrape' fiyatları silinir; fiyatsız kalan mf- ürünleri de silinir.
 * ttlDays, rotasyon periyodundan (fiyatlı=7g) yeterince büyük olmalı (varsayılan 21g)
 * ki geçici stok-dışı ürünler yanlışlıkla silinmesin.
 */
export const pruneStalePrices = async (countryId?: number, ttlDays: number = 21) => {
    const cutoff = new Date(Date.now() - ttlDays * 86400 * 1000);
    const priceWhere: any = { source: { in: ['api', 'scrape'] }, last_updated_at: { lt: cutoff } };
    if (countryId) priceWhere.product = { country_id: countryId };
    const delPrices = await prisma.storePrice.deleteMany({ where: priceWhere });

    const prodWhere: any = { ean_barcode: { startsWith: 'mf-' }, store_prices: { none: {} } };
    if (countryId) prodWhere.country_id = countryId;
    const delProducts = await prisma.product.deleteMany({ where: prodWhere });

    logger.info(`[StorePriceService] prune: ${delPrices.count} bayat fiyat, ${delProducts.count} öksüz ürün silindi (ttl=${ttlDays}g)`);
    return { deleted_prices: delPrices.count, deleted_products: delProducts.count, ttl_days: ttlDays };
};

export const bulkUpsertStorePrices = async (prices: UpsertData[], countryId?: number) => {
    // SIRALI işlenir (concurrent DEĞİL). Sebep: aynı chunk içinde aynı gerçek
    // ürünün iki farklı store_sku ile gelmesi mümkün (ör. Auchan aynı sütü
    // "Mleko UHT 3,2% Auchan 1l" ve "Mleko UHT 3.2%  Auchan 1 l" olarak iki
    // ayrı satırda listeler). EAN yolunun aksine (product.create P2002 ile
    // korunur, bkz. product-matcher.service.ts), fingerprint/muadil_grup_id
    // üzerinde UNIQUE constraint YOK — bu yüzden findOrCreateProduct'ın
    // "önce bul, bulamazsan oluştur" adımı yarışa açık: paralel çağrılırsa
    // ikinci çağrı birincinin henüz commit etmediği ürünü göremez ve aynı
    // fingerprint için DUPLICATE product oluşturur (pilotta doğrulandı:
    // product 20411 & 20414, ikisi de auchan-mleko-uht@1000ml%3.2, store 41).
    // Haftalık batch ingest'te (~1-2k satır/chunk) gecikme önemsiz;
    // doğruluk paralellikten daha değerli.
    const results: Array<{ success: true; data: unknown } | { success: false; error: string; data: UpsertData }> = [];
    for (let index = 0; index < prices.length; index++) {
        const priceData = prices[index];
        try {
            const data = await upsertStorePrice(priceData, countryId);
            results.push({ success: true, data });
        } catch (err) {
            const reason = err as Error;
            logger.error(`[StorePriceService] Hata: Ürün #${index + 1} (${priceData?.name}) işlenemedi. Sebep: ${reason.message}`);
            results.push({
                success: false,
                error: reason.message || 'Unknown error',
                data: priceData,
            });
        }
    }

    logger.info('[StorePriceService] Bulk upsert tamamlandı. Sonuçlar işleniyor...');
    logger.info(`[StorePriceService] İşlem özeti: Başarılı`);

    return {
        total: prices.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
    };
};

