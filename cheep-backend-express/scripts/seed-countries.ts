/**
 * ÜRETİM-GÜVENLİ referans veri tohumlaması.
 *
 * `prisma/seed.ts` GELİŞTİRME tohumlamasıdır: test kullanıcısı, UYDURMA
 * EAN'lı sahte ürünler ve örnek bir liste yaratır. Üretimde çalıştırmak
 * kataloğa sahte ürün enjekte eder — bir kez yaşandı, sahte bir ürün prod'a
 * girip elle silinmek zorunda kaldı.
 *
 * Bu betik YALNIZCA referans veriyi kurar: ülkeler, market satırları ve
 * kategori ağaçları. Hepsi upsert; tekrar çalıştırmak güvenli ve beklenen
 * kullanım bu (yeni ülke eklendikçe yeniden koşar).
 *
 * Kullanım (prod konteynerinin içinden):
 *   node --experimental-strip-types scripts/seed-countries.ts --dry-run
 *   node --experimental-strip-types scripts/seed-countries.ts
 * ya da yerelde:  npx tsx scripts/seed-countries.ts
 */
import { PrismaClient } from '@prisma/client';
import {
    CATEGORY_TREE_COUNTRIES,
    COUNTRIES,
    STORES,
    seedCategoryTree,
    seedCountriesAndStores,
} from '../src/config/countries-seed.js';

const prisma = new PrismaClient();

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    if (dryRun) {
        console.log('KURU KOŞU — hiçbir şey yazılmayacak.\n');
        console.log(`ülke      : ${COUNTRIES.map((c) => c.code).join(', ')}`);
        console.log(`market    : ${STORES.length} satır`);
        for (const code of CATEGORY_TREE_COUNTRIES) {
            console.log(`kategori  : ${code} ağacı kurulacak`);
        }
        const existing = await prisma.country.findMany({ select: { code: true } });
        console.log(`\nşu an DB'de: ${existing.map((c) => c.code).sort().join(', ')}`);
        return;
    }

    const { countries, stores, idByCode } = await seedCountriesAndStores(prisma);
    console.log(`✅ ülke: ${countries} · market: ${stores}`);

    for (const code of CATEGORY_TREE_COUNTRIES) {
        const countryId = idByCode.get(code);
        if (countryId === undefined) {
            // Sessizce atlamak, o ülkenin tüm ürünlerinin kategorisiz
            // kalmasına yol açardı — açık hata ver.
            throw new Error(`${code} ülkesi bulunamadı, kategori ağacı kurulamıyor`);
        }
        const slugs = await seedCategoryTree(prisma, countryId);
        console.log(`✅ ${code} kategori ağacı: ${slugs.size} slug`);
    }

    // Doğrulama: uygulamanın gerçekten göreceği hâli raporla.
    const summary = await prisma.country.findMany({
        select: {
            code: true,
            _count: { select: { stores: true, categories: true, products: true } },
        },
        orderBy: { id: 'asc' },
    });
    console.log('\nülke  market  kategori  ürün');
    for (const c of summary) {
        console.log(
            `${c.code.padEnd(5)} ${String(c._count.stores).padStart(6)} ` +
            `${String(c._count.categories).padStart(9)} ${String(c._count.products).padStart(6)}`,
        );
    }
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
