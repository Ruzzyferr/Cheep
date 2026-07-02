import { prisma } from '../../utils/prisma.client.js';
import {
    calculateSimilarity,
    jaccardSimilarity,
} from '../../utils/similarity.js';
import { getCountryIdByCode } from '../../utils/country.js';
import { extractGramaj } from '../../services/brand-independent-pricing.js';

/**
 * Product Matching Service
 * Barkod olmayan ürünleri eşleştirmek için çeşitli algoritmalar kullanır
 */

// ============================================
// 1. TEXT NORMALIZATION
// ============================================

const EXTRA_NOISE_WORDS = new Set<string>([
    'orta',
    'boy',
    'buyuk',
    'kucuk',
    'mini',
    'jumbo',
    'm',
    'l',
    'xl',
    'xxl',
    'paket',
    'koli',
    'adet',
    'cift',
    'tek',
]);

const REPLACEMENT_MAP: Record<string, string> = {
    'litre': 'l',
    'lt': 'l',
    'kilogram': 'kg',
    'gram': 'g',
    'gr': 'g',
    'mililitre': 'ml',
    'adet': '',
    'tane': '',
    've': '',
    'ile': '',
    'icin': '',
};

function baseNormalize(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/İ/g, 'i')
        .replace(/Ğ/g, 'g')
        .replace(/Ü/g, 'u')
        .replace(/Ş/g, 's')
        .replace(/Ö/g, 'o')
        .replace(/Ç/g, 'c')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function applyReplacements(text: string): string {
    let output = ` ${text} `;
    for (const [oldWord, replacement] of Object.entries(REPLACEMENT_MAP)) {
        const regex = new RegExp(`\\b${oldWord}\\b`, 'g');
        output = output.replace(regex, replacement ? ` ${replacement} ` : ' ');
    }
    return output.trim();
}

function cleanProductText(name: string, brand?: string): string {
    let text = name;

    if (brand) {
        const normalizedBrand = baseNormalize(brand);
        const normalizedName = baseNormalize(name);
        if (!normalizedName.startsWith(normalizedBrand)) {
            text = `${brand} ${name}`;
        }
    }

    text = baseNormalize(text);
    text = applyReplacements(text);

    text = text
        .replace(/\bno\s*\d+\b/g, ' ')
        .replace(/\b\d+(?:li|lı|lu|lü)\b/g, ' ')
        .replace(/\d+\s*(ml|l|lt|g|gr|kg|cl|adet|ad)\b/g, ' ')
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const words = text
        .split(' ')
        .filter(word => {
            if (!word) return false;
            if (EXTRA_NOISE_WORDS.has(word)) return false;
            if (word.length <= 2 && word !== 'su') return false;
            return true;
        });

    return words.join(' ');
}

function normalizeProductName(name: string): string {
    return cleanProductText(name);
}

export function generateProductFingerprint(data: {
    name: string;
    brand?: string;
}): string {
    const cleaned = cleanProductText(data.name, data.brand);

    // STRICT: gramaj/boyut fingerprint'e dahil edilir. cleanProductText birimleri
    // temizlediği için "Süt 1L" ve "Süt 2L" aksi halde aynı fingerprint'e düşerdi.
    // Gramaj farkı olan ürünler ASLA birleşmesin diye boyut token'ı eklenir.
    const gramaj = extractGramaj(data.name); // örn. "1000ml", "500g", "10adet" ya da null

    if (!cleaned) return gramaj ? `@${gramaj}` : '';

    const uniqueWords = Array.from(new Set(cleaned.split(' ').filter(Boolean)));
    uniqueWords.sort();

    const base = uniqueWords.join('-');
    return gramaj ? `${base}@${gramaj}` : base;
}

// Benzerlik algoritmaları artık ../../utils/similarity.ts içinde (DRY + test edilebilir).

// ============================================
// 3. PRODUCT MATCHING SERVICE
// ============================================

interface ProductMatchCandidate {
    id: number;
    name: string;
    brand?: string;
    fingerprint: string;
    similarity: number;
    matchReason: string;
}

