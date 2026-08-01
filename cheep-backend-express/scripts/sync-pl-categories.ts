/**
 * Prod'da (veya herhangi bir ortamda) STANDARD_CATEGORIES setini idempotent
 * upsert eder, sonra bir export dosyasındaki (store_id, store_sku) -> category_slug
 * eşlemesinden PL ürünlerinin BOŞ category_id'lerini doldurur.
 *
 * Neden: veri başka bir ortamdan transfer edilince hedef DB'nin kategori tablosu
 * eksikse (ör. 88 vs 250 slug) category_slug çözülemez ve ürünler kategorisiz kalır.
 * Bu script kategorileri tamamlar + backfill yapar.
 *
 * Kullanım (container içinde): EXPORT_PATH=/tmp/pl_export.json npx tsx scripts/sync-pl-categories.ts
 */
import { prisma } from '../src/utils/prisma.client.js';
import { STANDARD_CATEGORIES } from '../src/config/standard-categories.js';
import * as fs from 'fs';

async function main() {
    const plCountry = await prisma.country.findFirst({ where: { code: 'PL' } });
    if (!plCountry) throw new Error('PL country yok');

    // 1) PL kategori ağacını idempotent upsert et (seed.ts ile aynı mantık).
    //    STANDARD_CATEGORIES yalnızca PL'nin taksonomisidir; TR ağacı devletin
    //    verisinden türer ve buraya karışmaz.
    const slugToId = new Map<string, number>();
    for (const c of STANDARD_CATEGORIES) {
        const parent = await prisma.category.upsert({
            where: { country_id_slug: { country_id: plCountry.id, slug: c.slug } },
            update: { name: c.name, display_order: c.displayOrder, icon_url: c.icon || null },
            create: { name: c.name, slug: c.slug, country_id: plCountry.id, parent_id: null, display_order: c.displayOrder, icon_url: c.icon || null },
        });
        slugToId.set(c.slug, parent.id);
        for (const s of c.subcategories) {
            const sub = await prisma.category.upsert({
                where: { country_id_slug: { country_id: plCountry.id, slug: s.slug } },
                update: { name: s.name, parent_id: parent.id, display_order: s.displayOrder },
                create: { name: s.name, slug: s.slug, country_id: plCountry.id, parent_id: parent.id, display_order: s.displayOrder },
            });
            slugToId.set(s.slug, sub.id);
        }
    }
    console.log(`[sync] PL kategorileri senkronlandı: ${slugToId.size} slug`);

    // 2) Export'tan (store_id|store_sku) -> slug eşlemesi kur.
    const exportPath = process.env.EXPORT_PATH || '/tmp/pl_export.json';
    const rows: Array<{ store_id: number; store_sku: string; category_slug?: string }> =
        JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    const skuToSlug = new Map<string, string>();
    for (const r of rows) {
        if (r.category_slug) skuToSlug.set(`${r.store_id}|${r.store_sku}`, r.category_slug);
    }

    // 3) PL ürünlerinin boş category_id'lerini doldur.
    const pl = plCountry;
    const sps = await prisma.storePrice.findMany({
        where: { product: { country_id: pl.id } },
        select: { store_id: true, store_sku: true, product_id: true, product: { select: { category_id: true } } },
    });
    const done = new Set<number>();
    let updated = 0, noSlug = 0, unknownSlug = 0;
    for (const sp of sps) {
        if (sp.product.category_id || done.has(sp.product_id)) continue;
        const slug = sp.store_sku ? skuToSlug.get(`${sp.store_id}|${sp.store_sku}`) : undefined;
        if (!slug) { noSlug++; continue; }
        const cid = slugToId.get(slug);
        if (!cid) { unknownSlug++; continue; }
        await prisma.product.update({ where: { id: sp.product_id }, data: { category_id: cid } });
        done.add(sp.product_id);
        updated++;
    }
    console.log(`[sync] kategorilenen ürün: ${updated} | slug'suz: ${noSlug} | bilinmeyen-slug: ${unknownSlug}`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
