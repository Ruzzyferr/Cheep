/**
 * Taksonomi birleştirmesini UYGULAR.
 *
 * `20260801200000_category_country_scope` migration'ı `country_id`'yi kabaca —
 * alt ağaçtaki ürün çoğunluğuna göre — doldurur. Bu script kalan işi yapar:
 *
 *   1. Bir kategoride başka ülkenin ürünü varsa o ülkenin kopyasını yaratır
 *      (parent zinciriyle) ve ürünleri oraya taşır.
 *   2. Kendi ülkesinde ürünü kalmayan kategorileri siler.
 *   3. Silinen ikizler için `category_redirects` yazar (301 kaynağı).
 *
 * Karar mantığı saf ve test edilmiş: `src/services/reconcile-taxonomy.ts`.
 * Burası yalnızca planı sırayla uygular.
 *
 * VARSAYILAN KURU ÇALIŞMADIR. Yazmak için `--apply` verin:
 *   npx tsx scripts/reconcile-taxonomy.ts            # rapor
 *   npx tsx scripts/reconcile-taxonomy.ts --apply    # uygula
 *
 * Idempotent: ikinci çalıştırmada plan boş çıkar.
 */
import * as fs from 'node:fs';
import { prisma } from '../src/utils/prisma.client.js';
import {
    planReconciliation,
    type CategoryRef,
    type OwnedCategory,
    type ProductCount,
    type ReconcileOptions,
} from '../src/services/reconcile-taxonomy.js';

const APPLY = process.argv.includes('--apply');
/**
 * Güvenli mod: yalnızca deterministik onarımlar uygulanır, ikiz birleştirme
 * yalnızca RAPORLANIR. Haftalık zamanlayıcı bu modda çalışır — iki meşru
 * kategoriyi birleştirmek geri alınamaz ve karar sezgisel bir eşiğe dayanıyor.
 */
const SAFE_ONLY = process.argv.includes('--safe-only');

