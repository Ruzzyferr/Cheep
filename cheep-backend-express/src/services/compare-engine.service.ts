import { prisma } from '../utils/prisma.client.js';
import * as RouteOptimizer from './route-optimizer.service.js';
import { resolveItemStoreOptions, PricedProduct, StoreOption } from './brand-independent-pricing.js';
import { notFound } from '../utils/app-error.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CompareOptions {
    maxStores?: number;              // Maksimum market sayısı (default: 3)
    userLocation?: {                 // Kullanıcı konumu (mesafe hesabı için)
        lat: number;
        lon: number;
    };
    favoriteStoreIds?: number[];     // Favori market ID'leri
    includeMissingProducts?: boolean; // Eksik ürünleri göster (default: true)
    countryId?: number;              // Ülke scoping — sadece bu ülkedeki marketler
}

interface ProductInList {
    id: number;
    product_id: number;
    quantity: number;
    unit: string;
    brand_independent: boolean;
    product: {
        id: number;
        name: string;
        brand: string | null;
        image_url: string | null;
        category_id: number | null;
        muadil_grup_id: string | null;
        store_prices: Array<{
            id: number;
            store_id: number;
            price: any; // Decimal
            unit: string;
            store: {
                id: number;
                name: string;
                country_id: number;
                lat: number | null;
                lon: number | null;
            };
        }>;
    };
}

/**
 * Liste öğelerindeki store_prices'ı yalnızca verilen ülkedeki marketlere indirger.
 * countryId verilmezse dokunmaz (geriye dönük uyum).
 */
export function filterStorePricesByCountry<T extends { product: { store_prices: Array<{ store: { country_id: number } }> } }>(
    listItems: T[],
    countryId: number | undefined
): T[] {
    if (!countryId) return listItems;
    // Not: girdiyi mutasyona uğratmadan (pure) yeni bir liste döner —
    // aksi halde çağıranın elindeki orijinal referans da süzülmüş olurdu.
    return listItems.map(item => ({
        ...item,
        product: {
            ...item.product,
            store_prices: item.product.store_prices.filter(
                sp => sp.store.country_id === countryId
            ),
        },
    }));
}

interface StoreAllocation {
    store: {
        id: number;
        name: string;
        lat: number | null;
        lon: number | null;
    };
    products: Array<{
        listItemId: number;
        product: {
            id: number;
            name: string;
            brand: string | null;
            image_url: string | null;
        };
        quantity: number;
        unit: string;
        pricePerUnit: number;
        totalPrice: number;
    }>;
    subtotal: number;
}

interface RouteStrategy {
    type: 'single_store' | 'multi_store';
    stores: StoreAllocation[];
    totalPrice: number;
    totalDistance: number;
    estimatedDuration: number;
    missingProducts: Array<{
        listItemId: number;
        product: { id: number; name: string; brand: string | null };
        quantity: number;
        unit: string;
    }>;
    coveragePercentage: number;
    budgetStatus: 'within_budget' | 'over_budget' | 'unknown';
    budgetRemaining: number | null;
    hasFavoriteStores: boolean;
    favoriteStoreCount: number;
    score: number; // Sıralama için hesaplanan skor
}

interface CompareResult {
    listId: number;
    listName: string;
    totalItems: number;
    budget: number | null;
    strategies: RouteStrategy[];
    alternatives: Array<{
        originalProduct: { id: number; name: string; brand: string | null };
        alternativeProduct: { id: number; name: string; brand: string | null };
        originalPrice: number;
        alternativePrice: number;
        savings: number;
        store: { id: number; name: string };
    }>;
    summary: {
        bestSingleStore: RouteStrategy | null;
        bestMultiStore: RouteStrategy | null;
        cheapestOption: RouteStrategy | null;
        closestOption: RouteStrategy | null;
        maxSavings: number;
    };
}

// ============================================
// MAIN COMPARE ENGINE
// ============================================

