/** Quick category-cleanliness audit: list Meyve & Sebze contents + hunt the ss1.png offenders. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const OFFENDERS = ["olips", "kekstra", "falım", "falim", "ebru", "pereja", "kolonya"];

async function main() {
  // 1) Meyve & Sebze top category and its products
  const top = await prisma.category.findFirst({ where: { slug: "meyve-sebze" } });
  if (top) {
    const subs = await prisma.category.findMany({ where: { parent_id: top.id } });
    const subIds = subs.map((s) => s.id);
    const prods = await prisma.product.findMany({
      where: { category_id: { in: subIds } },
      select: { name: true },
    });
    console.log(`\n=== Meyve & Sebze: ${prods.length} ürün ===`);
    // flag any that look non-produce (brand/snack words)
    const suspect = prods.filter((p) =>
      OFFENDERS.some((o) => p.name.toLowerCase().includes(o))
    );
    console.log("şüpheli (offender kelimesi):", suspect.length ? suspect.map((p) => p.name) : "YOK ✅");
    console.log("ilk 30:", prods.slice(0, 30).map((p) => p.name));
  }

  // 2) Where did the offenders land now?
  console.log("\n=== Offender ürünler nerede? ===");
  for (const o of OFFENDERS) {
    const hits = await prisma.product.findMany({
      where: { name: { contains: o, mode: "insensitive" } },
      select: { name: true, category: { select: { name: true, parent: { select: { name: true } } } } },
      take: 5,
    });
    if (hits.length) {
      for (const h of hits) {
        const path = h.category?.parent ? `${h.category.parent.name} > ${h.category.name}` : h.category?.name ?? "—";
        console.log(`  [${o}] ${h.name}  ->  ${path}`);
      }
    }
  }

  // 3) Top-level category distribution
  const tops = await prisma.category.findMany({ where: { parent_id: null }, select: { id: true, name: true } });
  console.log("\n=== Üst kategori dağılımı (ürün sayısı) ===");
  const rows: [string, number][] = [];
  for (const t of tops) {
    const subs = await prisma.category.findMany({ where: { parent_id: t.id }, select: { id: true } });
    const ids = [t.id, ...subs.map((s) => s.id)];
    const n = await prisma.product.count({ where: { category_id: { in: ids } } });
    rows.push([t.name, n]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  for (const [name, n] of rows) console.log(`  ${name}: ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
