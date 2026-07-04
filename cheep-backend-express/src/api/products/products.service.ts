import { prisma } from '../../utils/prisma.client.js';
import { Prisma } from '@prisma/client';
import { getCountryIdByCode } from '../../utils/country.js';
import { notFound, conflict } from '../../utils/app-error.js';
import { normalizeSearchInput, tokenizeSearch, isBarcodeQuery } from './product-search.util.js';

interface GetAllProductsParams {
    category_id?: number;
    brand?: string;
    search?: string;
    limit?: number;
    offset?: number;
    countryId?: number;
}

export const getAllProducts = async (params: GetAllProductsParams) => {
    const { category_id, brand, search, limit = 50, offset = 0, countryId } = params;

    const where: Prisma.ProductWhereInput = {};
    if (countryId) {
        where.country_id = countryId;
    }
    // Raw SQL filtresinde kullanılmak üzere çözülen kategori id listesi
    let categoryIdsForSql: number[] | null = null;

    if (category_id) {
        // 🔥 Parent kategorinin alt kategorilerini de dahil et
        const category = await prisma.category.findUnique({
            where: { id: category_id },
            include: {
                children: {
                    select: { id: true },
                },
            },
        });

        if (category) {
            // Eğer parent kategoriyse (alt kategorileri varsa), onları da dahil et
            if (category.children && category.children.length > 0) {
                const categoryIds = [category.id, ...category.children.map(c => c.id)];
                where.category_id = { in: categoryIds };
                categoryIdsForSql = categoryIds;
            } else {
                // Alt kategoriyse, sadece kendi ID'sini kullan
                where.category_id = category_id;
                categoryIdsForSql = [category_id];
            }
        } else {
            // Kategori bulunamadıysa, yine de filtrele (hata verme)
            where.category_id = category_id;
            categoryIdsForSql = [category_id];
        }
    }

    if (brand) {
        where.brand = {
            contains: brand,
            mode: 'insensitive',
        };
    }

    // NOT: asıl arama aşağıdaki raw SQL'de trigram ile yapılır (bu Prisma `where`
    // yalnızca kategori/marka/ülke listeleme filtreleri için kullanılır; search'i
    // buradan çıkarıyoruz ki iki farklı arama mantığı çakışmasın).

    // 🔥 DATABASE SEVİYESİNDE SIRALAMA: Market sayısına göre (çoktan aza)
    // Raw SQL ile store_prices count'una göre sıralama
    
    // WHERE clause builder — orijinal parametrelerden kurulur (tip güvenli)
    let whereClause = Prisma.sql`WHERE 1=1`;

    if (countryId) {
        whereClause = Prisma.sql`${whereClause} AND p.country_id = ${countryId}`;
    }

    if (categoryIdsForSql && categoryIdsForSql.length > 0) {
        whereClause = Prisma.sql`${whereClause} AND p.category_id IN (${Prisma.join(categoryIdsForSql)})`;
    }

    if (brand) {
        whereClause = Prisma.sql`${whereClause} AND p.brand ILIKE ${'%' + brand + '%'}`;
    }

    // 🔎 Akıllı arama: cheep_normalize (unaccent + Türkçe İ/ı) üzerinden trigram.
    // - Çok kelime: her token normalize edilmiş isimde substring olmalı (AND) → sıra bağımsız değil.
    // - Yazım hatası: word_similarity(sorgu, ad) — kısa sorguyu uzun ad İÇİNDEKİ en iyi
    //   kelime/parçaya karşı ölçer. NOT: whole-string similarity() burada ÇALIŞMAZ; kısa
    //   typo uzun çok-kelimeli ürün adına karşı ~0.09 verir (Task 2 bulgusu). word_similarity
    //   yönü ÖNEMLİ: ilk argüman sorgu, ikinci hedef.
    // - Barkod: yalnızca sayısal sorguda prefix eşleşmesi.
    let searchOrder: Prisma.Sql = Prisma.empty;
    const nq = normalizeSearchInput(search ?? '');
    if (search && nq) {
        const tokens = tokenizeSearch(search);

        // Token-AND: her token cheep_normalize(p.name) VEYA cheep_normalize(p.brand) içinde geçmeli (substring, tam parça).
        const tokenAnd = tokens.length > 0
            ? Prisma.join(
                tokens.map(tok => Prisma.sql`(cheep_normalize(p.name) LIKE '%' || cheep_normalize(${tok}) || '%' OR cheep_normalize(coalesce(p.brand, '')) LIKE '%' || cheep_normalize(${tok}) || '%')`),
                ' AND '
              )
            : Prisma.sql`TRUE`;

        const barcodeClause = isBarcodeQuery(search)
            ? Prisma.sql`OR p.ean_barcode LIKE ${nq + '%'}`
            : Prisma.empty;

        whereClause = Prisma.sql`${whereClause} AND (
            (${tokenAnd})
            OR cheep_normalize(${nq}) <% cheep_normalize(p.name)
            OR cheep_normalize(coalesce(p.brand, '')) LIKE '%' || cheep_normalize(${nq}) || '%'
            ${barcodeClause}
        )`;

        // Alaka sıralaması: önce prefix eşleşmesi, sonra word_similarity.
        searchOrder = Prisma.sql`
            (cheep_normalize(p.name) LIKE cheep_normalize(${nq}) || '%')::int DESC,
            word_similarity(cheep_normalize(${nq}), cheep_normalize(p.name)) DESC,
        `;
    }

    // 🔎 `<%` operatörü GIN trigram index'lerini kullanabilir (bare word_similarity()
    // fonksiyonu kullanamaz), ama pg_trgm.word_similarity_threshold GUC'una bağlıdır
    // (varsayılan 0.6, yazım hataları için çok katı). Aynı bağlantıda SET LOCAL ile
    // 0.35'e düşürüyoruz — bu yüzden her iki raw sorgu da tek bir transaction içinde.
    const [products, totalRows] = await prisma.$transaction(async (tx) => {
        if (search && nq) {
            // SET LOCAL transaction-scoped'tur; değer sabit (kullanıcı girdisi değil).
            await tx.$executeRawUnsafe('SET LOCAL pg_trgm.word_similarity_threshold = 0.35');
        }

        const products = await tx.$queryRaw<any[]>`
            SELECT
                p.*,
                COUNT(sp.id) as store_count,
                MIN(sp.price::numeric) as min_price
            FROM "products" p
            LEFT JOIN "store_prices" sp ON p.id = sp.product_id
            ${whereClause}
            GROUP BY p.id
            ORDER BY
                ${searchOrder}
                store_count DESC,
                min_price ASC,
                p.created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
        `;

        // total, listeleme ile AYNI filtreden türetilir (whereClause) — sapma olmaz.
        const totalRows = await tx.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint as count
            FROM "products" p
            ${whereClause}
        `;

        return [products, totalRows];
    });
    const total = Number(totalRows[0]?.count ?? 0);

    // Eğer ürün yoksa boş array döndür
    if (products.length === 0) {
        return {
            products: [],
            pagination: {
                total,
                limit,
                offset,
                hasMore: false,
            },
        };
    }

    // İlişkili verileri (category, store_prices) ayrı sorgularla al
    // BigInt'ten Number'a dönüştür
    const productIds = products.map(p => Number(p.id));
    
    const productsWithRelations = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
            category: true,
            store_prices: {
                include: {
                    store: true,
                },
                orderBy: {
                    price: 'asc',
                },
                take: 50, // makul üst sınır (her market en fazla 1 fiyat → liste için fazlasıyla yeterli)
            },
        },
    });

    // Raw SQL sonuçlarının sırasını koru
    const orderedProducts = productIds.map(id => 
        productsWithRelations.find(p => p.id === id)
    ).filter(Boolean) as any[];

    return {
        products: orderedProducts,
        pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        },
    };
};

export const getProductById = async (id: number, countryId?: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            category: true,
            store_prices: {
                include: {
                    store: true,
                },
                orderBy: {
                    price: 'asc',
                },
            },
        },
    });

    if (!product || (countryId && product.country_id !== countryId)) {
        throw notFound('Ürün bulunamadı');
    }

    return product;
};

export const getProductByBarcode = async (barcode: string, countryId?: number) => {
    // ean_barcode is unique per-country now, not globally; scope the lookup when we have a country.
    const product = await prisma.product.findFirst({
        where: { ean_barcode: barcode, ...(countryId ? { country_id: countryId } : {}) },
        include: {
            category: true,
            store_prices: {
                include: {
                    store: true,
                },
                orderBy: {
                    price: 'asc',
                },
            },
        },
    });

    if (!product || (countryId && product.country_id !== countryId)) {
        throw notFound('Ürün bulunamadı');
    }

    return product;
};

export const createProduct = async (data: {
    name: string;
    brand?: string;
    ean_barcode?: string;
    image_url?: string;
    category_id?: number;
    muadil_grup_id?: string;
    country_id?: number;
    country_code?: string;
}) => {
    const { country_code, country_id, ...rest } = data;
    // getCountryIdByCode never returns undefined (it defaults to TR or throws),
    // so resolvedCountryId below is always a valid id and country scoping is
    // always applied in the where-clauses that use it.
    const resolvedCountryId = country_id ?? (await getCountryIdByCode(country_code));

    // Barkod varsa, aynı ülkede aynı barkodlu ürün kontrolü (ean_barcode artık ülke-scope benzersiz)
    if (data.ean_barcode) {
        const existing = await prisma.product.findFirst({
            where: { ean_barcode: data.ean_barcode, country_id: resolvedCountryId },
        });

        if (existing) {
            throw conflict('Bu barkoda sahip ürün zaten mevcut');
        }
    }

    return await prisma.product.create({
        data: { ...rest, country_id: resolvedCountryId },
        include: {
            category: true,
        },
    });
};

export const upsertProduct = async (data: {
    name: string;
    brand?: string;
    ean_barcode?: string;
    image_url?: string;
    category_id?: number;
    muadil_grup_id?: string;
    country_id?: number;
    country_code?: string;
}) => {
    const { country_code, country_id, ...rest } = data;
    // getCountryIdByCode never returns undefined (it defaults to TR or throws),
    // so resolvedCountryId below is always a valid id and country scoping is
    // always applied in the where-clauses that use it.
    const resolvedCountryId = country_id ?? (await getCountryIdByCode(country_code));

    // Eğer barkod varsa, ona göre upsert yap (ean_barcode artık ülke-scope benzersiz)
    if (data.ean_barcode) {
        return await prisma.product.upsert({
            where: {
                country_id_ean_barcode: {
                    country_id: resolvedCountryId,
                    ean_barcode: data.ean_barcode,
                },
            },
            update: {
                name: data.name,
                brand: data.brand,
                image_url: data.image_url,
                category_id: data.category_id,
                muadil_grup_id: data.muadil_grup_id,
            },
            create: { ...rest, country_id: resolvedCountryId },
            include: {
                category: true,
            },
        });
    }

    // Barkod yoksa direkt oluştur
    return await prisma.product.create({
        data: { ...rest, country_id: resolvedCountryId },
        include: {
            category: true,
        },
    });
};

export const updateProduct = async (
    id: number,
    data: {
        name?: string;
        brand?: string;
        ean_barcode?: string;
        image_url?: string;
        category_id?: number;
        muadil_grup_id?: string;
    }
) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
        throw notFound('Ürün bulunamadı');
    }

    return await prisma.product.update({
        where: { id },
        data,
        include: {
            category: true,
        },
    });
};

export const deleteProduct = async (id: number) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
        throw notFound('Ürün bulunamadı');
    }

    await prisma.product.delete({ where: { id } });
};

export const getProductPrices = async (id: number, countryId?: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            store_prices: {
                include: {
                    store: true,
                },
                orderBy: {
                    price: 'asc',
                },
            },
        },
    });

    if (!product || (countryId && product.country_id !== countryId)) {
        throw notFound('Ürün bulunamadı');
    }

    return product.store_prices;
};

/**
 * Bir ürünün fiyat geçmişini market bazında zaman serisi olarak döndürür.
 * @param days Kaç günlük geçmiş (default 90)
 */
export const getProductPriceHistory = async (id: number, days = 90, countryId?: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        select: { country_id: true },
    });

    if (!product || (countryId && product.country_id !== countryId)) {
        throw notFound('Ürün bulunamadı');
    }

    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(days, 365)));

    const rows = await prisma.priceHistory.findMany({
        where: { product_id: id, recorded_at: { gte: since } },
        include: { store: { select: { id: true, name: true, logo_url: true } } },
        orderBy: { recorded_at: 'asc' },
    });

    // Market bazında grupla
    const byStore = new Map<number, {
        store: { id: number; name: string; logo_url: string | null };
        points: Array<{ price: number; recorded_at: Date }>;
    }>();

    for (const row of rows) {
        if (!byStore.has(row.store_id)) {
            byStore.set(row.store_id, { store: row.store, points: [] });
        }
        byStore.get(row.store_id)!.points.push({
            price: Number(row.price),
            recorded_at: row.recorded_at,
        });
    }

    const series = Array.from(byStore.values());
    const allPrices = rows.map(r => Number(r.price));

    return {
        product_id: id,
        days,
        series,
        summary: {
            lowest: allPrices.length ? Math.min(...allPrices) : null,
            highest: allPrices.length ? Math.max(...allPrices) : null,
            dataPoints: allPrices.length,
        },
    };
};

export const compareProductPrices = async (id: number, countryId?: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            store_prices: {
                include: {
                    store: true,
                },
                orderBy: {
                    price: 'asc',
                },
            },
        },
    });

    if (!product || (countryId && product.country_id !== countryId)) {
        throw notFound('Ürün bulunamadı');
    }

    if (product.store_prices.length === 0) {
        return {
            product: {
                id: product.id,
                name: product.name,
                brand: product.brand,
            },
            prices: [],
            cheapest: null,
            mostExpensive: null,
            averagePrice: null,
            priceDifference: null,
        };
    }

    const prices = product.store_prices.map((sp) => ({
        store: sp.store,
        price: Number(sp.price),
        unit: sp.unit,
        last_updated_at: sp.last_updated_at,
    }));

    const cheapest = prices[0];
    const mostExpensive = prices[prices.length - 1];
    const averagePrice =
        prices.reduce((sum: any, p: { price: any; }) => sum + p.price, 0) / prices.length;
    const priceDifference = mostExpensive.price - cheapest.price;
    const savingsPercentage =
        ((priceDifference / mostExpensive.price) * 100).toFixed(2);

    return {
        product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            image_url: product.image_url,
        },
        prices,
        cheapest,
        mostExpensive,
        averagePrice: Number(averagePrice.toFixed(2)),
        priceDifference: Number(priceDifference.toFixed(2)),
        savingsPercentage: `${savingsPercentage}%`,
    };
};

