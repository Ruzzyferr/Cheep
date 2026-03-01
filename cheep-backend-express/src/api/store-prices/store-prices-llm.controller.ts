/**
 * 🤖 LLM-based Store Price Import Controller
 * Market bazlı gruplama ile optimize edilmiş import
 */

import { type Request, type Response, type NextFunction } from 'express';
import { llmProductMatcher } from '../../services/llm-product-matcher.service.js';
import { prisma } from '../../utils/prisma.client.js';
import logger from '../../utils/logger.js';
import { Decimal } from '@prisma/client/runtime/library';
import { productMatcher } from '../products/product-matcher.service.js';

interface RawProductInput {
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

/**
 * LLM ile ürün import et
 * Market bazlı gruplama ile optimize edilmiş
 */
export const importWithLLM = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { products, use_llm = true } = req.body as {
            products: RawProductInput[];
            use_llm?: boolean;
        };

        if (!Array.isArray(products) || products.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Ürün listesi boş veya geçersiz',
            });
            return;
        }

        logger.info(`[LLMImport] ${products.length} ürün import ediliyor (LLM: ${use_llm})`);

        let processedProducts;

        if (use_llm) {
            // LLM ile işle
            processedProducts = await llmProductMatcher.processMarketGroups(products);
            logger.info(`[LLMImport] LLM işleme tamamlandı: ${processedProducts.length} ürün`);
        } else {
            // Fallback: Mevcut matcher kullan
            processedProducts = await processWithFallback(products);
        }

        // Database'e kaydet
        const results = await saveProcessedProducts(processedProducts);

        res.status(200).json({
            success: true,
            data: {
                total: products.length,
                processed: processedProducts.length,
                saved: results.successful,
                failed: results.failed,
                stats: {
                    new_products: results.newProducts,
                    matched_products: results.matchedProducts,
                    updated_prices: results.updatedPrices,
                },
            },
            message: `✅ ${results.successful} ürün başarıyla import edildi`,
        });
    } catch (error: any) {
        logger.error(`[LLMImport] Hata: ${error.message}`);
        next(error);
    }
};

/**
 * Fallback: Mevcut product matcher kullan
 */
async function processWithFallback(products: RawProductInput[]) {
    return llmProductMatcher.fallbackProcess(products);
}

/**
 * İşlenmiş ürünleri database'e kaydet
 */
async function saveProcessedProducts(processedProducts: any[]) {
    const stats = {
        successful: 0,
        failed: 0,
        newProducts: 0,
        matchedProducts: 0,
        updatedPrices: 0,
    };

    for (const processed of processedProducts) {
        try {
            // 1. Ürünü bul veya oluştur
            let product;
            
            if (processed.matched_product_id) {
                // Mevcut ürünle eşleşti
                product = await prisma.product.findUnique({
                    where: { id: processed.matched_product_id },
                });
                stats.matchedProducts++;
            } else {
                // Yeni ürün oluştur
                // category_id zaten LLM service'de set edilmiş olmalı
                let categoryId = processed.category_id;
                
                // Eğer yoksa database'den bul
                if (!categoryId && processed.category) {
                    categoryId = await getCategoryIdByName(processed.category, processed.subcategory);
                }
                
                // Hala bulunamadıysa null bırak (kategori olmadan kaydet)
                if (!categoryId) {
                    logger.warn(`[LLMImport] Kategori bulunamadı: "${processed.category}" - kategori olmadan kaydediliyor`);
                }

                product = await prisma.product.create({
                    data: {
                        name: processed.normalized_name,
                        brand: processed.normalized_brand,
                        category_id: categoryId,
                        image_url: processed.prices[0]?.image_url,
                        muadil_grup_id: processed.muadil_grup_id || 
                            generateMuadilGrupId(processed.normalized_name, processed.normalized_brand),
                    },
                });
                stats.newProducts++;
            }

            // 2. Her market için fiyat kaydet
            for (const priceData of processed.prices) {
                await prisma.storePrice.upsert({
                    where: {
                        store_id_store_sku: {
                            store_id: priceData.store_id,
                            store_sku: priceData.store_sku,
                        },
                    },
                    create: {
                        store_id: priceData.store_id,
                        product_id: product.id,
                        store_sku: priceData.store_sku,
                        price: new Decimal(priceData.price),
                        unit: priceData.unit,
                        source: 'llm_import',
                        confidence_score: processed.confidence,
                    },
                    update: {
                        product_id: product.id,
                        price: new Decimal(priceData.price),
                        unit: priceData.unit,
                        last_updated_at: new Date(),
                    },
                });
                stats.updatedPrices++;
            }

            stats.successful++;
        } catch (error: any) {
            logger.error(`[LLMImport] Ürün kaydetme hatası: ${error.message}`);
            stats.failed++;
        }
    }

    return stats;
}

/**
 * Kategori adından ID bul
 */
async function getCategoryIdByName(categoryName: string, subcategoryName?: string): Promise<number | null> {
    try {
        // Önce alt kategoriyi ara (eğer verilmişse)
        if (subcategoryName && subcategoryName.trim()) {
            // Önce parent kategoriyi bul
            const parentCategory = await prisma.category.findFirst({
                where: {
                    name: { equals: categoryName, mode: 'insensitive' },
                    parent_id: null,
                },
            });

            if (parentCategory) {
                // Alt kategoriyi parent'a göre ara
                const subcategory = await prisma.category.findFirst({
                    where: {
                        name: { equals: subcategoryName.trim(), mode: 'insensitive' },
                        parent_id: parentCategory.id,
                    },
                });
                
                if (subcategory) {
                    logger.info(`[LLMImport] Alt kategori bulundu: ${subcategoryName} (ID: ${subcategory.id})`);
                    return subcategory.id;
                }
            }
        }

        // Alt kategori bulunamadıysa veya verilmemişse, ana kategoriyi kullan
        const category = await prisma.category.findFirst({
            where: {
                name: { equals: categoryName, mode: 'insensitive' },
                parent_id: null,
            },
        });

        if (category) {
            logger.info(`[LLMImport] Ana kategori bulundu: ${categoryName} (ID: ${category.id})`);
            return category.id;
        }

        logger.warn(`[LLMImport] Kategori bulunamadı: ${categoryName}`);
        return null;
    } catch (error: any) {
        logger.error(`[LLMImport] Kategori ID bulma hatası: ${error.message}`);
        return null;
    }
}

/**
 * Muadil grup ID oluştur
 */
function generateMuadilGrupId(name: string, brand?: string): string {
    const parts: string[] = [];
    if (brand) {
        parts.push(brand.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    parts.push(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return parts.join('-');
}

