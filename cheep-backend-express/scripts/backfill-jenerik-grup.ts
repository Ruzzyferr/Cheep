/**
 * Mevcut kataloğa `jenerik_grup_id` doldurur ("marka önemsemiyorum" ikamesi).
 *
 * GÜVENLİ: yalnızca bu alanı yazar. `muadil_grup_id`ye DOKUNMAZ — orası ürün
 * birleştirme anahtarı ve bozulursa farklı markalar tek ürüne çöker.
 *
 * Kullanım:
 *   npx tsx scripts/backfill-jenerik-grup.ts            # kuru koşum (yazmaz)
 *   npx tsx scripts/backfill-jenerik-grup.ts --yaz      # uygular
 *   npx tsx scripts/backfill-jenerik-grup.ts --yaz --ulke TR
 */
import { PrismaClient } from '@prisma/client';
import { jenerikParmakIzi } from '../src/services/generic-grouping.js';

const prisma = new PrismaClient();
const YAZ = process.argv.includes('--yaz');
const ulkeIx = process.argv.indexOf('--ulke');
const ULKE = ulkeIx > -1 ? process.argv[ulkeIx + 1] : null;

async function main() {
  const where: any = {};
  if (ULKE) {
    const c = await prisma.country.findFirst({ where: { code: ULKE } });
    if (!c) throw new Error(`ulke bulunamadi: ${ULKE}`);
    where.country_id = c.id;
  }

  const urunler = await prisma.product.findMany({
    where,
    select: { id: true, name: true, brand: true, jenerik_grup_id: true },
  });
  console.log(`urun: ${urunler.length}${ULKE ? ` (${ULKE})` : ' (tum ulkeler)'}`);

  const yeni = new Map<number, string>();
  const gruplar = new Map<string, number>();
  let degismeyen = 0;
  for (const u of urunler) {
    const fp = jenerikParmakIzi({ name: u.name, brand: u.brand });
    if (!fp) continue;
    gruplar.set(fp, (gruplar.get(fp) ?? 0) + 1);
    if (u.jenerik_grup_id === fp) { degismeyen++; continue; }
    yeni.set(u.id, fp);
  }

  const coklu = [...gruplar.values()].filter(n => n > 1).length;
  const ikameliUrun = [...gruplar.entries()].filter(([, n]) => n > 1).reduce((a, [, n]) => a + n, 0);
  console.log(`gruplanabilen : ${urunler.length - (urunler.length - [...gruplar.values()].reduce((a, b) => a + b, 0))}`);
  console.log(`toplam grup   : ${gruplar.size}`);
  console.log(`COKLU grup    : ${coklu}  (gercek ikame)`);
  console.log(`ikame kapsanan: ${ikameliUrun} urun`);
  console.log(`yazilacak     : ${yeni.size}  (degismeyen ${degismeyen})`);

  if (!YAZ) { console.log('\nkuru kosum — uygulamak icin --yaz ekleyin.'); return; }

  // Gruplar halinde yaz: aynı parmak izine sahip ürünler tek sorguda.
  const tersine = new Map<string, number[]>();
  for (const [id, fp] of yeni) {
    const a = tersine.get(fp) ?? [];
    a.push(id);
    tersine.set(fp, a);
  }
  let yazilan = 0;
  for (const [fp, idler] of tersine) {
    await prisma.product.updateMany({ where: { id: { in: idler } }, data: { jenerik_grup_id: fp } });
    yazilan += idler.length;
    if (yazilan % 5000 < idler.length) console.log(`  ... ${yazilan}`);
  }
  console.log(`yazildi: ${yazilan}`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
