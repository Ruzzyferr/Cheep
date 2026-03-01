/**
 * 🤖 LLM Product Matcher Service
 * OpenAI/Anthropic API kullanarak ürün eşleştirme ve kategorizasyon
 * Market bazlı gruplama ile optimize edilmiş batch processing
 */

import logger from '../utils/logger.js';
import { prisma } from '../utils/prisma.client.js';
import { STANDARD_CATEGORIES, findStandardCategoryByName } from '../config/standard-categories.js';

// ============================================
// TYPES
// ============================================

interface RawProductData {
    name: string;
    brand?: string;
    image_url?: string;
    store_id: number;
    store_name?: string; // Market adı (Migros, CarrefourSA vb.)
    store_sku: string;
    price: number;
    unit?: string;
    raw_category?: string; // Scraper'dan gelen ham kategori
}

interface ProcessedProduct {
    // Orijinal veri
    original_name: string;
    original_brand?: string;
    original_category?: string;
    store_sku: string;
    
    // LLM'den gelen normalize edilmiş veri
    normalized_name: string;
    normalized_brand?: string;
    category: string; // Ana kategori adı
    subcategory?: string; // Alt kategori adı
    category_id?: number; // Kategori ID (parse edildikten sonra)
    confidence: number; // 0-1 arası
    
    // Market bazlı fiyatlar (tüm marketler için)
    prices: Array<{
        store_name: string;
        store_id: number;
        store_sku: string;
        price: number;
        unit?: string;
        image_url?: string;
    }>;
    
    // Eşleştirme bilgisi
    matched_product_id?: number; // Eğer mevcut ürünle eşleştiyse
    muadil_grup_id?: string; // Ürün grubu ID
}

interface MarketGroup {
    store_id: number;
    store_name: string;
    products: RawProductData[];
}

interface LLMBatchResponse {
    products: ProcessedProduct[];
}

// ============================================
// LLM SERVICE
// ============================================

class LLMProductMatcher {
    private apiKey: string;
    private apiUrl: string;
    private model: string;
    private maxRetries: number = 3;
    private retryDelay: number = 1000;

    constructor() {
        // OpenRouter API key (öncelikli) veya OpenAI API key
        this.apiKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
        
        // OpenRouter kullanılıyor mu?
        const useOpenRouter = !!process.env.OPENROUTER_API_KEY || process.env.USE_OPENROUTER === 'true';
        
        if (useOpenRouter) {
            // OpenRouter API (OpenAI uyumlu)
            this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            // Model seçimi - Kategori doğruluğu için daha güçlü model gerekli
            // Önerilen modeller (performans sırasına göre):
            // - anthropic/claude-3.5-sonnet (en iyi, ~$3/1M tokens)
            // - openai/gpt-4o (çok iyi, ~$2.5/1M tokens)
            // - openai/gpt-4o-mini (iyi, ~$0.15/1M tokens) - önerilen
            // - google/gemini-2.0-flash-exp (hızlı, ~$0.075/1M tokens)
            // - google/gemini-2.0-flash-exp:free (ücretsiz ama zayıf)
            // Varsayılan model: GPT-4o-mini (kategori doğruluğu için yeterli ve ucuz)
            // Daha iyi sonuçlar için: anthropic/claude-3.5-sonnet
            this.model = process.env.LLM_MODEL || 'openai/gpt-4o-mini';
            logger.info(`[LLMProductMatcher] OpenRouter kullanılıyor - Model: ${this.model}`);
        } else {
            // OpenAI API (fallback)
            this.apiUrl = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
            this.model = process.env.LLM_MODEL || 'gpt-4o-mini';
            logger.info(`[LLMProductMatcher] OpenAI API kullanılıyor - Model: ${this.model}`);
        }
        
        if (!this.apiKey) {
            logger.warn('[LLMProductMatcher] API key bulunamadı. LLM özellikleri devre dışı.');
        } else {
            logger.info(`[LLMProductMatcher] Model: ${this.model}`);
        }
    }

