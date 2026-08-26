import { prisma } from '../../utils/prisma.client.js';
import { Prisma } from '@prisma/client';
import { getCountryIdByCode } from '../../utils/country.js';
import { notFound, conflict } from '../../utils/app-error.js';
import { normalizeSearchInput, tokenizeSearch, isBarcodeQuery } from './product-search.util.js';
import { buildProductFilter, type SortMode } from './product-filter.js';

/**
 * 📐 ALAKA MERDİVENİ — arama sonuçlarının sıralaması.
 *
 * Eski hali iki basamaklıydı (ad-öneki + `word_similarity`) ve canlı veride
 * ÇÖKÜYORDU:
 *   "peynir"     → "Ülker Çiziviç Peynir Kremalı Sandviç Kraker"  (kraker)
 *   "zeytinyağı" → "Duru Zeytinyağı Özlü DUŞ SABUNU"              (sabun)
 *   "yumurta"    → "Ozmo Yumurta Kafalar"                          (şeker)
 *   "süt"        → yalnızca Sütaş ürünleri (muzlu/çilekli içecekler)
 *
 * İki kök neden:
 *  ① `word_similarity` sorgu bir kelimeyle TAM eşleştiğinde 1.0'da DOYUYOR.
 *     Kraker de peynir de 1.0 alıyor → sıralama sessizce `store_count`'a
 *     düşüyor ve en çok markette bulunan ÇÖP kazanıyor.
 *  ② Önek testi `LIKE 'sut%'` kelime sınırı tanımıyor; "Sütaş…" ile başlayan
 *     HER ürün "süt" aramasında birinci lige çıkıyor.
 *
 * Basamaklar (sırası kanıta dayalı, keyfî değil):
 *  1. Ad, sorguyu TAM KELİME olarak İÇERİYOR mu    ("Sütaş Süzme Peynir")
 *     — "Peynirli Börek" bu basamağı geçemez; yalnızca önek benzeri.
 *  2. `word_similarity` — yazım hatası toleransı. Bu basamak olmadan
 *     "zeytınyagi" hiçbir sonuç bulamaz.
 *  3. Bütün-ad benzerliğinin KOVASI: sorgu, adın ne kadar büyük bir parçası?
 *     Uzun çöp adlar ("…Özlü Duş Sabunu 600 Gr") düşük alır. Kova TAVANLI
 *     (0.30 üstü hepsi eşit) — aksi halde bu SÜREKLİ değer her zaman ilk
 *     ayrımı yapar ve 1 markette bulunan ürün 2 markettekini geçer; oysa
 *     karşılaştırılabilirlik uygulamanın var oluş sebebi.
 *  4. Ad, sorguyla TAM KELİME olarak BAŞLIYOR mu   ("Yumurta Gezen 10 Adet")
 *     — KOVADAN SONRA geliyor, çünkü önce dener gibi kovadan önce konunca
 *     "Peynir Dolgulu Biber Çeşitleri" (kategori: Hazır Yemekler) gerçek
 *     peynirlerin önüne geçiyordu: adı "peynir" ile başlıyor ama peynir
 *     değil. Kova onu dibe iter; aynı kovadaki adaylar arasında bu basamak
 *     hâlâ karar verir ("Yumurta …" ürünleri "Ozmo Yumurta"nın önünde kalır).
 *  5. Sonrası çağırana ait: store_count DESC, min_price ASC.
 *
 * Kelime sınırı REGEX ile DEĞİL, boşlukla doldurulmuş LIKE ile yazıldı: sorgu
 * kullanıcı girdisidir ve bir regex metakarakteri (`a([`) `~` operatöründe
 * "invalid regular expression" ile 500 ürettiği gibi geri-izleme patlamasına
 * (ReDoS) da açıktır. LIKE'ın metakarakterleri (`%`, `_`) yalnızca eşleşmeyi
 * gevşetir — ne hata üretir ne tehlike; üstelik aday kümesi WHERE ile zaten
 * daraltılmış olduğu için etkisi sadece sıralamadır.
 */
