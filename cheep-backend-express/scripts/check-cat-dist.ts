import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const tops = await p.category.findMany({ where: { parent_id: null }, select: { id: true, name: true } });
  const rows: [string, number][] = [];
  for (const t of tops) {
    const subs = await p.category.findMany({ where: { parent_id: t.id }, select: { id: true } });
    const ids = [t.id, ...subs.map((s) => s.id)];
    const c = await p.product.count({ where: { category_id: { in: ids } } });
    rows.push([t.name, c]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  let tot = 0;
  for (const [n, c] of rows) { tot += c; console.log(String(c).padStart(6), n); }
  const noCat = await p.product.count({ where: { category_id: null } });
  console.log("---- tops total:", tot, "| no category:", noCat, "| all:", await p.product.count());
  await p.$disconnect();
})();
