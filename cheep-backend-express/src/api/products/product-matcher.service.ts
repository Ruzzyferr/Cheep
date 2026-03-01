import { prisma } from '../../utils/prisma.client.js';

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

function generateProductFingerprint(data: {
    name: string;
    brand?: string;
}): string {
    const cleaned = cleanProductText(data.name, data.brand);
    if (!cleaned) return '';

    const uniqueWords = Array.from(new Set(cleaned.split(' ').filter(Boolean)));
    uniqueWords.sort();

    return uniqueWords.join('-');
}

// ============================================
// 2. SIMILARITY ALGORITHMS
// ============================================

/**
 * Levenshtein Distance (Edit Distance)
 * İki string arasındaki karakter farkını hesaplar
 */
function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Similarity Score (0-1 arası)
 * 1 = tamamen aynı
 * 0 = tamamen farklı
 */
function calculateSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
}

/**
 * Jaccard Similarity (kelime bazlı)
 * İki metin arasındaki ortak kelimelere bakar
 */
function jaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(' '));
    const set2 = new Set(str2.split(' '));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
}

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
    }): Promise<{ product: any; isNew: boolean }> {
        const providedMuadil = data.muadil_grup_id?.trim();
        if (providedMuadil) {
            const existingByMuadil = await this.findExactMatch(providedMuadil);
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

        let exactMatch = fingerprint ? await this.findExactMatch(fingerprint) : null;
        if (!exactMatch && generatedFingerprint && generatedFingerprint !== fingerprint) {
            exactMatch = await this.findExactMatch(generatedFingerprint);
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

        const candidates = await this.findSimilarProducts(data);
        const bestMatch = candidates.find(c => c.similarity >= 0.85);
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

        const newProduct = await prisma.product.create({
            data: {
                name: data.name,
                brand: data.brand,
                category_id: categoryId,
                image_url: data.image_url,
                muadil_grup_id: muadilToPersist && muadilToPersist.length > 0 ? muadilToPersist : undefined,
            },
        });

        return { product: newProduct, isNew: true };
    }

    /**
     * Exact match (fingerprint'e göre)
     */
    private async findExactMatch(fingerprint: string) {
        return await prisma.product.findFirst({
            where: {
                muadil_grup_id: fingerprint,
            },
        });
    }

    /**
     * Benzer ürünleri bulur (fuzzy matching)
     */
    private async findSimilarProducts(data: {
        name: string;
        brand?: string;
    }): Promise<ProductMatchCandidate[]> {
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
            where: orFilters.length > 0 ? { OR: orFilters } : {},
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
        // Source product'ın tüm fiyatlarını target'a taşı
        await prisma.storePrice.updateMany({
            where: { product_id: sourceProductId },
            data: { product_id: targetProductId },
        });

        // Source product'ın list item'larını target'a taşı
        await prisma.listItem.updateMany({
            where: { product_id: sourceProductId },
            data: { product_id: targetProductId },
        });

        // Source product'ı sil
        await prisma.product.delete({
            where: { id: sourceProductId },
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

