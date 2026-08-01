/**
 * Taksonomi sağlık raporu.
 *
 * NEDEN VAR: kategori sorunları sessizce birikiyor. Devlet yeni bir kategori
 * açtığında ürünleri "Diğer"e düşüyor, PL scraper'ı eşlenmemiş bir kategori
 * getirdiğinde ürün KATEGORİSİZ kalıp hiçbir listede görünmüyor, yeni bir
 * kategori çeviri sözlüğüne eklenmediğinde beş dilde birden Türkçe adıyla
 * çıkıyor. Hiçbiri hata vermiyor — aylar sonra fark ediliyor.
 *
 * Haftalık taksonomi tazelemesinin son adımı bunu basar. Amaç düzeltmek değil,
 * GÖRÜNÜR KILMAK: hangi kategoriler çevrilmemiş, kaç ürün kategorisiz kalmış.
 */
import { prisma } from '../src/utils/prisma.client.js';
import { CATEGORY_NAMES } from '../src/config/category-i18n.js';

/** Bu orandan fazla ürün "Diğer"de ise sınıflandırma bozulmuş demektir. */
const OTHER_SHARE_WARN = 0.15;

async function main() {
    const countries = await prisma.country.findMany({
        select: { id: true, code: true },
        orderBy: { id: 'asc' },
    });

    let problems = 0;

    for (const country of countries) {
        const total = await prisma.product.count({ where: { country_id: country.id } });
        if (total === 0) continue;

        console.log(`\n[${country.code}] ${total} ürün`);

        // 1) Kategorisiz ürünler. PL scraper'ı eşlenmemiş bir kategori
        //    getirdiğinde `canonical_category` null döner ve ürün hiçbir
        //    listede görünmez — sessiz kayıp.
        const uncategorized = await prisma.product.count({
            where: { country_id: country.id, category_id: null },
        });
        if (uncategorized > 0) {
            problems += 1;
            const pct = ((uncategorized / total) * 100).toFixed(1);
            console.log(`  ⚠️  kategorisiz ürün: ${uncategorized} (%${pct}) — hiçbir listede görünmüyor`);
        } else {
            console.log('  ✓ kategorisiz ürün yok');
        }

        // 2) "Diğer"e düşenler. Devletin/scraper'ın yeni kategorisi eşlenmemişse
        //    burada birikir.
        const other = await prisma.$queryRaw<Array<{ n: bigint }>>`
            SELECT COUNT(*)::bigint AS n
            FROM products p JOIN categories c ON c.id = p.category_id
            WHERE p.country_id = ${country.id} AND c.slug IN ('diger', 'diger-urunler', 'diger-urunler-diger-urunler')
        `;
        const otherN = Number(other[0]?.n ?? 0);
        const share = otherN / total;
        if (share > OTHER_SHARE_WARN) {
            problems += 1;
            console.log(
                `  ⚠️  "Diğer" kategorisinde: ${otherN} (%${(share * 100).toFixed(1)}) — ` +
                    'eşlenmemiş kaynak kategorisi olabilir',
            );
        } else {
            console.log(`  ✓ "Diğer" payı: %${(share * 100).toFixed(1)}`);
        }

        // 3) Çevrilmemiş kategoriler. Beş dilde birden Türkçe adıyla çıkarlar.
        //    Kırılma değil ama fark edilmezse kalıcılaşır.
        const cats = await prisma.category.findMany({
            where: { country_id: country.id },
            select: { slug: true, name: true },
        });
        const untranslated = cats.filter((c) => !CATEGORY_NAMES[c.slug]);
        if (untranslated.length > 0) {
            problems += 1;
            console.log(
                `  ⚠️  çevrilmemiş kategori: ${untranslated.length} — ` +
                    'config/category-i18n.ts dosyasına ekleyin:',
            );
            for (const c of untranslated.slice(0, 15)) {
                console.log(`       '${c.slug}': ['', '', '', ''],   // ${c.name}`);
            }
            if (untranslated.length > 15) console.log(`       … ve ${untranslated.length - 15} tane daha`);
        } else {
            console.log('  ✓ tüm kategoriler çevrili');
        }
    }

    // 4) Yapısal bozulmalar — reconcile bunları onarmış olmalı; kalmışsa
    //    onarım başarısız olmuş demektir.
    const [stray, brokenParent, emptyCats] = await Promise.all([
        prisma.$queryRaw<Array<{ n: bigint }>>`
            SELECT COUNT(*)::bigint AS n FROM products p JOIN categories c ON c.id = p.category_id
            WHERE p.country_id <> c.country_id`,
        prisma.$queryRaw<Array<{ n: bigint }>>`
            SELECT COUNT(*)::bigint AS n FROM categories c JOIN categories p ON p.id = c.parent_id
            WHERE p.country_id <> c.country_id`,
        prisma.$queryRaw<Array<{ n: bigint }>>`
            SELECT COUNT(*)::bigint AS n FROM categories c
            WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id)
              AND NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = c.id)`,
    ]);

    console.log('\n[yapı]');
    const structural: Array<[string, number]> = [
        ['yanlış ülkenin kategorisindeki ürün', Number(stray[0]?.n ?? 0)],
        ['başka ülkenin çocuğu olan kategori', Number(brokenParent[0]?.n ?? 0)],
        ['ürünsüz ve çocuksuz kategori', Number(emptyCats[0]?.n ?? 0)],
    ];
    for (const [label, n] of structural) {
        if (n > 0) problems += 1;
        console.log(`  ${n === 0 ? '✓' : '⚠️ '} ${label}: ${n}`);
    }

    console.log(problems === 0 ? '\n✅ taksonomi sağlıklı\n' : `\n⚠️  ${problems} başlıkta dikkat gerekiyor\n`);
}

main()
    .catch((err) => {
        console.error('sağlık raporu hatası:', err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
