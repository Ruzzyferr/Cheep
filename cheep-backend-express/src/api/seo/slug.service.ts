/**
 * Slug'ı olmayan ürün ve marketlere slug üretir.
 *
 * Bu tek seferlik bir göç değil, **gecelik bir adım**: scrape her gün yeni
 * ürünler getiriyor ve slug'sız ürünün sayfası olamaz. Gecelik site üretimi
 * export'tan ÖNCE bunu çağırır.
 *
 * Değişmez kural: var olan slug'a asla dokunulmaz. Slug o sayfanın kalıcı
 * adresidir; ürün adı sonradan düzelse bile değiştirmek indekslenmiş URL'i
 * öldürür ve Google'da biriken sıralamayı sıfırlar.
 */
import { prisma } from '../../utils/prisma.client.js';
import { productSlug, slugify, uniqueSlug } from '../../utils/slug.js';

/** Tek UPDATE'te yazılan satır sayısı. */
const BATCH = 500;

export interface SlugBackfillResult {
    stores: number;
    products: number;
    remaining: number;
    collisions: number;
}

async function backfillStores(): Promise<number> {
    const stores = await prisma.store.findMany({
        select: { id: true, name: true, slug: true, country_id: true },
        orderBy: { id: 'asc' },
    });

    // Benzersizlik ülke bazında, o yüzden rezervasyon kümesi de ülke bazında.
    const taken = new Map<number, Set<string>>();
    for (const s of stores) {
        if (!taken.has(s.country_id)) taken.set(s.country_id, new Set());
        if (s.slug) taken.get(s.country_id)!.add(s.slug);
    }

    let written = 0;
    for (const s of stores) {
        if (s.slug) continue;
        const slug = uniqueSlug(slugify(s.name), s.id, taken.get(s.country_id)!);
        await prisma.store.update({ where: { id: s.id }, data: { slug } });
        written++;
    }
    return written;
}

async function backfillProducts(): Promise<number> {
    const countries = await prisma.country.findMany({ select: { id: true } });
    let written = 0;

    for (const country of countries) {
        // Ülkenin tamamını çekiyoruz: çakışma kontrolü için mevcut slug'ların
        // hepsi elde olmalı. 40 bin satır × 4 kolon ~ birkaç MB, sorun değil.
        const products = await prisma.product.findMany({
            where: { country_id: country.id },
            select: { id: true, name: true, brand: true, slug: true },
            orderBy: { id: 'asc' },
        });
        if (products.length === 0) continue;

        const taken = new Set(products.map((p) => p.slug).filter((s): s is string => !!s));
        const updates = products
            .filter((p) => !p.slug)
            .map((p) => ({ id: p.id, slug: uniqueSlug(productSlug(p.name, p.brand), p.id, taken) }));

        // Tek tek UPDATE 40 bin satırda dakikalar sürüyor; UNNEST ile toplu.
        for (let i = 0; i < updates.length; i += BATCH) {
            const chunk = updates.slice(i, i + BATCH);
            await prisma.$executeRawUnsafe(
                `UPDATE products AS p SET slug = v.slug
                 FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::text[]) AS slug) AS v
                 WHERE p.id = v.id`,
                chunk.map((c) => c.id),
                chunk.map((c) => c.slug),
            );
        }
        written += updates.length;
    }
    return written;
}

export async function ensureSlugs(): Promise<SlugBackfillResult> {
    const stores = await backfillStores();
    const products = await backfillProducts();

    const remaining = await prisma.product.count({ where: { slug: null } });
    const dupes = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT COUNT(*)::bigint AS n FROM (
           SELECT country_id, slug FROM products WHERE slug IS NOT NULL
           GROUP BY country_id, slug HAVING COUNT(*) > 1) d`,
    );

    return { stores, products, remaining, collisions: Number(dupes[0]?.n ?? 0) };
}