/** `--taxonomy <yol>` — mf_taxonomy.py çıktısı. */
function argValue(flag: string): string | undefined {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Devletin türettiği taksonomiden kanonik TR slug kümesini okur.
 *
 * Bu dosya verilirse ikiz gruplarının kazananını O belirler — TR kataloğunun
 * kaynağı marketfiyati.org.tr'dir, elle tutulan bir liste değil. Verilmezse
 * veri konuşur (en çok ürünü olan kazanır) ve rapor bunu açıkça söyler.
 */
function loadCanonical(countryId: number): ReconcileOptions {
    const path = argValue('--taxonomy');
    if (!path) return {};
    if (!fs.existsSync(path)) {
        throw new Error(`Taksonomi dosyası bulunamadı: ${path}`);
    }
    const tax = JSON.parse(fs.readFileSync(path, 'utf-8')) as {
        tops: Array<{ slug: string; children: Array<{ slug: string }> }>;
    };
    const slugs = new Set<string>();
    for (const top of tax.tops ?? []) {
        slugs.add(top.slug);
        for (const child of top.children ?? []) slugs.add(child.slug);
    }
    console.log(`   📖 Kanonik taksonomi: ${path} (${slugs.size} slug)`);
    return { canonicalSlugs: { [countryId]: slugs } };
}

async function loadNodes(): Promise<OwnedCategory[]> {
    const rows = await prisma.category.findMany({
        select: {
            id: true,
            slug: true,
            name: true,
            country_id: true,
            parent_id: true,
            display_order: true,
            icon_url: true,
        },
        orderBy: { id: 'asc' },
    });
    return rows;
}

async function loadCounts(): Promise<ProductCount[]> {
    const rows = await prisma.$queryRaw<Array<{ category_id: number; country_id: number; n: bigint }>>`
        SELECT category_id, country_id, COUNT(*)::bigint AS n
        FROM products
        WHERE category_id IS NOT NULL
        GROUP BY category_id, country_id
    `;
    return rows.map((r) => ({ categoryId: r.category_id, countryId: r.country_id, n: Number(r.n) }));
}

async function main() {
    console.log(`\n📋 Taksonomi birleştirme planı (${APPLY ? 'UYGULANACAK' : 'KURU ÇALIŞMA'})`);

    const trCountry = await prisma.country.findUnique({ where: { code: 'TR' }, select: { id: true } });
    const options = { ...loadCanonical(trCountry?.id ?? 1), safeOnly: SAFE_ONLY };
    if (SAFE_ONLY) console.log('   🛡️  Güvenli mod: ikiz birleştirme uygulanmaz, raporlanır.');
    if (!options.canonicalSlugs) {
        console.log(
            '   ⚠️  Kanonik taksonomi verilmedi (--taxonomy). İkiz gruplarının\n' +
                '       kazananını ürün sayısı belirleyecek. Prod çalıştırmasında\n' +
                '       mf_taxonomy.py çıktısını verin.',
        );
    }

    const [nodes, counts] = await Promise.all([loadNodes(), loadCounts()]);
    const plan = planReconciliation(nodes, counts, options);

    console.log(`   kategori: ${nodes.length}, ürün-kategori-ülke satırı: ${counts.length}`);
    console.log(
        `   yaratılacak: ${plan.summary.created}  ` +
            `taşıma: ${plan.summary.moved} (${plan.summary.movedProducts} ürün)  ` +
            `silinecek: ${plan.summary.deleted}  yönlendirme: ${plan.redirects.length}\n`,
    );

    if (plan.ops.length === 0) {
        console.log('✅ Yapacak iş yok — taksonomi zaten tutarlı.\n');
        return;
    }

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const countryCode = new Map(
        (await prisma.country.findMany({ select: { id: true, code: true } })).map((c) => [c.id, c.code]),
    );

    for (const op of plan.ops) {
        if (op.kind === 'createCategory') {
            console.log(
                `   ➕ [${countryCode.get(op.countryId)}] "${op.slug}" oluşturulacak ` +
                    `(#${op.clonedFrom} kopyası)`,
            );
        } else if (op.kind === 'moveProducts') {
            const from = byId.get(op.fromCategoryId);
            console.log(
                `   ➡️  ${op.n} ürün [${countryCode.get(op.countryId)}] "${from?.slug}" ` +
                    `(#${op.fromCategoryId}, ${countryCode.get(from?.country_id ?? 0)}) → kendi ülkesinin kopyasına`,
            );
        } else if (op.kind === 'mergeCategory') {
            console.log(
                `   🔗 [${countryCode.get(op.countryId)}] "${op.fromSlug}" (#${op.fromCategoryId}) ` +
                    `→ "${op.toSlug}" içinde birleşecek` +
                    (op.reparentChildIds.length > 0 ? ` (+${op.reparentChildIds.length} alt kategori)` : ''),
            );
        } else if (op.kind === 'reparent') {
            console.log(
                `   🧬 [${countryCode.get(op.countryId)}] "${op.slug}" (#${op.categoryId}) ` +
                    `kendi ülkesinin üst kategorisine bağlanacak (parent başka ülkedeydi)`,
            );
        } else if (op.kind === 'renameSlug') {
            console.log(
                `   ✏️  [${countryCode.get(op.countryId)}] "${op.oldSlug}" → "${op.newSlug}" ` +
                    `(ASCII olmayan slug URL'de yüzde-kodlanıyordu)`,
            );
        } else {
            console.log(`   🗑️  [${countryCode.get(op.countryId)}] "${op.slug}" (#${op.categoryId}) silinecek`);
        }
    }

    for (const r of plan.redirects) {
        console.log(`   ↪️  [${countryCode.get(r.countryId)}] /${r.oldSlug} → /${r.newSlug}`);
    }

    if (plan.pendingMerges.length > 0) {
        console.log(
            `
   ⚠️  ${plan.pendingMerges.length} ikiz çifti bulundu ama BİRLEŞTİRİLMEDİ ` +
                '(güvenli mod). İnceleyip onaylıyorsanız --safe-only olmadan çalıştırın:',
        );
        for (const m of plan.pendingMerges) {
            console.log(`      [${countryCode.get(m.countryId)}] "${m.from}" → "${m.to}"`);
        }
    }

    if (!APPLY) {
        console.log('\n👀 Kuru çalışma bitti. Uygulamak için --apply verin.\n');
        return;
    }

    // Tek transaction: yarım uygulanmış bir birleştirme, başladığımız
    // durumdan daha kötü (ürünler yaratılmış ama bağlanmamış kategorilere
    // dağılmış olurdu).
    await prisma.$transaction(
        async (tx) => {
            const resolved = new Map<string, number>(); // tempId → gerçek id
            const refToId = (ref: CategoryRef): number =>
                typeof ref === 'number' ? ref : (resolved.get(ref) as number);

            for (const op of plan.ops) {
                if (op.kind === 'createCategory') {
                    const created = await tx.category.create({
                        data: {
                            name: op.name,
                            slug: op.slug,
                            country_id: op.countryId,
                            parent_id: op.parentRef === null ? null : refToId(op.parentRef),
                            display_order: op.display_order,
                            icon_url: op.icon_url,
                        },
                    });
                    resolved.set(op.tempId, created.id);
                } else if (op.kind === 'moveProducts') {
                    await tx.product.updateMany({
                        where: { category_id: op.fromCategoryId, country_id: op.countryId },
                        data: { category_id: refToId(op.toRef) },
                    });
                } else if (op.kind === 'mergeCategory') {
                    const target = refToId(op.toRef);
                    // Ürünleri ve çocukları kanoniğe taşı, sonra kaynağı sil.
                    // Sıra önemli: çocuklar taşınmadan silmek onları CASCADE ile
                    // götürürdü (Category.parent onDelete: Cascade).
                    await tx.product.updateMany({
                        where: { category_id: op.fromCategoryId },
                        data: { category_id: target },
                    });
                    if (op.reparentChildIds.length > 0) {
                        await tx.category.updateMany({
                            where: { id: { in: op.reparentChildIds } },
                            data: { parent_id: target },
                        });
                    }
                    await tx.category.delete({ where: { id: op.fromCategoryId } });
                } else if (op.kind === 'reparent') {
                    await tx.category.update({
                        where: { id: op.categoryId },
                        data: { parent_id: refToId(op.toRef) },
                    });
                } else if (op.kind === 'renameSlug') {
                    await tx.category.update({
                        where: { id: op.categoryId },
                        data: { slug: op.newSlug },
                    });
                } else {
                    // Ürünü kalmadığı planlandı; yine de kategorisiz ürün
                    // bırakmamak için önce bağı kopar (FK SetNull zaten var,
                    // ama niyeti açık yazıyoruz).
                    await tx.product.updateMany({
                        where: { category_id: op.categoryId },
                        data: { category_id: null },
                    });
                    await tx.category.delete({ where: { id: op.categoryId } });
                }
            }

            for (const r of plan.redirects) {
                await tx.categoryRedirect.upsert({
                    where: { country_id_old_slug: { country_id: r.countryId, old_slug: r.oldSlug } },
                    update: { new_slug: r.newSlug },
                    create: { country_id: r.countryId, old_slug: r.oldSlug, new_slug: r.newSlug },
                });
            }
        },
        { timeout: 300_000 },
    );

    console.log('\n✅ Uygulandı.\n');

    // Doğrulama: birleştirme sonrası hiçbir ürün başka ülkenin kategorisinde
    // kalmamalı ve ürünsüz kategori olmamalı.
    const stray = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n
        FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.country_id <> c.country_id
    `;
    console.log(`   yanlış ülkenin kategorisindeki ürün: ${Number(stray[0]?.n ?? 0)} (0 olmalı)`);
}

main()
    .catch((err) => {
        console.error('❌ Birleştirme hatası:', err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