export function buildRelevanceOrder(nq: string): Prisma.Sql {
    const nqSql = Prisma.sql`cheep_normalize(${nq})`;
    const paddedName = Prisma.sql`(' ' || cheep_normalize(p.name) || ' ')`;
    return Prisma.sql`
        (${paddedName} LIKE ('% ' || ${nqSql} || ' %'))::int DESC,
        word_similarity(${nqSql}, cheep_normalize(p.name)) DESC,
        least(floor(similarity(${nqSql}, cheep_normalize(p.name)) / 0.10), 3) DESC,
        (${paddedName} LIKE (' ' || ${nqSql} || ' %'))::int DESC,
    `;
}

interface GetAllProductsParams {
    category_id?: number;
    /** Website URL'leri slug tabanlı; ülke içinde çözülür. */
    category_slug?: string;
    /** Market filtresi (çoklu). Ürün, bu marketlerden en az birinde bulunmalı. */
    store_slug?: string[];
    brand?: string;
    search?: string;
    sort?: SortMode;
    /** En az kaç markette bulunsun — karşılaştırma değeri olmayanları eler. */
    min_stores?: number;
    min_price?: number;
    max_price?: number;
    limit?: number;
    offset?: number;
    countryId?: number;
    /** Facet sayıları da hesaplansın mı (website filtre paneli için). */
    withFacets?: boolean;
}

export interface ProductFacets {
    categories: Array<{ slug: string; name: string; n: number }>;
    stores: Array<{ slug: string; name: string; n: number }>;
}