export class ProductMatcher {
    /**
     * Ürünü database'de bulur veya yeni oluşturur
     */
    async findOrCreateProduct(data: {
        name: string;
        brand?: string;
        quantity?: number;
        unit?: string;
        category_id?: number | string | null;
        image_url?: string;
        muadil_grup_id?: string | null;
        country_id?: number;
        country_code?: string;
        ean_barcode?: string;
    }): Promise<{ product: any; isNew: boolean }> {
        // EAN-first: exact, language-neutral, cross-store. Country-scoped so the
        // same physical EAN in two countries stays two distinct products (Phase 1).
        const ean = data.ean_barcode?.trim() || undefined;
        const resolvedCountryId =
            data.country_id ?? (await getCountryIdByCode(data.country_code));
        // Payload'dan gelen kategori (marketfiyati üst-kategori id'si vb.)
        const rawCat = data.category_id != null ? Number(data.category_id) : NaN;
        const providedCategoryId = Number.isInteger(rawCat) ? rawCat : null;

        if (ean && resolvedCountryId) {
            const existingByEan = await prisma.product.findFirst({
                where: { ean_barcode: ean, country_id: resolvedCountryId },
            });
            if (existingByEan) {
                // Kategori (re-)ata: payload bir kategori sağladıysa VE mevcut ürününki
                // farklıysa güncelle. marketfiyati resmi kaynağı kategoride otoritedir;
                // bu, üst-kategoriden alt-kategoriye rafine etmeyi (ve düzeltmeyi) sağlar.
                // Kategori taşımayan kaynaklar (yabancı scraper'lar) null gönderir → dokunmaz.
                if (providedCategoryId !== null && existingByEan.category_id !== providedCategoryId) {
                    const updated = await prisma.product.update({
                        where: { id: existingByEan.id },
                        data: { category_id: providedCategoryId },
                    });
                    return { product: updated, isNew: false };
                }
                return { product: existingByEan, isNew: false };
            }
            // Bulunamadıysa oluştur — YARIŞ-GÜVENLİ. Aynı ürünün birden çok mağaza
            // fiyatı aynı ean_barcode'u taşır (ör. marketfiyati.org.tr'de bir ürün 6
            // zincirde); tek bulk-upsert chunk'ında paralel gelince "önce-bul-sonra-
            // oluştur" ikinci+ kayıtları @@unique([country_id,ean_barcode])'e çarpar.
            // Prisma.upsert atomik DEĞİLDİR (SELECT+INSERT) — bu yarışı çözmez. Doğru
            // desen: create dene, unique-ihlalinde (P2002) rakibin oluşturduğu ürünü
            // yeniden sorgula ve onu döndür.
            try {
                const created = await prisma.product.create({
                    data: {
                        name: data.name,
                        brand: data.brand,
                        country_id: resolvedCountryId,
                        ean_barcode: ean,
                        category_id: providedCategoryId,
                    },
                });
                return { product: created, isNew: true };
            } catch (err) {
                if ((err as { code?: string })?.code === 'P2002') {
                    const raced = await prisma.product.findFirst({
                        where: { ean_barcode: ean, country_id: resolvedCountryId },
                    });
                    if (raced) return { product: raced, isNew: false };
                }
                throw err;
            }
        }

        const providedMuadil = data.muadil_grup_id?.trim();
        if (providedMuadil) {
            const existingByMuadil = await this.findExactMatch(providedMuadil, resolvedCountryId);
            if (existingByMuadil) {
                if (!existingByMuadil.muadil_grup_id || existingByMuadil.muadil_grup_id !== providedMuadil) {
                    await prisma.product.update({
                        where: { id: existingByMuadil.id },
                        data: { muadil_grup_id: providedMuadil },
                    });
                    existingByMuadil.muadil_grup_id = providedMuadil;
                }
                return { product: existingByMuadil, isNew: false };
            }
        }

        const generatedFingerprint = generateProductFingerprint({
            name: data.name,
            brand: data.brand,
        });

        const fingerprint = providedMuadil || generatedFingerprint;

        let exactMatch = fingerprint ? await this.findExactMatch(fingerprint, resolvedCountryId) : null;
        if (!exactMatch && generatedFingerprint && generatedFingerprint !== fingerprint) {
            exactMatch = await this.findExactMatch(generatedFingerprint, resolvedCountryId);
        }

        if (exactMatch) {
            if (!exactMatch.muadil_grup_id || exactMatch.muadil_grup_id !== fingerprint) {
                await prisma.product.update({
                    where: { id: exactMatch.id },
                    data: { muadil_grup_id: fingerprint },
                });
                exactMatch.muadil_grup_id = fingerprint;
            }
            return { product: exactMatch, isNew: false };
        }

        const candidates = await this.findSimilarProducts(data, resolvedCountryId);
        // STRICT: gramajı eşleşmeyen aday ASLA otomatik birleşmez (0.85 fuzzy dahil).
        const incomingGramaj = extractGramaj(data.name);
        const bestMatch = candidates.find(
            c => c.similarity >= 0.85 && extractGramaj(c.name) === incomingGramaj
        );
        if (bestMatch) {
            const product = await prisma.product.findUnique({
                where: { id: bestMatch.id },
            });
            if (product && (!product.muadil_grup_id || product.muadil_grup_id !== fingerprint)) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { muadil_grup_id: fingerprint },
                });
                product.muadil_grup_id = fingerprint;
            }
            return { product, isNew: false };
        }

        let categoryId: number | null = null;
        if (data.category_id) {
            const parsed = typeof data.category_id === 'string'
                ? parseInt(data.category_id, 10)
                : data.category_id;
            categoryId = isNaN(parsed) ? null : parsed;
        }

        const muadilToPersist = fingerprint || generatedFingerprint || providedMuadil || '';
        const countryId = resolvedCountryId;

        const newProduct = await prisma.product.create({
            data: {
                name: data.name,
                brand: data.brand,
                category_id: categoryId,
                country_id: countryId,
                image_url: data.image_url,
                ean_barcode: ean,
                muadil_grup_id: muadilToPersist && muadilToPersist.length > 0 ? muadilToPersist : undefined,
            },
        });

        return { product: newProduct, isNew: true };
    }

    /**
     * Exact match (fingerprint'e göre)
     */
    private async findExactMatch(fingerprint: string, countryId?: number) {
        return await prisma.product.findFirst({
            where: {
                muadil_grup_id: fingerprint,
                ...(typeof countryId === 'number' ? { country_id: countryId } : {}),
            },
        });
    }

    /**
     * Benzer ürünleri bulur (fuzzy matching)
     */
    private async findSimilarProducts(data: {
        name: string;
        brand?: string;
    }, countryId?: number): Promise<ProductMatchCandidate[]> {
        const fingerprint = generateProductFingerprint({
            name: data.name,
            brand: data.brand,
        });

        const normalizedName = cleanProductText(data.name);

        const orFilters: any[] = [];

        if (data.brand) {
            orFilters.push({
                brand: {
                    contains: data.brand,
                    mode: 'insensitive',
                },
            });
        }

        if (fingerprint) {
            const firstToken = fingerprint.split('-')[0];
            if (firstToken) {
                orFilters.push({
                    muadil_grup_id: {
                        contains: firstToken,
                        mode: 'insensitive',
                    },
                });
            }
        }

        const candidates = await prisma.product.findMany({
            where: {
                ...(typeof countryId === 'number' ? { country_id: countryId } : {}),
                ...(orFilters.length > 0 ? { OR: orFilters } : {}),
            },
            take: 50,
        });

        // Her aday için similarity hesapla
        const matches: ProductMatchCandidate[] = candidates.map(product => {
            const candidateFingerprint = generateProductFingerprint({
                name: product.name,
                brand: product.brand || undefined,
            });

            // Farklı similarity metriklerini birleştir
            const levenshteinSim = calculateSimilarity(fingerprint, candidateFingerprint);
            const jaccardSim = jaccardSimilarity(
                normalizedName,
                cleanProductText(product.name),
            );

            // Ağırlıklı ortalama
            const similarity = (levenshteinSim * 0.6) + (jaccardSim * 0.4);

            let matchReason = 'fuzzy';
            if (similarity > 0.95) matchReason = 'near-exact';
            if (similarity > 0.85) matchReason = 'high-confidence';

            return {
                id: product.id,
                name: product.name,
                brand: product.brand || undefined,
                fingerprint: candidateFingerprint,
                similarity,
                matchReason,
            };
        });

        // Similarity'ye göre sırala
        return matches
            .filter(m => m.similarity >= 0.70) // Minimum threshold
            .sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Manuel olarak ürünleri birleştir
     */
    async mergeProducts(sourceProductId: number, targetProductId: number) {
        // Çoklu yazma + delete atomik olmalı: yarıda kalırsa veri tutarsız kalır.
        await prisma.$transaction(async (tx) => {
            // Source product'ın tüm fiyatlarını target'a taşı
            await tx.storePrice.updateMany({
                where: { product_id: sourceProductId },
                data: { product_id: targetProductId },
            });

            // Source product'ın list item'larını target'a taşı
            await tx.listItem.updateMany({
                where: { product_id: sourceProductId },
                data: { product_id: targetProductId },
            });

            // Source product'ı sil
            await tx.product.delete({
                where: { id: sourceProductId },
            });
        });

        return { success: true };
    }

    /**
     * Tüm ürünler için fingerprint oluştur (migration)
     */
    async generateFingerprintsForAll() {
        const products = await prisma.product.findMany();

        for (const product of products) {
            if (!product.muadil_grup_id) {
                const fingerprint = generateProductFingerprint({
                    name: product.name,
                    brand: product.brand || undefined,
                });

                await prisma.product.update({
                    where: { id: product.id },
                    data: { muadil_grup_id: fingerprint },
                });
            }
        }

        return { processed: products.length };
    }

    /**
     * Debug: Benzer ürünleri göster
     */
    async debugSimilarProducts(name: string, brand?: string) {
        const candidates = await this.findSimilarProducts({ name, brand });

        return candidates.map(c => ({
            id: c.id,
            name: c.name,
            brand: c.brand,
            similarity: (c.similarity * 100).toFixed(2) + '%',
            matchReason: c.matchReason,
        }));
    }
}

// Export
export const productMatcher = new ProductMatcher();

