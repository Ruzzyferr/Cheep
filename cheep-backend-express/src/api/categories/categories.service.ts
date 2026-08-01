// ============================================
// src/api/categories/categories.service.ts
// HİYERARŞİK KATEGORİ SERVİSİ — ÜLKE BAZLI
// ============================================
//
// İki kural bu dosyanın şeklini belirliyor, ikisi de canlıda hataya yol açtığı
// için yazıldı:
//
// 1) **Listeler ülkeye göre süzülür.** `categories` uzun süre ülkesizdi; TR
//    (devletin marketfiyati verisinden türetilen ağaç) ile PL (scraper'ın kendi
//    ağacı) tek tabloda çakıştı. Ürün sayıları da (`_count.products`) ülkeden
//    bağımsız sayılıyordu: Türk kullanıcı, Polonya ürünlerini içeren sayılar
//    görüyordu ve TR'de sıfır ürünü olan kategoriler dolu görünüyordu.
//
// 2) **Ürünü olmayan kategori DÖNMEZ.** Yarım kalmış bir migration
//    `meyve-ve-sebze`yi içi boşaltılmış bir kabuk bırakmıştı (0 ürün, 0 çocuk).
//    Anasayfa onu gösteriyor, kullanıcı tıklayınca boş ekran geliyordu. Sayım
//    ALT AĞACI kapsar: üst kategorinin kendi ürünü olmayabilir ama çocukları
//    doludur.
import { prisma } from '../../utils/prisma.client.js';
import { Prisma } from '@prisma/client';
import slugifyModule from 'slugify';
import logger from '../../utils/logger.js';
import { notFound, conflict, badRequest } from '../../utils/app-error.js';

const slugify =
    (slugifyModule as unknown as typeof import('slugify')['default']) ??
    ((slugifyModule as unknown) as typeof import('slugify')['default']);

/** Listeleme uçlarının döndürdüğü satır. `product_count` alt ağaç toplamıdır. */
export interface CategoryRow {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    display_order: number;
    icon_url: string | null;
    product_count: number;
}

export interface CategoryTreeNode extends CategoryRow {
    children: CategoryRow[];
}

const byOrder = (a: CategoryRow, b: CategoryRow) =>
    a.display_order - b.display_order || a.name.localeCompare(b.name, 'tr');

/**
 * Bir ülkedeki, alt ağacında EN AZ BİR ürünü olan tüm kategoriler.
 *
 * Tek özyinelemeli CTE: kategori başına ayrı sayım sorgusu atmak 250+ kategoride
 * N+1 demekti. `depth < 6` guard'ı şemanın engellemediği parent döngüsüne karşı
 * (gerçek ağaç 2 seviye).
 */
export const getCategoriesWithCounts = async (countryId: number): Promise<CategoryRow[]> => {
    const rows = await prisma.$queryRaw<
        Array<Omit<CategoryRow, 'product_count'> & { product_count: bigint }>
    >`
        WITH RECURSIVE tree(root_id, id, depth) AS (
            SELECT id, id, 0 FROM categories WHERE country_id = ${countryId}
          UNION ALL
            SELECT t.root_id, c.id, t.depth + 1
            FROM categories c
            JOIN tree t ON c.parent_id = t.id
            WHERE t.depth < 6
        ),
        counts AS (
            SELECT t.root_id, COUNT(p.id)::bigint AS n
            FROM tree t
            LEFT JOIN products p ON p.category_id = t.id AND p.country_id = ${countryId}
            GROUP BY t.root_id
        )
        SELECT c.id, c.name, c.slug, c.parent_id, c.display_order, c.icon_url,
               counts.n AS product_count
        FROM categories c
        JOIN counts ON counts.root_id = c.id
        WHERE c.country_id = ${countryId} AND counts.n > 0
        ORDER BY c.display_order ASC, c.name ASC
    `;

    // Postgres COUNT() BigInt döner; JSON.stringify BigInt'te patlar.
    return rows.map((r) => ({ ...r, product_count: Number(r.product_count) }));
};

/** Yalnızca kökler (parent_id = null). */
export const onlyParents = (rows: CategoryRow[]): CategoryRow[] => {
    const ids = new Set(rows.map((r) => r.id));
    // parent_id dolu ama parent listede yoksa (ör. parent'ın hiç ürünü yok ve
    // elendi) satırı öksüz bırakmayıp kök sayarız — sessizce kaybolmasın.
    return rows.filter((r) => r.parent_id === null || !ids.has(r.parent_id)).sort(byOrder);
};