export const getAllProducts = async (params: GetAllProductsParams) => {
    const {
        category_id,
        category_slug,
        store_slug,
        brand,
        search,
        min_stores,
        min_price,
        max_price,
        limit = 50,
        offset = 0,
        countryId,
        withFacets = false,
    } = params;

    const filter = buildProductFilter({
        countryId: countryId ?? 0,
        category_id,
        category_slug,
        store_slug,
        brand,
        search,
        sort: params.sort,
        min_stores,
        min_price,
        max_price,
    });

    const where: Prisma.ProductWhereInput = {};
    if (countryId) {
        where.country_id = countryId;
    }
    // Raw SQL filtresinde kullanılmak üzere çözülen kategori id listesi
    let categoryIdsForSql: number[] | null = null;

    // Slug ile gelen kategori önce id'ye çevrilir. Slug artık YALNIZCA ülke
    // içinde benzersiz; ülkesiz arama başka ülkenin kategorisini bulabilirdi.
    let resolvedCategoryId = category_id;
    if (filter.categorySlug && countryId) {
        const bySlug = await prisma.category.findUnique({
            where: { country_id_slug: { country_id: countryId, slug: filter.categorySlug } },
            select: { id: true },
        });
        // Bilinmeyen slug → eşleşen ürün yok. Filtreyi düşürüp tüm kataloğu
        // döndürmek kullanıcıyı yanıltırdı (yanlış URL'de dolu sayfa).
        if (!bySlug) {
            return {
                products: [],
                pagination: { total: 0, limit, offset, hasMore: false },
                ...(withFacets ? { facets: { categories: [], stores: [] } } : {}),
            };
        }
        resolvedCategoryId = bySlug.id;
    }

    if (resolvedCategoryId) {
        const category_id = resolvedCategoryId;
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
    
    // WHERE parçaları AYRI tutulur ve sonra birleştirilir.
    //
    // Neden tek bir birikimli string değil: facet sayıları her boyut için
    // KENDİ boyutu hariç hesaplanmalı. "BİM"i seçtiğinde diğer marketlerin
    // sayısı sıfırlanırsa kullanıcı seçimini genişletemez — filtre paneli
    // çıkmaz sokağa döner.
    const clauses: Prisma.Sql[] = [];
    let categoryClause: Prisma.Sql = Prisma.empty;
    let storeClause: Prisma.Sql = Prisma.empty;

    if (countryId) {
        clauses.push(Prisma.sql`p.country_id = ${countryId}`);
    }

    if (categoryIdsForSql && categoryIdsForSql.length > 0) {
        categoryClause = Prisma.sql`p.category_id IN (${Prisma.join(categoryIdsForSql)})`;
    }

    if (brand) {
        clauses.push(Prisma.sql`p.brand ILIKE ${'%' + brand + '%'}`);
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

        clauses.push(Prisma.sql`(
            (${tokenAnd})
            OR cheep_normalize(${nq}) <% cheep_normalize(p.name)
            OR cheep_normalize(coalesce(p.brand, '')) LIKE '%' || cheep_normalize(${nq}) || '%'
            ${barcodeClause}
        )`);

        searchOrder = buildRelevanceOrder(nq);
    }

    // 🏪 Market filtresi. EXISTS ile: JOIN üzerinden filtrelemek ürünü market
    // sayısı kadar çoğaltır ve hem toplam sayımı hem min_price'ı bozardı.
    if (filter.storeSlugs && filter.storeSlugs.length > 0) {
        storeClause = Prisma.sql`EXISTS (
            SELECT 1 FROM store_prices spf
            JOIN stores stf ON stf.id = spf.store_id
            WHERE spf.product_id = p.id AND stf.slug IN (${Prisma.join(filter.storeSlugs)})
        )`;
    }

    // 💰 Fiyat aralığı: ürünün EN DÜŞÜK fiyatı aralıkta olmalı. Kullanıcı
    // "50 TL'ye kadar" derken en ucuz halini kastediyor; herhangi bir markette
    // ucuz olan ürün listede kalmalı.
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
        const lo = filter.minPrice ?? 0;
        const hi = filter.maxPrice ?? Number.MAX_SAFE_INTEGER;
        clauses.push(Prisma.sql`EXISTS (
            SELECT 1 FROM store_prices spp
            WHERE spp.product_id = p.id
            GROUP BY spp.product_id
            HAVING MIN(spp.price::numeric) BETWEEN ${lo} AND ${hi}
        )`);
    }

    // 🔢 En az N markette bulunma koşulu.
    if (filter.minStores !== undefined) {
        clauses.push(Prisma.sql`(
            SELECT COUNT(DISTINCT spm.store_id) FROM store_prices spm WHERE spm.product_id = p.id
        ) >= ${filter.minStores}`);
    }

    /** Verilen parçalardan WHERE üretir; boş parçalar atlanır. */
    const composeWhere = (...parts: Prisma.Sql[]): Prisma.Sql => {
        const active = parts.filter((p) => p !== Prisma.empty);
        return active.length === 0
            ? Prisma.sql`WHERE 1=1`
            : Prisma.sql`WHERE ${Prisma.join(active, ' AND ')}`;
    };

    const whereClause = composeWhere(...clauses, categoryClause, storeClause);
    // Facet'ler kendi boyutları HARİÇ hesaplanır (bkz. yukarıdaki gerekçe).
    const whereForCategoryFacets = composeWhere(...clauses, storeClause);
    const whereForStoreFacets = composeWhere(...clauses, categoryClause);

    // 📊 Sıralama. `savings` = en ucuz ile en pahalı arasındaki fark: "burada
    // kazanç var" sinyali, uygulamanın var oluş sebebi.
    const sortOrder: Prisma.Sql = (() => {
        switch (filter.effectiveSort) {
            case 'price_asc':
                return Prisma.sql`min_price ASC NULLS LAST,`;
            case 'price_desc':
                return Prisma.sql`min_price DESC NULLS LAST,`;
            case 'savings':
                return Prisma.sql`(MAX(sp.price::numeric) - MIN(sp.price::numeric)) DESC NULLS LAST,`;
            case 'name':
                return Prisma.sql`p.name ASC,`;
            default:
                // store_count / relevance → mevcut varsayılan (aşağıda zaten var)
                return Prisma.empty;
        }
    })();

    // 🔎 `<%` operatörü GIN trigram index'lerini kullanabilir (bare word_similarity()
    // fonksiyonu kullanamaz), ama pg_trgm.word_similarity_threshold GUC'una bağlıdır
    // (varsayılan 0.6, yazım hataları için çok katı). Aynı bağlantıda SET LOCAL ile
    // düşürüyoruz — bu yüzden her iki raw sorgu da tek bir transaction içinde.
    //
    // DEĞER 0.35 DEĞİL 0.45 (26 Ağu 2026, ÖLÇÜLEREK seçildi).
    //
    // 0.35 çok gevşekti: Türkçe katalogda `chicken` araması 53 alakasız sonuç
    // döndürüyordu (Eti Crax **Chi**li Lime, Long **Chi**ps, M**chi**a) —
    // eşleştirici "chi" alt dizesine takılıyordu.
    //
    // Eşiği yükseltmenin bedeli yazım hatası toleransıdır, o yüzden tahminle
    // değil ölçümle seçildi. Değerlendirme seti UYDURMA DEĞİL: üretimdeki
    // erişim loglarından çıkarılan 593 gerçek arama (307 benzersiz).
    // Ölçüm ve set: `scripts/search-threshold-eval.sql`.
    //
    // 0.35 -> 0.45 sonucu:
    //   • 12 gerçek TR + 10 gerçek PL sorgusunun tamamında İLK SONUÇ AYNI
    //   • 5 yazım hatası (peynr, sut, yogurt, makarrna, ekemk) çalışmaya devam
    //   • `chicken` 53 -> 0 (tek gerçek çöp vakası kapandı)
    //   • hâlâ sonuç dönen İngilizce kelimeler GERÇEK eşleşme:
    //     "Kinder Chocolate", "Coffee Mate", "Pınar Protein Süt"
    //
    // 0.55 DENENDİ VE REDDEDİLDİ: `ekemk` 41 -> 0, Lehçe `jajka` 195 -> 20.
    //
    // ÖNEMLİ: yazarken arama (`y`, `yu`, `yum`, `yumu`) bu eşikten
    // ETKİLENMİYOR — onları yukarıdaki alt dize (token) dalı yakalıyor,
    // `<%` değil. Ölçümde 7/7 önek her eşikte çalıştı.
    //
    // Eşiği yine değiştirecek olan: önce `search-threshold-eval.sql` çalıştır.
    const [products, totalRows, categoryFacetRows, storeFacetRows] = await prisma.$transaction(async (tx) => {
        if (search && nq) {
            // SET LOCAL transaction-scoped'tur; değer sabit (kullanıcı girdisi değil).
            await tx.$executeRawUnsafe('SET LOCAL pg_trgm.word_similarity_threshold = 0.45');
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
                ${sortOrder}
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

        // Facet'ler yalnızca istendiğinde: website filtre paneli için gerekli,
        // mobil listeler için iki fazladan ağır sorgu demek.
        const categoryFacetRows = withFacets
            ? await tx.$queryRaw<Array<{ slug: string; name: string; n: bigint }>>`
                SELECT c.slug, c.name, COUNT(*)::bigint AS n
                FROM "products" p
                JOIN "categories" c ON c.id = p.category_id
                ${whereForCategoryFacets}
                GROUP BY c.slug, c.name
                ORDER BY n DESC
            `
            : [];

        const storeFacetRows = withFacets
            ? await tx.$queryRaw<Array<{ slug: string; name: string; n: bigint }>>`
                SELECT s.slug, s.name, COUNT(DISTINCT p.id)::bigint AS n
                FROM "products" p
                JOIN "store_prices" spx ON spx.product_id = p.id
                JOIN "stores" s ON s.id = spx.store_id AND s.slug IS NOT NULL
                ${whereForStoreFacets}
                GROUP BY s.slug, s.name
                ORDER BY n DESC
            `
            : [];

        return [products, totalRows, categoryFacetRows, storeFacetRows] as const;
    });
    const total = Number(totalRows[0]?.count ?? 0);

    const facets: ProductFacets | undefined = withFacets
        ? {
              categories: categoryFacetRows.map((r) => ({
                  slug: r.slug,
                  name: r.name,
                  n: Number(r.n),
              })),
              stores: storeFacetRows.map((r) => ({ slug: r.slug, name: r.name, n: Number(r.n) })),
          }
        : undefined;

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
            ...(facets ? { facets } : {}),
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
        ...(facets ? { facets } : {}),
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
    // Kirpilmis deger AYRI tutuluyor: yanitin `days` alani eskiden HAM
    // istegi yansitiyordu, yani `days=9999` sorulunca sunucu 365 gunluk
    // veri donup basligina "9999 gun" yaziyordu. Grafik, sahip olmadigi
    // bir araligi ilan ediyordu.
    const effectiveDays = Math.max(1, Math.min(days, 365));
    since.setDate(since.getDate() - effectiveDays);

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
        days: effectiveDays,
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

