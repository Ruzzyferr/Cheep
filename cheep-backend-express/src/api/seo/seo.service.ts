/**
 * Statik site üretimi için toplu veri dışa aktarımı.
 *
 * Gecelik build bu ucu BİR kez çağırır ve 7.800 sayfayı ürettiği her şeyi tek
 * yanıtta alır. Sayfa başına istek atmak (6.471 ürün × 1 istek) hem dakikalarca
 * sürerdi hem de 1 vCPU'luk kutuyu gereksiz yere döverdi.
 *
 * Sorgular ham SQL: Prisma'nın ilişki yükleyicisi bu şekilde bir toplu çekimde
 * kaçınılmaz olarak N+1 üretiyor. Her sorgu ülke bazında tek turdur.
 */
import { prisma } from '../../utils/prisma.client.js';
import { defaultLangForCountry, localizeCategory } from '../../config/category-i18n.js';
import { normalizeCity } from '../../config/city-normalize.js';

/** Bir sayfanın var olmayı hak etmesi için gereken en az market sayısı. */
const MIN_STORES_FOR_PAGE = 2;
/** Fiyat grafiğinin kapsadığı gün sayısı. */
const HISTORY_DAYS = 28;
/** Şehir sayfası açmaya değer en az şube sayısı. */
const MIN_BRANCHES_FOR_CITY = 5;

export interface SeoOffer {
    storeSlug: string;
    storeName: string;
    price: number;
    updatedAt: string;
}

export interface SeoHistoryPoint {
    date: string;
    min: number;
}

export interface SeoProduct {
    slug: string;
    name: string;
    brand: string | null;
    image: string | null;
    categorySlug: string | null;
    categoryName: string | null;
    offers: SeoOffer[];
    history: SeoHistoryPoint[];
}

export interface SeoCategory {
    slug: string;
    name: string;
    productCount: number;
}

export interface SeoStore {
    slug: string;
    name: string;
    logo: string | null;
    branchCount: number;
    cityCount: number;
    productCount: number;
}

export interface SeoCity {
    slug: string;
    name: string;
    branchCount: number;
    stores: { slug: string; name: string; branchCount: number }[];
}

/** Silinen/yeniden adlandırılan kategori slug'ı → hayatta kalan karşılığı. */
export interface SeoRedirect {
    from: string;
    to: string;
}

export interface SeoCountryExport {
    code: string;
    name: string;
    currency: string;
    products: SeoProduct[];
    categories: SeoCategory[];
    stores: SeoStore[];
    cities: SeoCity[];
    /** Site üretimi bunlardan 301 kuralları çıkarır. */
    redirects: SeoRedirect[];
}

export interface SeoExport {
    generatedAt: string;
    countries: SeoCountryExport[];
}

/** Postgres NUMERIC'i string döner; sayfa üretimi sayı bekliyor. */
const num = (v: unknown): number => Number(v ?? 0);

async function fetchProducts(countryId: number, countryCode: string): Promise<SeoProduct[]> {
    // Tek turda ürün + tüm teklifleri. json_agg ile satır patlaması olmadan.
    const rows = await prisma.$queryRawUnsafe<
        {
            slug: string;
            name: string;
            brand: string | null;
            image_url: string | null;
            category_slug: string | null;
            category_name: string | null;
            offers: { storeSlug: string; storeName: string; price: string; updatedAt: Date }[];
        }[]
    >(
        `SELECT p.slug, p.name, p.brand, p.image_url,
                c.slug AS category_slug, c.name AS category_name,
                json_agg(json_build_object(
                    'storeSlug', s.slug, 'storeName', s.name,
                    'price', sp.price, 'updatedAt', sp.last_updated_at
                ) ORDER BY sp.price ASC) AS offers
         FROM products p
         JOIN store_prices sp ON sp.product_id = p.id
         JOIN stores s        ON s.id = sp.store_id AND s.slug IS NOT NULL
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.country_id = $1 AND p.slug IS NOT NULL
         GROUP BY p.id, p.slug, p.name, p.brand, p.image_url, c.slug, c.name
         HAVING COUNT(DISTINCT sp.store_id) >= $2`,
        countryId,
        MIN_STORES_FOR_PAGE,
    );

    const slugs = rows.map((r) => r.slug);
    const history = await fetchHistory(countryId, slugs);

    return rows.map((r) => {
        // Kategori adı/slug'ı ülkenin diline çevrilir; gerekçe:
        // config/category-i18n.ts
        // Site, ülkenin dilinde yayınlanır (TR → tr, PL → pl).
        const cat = r.category_slug
            ? localizeCategory(defaultLangForCountry(countryCode), r.category_name ?? '', r.category_slug)
            : null;
        return ({
        slug: r.slug,
        name: r.name,
        brand: r.brand,
        image: r.image_url,
        categorySlug: cat?.slug ?? null,
        categoryName: cat?.name ?? null,
        offers: (r.offers ?? []).map((o) => ({
            storeSlug: o.storeSlug,
            storeName: o.storeName,
            price: num(o.price),
            updatedAt: new Date(o.updatedAt).toISOString(),
        })),
        history: history.get(r.slug) ?? [],
    });
    });
}