/** Verilen parent'ın doğrudan çocukları. */
export const childrenOf = (rows: CategoryRow[], parentId: number): CategoryRow[] =>
    rows.filter((r) => r.parent_id === parentId).sort(byOrder);

/** Düz satırları iki seviyeli ağaca çevirir. */
export const buildTree = (rows: CategoryRow[]): CategoryTreeNode[] =>
    onlyParents(rows).map((parent) => ({ ...parent, children: childrenOf(rows, parent.id) }));

/**
 * Tüm kategoriler (düz liste, ülkeye göre süzülmüş).
 */
export const getAllCategories = async (countryId: number): Promise<CategoryRow[]> => {
    return await getCategoriesWithCounts(countryId);
};

/**
 * Ana kategoriler. Sıra `display_order`'dan gelir; istemcide elle yazılmış
 * öncelik listeleri YOKTUR (mobilde `HOME_PRIORITY` tam da bu yüzden ölü
 * kategoriyi ilk sıraya koyuyordu).
 */
export const getParentCategories = async (countryId: number): Promise<CategoryRow[]> => {
    const rows = await getCategoriesWithCounts(countryId);
    const parents = onlyParents(rows);
    logger.debug(`[Categories] country=${countryId} parent categories: ${parents.length}`);
    return parents;
};

/**
 * Hiyerarşik ağaç.
 */
export const getCategoryTree = async (countryId: number): Promise<CategoryTreeNode[]> => {
    return buildTree(await getCategoriesWithCounts(countryId));
};

/**
 * Bir kategorinin alt kategorileri.
 */
export const getSubcategories = async (parentId: number, countryId: number): Promise<CategoryRow[]> => {
    return childrenOf(await getCategoriesWithCounts(countryId), parentId);
};

/**
 * ID'ye göre kategori getir (children ile birlikte).
 * `countryId` verilirse başka ülkenin kategorisi 404 gibi davranır (null döner).
 */
export const getCategoryById = async (id: number, countryId?: number) => {
    const category = await prisma.category.findUnique({
        where: { id },
        include: {
            parent: true,
            children: { orderBy: { display_order: 'asc' } },
            _count: { select: { products: true, children: true } },
        },
    });
    if (!category) return null;
    if (countryId !== undefined && category.country_id !== countryId) return null;
    return category;
};

/**
 * Slug'a göre kategori getir. Slug artık YALNIZCA ülke içinde benzersiz —
 * `country_id` zorunlu.
 */
export const getCategoryBySlug = async (slug: string, countryId: number) => {
    return await prisma.category.findUnique({
        where: { country_id_slug: { country_id: countryId, slug } },
        include: {
            parent: true,
            children: { orderBy: { display_order: 'asc' } },
            _count: { select: { products: true, children: true } },
        },
    });
};

/**
 * İsme göre kategori bul (ülke içinde).
 */
export const getCategoryByName = async (name: string, countryId: number) => {
    return await prisma.category.findFirst({
        where: { name, country_id: countryId },
    });
};

/**
 * Kategori oluştur. Slug verilmezse addan üretilir.
 */
export const createCategory = async (data: {
    name: string;
    slug?: string;
    country_id: number;
    parent_id?: number | null;
    display_order?: number;
    icon_url?: string;
}) => {
    const finalSlug = data.slug || slugify(data.name, {
        lower: true,
        locale: 'tr',
        strict: true,
    });

    // Çakışma kontrolü ülke içindedir: aynı slug başka ülkede meşru şekilde
    // var olabilir (TR'nin `sut`'u ile PL'nin `sut`'u ayrı kategorilerdir).
    const existing = await prisma.category.findUnique({
        where: { country_id_slug: { country_id: data.country_id, slug: finalSlug } },
    });

    if (existing) {
        throw conflict('Bu slug zaten kullanılıyor');
    }

    if (data.parent_id) {
        const parent = await prisma.category.findUnique({ where: { id: data.parent_id } });
        if (!parent) {
            throw badRequest('Parent kategori bulunamadı');
        }
        // Ağaçlar ülkeye bağlı: bir kategori başka ülkenin çocuğu olamaz.
        if (parent.country_id !== data.country_id) {
            throw badRequest('Parent kategori farklı bir ülkeye ait');
        }
    }

    return await prisma.category.create({
        data: {
            name: data.name,
            slug: finalSlug,
            country_id: data.country_id,
            parent_id: data.parent_id || null,
            display_order: data.display_order || 0,
            icon_url: data.icon_url,
        },
        include: { parent: true },
    });
};

