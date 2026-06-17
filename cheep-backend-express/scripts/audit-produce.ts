/** Deep purity check: scan ALL Meyve & Sebze for any non-produce form words. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// words that should NEVER appear in a real produce product name
const NONPRODUCE = [
  "sabun", "şampuan", "sampuan", "kolonya", "parfüm", "parfum", "sprey", "deodorant",
  "deterjan", "krem", "losyon", "jel", "yatak", "deniz", "havuz", "kitap", "oyuncak",
  "mum", "pil", "kalem", "defter", "tabak", "bardak", "tava", "tencere", "havlu",
  "peçete", "bez", "çamaşır", "temizleyici", "temizlik", "kumaş", "ölüm", "seti",
  "telefon", "kablo", "şarj", "battaniye", "nevresim",
];

async function main() {
  const top = await prisma.category.findFirst({ where: { slug: "meyve-sebze" } });
  if (!top) { console.log("Meyve & Sebze yok"); return; }
  const subs = await prisma.category.findMany({ where: { parent_id: top.id } });
  const subIds = subs.map((s) => s.id);
  const prods = await prisma.product.findMany({
    where: { category_id: { in: subIds } },
    select: { name: true, category: { select: { name: true } } },
  });
  console.log(`Meyve & Sebze toplam: ${prods.length} ürün`);
  const suspect = prods.filter((p) =>
    NONPRODUCE.some((w) => p.name.toLowerCase().includes(w))
  );
  if (suspect.length === 0) {
    console.log("✅ Yabancı (gıda-dışı) ürün YOK — kategori temiz.");
  } else {
    console.log(`⚠️  ${suspect.length} şüpheli:`);
    for (const s of suspect) console.log(`   ${s.name}  (${s.category?.name})`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