    /**
     * Kategori adından ID bulur (cache'li)
     */
    private async getCategoryId(categoryName: string, subcategoryName?: string): Promise<number | null> {
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
                        logger.info(`[LLMProductMatcher] Alt kategori bulundu: ${subcategoryName} (ID: ${subcategory.id})`);
                        return subcategory.id;
                    } else {
                        logger.warn(`[LLMProductMatcher] Alt kategori bulunamadı: ${subcategoryName} (Parent: ${categoryName})`);
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
                logger.info(`[LLMProductMatcher] Ana kategori bulundu: ${categoryName} (ID: ${category.id})`);
                return category.id;
            }

            logger.warn(`[LLMProductMatcher] Kategori bulunamadı: ${categoryName}`);
            return null;
        } catch (error: any) {
            logger.error(`[LLMProductMatcher] Kategori ID bulma hatası: ${error.message}`);
            return null;
        }
    }

    /**
     * Market bazlı gruplama ile tüm ürünleri işler
     * Her market için tüm ürünleri tek seferde LLM'e gönderir
     */
    async processMarketGroups(
        rawProducts: RawProductData[]
    ): Promise<ProcessedProduct[]> {
        if (!this.apiKey) {
            logger.warn('[LLMProductMatcher] API key yok, fallback matching kullanılıyor');
            return this.fallbackProcess(rawProducts);
        }

        // 1. Market bazlı gruplama
        const marketGroups = this.groupByMarket(rawProducts);
        logger.info(`[LLMProductMatcher] ${marketGroups.length} market grubu bulundu`);

        const allResults: ProcessedProduct[] = [];

        // 2. Her market için ayrı ayrı işle
        for (const group of marketGroups) {
            logger.info(`[LLMProductMatcher] ${group.store_name} için ${group.products.length} ürün işleniyor...`);
            
            try {
                const results = await this.processMarketGroup(group, rawProducts);
                allResults.push(...results);
                
                // Rate limiting için bekle
                await this.delay(1000);
            } catch (error: any) {
                logger.error(`[LLMProductMatcher] Market grubu hatası (${group.store_name}): ${error.message}`);
                // Hata durumunda fallback kullan
                const fallbackResults = this.fallbackProcess(group.products);
                allResults.push(...fallbackResults);
            }
        }

        // 3. Cross-market matching (aynı ürün farklı marketlerde)
        const matchedResults = await this.matchCrossMarket(allResults);
        
        return matchedResults;
    }

    /**
     * Market bazlı gruplama
     */
    private groupByMarket(rawProducts: RawProductData[]): MarketGroup[] {
        const groups = new Map<number, MarketGroup>();

        for (const product of rawProducts) {
            const storeId = product.store_id;
            
            if (!groups.has(storeId)) {
                groups.set(storeId, {
                    store_id: storeId,
                    store_name: product.store_name || `Store ${storeId}`,
                    products: [],
                });
            }

            groups.get(storeId)!.products.push(product);
        }

        return Array.from(groups.values());
    }

    /**
     * Tek bir market grubunu işler
     */
    private async processMarketGroup(
        group: MarketGroup,
        allProducts: RawProductData[] // Cross-market matching için
    ): Promise<ProcessedProduct[]> {
        // Mevcut ürünlerden örnekler al
        const sampleProducts = await prisma.product.findMany({
            take: 200,
            orderBy: { id: 'desc' },
            include: {
                category: true,
            },
        });

        // STANDARD_CATEGORIES dosyasındaki kategorileri kullan (database'den değil!)
        // Bu kategoriler seed'te oluşturuluyor ve LLM'in sadece bunları kullanması gerekiyor
        const categoryTree = STANDARD_CATEGORIES.map(cat => ({
            name: cat.name,
            subcategories: cat.subcategories.map(sub => sub.name),
        }));

        // Database'deki kategorileri sadece ID mapping için al
        const allCategories = await prisma.category.findMany({
            orderBy: [
                { parent_id: 'asc' },
                { display_order: 'asc' },
            ],
        });

        const prompt = this.buildMarketGroupPrompt(group, sampleProducts, categoryTree);
        const response = await this.callLLM(prompt);
        const processed = await this.parseMarketGroupResponse(response, group, allCategories);

        return processed;
    }

    /**
     * Cross-market matching (aynı ürün farklı marketlerde)
     */
    private async matchCrossMarket(
        products: ProcessedProduct[]
    ): Promise<ProcessedProduct[]> {
        // Normalize edilmiş isim ve markaya göre grupla
        const productMap = new Map<string, ProcessedProduct[]>();

        for (const product of products) {
            const key = `${product.normalized_name}|${product.normalized_brand || ''}`.toLowerCase();
            
            if (!productMap.has(key)) {
                productMap.set(key, []);
            }
            
            productMap.get(key)!.push(product);
        }

        // Aynı ürün farklı marketlerdeyse birleştir
        const matched: ProcessedProduct[] = [];

        for (const [key, group] of productMap.entries()) {
            if (group.length === 1) {
                matched.push(group[0]);
            } else {
                // İlk ürünü base olarak al, diğerlerinin fiyatlarını ekle
                const base = group[0];
                const otherPrices = group.slice(1).flatMap(p => p.prices);
                
                base.prices = [...base.prices, ...otherPrices];
                
                // Muadil grup ID'sini oluştur
                base.muadil_grup_id = this.generateMuadilGrupId(base.normalized_name, base.normalized_brand);
                
                matched.push(base);
            }
        }

        return matched;
    }

    /**
     * Kategori önerisi alır
     */
    async suggestCategory(productName: string, brand?: string): Promise<number | null> {
        if (!this.apiKey) {
            return null;
        }

        try {
            // Mevcut kategorileri al
            const categories = await prisma.category.findMany({
                where: { parent_id: null }, // Sadece ana kategoriler
            });

            const prompt = this.buildCategoryPrompt(productName, brand, categories);
            const response = await this.callLLM(prompt);
            const categoryName = this.parseCategoryResponse(response);

            if (categoryName) {
                const category = categories.find(
                    c => c.name.toLowerCase() === categoryName.toLowerCase()
                );
                return category?.id || null;
            }
        } catch (error: any) {
            logger.error(`[LLMProductMatcher] Kategori önerisi hatası: ${error.message}`);
        }

        return null;
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    // Eski matchBatch metodu - artık kullanılmıyor, processMarketGroups kullanılıyor
    // Bu metod kaldırıldı çünkü yeni sistem market gruplarına göre çalışıyor

    private buildMatchPrompt(
        rawProduct: RawProductData,
        existingProducts: Array<{ id: number; name: string; brand?: string }>
    ): string {
        const existingProductsText = existingProducts
            .slice(0, 10) // İlk 10 örnek
            .map(p => `- ID: ${p.id}, İsim: ${p.name}${p.brand ? `, Marka: ${p.brand}` : ''}`)
            .join('\n');

        return `Sen bir ürün eşleştirme uzmanısın. Aşağıdaki ürünü mevcut ürünlerle eşleştir veya yeni ürün olarak öner.

YENİ ÜRÜN:
- İsim: ${rawProduct.name}
${rawProduct.brand ? `- Marka: ${rawProduct.brand}` : ''}
${rawProduct.raw_category ? `- Ham Kategori: ${rawProduct.raw_category}` : ''}
${rawProduct.unit ? `- Birim: ${rawProduct.unit}` : ''}

MEVCUT ÜRÜNLER (örnekler):
${existingProductsText || 'Henüz ürün yok'}

GÖREV:
1. Bu ürün mevcut ürünlerden biriyle eşleşiyor mu? Eşleşiyorsa ID'sini ver.
2. Eşleşmiyorsa, ürün ismini ve markasını normalize et (Türkçe karakterler, büyük/küçük harf).
3. En uygun kategoriyi öner (Meyve & Sebze, Süt Ürünleri, Et & Tavuk, Fırın, Atıştırmalıklar, İçecekler, Temizlik, vb.).

JSON formatında cevap ver:
{
  "product_id": null veya sayı,
  "confidence": 0.0-1.0 arası,
  "reason": "Eşleşme nedeni",
  "suggested_name": "Normalize edilmiş isim",
  "suggested_brand": "Normalize edilmiş marka",
  "suggested_category": "Kategori adı"
}`;
    }

    private buildMarketGroupPrompt(
        group: MarketGroup,
        sampleProducts: Array<{ id: number; name: string; brand?: string | null; category?: { name: string } | null }>,
        categoryTree: Array<{ name: string; subcategories: string[] }>
    ): string {
        // Ürünleri sadeleştirilmiş formatta hazırla
        const productsText = group.products
            .map((p, i) => `${i + 1}. "${p.name}"${p.brand ? ` - Marka: ${p.brand}` : ''}${p.raw_category ? ` [Kategori: ${p.raw_category}]` : ''} - Fiyat: ₺${p.price}${p.unit ? ` / ${p.unit}` : ''} - SKU: ${p.store_sku}`)
            .join('\n');

        // Database'deki kategorileri formatla
        const allCategoryNames: string[] = [];
        const categoriesText = categoryTree
            .map(cat => {
                allCategoryNames.push(cat.name);
                const subcats = cat.subcategories.map(s => {
                    allCategoryNames.push(s);
                    return `  - ${s}`;
                }).join('\n');
                return `- ${cat.name}${cat.subcategories.length > 0 ? `:\n${subcats}` : ''}`;
            })
            .join('\n');
        
        const categoryNamesList = allCategoryNames.join(', ');

        // Mevcut ürün örnekleri (eşleştirme için)
        const sampleText = sampleProducts
            .slice(0, 50)
            .map(p => `- ID: ${p.id}, "${p.name}"${p.brand ? ` (${p.brand})` : ''}${p.category ? ` [${p.category.name}]` : ''}`)
            .join('\n');

        return `Sen bir ürün eşleştirme ve kategorizasyon uzmanısın. Aşağıdaki ${group.store_name} marketinden gelen ürünleri işle.

MARKET: ${group.store_name}
TOPLAM ÜRÜN: ${group.products.length}

ÜRÜNLER:
${productsText}

MEVCUT ÜRÜNLER (eşleştirme için örnekler):
${sampleText || 'Henüz ürün yok'}

STANDART KATEGORİLER (SADECE BUNLARI KULLAN - BAŞKA KATEGORİ UYDURMA!):
Bu kategoriler sistemde tanımlı TEK kategorilerdir. Başka kategori yazma!

${categoriesText}

İZİN VERİLEN KATEGORİ İSİMLERİ (SADECE BUNLAR - BAŞKA BİR ŞEY YAZMA!):
${categoryNamesList}

⚠️ BU LİSTE DIŞINDA KATEGORİ YOK! Eğer listede uygun kategori yoksa, en yakın kategoriyi seç.

⚠️ KRİTİK UYARI - MUTLAKA OKU:
- category alanına YUKARIDAKİ LİSTEDEN SADECE BİR TANESİNİ yaz
- "Kitap", "Eğitim", "Mutfak Ürünleri", "Ampul ve Aydınlatma", "Hırdavat", "Kablolar, Çoklu Priz ve Aksesuar" gibi kategoriler LİSTEDE YOK - ASLA YAZMA!
- Listede olmayan kategori yazarsan response geçersiz sayılır ve işlem başarısız olur
- Eğer uygun kategori bulamazsan, category: "Diğer" yaz (eğer "Diğer" listede varsa)

⚠️ ÖNEMLİ: category alanına YUKARIDAKİ LİSTEDEN SADECE BİR TANESİNİ yaz. 
Listede olmayan "Kitap", "Eğitim", "Mutfak Ürünleri" gibi kategoriler YAZMA!

GÖREV:
Her ürün için:
1. Ürün ismini ve markasını normalize et (Türkçe karakterler, büyük/küçük harf düzeltmesi)
2. En uygun ANA KATEGORİ ve ALT KATEGORİ'yi seç - SADECE YUKARIDAKİ LİSTEDEN!
3. Mevcut ürünlerle eşleşiyor mu kontrol et (product_id)
4. Güven skoru ver (0.0-1.0)

KRİTİK KURALLAR - MUTLAKA UY!
- ⚠️ category ve subcategory alanlarını MUTLAKA yukarıdaki "İZİN VERİLEN KATEGORİ İSİMLERİ" listesinden seç
- ⚠️ BAŞKA KATEGORİ İSMİ UYDURMA! Listede yoksa "Diğer" kullan
- ⚠️ Kategori isimlerini TAM OLARAK kopyala (büyük/küçük harf, noktalama işaretleri dahil)
- ⚠️ Eğer listede uygun kategori yoksa, category: "Diğer", subcategory: null yaz
- Aynı ürün farklı marketlerde farklı isimlerle gelebilir, dikkatli eşleştir
- Alt kategori seçimi zorunlu değil, ama mümkünse seç
- Normalize edilmiş isim tutarlı olmalı (örn: "Sütaş Süt 1L" -> "Sütaş Süt 1L")

JSON array formatında cevap ver (TÜM ÜRÜNLER İÇİN):
[
  {
    "index": 1,
    "original_name": "Orijinal isim",
    "normalized_name": "Normalize edilmiş isim",
    "normalized_brand": "Normalize edilmiş marka",
    "category": "Ana kategori adı - MUTLAKA yukarıdaki listeden seç, başka bir şey yazma!",
    "subcategory": "Alt kategori adı - MUTLAKA yukarıdaki listeden seç veya null",
    "confidence": 0.95,
    "matched_product_id": null veya sayı,
    "store_sku": "SKU",
    "price": 34.50,
    "unit": "adet"
  },
  ...
]

UYARI: category ve subcategory alanlarını YUKARIDAKİ LİSTEDEN TAM OLARAK kopyala. 
Listede olmayan bir kategori ismi yazarsan, response geçersiz sayılacak ve işlem başarısız olacak!`;
    }

    private buildCategoryPrompt(
        productName: string,
        brand: string | undefined,
        categories: Array<{ id: number; name: string }>
    ): string {
        const categoriesText = categories.map(c => `- ${c.name}`).join('\n');

        return `Aşağıdaki ürün hangi kategoriye ait?

Ürün: ${productName}${brand ? ` (${brand})` : ''}

Mevcut Kategoriler:
${categoriesText}

Sadece kategori adını döndür, başka bir şey yazma.`;
    }

    private async callLLM(prompt: string): Promise<string> {
        const useOpenRouter = this.apiUrl.includes('openrouter.ai');
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                };

                // OpenRouter için ek header'lar
                if (useOpenRouter) {
                    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER || 'https://cheep.app';
                    headers['X-Title'] = process.env.OPENROUTER_X_TITLE || 'Cheep Product Matcher';
                }

                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            {
                                role: 'system',
                                content: `Sen bir ürün eşleştirme ve kategorizasyon uzmanısın. Türkçe ürün isimlerini anlıyorsun. 

KRİTİK KURAL: Kategori seçiminde SADECE verilen kategori listesini kullan. Asla yeni kategori uydurma. Listede olmayan bir kategori yazarsan, response geçersiz sayılır.

Her zaman JSON formatında cevap ver.`,
                            },
                            {
                                role: 'user',
                                content: prompt,
                            },
                        ],
                        temperature: 0.1, // Çok düşük - kategori doğruluğu için kritik
                        max_tokens: 16000, // Büyük batch'ler için daha fazla token
                    }),
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`API Error: ${response.status} - ${error}`);
                }

                const data = await response.json() as any;
                
                // OpenRouter response formatı biraz farklı olabilir
                if (useOpenRouter && data.data) {
                    return data.data[0]?.choices[0]?.message?.content || '';
                }
                
                return data.choices[0]?.message?.content || '';
            } catch (error: any) {
                if (attempt === this.maxRetries) {
                    throw error;
                }
                logger.warn(`[LLMProductMatcher] Deneme ${attempt}/${this.maxRetries} başarısız, tekrar deneniyor...`);
                await this.delay(this.retryDelay * attempt);
            }
        }

        throw new Error('Max retries exceeded');
    }

    // Eski parseLLMResponse ve fallbackMatch metodları kaldırıldı
    // Artık parseMarketGroupResponse kullanılıyor

    private async parseMarketGroupResponse(
        response: string,
        group: MarketGroup,
        allCategories: Array<{ id: number; name: string; parent_id: number | null }>
    ): Promise<ProcessedProduct[]> {
        try {
            // JSON'u extract et
            const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || 
                            response.match(/\[[\s\S]*\]/);
            const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
            const parsed = JSON.parse(jsonText);

            if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
            }

            // Kategori ID'lerini cache'le (async olarak)
            const categoryCache = new Map<string, number>();

            const results: ProcessedProduct[] = [];

            for (const item of parsed) {
                const originalProduct = group.products[item.index - 1];
                if (!originalProduct) {
                    logger.warn(`[LLMProductMatcher] Product index ${item.index} not found, skipping`);
                    continue;
                }

                // Kategori ID'sini bul (cache'li) - Database'deki kategorileri kullan
                let categoryId: number | undefined;
                if (item.category) {
                // STANDARD_CATEGORIES'de var mı kontrol et
                const standardCategory = findStandardCategoryByName(item.category);
                const standardSubcategory = item.subcategory 
                    ? findStandardCategoryByName(item.subcategory)
                    : null;
                
                if (!standardCategory) {
                    // STANDARD_CATEGORIES'de yok - uyar ve null bırak
                    logger.warn(`[LLMProductMatcher] ⚠️ Standart olmayan kategori: "${item.category}" - kategori atlanıyor`);
                    const allStandardNames = STANDARD_CATEGORIES.map(c => c.name).join(', ');
                    logger.warn(`[LLMProductMatcher] Mevcut standart kategoriler: ${allStandardNames}`);
                    categoryId = undefined;
                } else {
                    // STANDARD_CATEGORIES'de var - database'den ID'yi bul
                    // Önce alt kategori var mı kontrol et
                    if (item.subcategory && standardSubcategory) {
                        // Alt kategori - parent'ı bul
                        const parentCat = STANDARD_CATEGORIES.find(c => 
                            c.subcategories.some(s => s.name === item.subcategory)
                        );
                        if (parentCat) {
                            const dbParent = allCategories.find(c => c.name === parentCat.name && c.parent_id === null);
                            if (dbParent) {
                                const dbSub = allCategories.find(c => 
                                    c.name === item.subcategory && c.parent_id === dbParent.id
                                );
                                if (dbSub) {
                                    categoryId = dbSub.id;
                                }
                            }
                        }
                    } else {
                        // Ana kategori (veya alt kategori yoksa)
                        const dbCategory = allCategories.find(
                            c => c.name === item.category && c.parent_id === null
                        );
                        if (dbCategory) {
                            categoryId = dbCategory.id;
                        }
                    }
                }
                    
                // Cache'e ekle
                if (categoryId) {
                    const cacheKey = `${item.category.toLowerCase()}|${item.subcategory?.toLowerCase() || ''}`;
                    categoryCache.set(cacheKey, categoryId);
                }
                }

                results.push({
                    original_name: item.original_name || originalProduct.name,
                    original_brand: originalProduct.brand,
                    original_category: originalProduct.raw_category,
                    store_sku: item.store_sku || originalProduct.store_sku,
                    normalized_name: item.normalized_name || originalProduct.name,
                    normalized_brand: item.normalized_brand || originalProduct.brand,
                    category: item.category || '',
                    subcategory: item.subcategory,
                    category_id: categoryId,
                    confidence: item.confidence || 0.5,
                    matched_product_id: item.matched_product_id || undefined,
                    prices: [{
                        store_name: group.store_name,
                        store_id: group.store_id,
                        store_sku: item.store_sku || originalProduct.store_sku,
                        price: item.price || originalProduct.price,
                        unit: item.unit || originalProduct.unit,
                        image_url: originalProduct.image_url,
                    }],
                });
            }

            return results;
        } catch (error: any) {
            logger.error(`[LLMProductMatcher] Market group parse hatası: ${error.message}`);
            logger.error(`Response: ${response.substring(0, 500)}...`);
            return this.fallbackProcess(group.products);
        }
    }

    private generateMuadilGrupId(name: string, brand?: string): string {
        const parts: string[] = [];
        if (brand) parts.push(brand.toLowerCase().replace(/[^a-z0-9]/g, ''));
        parts.push(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return parts.join('-');
    }


    fallbackProcess(rawProducts: RawProductData[]): ProcessedProduct[] {
        return rawProducts.map(p => ({
            original_name: p.name,
            original_brand: p.brand,
            original_category: p.raw_category,
            store_sku: p.store_sku,
            normalized_name: p.name,
            normalized_brand: p.brand,
            category: p.raw_category || 'Diğer',
            confidence: 0.3,
            prices: [{
                store_name: p.store_name || `Store ${p.store_id}`,
                store_id: p.store_id,
                store_sku: p.store_sku,
                price: p.price,
                unit: p.unit,
            }],
        }));
    }

    private parseCategoryResponse(response: string): string | null {
        try {
            // Sadece kategori adını extract et
            const lines = response.trim().split('\n');
            const firstLine = lines[0].trim();
            return firstLine || null;
        } catch {
            return null;
        }
    }


    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton
export const llmProductMatcher = new LLMProductMatcher();