/** Ürün başına günlük en düşük fiyat — grafiğin çizdiği seri. */
async function fetchHistory(countryId: number, slugs: string[]): Promise<Map<string, SeoHistoryPoint[]>> {
    const out = new Map<string, SeoHistoryPoint[]>();
    if (slugs.length === 0) return out;

    const rows = await prisma.$queryRawUnsafe<{ slug: string; day: Date; min_price: string }[]>(
        `SELECT p.slug, ph.recorded_at::date AS day, MIN(ph.price) AS min_price
         FROM price_history ph
         JOIN products p ON p.id = ph.product_id
         WHERE p.country_id = $1
           AND p.slug IS NOT NULL
           AND ph.recorded_at >= NOW() - ($2 || ' days')::interval
         GROUP BY p.slug, ph.recorded_at::date
         ORDER BY day ASC`,
        countryId,
        String(HISTORY_DAYS),
    );

    for (const r of rows) {
        const list = out.get(r.slug) ?? [];
        list.push({ date: new Date(r.day).toISOString().slice(0, 10), min: num(r.min_price) });
        out.set(r.slug, list);
    }
    return out;
}

async function fetchCategories(countryId: number, countryCode: string): Promise<SeoCategory[]> {
    const rows = await prisma.$queryRawUnsafe<{ slug: string; name: string; n: bigint }[]>(
        `SELECT c.slug, c.name, COUNT(*)::bigint AS n
         FROM (
           SELECT p.id, p.category_id
           FROM products p
           JOIN store_prices sp ON sp.product_id = p.id
           WHERE p.country_id = $1 AND p.slug IS NOT NULL AND p.category_id IS NOT NULL
           GROUP BY p.id, p.category_id
           HAVING COUNT(DISTINCT sp.store_id) >= $2
         ) q
         JOIN categories c ON c.id = q.category_id
         GROUP BY c.slug, c.name
         ORDER BY n DESC`,
        countryId,
        MIN_STORES_FOR_PAGE,
    );
    return rows.map((r) => {
        const cat = localizeCategory(defaultLangForCountry(countryCode), r.name, r.slug);
        return { slug: cat.slug, name: cat.name, productCount: Number(r.n) };
    });
}

async function fetchStores(countryId: number): Promise<SeoStore[]> {
    const rows = await prisma.$queryRawUnsafe<
        { slug: string; name: string; logo_url: string | null; branches: bigint; cities: bigint; products: bigint }[]
    >(
        // DİKKAT: branches ve prices'ı aynı sorguda JOIN'lemeyin. İkisi de
        // store_id'ye bağlı olduğu için join kartezyen çarpım üretir —
        // Migros'ta 10.247 şube × 5.405 fiyat = 55 milyon ara satır, tek başına
        // dışa aktarımı dakikalarca sürdürüyordu. Skaler alt sorgular her
        // tabloyu kendi indeksiyle bir kez tarar.
        // ÜRÜN SAYISI AYNI EVRENDEN SAYILIR. Eskiden bu alan markete ait TÜM
        // store_prices satırlarını sayıyordu; sayfa "2.995 ürün karşılaştırıyoruz"
        // yazarken hemen altındaki kartta "CarrefourSA 6.884 ürün" görünüyordu.
        // İki sayı da doğruydu ama farklı şeyleri sayıyordu ve yan yana
        // durunca güveni yiyordu. Artık ikisi de "yayınlanabilir ürün"
        // (>= MIN_STORES_FOR_PAGE markette bulunan) evrenini sayar.
        `SELECT s.slug, s.name, s.logo_url,
                (SELECT COUNT(*)          FROM store_branches b WHERE b.store_id = s.id)::bigint AS branches,
                (SELECT COUNT(DISTINCT b.city) FROM store_branches b WHERE b.store_id = s.id AND b.city IS NOT NULL)::bigint AS cities,
                (SELECT COUNT(*) FROM (
                    SELECT sp.product_id
                    FROM store_prices sp
                    JOIN products p ON p.id = sp.product_id
                    WHERE sp.store_id = s.id AND p.country_id = $1 AND p.slug IS NOT NULL
                      AND (SELECT COUNT(DISTINCT sp2.store_id) FROM store_prices sp2
                           WHERE sp2.product_id = sp.product_id) >= $2
                    GROUP BY sp.product_id
                 ) q)::bigint AS products
         FROM stores s
         WHERE s.country_id = $1 AND s.slug IS NOT NULL
         ORDER BY products DESC`,
        countryId,
        MIN_STORES_FOR_PAGE,
    );
    return rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        logo: r.logo_url,
        branchCount: Number(r.branches),
        cityCount: Number(r.cities),
        productCount: Number(r.products),
    }));
}