export async function compareShoppingList(
    listId: number,
    userId: number,
    options: CompareOptions = {}
): Promise<CompareResult> {
    // Defaults — maxStores'u [1,5] aralığına sınırla (kombinatorik patlamayı önle)
    const maxStores = Math.min(Math.max(options.maxStores || 3, 1), 5);
    const includeMissing = options.includeMissingProducts !== false;

    // 1. Liste ve ürünleri getir
    const list = await prisma.list.findFirst({
        where: {
            id: listId,
            user_id: userId,
        },
        include: {
            list_items: {
                include: {
                    product: {
                        include: {
                            store_prices: {
                                include: {
                                    store: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!list) {
        throw notFound('Liste bulunamadı veya erişim yetkiniz yok');
    }

    const listItems = filterStorePricesByCountry(
        list.list_items as unknown as ProductInList[],
        options.countryId
    );

    // Marka-bağımsız öğeler için muadil grup ürünlerini çek (tek sorgu)
    const muadilIds = Array.from(new Set(
        listItems
            .filter(i => i.brand_independent && i.product.muadil_grup_id)
            .map(i => i.product.muadil_grup_id as string)
    ));
    const siblingsByGroup = new Map<string, PricedProduct[]>();
    if (muadilIds.length > 0) {
        const siblings = await prisma.product.findMany({
            where: {
                muadil_grup_id: { in: muadilIds },
                ...(options.countryId ? { country_id: options.countryId } : {}),
            },
            include: { store_prices: { include: { store: true } } },
        });
        for (const s of siblings) {
            const gid = s.muadil_grup_id as string;
            const arr = siblingsByGroup.get(gid) || [];
            arr.push({
                id: s.id, name: s.name, brand: s.brand, image_url: s.image_url,
                store_prices: (s as any).store_prices.map((sp: any) => ({
                    store_id: sp.store_id, price: Number(sp.price), store: sp.store,
                })),
            });
            siblingsByGroup.set(gid, arr);
        }
    }

    // Her liste öğesi için market→seçenek haritası
    const itemOptions = new Map<number, Map<number, StoreOption>>();
    for (const item of listItems) {
        const representative: PricedProduct = {
            id: item.product.id, name: item.product.name, brand: item.product.brand,
            image_url: item.product.image_url,
            store_prices: item.product.store_prices.map(sp => ({
                store_id: sp.store_id, price: Number(sp.price), store: sp.store,
            })),
        };
        const siblings = item.brand_independent && item.product.muadil_grup_id
            ? (siblingsByGroup.get(item.product.muadil_grup_id) || []).filter(s => s.id !== item.product.id)
            : [];
        itemOptions.set(item.id, resolveItemStoreOptions(representative, item.brand_independent, siblings));
    }

    // 2. Tüm stratejileri hesapla
    const strategies: RouteStrategy[] = [];

    // 2.1. Single Store Strategies
    const singleStoreStrategies = await calculateSingleStoreStrategies(
        listItems,
        list.budget,
        options,
        itemOptions
    );
    strategies.push(...singleStoreStrategies);

    // 2.2. Multi Store Strategies
    if (maxStores > 1) {
        const multiStoreStrategies = await calculateMultiStoreStrategies(
            listItems,
            list.budget,
            maxStores,
            options,
            itemOptions
        );
        strategies.push(...multiStoreStrategies);
    }

    // 3. Muadil ürün önerilerini bul
    const alternatives = await findAlternativeProducts(listItems, options.countryId);

    // 4. Stratejileri sırala ve skorla
    const sortedStrategies = sortStrategies(strategies, options.favoriteStoreIds || []);

    // 5. Özet bilgileri oluştur
    const summary = generateSummary(sortedStrategies);

    return {
        listId: list.id,
        listName: list.name,
        totalItems: listItems.length,
        budget: list.budget ? Number(list.budget) : null,
        strategies: sortedStrategies,
        alternatives,
        summary,
    };
}

// ============================================
// SINGLE STORE STRATEGY
// ============================================

async function calculateSingleStoreStrategies(
    listItems: ProductInList[],
    budget: any,
    options: CompareOptions,
    itemOptions: Map<number, Map<number, StoreOption>>
): Promise<RouteStrategy[]> {
    // Tüm benzersiz marketleri bul
    const storeMap = new Map<number, any>();

    listItems.forEach(item => {
        itemOptions.get(item.id)!.forEach(opt => {
            if (!storeMap.has(opt.store_id)) storeMap.set(opt.store_id, opt.store);
        });
    });

    const strategies: RouteStrategy[] = [];

    // Her market için ayrı strateji hesapla
    for (const [storeId, store] of storeMap) {
        const allocation: StoreAllocation = {
            store: {
                id: store.id,
                name: store.name,
                lat: store.lat,
                lon: store.lon,
            },
            products: [],
            subtotal: 0,
        };

        const missingProducts: RouteStrategy['missingProducts'] = [];

        // Her ürün için bu marketteki fiyatı bul
        listItems.forEach(item => {
            const opt = itemOptions.get(item.id)!.get(storeId);
            if (opt) {
                const pricePerUnit = opt.price;
                const totalPrice = pricePerUnit * item.quantity;
                allocation.products.push({
                    listItemId: item.id,
                    product: {
                        id: opt.product.id, name: opt.product.name,
                        brand: opt.product.brand, image_url: opt.product.image_url,
                    },
                    quantity: item.quantity, unit: item.unit, pricePerUnit, totalPrice,
                });
                allocation.subtotal += totalPrice;
            } else {
                missingProducts.push({
                    listItemId: item.id,
                    product: { id: item.product.id, name: item.product.name, brand: item.product.brand },
                    quantity: item.quantity, unit: item.unit,
                });
            }
        });

        // Coverage hesapla
        const coveragePercentage = Math.round(
            (allocation.products.length / listItems.length) * 100
        );

        // Mesafe hesapla
        const distance = options.userLocation
            ? RouteOptimizer.calculateDistance(options.userLocation, {
                  lat: store.lat || 0,
                  lon: store.lon || 0,
              })
            : 0;

        // Bütçe kontrolü
        const budgetInfo = checkBudget(allocation.subtotal, budget);

        // Favori market mi?
        const isFavorite = options.favoriteStoreIds?.includes(storeId) || false;

        const strategy: RouteStrategy = {
            type: 'single_store',
            stores: [allocation],
            totalPrice: allocation.subtotal,
            totalDistance: distance,
            estimatedDuration: RouteOptimizer.estimateDuration(distance, 1),
            missingProducts,
            coveragePercentage,
            budgetStatus: budgetInfo.status,
            budgetRemaining: budgetInfo.remaining,
            hasFavoriteStores: isFavorite,
            favoriteStoreCount: isFavorite ? 1 : 0,
            score: 0, // Sonra hesaplanacak
        };

        strategies.push(strategy);
    }

    return strategies;
}

// ============================================
// MULTI STORE STRATEGY
// ============================================

async function calculateMultiStoreStrategies(
    listItems: ProductInList[],
    budget: any,
    maxStores: number,
    options: CompareOptions,
    itemOptions: Map<number, Map<number, StoreOption>>
): Promise<RouteStrategy[]> {
    const strategies: RouteStrategy[] = [];

    // Tüm benzersiz marketleri bul
    const storeMap = new Map<number, any>();
    listItems.forEach(item => {
        itemOptions.get(item.id)!.forEach(opt => {
            if (!storeMap.has(opt.store_id)) storeMap.set(opt.store_id, opt.store);
        });
    });

    let allStores = Array.from(storeMap.values());

    // Kombinatorik patlamayı önle: aday market sayısını kapsama (coverage) göre sınırla.
    // C(N, k) çok marketli senaryolarda hızla büyür; en çok ürün taşıyan ilk N marketi seçeriz.
    const MAX_CANDIDATE_STORES = 8;
    if (allStores.length > MAX_CANDIDATE_STORES) {
        const coverage = new Map<number, number>();
        listItems.forEach(item => {
            const seen = new Set<number>();
            item.product.store_prices.forEach(sp => {
                if (!seen.has(sp.store_id)) {
                    seen.add(sp.store_id);
                    coverage.set(sp.store_id, (coverage.get(sp.store_id) || 0) + 1);
                }
            });
        });
        allStores = allStores
            .sort((a, b) => (coverage.get(b.id) || 0) - (coverage.get(a.id) || 0))
            .slice(0, MAX_CANDIDATE_STORES);
    }

    // 2'li, 3'lü kombinasyonlar için
    for (let storeCount = 2; storeCount <= Math.min(maxStores, allStores.length); storeCount++) {
        const combinations = generateCombinations(allStores, storeCount);

        for (const storeCombination of combinations) {
            const strategy = calculateOptimalAllocation(
                listItems,
                storeCombination,
                budget,
                options,
                itemOptions
            );
            
            if (strategy) {
                strategies.push(strategy);
            }
        }
    }

    return strategies;
}

/**
 * Verilen marketler için optimal ürün dağılımını hesapla
 * Hedef: Her ürünü en ucuz marketten al
 */
function calculateOptimalAllocation(
    listItems: ProductInList[],
    stores: any[],
    budget: any,
    options: CompareOptions,
    itemOptions: Map<number, Map<number, StoreOption>>
): RouteStrategy | null {
    const storeIds = stores.map(s => s.id);
    const allocations: Map<number, StoreAllocation> = new Map();

    // Her market için boş allocation oluştur
    stores.forEach(store => {
        allocations.set(store.id, {
            store: {
                id: store.id,
                name: store.name,
                lat: store.lat,
                lon: store.lon,
            },
            products: [],
            subtotal: 0,
        });
    });

    const missingProducts: RouteStrategy['missingProducts'] = [];

    // Her ürün için en ucuz marketi bul
    listItems.forEach(item => {
        let best: StoreOption | null = null;
        const opts = itemOptions.get(item.id)!;
        for (const storeId of storeIds) {
            const opt = opts.get(storeId);
            if (opt && (!best || opt.price < best.price)) best = opt;
        }
        if (best) {
            const allocation = allocations.get(best.store_id)!;
            const totalPrice = best.price * item.quantity;
            allocation.products.push({
                listItemId: item.id,
                product: {
                    id: best.product.id, name: best.product.name,
                    brand: best.product.brand, image_url: best.product.image_url,
                },
                quantity: item.quantity, unit: item.unit,
                pricePerUnit: best.price, totalPrice,
            });
            allocation.subtotal += totalPrice;
        } else {
            missingProducts.push({
                listItemId: item.id,
                product: { id: item.product.id, name: item.product.name, brand: item.product.brand },
                quantity: item.quantity, unit: item.unit,
            });
        }
    });

    // Toplam fiyat
    const totalPrice = Array.from(allocations.values()).reduce(
        (sum, a) => sum + a.subtotal,
        0
    );

    // Coverage
    const totalAllocatedProducts = Array.from(allocations.values()).reduce(
        (sum, a) => sum + a.products.length,
        0
    );
    const coveragePercentage = Math.round(
        (totalAllocatedProducts / listItems.length) * 100
    );

    // Mesafe hesapla
    const storesWithLocation = stores.filter(s => s.lat !== null && s.lon !== null);
    let totalDistance = 0;
    
    if (options.userLocation && storesWithLocation.length > 0) {
        // Optimal sıralama ile mesafe hesapla
        const optimizedStores = RouteOptimizer.optimizeStoreOrder(
            options.userLocation,
            storesWithLocation.map(s => ({
                id: s.id,
                lat: s.lat!,
                lon: s.lon!,
                name: s.name,
            }))
        );

        totalDistance = RouteOptimizer.calculateRouteDistance(
            options.userLocation,
            optimizedStores
        );
    }

    // Bütçe kontrolü
    const budgetInfo = checkBudget(totalPrice, budget);

    // Favori market sayısı
    const favoriteCount = stores.filter(s =>
        options.favoriteStoreIds?.includes(s.id)
    ).length;

    // Boş allocations'ları filtrele
    const nonEmptyAllocations = Array.from(allocations.values()).filter(
        a => a.products.length > 0
    );

    return {
        type: 'multi_store',
        stores: nonEmptyAllocations,
        totalPrice,
        totalDistance,
        estimatedDuration: RouteOptimizer.estimateDuration(
            totalDistance,
            nonEmptyAllocations.length
        ),
        missingProducts,
        coveragePercentage,
        budgetStatus: budgetInfo.status,
        budgetRemaining: budgetInfo.remaining,
        hasFavoriteStores: favoriteCount > 0,
        favoriteStoreCount: favoriteCount,
        score: 0,
    };
}

// ============================================
// ALTERNATIVE PRODUCTS (MUADİL ÜRÜNLER)
// ============================================

async function findAlternativeProducts(
    listItems: ProductInList[],
    countryId?: number
): Promise<CompareResult['alternatives']> {
    const alternatives: CompareResult['alternatives'] = [];

    for (const item of listItems) {
        // Muadil grup ID'si varsa, aynı gruptaki diğer ürünleri bul
        if (!item.product.muadil_grup_id) continue;

        const alternativeProducts = await prisma.product.findMany({
            where: {
                muadil_grup_id: item.product.muadil_grup_id,
                id: { not: item.product.id }, // Kendisi hariç
                ...(countryId ? { country_id: countryId } : {}),
            },
            include: {
                store_prices: {
                    include: {
                        store: true,
                    },
                    orderBy: {
                        price: 'asc',
                    },
                    take: 1, // En ucuz fiyat
                },
            },
        });

        // Orijinal ürünün en ucuz fiyatı
        const originalCheapestPrice = item.product.store_prices.length > 0
            ? Math.min(...item.product.store_prices.map(sp => Number(sp.price)))
            : Infinity;

        // Her alternatif için karşılaştır
        for (const alt of alternativeProducts) {
            if (alt.store_prices.length === 0) continue;

            const altPrice = Number(alt.store_prices[0].price);

            if (altPrice < originalCheapestPrice) {
                const savings = originalCheapestPrice - altPrice;

                alternatives.push({
                    originalProduct: {
                        id: item.product.id,
                        name: item.product.name,
                        brand: item.product.brand,
                    },
                    alternativeProduct: {
                        id: alt.id,
                        name: alt.name,
                        brand: alt.brand,
                    },
                    originalPrice: originalCheapestPrice,
                    alternativePrice: altPrice,
                    savings,
                    store: {
                        id: alt.store_prices[0].store.id,
                        name: alt.store_prices[0].store.name,
                    },
                });
            }
        }
    }

    // Tasarrufa göre sırala (büyükten küçüğe)
    return alternatives.sort((a, b) => b.savings - a.savings);
}

// ============================================
// HELPERS
// ============================================

function checkBudget(
    totalPrice: number,
    budget: any
): { status: RouteStrategy['budgetStatus']; remaining: number | null } {
    if (!budget) {
        return { status: 'unknown', remaining: null };
    }

    const budgetNum = Number(budget);
    const remaining = budgetNum - totalPrice;

    return {
        status: totalPrice <= budgetNum ? 'within_budget' : 'over_budget',
        remaining,
    };
}

/**
 * N elemandan K'lı kombinasyonlar üret
 */
function generateCombinations<T>(arr: T[], k: number): T[][] {
    if (k === 1) return arr.map(item => [item]);
    if (k === arr.length) return [arr];

    const combinations: T[][] = [];

    for (let i = 0; i <= arr.length - k; i++) {
        const head = arr[i];
        const tailCombinations = generateCombinations(arr.slice(i + 1), k - 1);
        
        for (const tail of tailCombinations) {
            combinations.push([head, ...tail]);
        }
    }

    return combinations;
}

/**
 * Stratejileri sırala ve skorla
 */
function sortStrategies(
    strategies: RouteStrategy[],
    favoriteStoreIds: number[]
): RouteStrategy[] {
    if (strategies.length === 0) return strategies;

    // Tüm stratejilerden min/max değerleri bul (normalizasyon için)
    const allPrices = strategies.map(s => s.totalPrice);
    const allDistances = strategies.map(s => s.totalDistance).filter(d => d > 0);
    const allCoverages = strategies.map(s => s.coveragePercentage);
    
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;
    
    const minDistance = allDistances.length > 0 ? Math.min(...allDistances) : 0;
    const maxDistance = allDistances.length > 0 ? Math.max(...allDistances) : 1;
    const distanceRange = maxDistance - minDistance || 1;

    // Her strateji için skor hesapla (0-100 arası)
    strategies.forEach(strategy => {
        let score = 0;
        const weights = {
            price: 0.40,      // %40 - Fiyat (düşük = iyi)
            coverage: 0.25,   // %25 - Kapsama (yüksek = iyi)
            distance: 0.15,   // %15 - Mesafe (kısa = iyi)
            stores: 0.10,     // %10 - Market sayısı (az = iyi)
            favorites: 0.05,  // %5 - Favori marketler
            budget: 0.05,     // %5 - Bütçe uyumu
        };

        // 1. Fiyat skoru (0-40 puan) - Düşük fiyat = yüksek skor
        const priceScore = priceRange > 0 
            ? ((maxPrice - strategy.totalPrice) / priceRange) * 100 * weights.price
            : 100 * weights.price;
        score += priceScore;

        // 2. Kapsama skoru (0-25 puan) - Yüksek kapsama = yüksek skor
        score += strategy.coveragePercentage * weights.coverage;

        // 3. Mesafe skoru (0-15 puan) - Kısa mesafe = yüksek skor
        if (strategy.totalDistance > 0 && distanceRange > 0) {
            const distanceScore = ((maxDistance - strategy.totalDistance) / distanceRange) * 100 * weights.distance;
            score += distanceScore;
        } else if (strategy.totalDistance === 0) {
            score += 100 * weights.distance; // Mesafe bilgisi yoksa tam puan
        }

        // 4. Market sayısı skoru (0-10 puan) - Az market = yüksek skor
        const maxStores = Math.max(...strategies.map(s => s.stores.length));
        const storeCountScore = maxStores > 1
            ? ((maxStores - strategy.stores.length) / (maxStores - 1)) * 100 * weights.stores
            : 100 * weights.stores;
        score += storeCountScore;

        // 5. Favori marketler (0-5 puan)
        if (strategy.hasFavoriteStores && favoriteStoreIds.length > 0) {
            const favoriteRatio = strategy.favoriteStoreCount / favoriteStoreIds.length;
            score += favoriteRatio * 100 * weights.favorites;
        }

        // 6. Bütçe uyumu (0-5 puan)
        if (strategy.budgetStatus === 'within_budget') {
            score += 100 * weights.budget;
        } else if (strategy.budgetStatus === 'over_budget') {
            score += 0; // Bütçe aşıyorsa bonus yok
        } else {
            score += 50 * weights.budget; // Bilinmiyorsa yarı puan
        }

        // 7. Eksik ürün cezası (skordan düş)
        const missingPenalty = strategy.missingProducts.length * 5; // Her eksik ürün -5 puan
        score = Math.max(0, score - missingPenalty);

        // 0-100 arasına sınırla
        strategy.score = Math.round(Math.min(100, Math.max(0, score)));
    });

    // Skora göre sırala (yüksekten düşüğe)
    return strategies.sort((a, b) => b.score - a.score);
}

/**
 * Özet bilgileri oluştur
 */
function generateSummary(strategies: RouteStrategy[]): CompareResult['summary'] {
    const singleStoreStrategies = strategies.filter(s => s.type === 'single_store');
    const multiStoreStrategies = strategies.filter(s => s.type === 'multi_store');

    const bestSingleStore = singleStoreStrategies[0] || null;
    const bestMultiStore = multiStoreStrategies[0] || null;

    // En ucuz seçenek
    const cheapestOption = strategies.reduce((cheapest, current) => {
        return current.totalPrice < cheapest.totalPrice ? current : cheapest;
    }, strategies[0]);

    // En yakın seçenek (mesafe > 0 olanlar arasında)
    const strategiesWithDistance = strategies.filter(s => s.totalDistance > 0);
    const closestOption = strategiesWithDistance.length > 0
        ? strategiesWithDistance.reduce((closest, current) => {
              return current.totalDistance < closest.totalDistance ? current : closest;
          }, strategiesWithDistance[0])
        : null;

    // Maksimum tasarruf
    const prices = strategies.map(s => s.totalPrice);
    const maxSavings = prices.length > 0
        ? Math.max(...prices) - Math.min(...prices)
        : 0;

    return {
        bestSingleStore,
        bestMultiStore,
        cheapestOption,
        closestOption,
        maxSavings: Math.round(maxSavings * 100) / 100,
    };
}

