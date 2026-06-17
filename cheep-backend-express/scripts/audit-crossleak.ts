/** Cross-category leak scan: a non-food word inside a FOOD category = misclassified. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FOOD_TOPS = [
  "Meyve & Sebze", "Et, Tavuk & Balık", "Süt Ürünleri", "Kahvaltılık", "Temel Gıda",
  "Atıştırmalık", "İçecek", "Donuk & Hazır Yemek", "Fırın & Pastane", "Dondurma",
];
// unmistakable non-food words; a real food name never contains these
const NONFOOD = [
  "sabun", "şampuan", "kolonya", "parfüm", "deodorant", "deterjan", "çamaşır suyu",
  "yumuşatıcı", "vantilatör", "şarjlı", " fanı", "telefon", "kulaklık", "powerbank",
  "oyuncak", "puzzle", "nevresim", "battaniye", "havlu set", "tuvalet kağıdı",
  "ıslak mendil", "bebek bezi", "kedi maması", "köpek maması", "diş macunu",
  "diş fırça", "tıraş", "makyaj", "ruj", "oje", "yetiştirme seti",
];

async function main() {
  for (const topName of FOOD_TOPS) {
    const top = await prisma.category.findFirst({ where: { name: topName, parent_id: null } });
    if (!top) continue;
    const subs = await prisma.category.findMany({ where: { parent_id: top.id }, select: { id: true } });
    const ids = subs.map((s) => s.id);
    const prods = await prisma.product.findMany({
      where: { category_id: { in: ids } },
      select: { name: true, category: { select: { name: true } } },
    });
    const bad = prods.filter((p) => {
      const n = " " + p.name.toLowerCase() + " ";
      // word-START match: keyword must begin a token (avoids "oje" in "çokojelo")
      return NONFOOD.some((w) => n.includes(" " + w.trim()));
    });
    const tag = bad.length === 0 ? "✅" : "⚠️ ";
    console.log(`${tag} ${topName}: ${prods.length} ürün, ${bad.length} yabancı`);
    for (const b of bad.slice(0, 12)) console.log(`     ${b.name}  (${b.category?.name})`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
