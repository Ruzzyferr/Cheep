/**
 * Mevcut ürün ve marketlere SEO slug'ı üretir.
 *
 * Fikir basit ama bir kural kritik: **var olan slug'a DOKUNULMAZ.** Slug bir
 * kez üretildikten sonra o sayfanın kalıcı adresidir; ürün adı sonradan
 * düzelse bile değiştirmek indekslenmiş URL'i öldürür. Script bu yüzden
 * yalnızca `slug IS NULL` satırları doldurur ve defalarca çalıştırılabilir.
 *
 * Kullanım:
 *   npx tsx scripts/backfill-slugs.ts            # ne yapacağını yazar, yazmaz
 *   npx tsx scripts/backfill-slugs.ts --apply    # uygular
 */
import { PrismaClient } from '@prisma/client';
import { productSlug, slugify, uniqueSlug } from '../src/utils/slug.js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const BATCH = 500;

async function backfillStores() {
    const countries = await prisma.country.findMany({ select: { id: true, name: true } });
    let total = 0;

    for (const country of countries) {
        const stores = await prisma.store.findMany({
            where: { country_id: country.id },
            select: { id: true, name: true, slug: true },
            orderBy: { id: 'asc' },
        });
        if (stores.length === 0) continue;

        // Aynı ülkede zaten kullanılmış slug'lar rezerve edilir.
        const taken = new Set(stores.map((s) => s.slug).filter((s): s is string => !!s));
        const updates = stores
            .filter((s) => !s.slug)
            .map((s) => ({ id: s.id, slug: uniqueSlug(slugify(s.name), s.id, taken) }));

        if (updates.length === 0) continue;
        total += updates.length;
        console.log(`  ${country.name}: ${updates.length} market`);
        for (const u of updates.slice(0, 5)) console.log(`    ${u.slug}`);

        if (APPLY) {
            for (const u of updates) {
                await prisma.store.update({ where: { id: u.id }, data: { slug: u.slug } });
            }
        }
    }
    return total;
}

async function backfillProducts() {
    const countries = await prisma.country.findMany({ select: { id: true, name: true } });
    let total = 0;

    for (const country of countries) {
        // Ülke başına tek seferde çekiyoruz: slug benzersizliği ülke kapsamlı,
        // yani çakışma kontrolü için o ülkenin tamamı elde olmalı.
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

        if (updates.length === 0) continue;
        total += updates.length;
        console.log(`  ${country.name}: ${updates.length} ürün`);
        for (const u of updates.slice(0, 5)) console.log(`    ${u.slug}`);

        if (APPLY) {
            // Tek tek UPDATE 40 bin satırda çok yavaş; UNNEST ile toplu yazıyoruz.
            for (let i = 0; i < updates.length; i += BATCH) {
                const chunk = updates.slice(i, i + BATCH);
                await prisma.$executeRawUnsafe(
                    `UPDATE products AS p SET slug = v.slug
                     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::text[]) AS slug) AS v
                     WHERE p.id = v.id`,
                    chunk.map((c) => c.id),
                    chunk.map((c) => c.slug),
                );
                process.stdout.write(`\r    yazıldı: ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
            }
            process.stdout.write('\n');
        }
    }
    return total;
}

async function main() {
    console.log(APPLY ? '=== UYGULANIYOR ===' : '=== DENEME (yazmaz) — uygulamak için --apply ===');

    console.log('\nMarketler:');
    const stores = await backfillStores();
    console.log('\nÜrünler:');
    const products = await backfillProducts();

    console.log(`\nToplam: ${stores} market, ${products} ürün${APPLY ? ' güncellendi' : ' güncellenecek'}`);

    if (APPLY) {
        const missing = await prisma.product.count({ where: { slug: null } });
        const dupes = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT COUNT(*)::bigint AS n FROM (
               SELECT country_id, slug FROM products WHERE slug IS NOT NULL
               GROUP BY country_id, slug HAVING COUNT(*) > 1) d`,
        );
        console.log(`Doğrulama: slug'sız ürün ${missing}, çakışan slug ${dupes[0]?.n ?? 0}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
