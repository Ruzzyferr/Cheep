/**
 * Ingest the scraper's matched catalog into Postgres.
 *
 * Input: Cheep-Scraper/countries/turkey/output/matched_*.json (latest, or a path
 * given as argv[2]). Each entry is ONE canonical product (cross-market grouped)
 * with its per-market prices.
 *
 * Model: one `Product` per canonical group (keyed by muadil_grup_id), one
 * `StorePrice` per market under it — so the UI shows one product and the detail
 * / list price-calc shows each market's price.
 *
 * Prices for the involved stores are fully refreshed each run (weekly); products
 * are upserted by muadil_grup_id (lists stay intact). Run: tsx scripts/ingest-catalog.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_NAMES: Record<number, string> = {
  1: "Migros", 2: "CarrefourSA", 3: "A101", 5: "ŞOK",
};

type PriceRow = {
  store: string; store_id: number | null; price: number;
  unit_price: number | null; unit_price_unit: string | null;
  product_url: string | null; sku: string | null;
};
type CatalogItem = {
  name: string; brand: string | null;
  category_top: string; category_sub: string;
  quantity: number; unit: string; size_key: string;
  image_url: string | null; country_code: string;
  markets: string[]; prices: PriceRow[];
};

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function latestMatchedFile(): string {
  if (process.argv[2]) return process.argv[2];
  const dir = path.resolve(__dirname, "../../Cheep-Scraper/countries/turkey/output");
  const files = readdirSync(dir).filter((f) => /^matched_\d{8}_\d{6}\.json$/.test(f)).sort();
  if (!files.length) throw new Error("No matched_*.json found in " + dir);
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  const file = latestMatchedFile();
  console.log("📂 katalog:", file);
  const catalog: CatalogItem[] = JSON.parse(readFileSync(file, "utf-8"));
  console.log("   kanonik ürün:", catalog.length);

  // 1) Country TR
  const country = await prisma.country.upsert({
    where: { code: "TR" },
    update: {},
    create: { code: "TR", name: "Türkiye", currency: "TRY" },
  });

  // 2) Stores (create if missing; don't clobber seeded lat/lon)
  for (const [idStr, name] of Object.entries(STORE_NAMES)) {
    const id = Number(idStr);
    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) {
      await prisma.store.create({ data: { id, name, country_id: country.id, city: "İstanbul" } });
    }
  }

  // 3) Categories (top + sub, hierarchical)
  const catId = new Map<string, number>();
  for (const item of catalog) {
    const topSlug = slugify(item.category_top);
    if (!catId.has("t:" + topSlug)) {
      const top = await prisma.category.upsert({
        where: { slug: topSlug },
        update: {},
        create: { name: item.category_top, slug: topSlug },
      });
      catId.set("t:" + topSlug, top.id);
    }
    const subSlug = `${topSlug}--${slugify(item.category_sub)}`;
    if (!catId.has("s:" + subSlug)) {
      const sub = await prisma.category.upsert({
        where: { slug: subSlug },
        update: {},
        create: { name: item.category_sub, slug: subSlug, parent_id: catId.get("t:" + topSlug)! },
      });
      catId.set("s:" + subSlug, sub.id);
    }
  }
  console.log("   kategori:", catId.size);

  // 4) Products — UPSERT by muadil_grup_id so product IDs stay STABLE across weekly
  //    scrapes. Stable IDs preserve user lists AND price history (deleting+recreating
  //    would cascade-wipe both). Category/name/brand/image are refreshed to latest.
  const groupKey = (it: CatalogItem) => `${slugify(it.name)}__${it.size_key}`;
  const catOf = (it: CatalogItem) =>
    catId.get("s:" + `${slugify(it.category_top)}--${slugify(it.category_sub)}`) ?? null;

  const existing = await prisma.product.findMany({
    where: { country_id: country.id },
    select: { id: true, muadil_grup_id: true },
  });
  const pmap = new Map<string, number>();
  for (const p of existing) if (p.muadil_grup_id) pmap.set(p.muadil_grup_id, p.id);

  // create products that are new to this catalog
  const seen = new Set<string>();
  const toCreate: any[] = [];
  for (const it of catalog) {
    const gid = groupKey(it);
    if (seen.has(gid)) continue;
    seen.add(gid);
    if (!pmap.has(gid)) {
      toCreate.push({
        name: it.name, brand: it.brand, image_url: it.image_url,
        category_id: catOf(it), muadil_grup_id: gid, country_id: country.id,
      });
    }
  }
  for (let i = 0; i < toCreate.length; i += 1000) {
    await prisma.product.createMany({ data: toCreate.slice(i, i + 1000), skipDuplicates: true });
  }
  const all = await prisma.product.findMany({
    where: { country_id: country.id },
    select: { id: true, muadil_grup_id: true },
  });
  for (const p of all) if (p.muadil_grup_id) pmap.set(p.muadil_grup_id, p.id);

  // refresh existing products' category/name/brand/image to the latest catalog values
  const seen2 = new Set<string>();
  let pending: Promise<unknown>[] = [];
  for (const it of catalog) {
    const gid = groupKey(it);
    if (seen2.has(gid)) continue;
    seen2.add(gid);
    const pid = pmap.get(gid);
    if (!pid) continue;
    pending.push(prisma.product.update({
      where: { id: pid },
      data: { name: it.name, brand: it.brand, image_url: it.image_url, category_id: catOf(it) },
    }));
    if (pending.length >= 200) { await Promise.all(pending); pending = []; }
  }
  await Promise.all(pending);
  console.log("   ürün: yeni", toCreate.length, "| toplam", pmap.size);

  // 5) StorePrices — refresh all prices for the involved stores
  const storeIds = Object.keys(STORE_NAMES).map(Number);
  await prisma.storePrice.deleteMany({ where: { store_id: { in: storeIds } } });

  // One price per (store, product): when a store lists the same canonical product
  // more than once (duplicate SKUs / stale listings), keep the LOWEST price so the
  // shopper always sees the best available — never an arbitrary stale-high one.
  const best = new Map<string, any>();
  for (const it of catalog) {
    const pid = pmap.get(groupKey(it));
    if (!pid) continue;
    for (const pr of it.prices) {
      if (!pr.store_id) continue;
      const key = `${pr.store_id}:${pid}`;
      const prev = best.get(key);
      if (!prev || Number(pr.price) < Number(prev.price)) {
        best.set(key, {
          store_id: pr.store_id, product_id: pid, store_sku: pr.sku || null,
          price: pr.price, unit: it.unit, source: "scrape",
        });
      }
    }
  }
  const rows = [...best.values()];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const r = await prisma.storePrice.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
    inserted += r.count;
  }
  console.log("   store_price:", inserted);

  // 6) Price history — append today's snapshot (one row per store+product per day),
  //    so product detail can chart each market's price over time. Re-runs on the same
  //    day replace that day's snapshot; rows older than 90 days are pruned.
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  await prisma.priceHistory.deleteMany({
    where: { store_id: { in: storeIds }, recorded_at: { gte: dayStart } },
  });
  const hist = rows.map((r) => ({ store_id: r.store_id, product_id: r.product_id, price: r.price }));
  let hcount = 0;
  for (let i = 0; i < hist.length; i += 1000) {
    const r = await prisma.priceHistory.createMany({ data: hist.slice(i, i + 1000) });
    hcount += r.count;
  }
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const pruned = await prisma.priceHistory.deleteMany({ where: { recorded_at: { lt: cutoff } } });
  console.log("   price_history: +", hcount, "| pruned(>90d):", pruned.count);
  console.log("✅ ingest tamam.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
