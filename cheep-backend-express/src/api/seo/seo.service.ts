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

export interface SeoCountryExport {
    code: string;
    name: string;
    currency: string;
    products: SeoProduct[];
    categories: SeoCategory[];
    stores: SeoStore[];
    cities: SeoCity[];
}

export interface SeoExport {
    generatedAt: string;
    countries: SeoCountryExport[];
}

/** Postgres NUMERIC'i string döner; sayfa üretimi sayı bekliyor. */
const num = (v: unknown): number => Number(v ?? 0);

async function fetchProducts(countryId: number): Promise<SeoProduct[]> {
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

    return rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        brand: r.brand,
        image: r.image_url,
        categorySlug: r.category_slug,
        categoryName: r.category_name,
        offers: (r.offers ?? []).map((o) => ({
            storeSlug: o.storeSlug,
            storeName: o.storeName,
            price: num(o.price),
            updatedAt: new Date(o.updatedAt).toISOString(),
        })),
        history: history.get(r.slug) ?? [],
    }));
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

async function fetchCategories(countryId: number): Promise<SeoCategory[]> {
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
    return rows.map((r) => ({ slug: r.slug, name: r.name, productCount: Number(r.n) }));
}

async function fetchStores(countryId: number): Promise<SeoStore[]> {
    const rows = await prisma.$queryRawUnsafe<
        { slug: string; name: string; logo_url: string | null; branches: bigint; cities: bigint; products: bigint }[]
    >(
        `SELECT s.slug, s.name, s.logo_url,
                COUNT(DISTINCT b.id)::bigint      AS branches,
                COUNT(DISTINCT b.city)::bigint    AS cities,
                COUNT(DISTINCT sp.product_id)::bigint AS products
         FROM stores s
         LEFT JOIN store_branches b ON b.store_id = s.id
         LEFT JOIN store_prices sp  ON sp.store_id = s.id
         WHERE s.country_id = $1 AND s.slug IS NOT NULL
         GROUP BY s.slug, s.name, s.logo_url
         ORDER BY products DESC`,
        countryId,
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

async function fetchCities(countryId: number): Promise<SeoCity[]> {
    const rows = await prisma.$queryRawUnsafe<
        { city: string; total: bigint; stores: { slug: string; name: string; branchCount: number }[] }[]
    >(
        `SELECT b.city,
                COUNT(*)::bigint AS total,
                json_agg(json_build_object('slug', s.slug, 'name', s.name, 'branchCount', b.n)
                         ORDER BY b.n DESC) AS stores
         FROM (
           SELECT city, store_id, COUNT(*) AS n
           FROM store_branches
           WHERE country_id = $1 AND city IS NOT NULL AND city <> ''
           GROUP BY city, store_id
         ) b
         JOIN stores s ON s.id = b.store_id AND s.slug IS NOT NULL
         GROUP BY b.city
         HAVING SUM(b.n) >= $2
         ORDER BY total DESC`,
        countryId,
        MIN_BRANCHES_FOR_CITY,
    );

    return rows.map((r) => ({
        slug: '', // controller dolduruyor (slugify backend util'i, burada import döngüsü olmasın)
        name: r.city,
        branchCount: Number(r.total),
        stores: (r.stores ?? []).map((s) => ({ ...s, branchCount: Number(s.branchCount) })),
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
        const products = await fetchProducts(c.id);
        // Ürünü olmayan ülke (Almanya, İsviçre, İsveç) sayfa üretmez.
        if (products.length === 0) continue;

        out.push({
            code: c.code,
            name: c.name,
            currency: c.currency,
            products,
            categories: await fetchCategories(c.id),
            stores: await fetchStores(c.id),
            cities: await fetchCities(c.id),
        });
    }

    return { generatedAt: new Date().toISOString(), countries: out };
}
