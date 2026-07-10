// Ülkedeki ÇOK-mağazalı her ürünü, mağaza başına ham (raw_name) adla listeler.
// Sıfır-hata kapısı: bu raporun TAMAMI elle doğrulanmadan Faz 2'ye geçilmez.
// Kullanım: npx tsx scripts/audit-merges.ts PL > audit-pl.md
import { prisma } from '../src/utils/prisma.client.js';

const code = (process.argv[2] || 'PL').toUpperCase();

async function main() {
    const country = await prisma.country.findFirst({ where: { code } });
    if (!country) throw new Error(`Bilinmeyen ülke: ${code}`);
    const products = await prisma.product.findMany({
        where: { country_id: country.id },
        include: { store_prices: { include: { store: true } }, category: true },
        orderBy: { id: 'asc' },
    });
    const merged = products.filter(p => p.store_prices.length >= 2);
    console.log(`# ${code} Birleşme Denetimi — ${new Date().toISOString().slice(0, 10)}`);
    console.log(`Toplam ürün: ${products.length}, çok-mağazalı (birleşmiş): ${merged.length}\n`);
    for (const p of merged) {
        const ean = p.ean_barcode ? ` EAN:${p.ean_barcode}` : ' (EAN yok — fingerprint birleşmesi)';
        console.log(`## #${p.id} ${p.name}${ean}  [kategori: ${p.category?.slug ?? 'YOK'}]`);
        for (const sp of p.store_prices) {
            console.log(`- ${sp.store.name}: "${sp.raw_name ?? '?'}" → ${sp.price} ${sp.unit}`);
        }
        console.log('');
    }
    const uncategorized = products.filter(p => !p.category_id).length;
    console.log(`---\nKategorisiz ürün: ${uncategorized} / ${products.length}`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
