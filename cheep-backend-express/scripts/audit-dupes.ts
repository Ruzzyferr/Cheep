/** Hunt duplicate / stale categories and reconcile API vs DB view. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.category.findMany({
    where: { OR: [{ slug: { contains: "meyve" } }, { name: { contains: "Meyve" } }] },
    select: { id: true, name: true, slug: true, parent_id: true },
    orderBy: { id: "asc" },
  });
  console.log("=== 'meyve' kategorileri ===");
  for (const c of cats) {
    const n = await prisma.product.count({ where: { category_id: c.id } });
    console.log(`  id=${c.id}  parent=${c.parent_id}  "${c.name}"  slug=${c.slug}  ürün=${n}`);
  }

  // sample products that are directly in id 27
  console.log("\n=== category_id=27 ilk 10 ürün ===");
  const p27 = await prisma.product.findMany({ where: { category_id: 27 }, select: { name: true }, take: 10 });
  for (const p of p27) console.log("   ", p.name);

  // total categories & null-named dupes
  const total = await prisma.category.count();
  const tops = await prisma.category.count({ where: { parent_id: null } });
  console.log(`\nToplam kategori: ${total}, üst kategori: ${tops}`);

  // duplicate slugs?
  const all = await prisma.category.findMany({ select: { slug: true } });
  const seen = new Map<string, number>();
  for (const c of all) seen.set(c.slug, (seen.get(c.slug) ?? 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  console.log("Tekrarlanan slug:", dups.length ? dups : "YOK");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
