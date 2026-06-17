/** Seed a demo shopping list with multi-market items for user 1 (UI verification). */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "test@cheep.com" } });
  if (!user) throw new Error("test user yok");

  // pick 6 products that have prices in multiple markets
  const products = await prisma.product.findMany({
    where: { country_id: 1, store_prices: { some: {} } },
    include: { store_prices: true },
    take: 200,
  });
  const multi = products.filter((p) => new Set(p.store_prices.map((s) => s.store_id)).size >= 3).slice(0, 6);
  if (multi.length < 3) throw new Error("yeterli çok-marketli ürün yok");

  // clear old active lists for a clean demo
  await prisma.list.deleteMany({ where: { user_id: user.id, is_template: false } });
  const list = await prisma.list.create({
    data: { user_id: user.id, name: "Haftalık Market", status: "active", budget: 750 },
  });
  for (const p of multi) {
    await prisma.listItem.create({
      data: { list_id: list.id, product_id: p.id, quantity: 2, unit: "adet" },
    });
  }
  console.log(`✅ liste #${list.id} "${list.name}" — ${multi.length} ürün:`);
  for (const p of multi) console.log("   -", p.name);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
