import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const q = process.argv[2] || "Burcu Ketçap";
  const prods = await p.product.findMany({
    where: { name: { contains: q } },
    include: { store_prices: { include: { store: true } }, category: { include: { parent: true } } },
    take: 8,
  });
  for (const pr of prods) {
    const cat = pr.category ? `${pr.category.parent?.name ?? "?"} / ${pr.category.name}` : "—";
    console.log(`\n${pr.name}  [${cat}]`);
    for (const sp of pr.store_prices.sort((a, b) => Number(a.price) - Number(b.price)))
      console.log(`   ${sp.store.name.padEnd(12)} ${sp.price} TL`);
  }
  await p.$disconnect();
})();
