/**
 * 🧩 Ingest Service
 * LLM tabanlı ürün import çekirdeği. Hem HTTP controller (import-with-llm) hem de
 * Kafka ingest consumer bu servisi çağırır (DRY).
 */

import { llmProductMatcher } from './llm-product-matcher.service.js';
import { prisma } from '../utils/prisma.client.js';
import logger from '../utils/logger.js';
import { Decimal } from '@prisma/client/runtime/library';
import { getCountryByCode } from '../utils/country.js';

export interface RawProductInput {
    name: string;
    brand?: string;
    image_url?: string;
    store_id: number;
    store_name?: string;
    store_sku: string;
    price: number;
    unit?: string;
    raw_category?: string;
}

export interface IngestResult {
    total: number;
    processed: number;
    saved: number;
    failed: number;
    stats: {
        new_products: number;
        matched_products: number;
        updated_prices: number;
    };
}

/**
 * Ham ürünleri normalize/eşleştir (LLM veya fallback) ve veritabanına kaydet.
 */
export async function processRawProducts(
    products: RawProductInput[],
    useLlm = true,
    countryCode?: string
): Promise<IngestResult> {
    logger.info(`[Ingest] ${products.length} ürün işleniyor (LLM: ${useLlm})`);

    const country = await getCountryByCode(countryCode);

    const processedProducts = useLlm
        ? await llmProductMatcher.processMarketGroups(products, country.currency)
        : await llmProductMatcher.fallbackProcess(products);

    logger.info(`[Ingest] İşleme tamamlandı: ${processedProducts.length} ürün`);

    const results = await saveProcessedProducts(processedProducts, country.id);

    return {
        total: products.length,
        processed: processedProducts.length,
        saved: results.successful,
        failed: results.failed,
        stats: {
            new_products: results.newProducts,
            matched_products: results.matchedProducts,
            updated_prices: results.updatedPrices,
        },
    };
}

async function saveProcessedProducts(processedProducts: any[], countryId: number) {
    const stats = {
        successful: 0,
        failed: 0,
        newProducts: 0,
        matchedProducts: 0,
        updatedPrices: 0,
    };
    const errorSamples: string[] = [];

    for (const processed of processedProducts) {
        try {
            let product;

            if (processed.matched_product_id) {
                product = await prisma.product.findUnique({
                    where: { id: processed.matched_product_id },
                });
                stats.matchedProducts++;
            } else {
                let categoryId = processed.category_id;
                if (!categoryId && processed.category) {
                    categoryId = await getCategoryIdByName(processed.category, processed.subcategory);
                }
                if (!categoryId) {
                    logger.warn(`[Ingest] Kategori bulunamadı: "${processed.category}" - kategori olmadan kaydediliyor`);
                }

                product = await prisma.product.create({
                    data: {
                        name: processed.normalized_name,
                        brand: processed.normalized_brand,
                        category_id: categoryId,
                        country_id: countryId,
                        image_url: processed.prices[0]?.image_url,
                        muadil_grup_id:
                            processed.muadil_grup_id ||
                            generateMuadilGrupId(processed.normalized_name, processed.normalized_brand),
                    },
                });
                stats.newProducts++;
            }

            if (!product) {
                logger.warn(`[Ingest] Ürün bulunamadı (matched_product_id: ${processed.matched_product_id}) - atlanıyor`);
                stats.failed++;
                continue;
            }

            for (const priceData of processed.prices) {
                const hasSku =
                    priceData.store_sku !== null &&
                    priceData.store_sku !== undefined &&
                    String(priceData.store_sku).length > 0;

                const create = {
                    store_id: priceData.store_id,
                    product_id: product.id,
                    store_sku: hasSku ? priceData.store_sku : null,
                    price: new Decimal(priceData.price),
                    unit: priceData.unit,
                    source: 'llm_import',
                    confidence_score: processed.confidence,
                };
                const update = {
                    product_id: product.id,
                    price: new Decimal(priceData.price),
                    unit: priceData.unit,
                    last_updated_at: new Date(),
                };

                // store_sku NULL ise Postgres'te NULL'lar distinct → store_id_store_sku
                // upsert her seferinde INSERT dener ve @@unique([store_id, product_id])
                // kısıtını ihlal eder. Bu durumda store_id_product_id key'i üzerinden upsert et.
                if (hasSku) {
                    await prisma.storePrice.upsert({
                        where: {
                            store_id_store_sku: {
                                store_id: priceData.store_id,
                                store_sku: priceData.store_sku,
                            },
                        },
                        create,
                        update: { ...update, store_sku: priceData.store_sku },
                    });
                } else {
                    await prisma.storePrice.upsert({
                        where: {
                            store_id_product_id: {
                                store_id: priceData.store_id,
                                product_id: product.id,
                            },
                        },
                        create,
                        update,
                    });
                }
                stats.updatedPrices++;
            }

            stats.successful++;
        } catch (error: any) {
            logger.error(`[Ingest] Ürün kaydetme hatası: ${error.message}`);
            if (errorSamples.length < 3) errorSamples.push(error.message);
            stats.failed++;
        }
    }

    // Sistematik hataları sessizce yutma: özet + örnek hata yüzeye çıkarılır.
    if (stats.failed > 0) {
        logger.error(
            `[Ingest] ${stats.failed}/${processedProducts.length} kayıt başarısız. Örnek hatalar: ${errorSamples.join(' | ')}`
        );
    }

    return stats;
}

async function getCategoryIdByName(categoryName: string, subcategoryName?: string): Promise<number | null> {
    try {
        if (subcategoryName && subcategoryName.trim()) {
            const parentCategory = await prisma.category.findFirst({
                where: { name: { equals: categoryName, mode: 'insensitive' }, parent_id: null },
            });
            if (parentCategory) {
                const subcategory = await prisma.category.findFirst({
                    where: {
                        name: { equals: subcategoryName.trim(), mode: 'insensitive' },
                        parent_id: parentCategory.id,
                    },
                });
                if (subcategory) return subcategory.id;
            }
        }

        const category = await prisma.category.findFirst({
            where: { name: { equals: categoryName, mode: 'insensitive' }, parent_id: null },
        });
        return category ? category.id : null;
    } catch (error: any) {
        logger.error(`[Ingest] Kategori ID bulma hatası: ${error.message}`);
        return null;
    }
}

function generateMuadilGrupId(name: string, brand?: string): string {
    const parts: string[] = [];
    if (brand) parts.push(brand.toLowerCase().replace(/[^a-z0-9]/g, ''));
    parts.push(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return parts.join('-');
}