async function fetchCities(countryId: number, countryCode: string): Promise<SeoCity[]> {
    // Ham şube×market sayıları; şehir adı normalizasyonu JS'te yapılıyor
    // çünkü Türkçe'ye duyarlı harf dönüşümü SQL'de güvenilir değil
    // (Postgres'in lower/upper'ı 'İ' harfini locale'siz ele alıyor).
    const rows = await prisma.$queryRawUnsafe<
        { city: string; store_slug: string; store_name: string; n: bigint }[]
    >(
        `SELECT b.city, s.slug AS store_slug, s.name AS store_name, COUNT(*)::bigint AS n
         FROM store_branches b
         JOIN stores s ON s.id = b.store_id AND s.slug IS NOT NULL
         WHERE b.country_id = $1 AND b.city IS NOT NULL AND b.city <> ''
         GROUP BY b.city, s.slug, s.name`,
        countryId,
    );

    // "Keçiören/Ankara" ve "Ankara" aynı sayfada toplanır; gerekçe:
    // config/city-normalize.ts
    const merged = new Map<string, { name: string; total: number; stores: Map<string, { name: string; n: number }> }>();

    for (const r of rows) {
        const name = normalizeCity(r.city, countryCode);
        if (!name) continue;

        let entry = merged.get(name);
        if (!entry) {
            entry = { name, total: 0, stores: new Map() };
            merged.set(name, entry);
        }
        const count = Number(r.n);
        entry.total += count;

        const store = entry.stores.get(r.store_slug);
        if (store) store.n += count;
        else entry.stores.set(r.store_slug, { name: r.store_name, n: count });
    }

    return [...merged.values()]
        .filter((c) => c.total >= MIN_BRANCHES_FOR_CITY)
        .sort((a, b) => b.total - a.total)
        .map((c) => ({
            slug: '', // controller dolduruyor
            name: c.name,
            branchCount: c.total,
            stores: [...c.stores.entries()]
                .map(([slug, s]) => ({ slug, name: s.name, branchCount: s.n }))
                .sort((a, b) => b.branchCount - a.branchCount),
        }));
}

/**
 * Taksonomi birleştirmesinde silinen kategori slug'ları.
 *
 * Yayındaki `/kategori/meyve-ve-sebze` gibi URL'ler birleştirme sonrası
 * kayboldu. Yönlendirme olmadan silmek birikmiş sıralamayı yakar; site üretimi
 * bu listeden 301 kuralları çıkarır. Slug'lar ülkenin diline çevrilir —
 * kategori slug'ları da çevriliyor (bkz. config/category-i18n.ts).
 */
async function fetchRedirects(countryId: number, countryCode: string): Promise<SeoRedirect[]> {
    const rows = await prisma.categoryRedirect.findMany({
        where: { country_id: countryId },
        select: { old_slug: true, new_slug: true },
        orderBy: { old_slug: 'asc' },
    });
    const lang = defaultLangForCountry(countryCode);
    return rows.map((r) => ({
        // Eski slug ÇEVRİLMEZ: yayındaki hâli neyse o. Yeni slug çevrilir,
        // çünkü hedef sayfa o dilde yayınlanıyor.
        from: r.old_slug,
        to: localizeCategory(lang, '', r.new_slug).slug,
    }));
}

/** Tüm ülkeler için sayfa üretimine yetecek veriyi toplar. */
export async function buildExport(): Promise<SeoExport> {
    const countries = await prisma.country.findMany({
        select: { id: true, code: true, name: true, currency: true },
        orderBy: { id: 'asc' },
    });

    const out: SeoCountryExport[] = [];
    for (const c of countries) {
        const products = await fetchProducts(c.id, c.code);
        // Ürünü olmayan ülke (Almanya, İsviçre, İsveç) sayfa üretmez.
        if (products.length === 0) continue;

        out.push({
            code: c.code,
            name: c.name,
            currency: c.currency,
            products,
            categories: await fetchCategories(c.id, c.code),
            stores: await fetchStores(c.id),
            cities: await fetchCities(c.id, c.code),
            redirects: await fetchRedirects(c.id, c.code),
        });
    }

    return { generatedAt: new Date().toISOString(), countries: out };
}