/**
 * Kategori güncelle
 */
export const updateCategory = async (
    id: number,
    data: {
        name?: string;
        slug?: string;
        parent_id?: number | null;
        display_order?: number;
        icon_url?: string;
    }
) => {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
        throw notFound('Kategori bulunamadı');
    }

    if (data.slug && data.slug !== category.slug) {
        const existing = await prisma.category.findUnique({
            where: { country_id_slug: { country_id: category.country_id, slug: data.slug } },
        });
        if (existing) {
            throw conflict('Bu slug zaten kullanılıyor');
        }
    }

    if (data.parent_id !== undefined) {
        if (data.parent_id === id) {
            throw badRequest('Kategori kendi parent\'ı olamaz');
        }
        if (data.parent_id !== null) {
            const parent = await prisma.category.findUnique({ where: { id: data.parent_id } });
            if (!parent) {
                throw badRequest('Parent kategori bulunamadı');
            }
            if (parent.country_id !== category.country_id) {
                throw badRequest('Parent kategori farklı bir ülkeye ait');
            }
        }
    }

    return await prisma.category.update({
        where: { id },
        data,
        include: { parent: true, children: true },
    });
};

/**
 * Kategori sil
 */
export const deleteCategory = async (id: number) => {
    const category = await prisma.category.findUnique({
        where: { id },
        include: {
            children: true,
            _count: { select: { products: true } },
        },
    });

    if (!category) {
        throw notFound('Kategori bulunamadı');
    }

    if (category.children.length > 0) {
        throw conflict('Alt kategorileri olan kategori silinemez');
    }

    if (category._count.products > 0) {
        throw conflict(`Bu kategoride ${category._count.products} ürün var. Önce ürünleri taşıyın.`);
    }

    await prisma.category.delete({ where: { id } });
};

/**
 * Bir kategorinin tüm parent'larını getir (breadcrumb için)
 */
export const getCategoryBreadcrumb = async (categoryId: number) => {
    const breadcrumb: Array<{ id: number; name: string; slug: string; parent_id: number | null }> = [];
    let currentId: number | null = categoryId;
    const visited = new Set<number>(); // parent döngüsüne karşı koruma (sonsuz loop engeli)

    while (currentId !== null) {
        if (visited.has(currentId)) {
            logger.warn(`[Categories] Breadcrumb parent döngüsü tespit edildi (id: ${currentId})`);
            break;
        }
        visited.add(currentId);

        const category: { id: number; name: string; slug: string; parent_id: number | null } | null =
            await prisma.category.findUnique({
                where: { id: currentId },
                select: { id: true, name: true, slug: true, parent_id: true },
            });

        if (!category) break;

        breadcrumb.unshift(category);
        currentId = category.parent_id;
    }

    return breadcrumb;
};

/**
 * Kategori ve alt kategorilerindeki toplam ürün sayısı (ülke bazlı).
 */
export const getCategoryProductCount = async (
    categoryId: number,
    countryId: number,
    includeChildren: boolean = true,
): Promise<number> => {
    if (!includeChildren) {
        const n = await prisma.product.count({
            where: { category_id: categoryId, country_id: countryId },
        });
        return n;
    }

    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
        WITH RECURSIVE tree(id, depth) AS (
            SELECT id, 0 FROM categories WHERE id = ${categoryId} AND country_id = ${countryId}
          UNION ALL
            SELECT c.id, t.depth + 1
            FROM categories c
            JOIN tree t ON c.parent_id = t.id
            WHERE t.depth < 6
        )
        SELECT COUNT(p.id)::bigint AS n
        FROM tree t
        LEFT JOIN products p ON p.category_id = t.id AND p.country_id = ${countryId}
    `;

    return Number(rows[0]?.n ?? 0);
};

/** Prisma.sql yeniden export edilmiyor; tip kontrolü için tutuluyor. */
export type { Prisma };
