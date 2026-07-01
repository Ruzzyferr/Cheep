# Foreign Data Pipeline (CH/SE/DE/PL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate real grocery price data for Switzerland, Sweden, Germany and Poland via config-driven scrapers, matched cross-store by EAN barcode, refreshed weekly (Sunday→Monday night) on the droplet — country-scoped, no cross-country leak.

**Architecture:** A new backend EAN-first product matcher (the cross-store merge key for Europe) is the linchpin; the scraper repo gains a shared, DRY foreign pipeline (`countries/_common/`) that scrapes each country's config, forwards `ean_barcode` straight to the backend `bulk-upsert` (no Turkish LLM matcher), and a weekly scheduler runs all four countries staggered with per-country isolation. Turkey's existing LLM pipeline is left untouched.

**Tech Stack:** Backend — Node 20, Express, Prisma, Postgres, vitest (`test/*.test.ts`, `vi.mock` on `prisma.client`). Scraper — Python 3, `requests`/Playwright, `dataclasses`, `pytest` (`tests/`), config-driven `importlib` runners. Deploy — DigitalOcean droplet, Docker Compose (`deploy/docker-compose.prod.yml`), host cron.

## Global Constraints

- **Country isolation is absolute (Phase 1).** No cross-country product/price/compare leak. Every ingested product lands under exactly one `country_id`. Prices stay in each country's own currency; never convert.
- **EAN is the primary cross-store merge key** for foreign countries; name+brand+gramaj fingerprint is the fallback. Turkish 900-entry category dictionary is **not** reused abroad.
- **EAN uniqueness is per country, not global** — the same physical EAN may be sold in two countries as two distinct `Product` rows.
- **Seeded foreign store IDs are fixed — use these exact values:** Switzerland `Migros=10`, `Coop=11`; Sweden `ICA=20`, `Willys=21`; Germany `REWE=30`, `Kaufland=31`; Poland `Carrefour=40`, `Auchan=41`. The file `countries/poland/config.json.example` uses stale IDs (10/11) — **do not** copy its store IDs.
- **Anchors vs. best-effort:** only the 8 seeded stores above are "anchors" with real scrapers enabled. Every other chain in the spec (Coop SE, Hemköp, Kaufland PL, Frisco, and all hard discounters: Denner, Aldi, Lidl, Penny, Netto, Edeka, City Gross, Biedronka, Dino, Żabka) is scaffolded `enabled:false` with a `note` — never a hard pipeline failure. Enabling one later requires adding its `Store` seed row first.
- **Secrets stay out of git.** `INGEST_API_KEY`, DB creds, any proxy creds live only in gitignored `.env` on the droplet. Never commit them.
- **Ingest contract (existing, do not change):** `POST /api/v1/store-prices/bulk-upsert` with header `x-api-key: <INGEST_API_KEY>` and `x-country: <CODE>`, body `{ "prices": [ {store_id, store_sku, price, name, ...} ] }`, max 1000 items/request. Allowed `unit` values: `adet, kg, g, l, ml, cl, paket, kutu`. `price` is a positive number or a `^\d+(\.\d{1,2})?$` string.
- **Scraper `Product` field is `barcode`** (see `scrapers/base_scraper.py`); it maps to the backend field `ean_barcode`. `to_dict()` emits key `"barcode"`.
- **Live foreign sites may be geo-blocked / anti-bot from the dev environment.** Where a site is reachable, save its real response as a committed fixture and implement the parser against it. Where it is unreachable, scaffold that chain `enabled:false` with a `note` explaining what was observed — do not invent fake fixtures.

---

### Task 1: Backend — EAN-first, country-scoped product matching

Makes `ean_barcode` an actual match+persist key. Today `findOrCreateProduct` never reads or stores `ean_barcode`; it matches only by Turkish name fingerprint + fuzzy similarity. This task adds EAN as the first, exact, language-neutral matching stage and changes the DB uniqueness of `ean_barcode` from global to per-country. This is the linchpin the whole foreign pipeline depends on and it also improves Turkey.

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma` (Product `ean_barcode` uniqueness)
- Create: `cheep-backend-express/prisma/migrations/<generated>/migration.sql` (via `prisma migrate dev`)
- Modify: `cheep-backend-express/src/api/products/product-matcher.service.ts:157-249` (`findOrCreateProduct`)
- Test: `cheep-backend-express/test/product-ean-match.test.ts`

**Interfaces:**
- Consumes: `getCountryIdByCode(code?: string): Promise<number|undefined>` from `../../utils/country.js` (already imported in the matcher).
- Produces: `findOrCreateProduct(data)` now honours `data.ean_barcode` — when present with a resolvable country, it returns the existing product with that `(country_id, ean_barcode)` before any fingerprint work, and persists `ean_barcode` on create. `upsertStorePrice` already spreads `ean_barcode` into `productData`, so no change is needed at the call site.

- [ ] **Step 1: Write the failing tests**

Create `cheep-backend-express/test/product-ean-match.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const create = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    product: {
      findFirst: (...a: any[]) => findFirst(...a),
      create: (...a: any[]) => create(...a),
      findMany: (...a: any[]) => findMany(...a),
      update: (...a: any[]) => update(...a),
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../src/utils/country.js', () => ({
  getCountryIdByCode: vi.fn(async (code?: string) =>
    ({ DE: 4, CH: 2, SE: 3, PL: 5 } as Record<string, number>)[code ?? ''] ?? undefined),
}));

import { productMatcher } from '../src/api/products/product-matcher.service.js';

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  findMany.mockReset();
  update.mockReset();
});

describe('findOrCreateProduct EAN-first (country-scoped)', () => {
  it('same EAN + same country → returns the existing product (no create)', async () => {
    // First findFirst = EAN lookup → hit.
    findFirst.mockResolvedValueOnce({ id: 99, name: 'REWE Milch', country_id: 4, ean_barcode: '4008400404127', muadil_grup_id: null });
    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'REWE Bio Milch 1L', ean_barcode: '4008400404127', country_code: 'DE',
    });
    expect(isNew).toBe(false);
    expect(product.id).toBe(99);
    expect(create).not.toHaveBeenCalled();
  });

  it('same EAN + different country → does NOT match, creates a new product', async () => {
    // EAN lookup is country-scoped → miss for CH even though DE has it.
    findFirst.mockResolvedValue(null); // EAN miss + fingerprint miss
    findMany.mockResolvedValueOnce([]); // no fuzzy candidates
    create.mockResolvedValueOnce({ id: 101, name: 'Migros Milch 1L', country_id: 2, ean_barcode: '4008400404127' });
    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'Migros Milch 1L', ean_barcode: '4008400404127', country_code: 'CH',
    });
    expect(isNew).toBe(true);
    expect(product.country_id).toBe(2);
    // EAN lookup must be scoped by country_id.
    const eanCall = findFirst.mock.calls.find(c => c[0]?.where?.ean_barcode);
    expect(eanCall?.[0].where.country_id).toBe(2);
  });

  it('persists ean_barcode on create', async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValueOnce([]);
    create.mockResolvedValueOnce({ id: 7, name: 'ICA Mjölk', country_id: 3, ean_barcode: '7300000000001' });
    await productMatcher.findOrCreateProduct({
      name: 'ICA Mjölk 1L', ean_barcode: '7300000000001', country_code: 'SE',
    });
    const createArg = create.mock.calls[0][0];
    expect(createArg.data.ean_barcode).toBe('7300000000001');
  });

  it('no EAN → falls back to fingerprint path (EAN lookup not attempted)', async () => {
    findFirst.mockResolvedValue(null); // fingerprint exact-match miss
    findMany.mockResolvedValueOnce([]);
    create.mockResolvedValueOnce({ id: 12, name: 'Süt', country_id: 4 });
    await productMatcher.findOrCreateProduct({ name: 'Süt 1L', brand: 'Pınar', country_code: 'DE' });
    // No findFirst call should carry an ean_barcode where-clause.
    const eanCall = findFirst.mock.calls.find(c => c[0]?.where?.ean_barcode);
    expect(eanCall).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd cheep-backend-express && pnpm test -- product-ean-match`
Expected: FAIL — current matcher never queries by `ean_barcode`, so the EAN-hit and country-scope assertions fail.

- [ ] **Step 3: Change the schema uniqueness of `ean_barcode`**

In `cheep-backend-express/prisma/schema.prisma`, in the `Product` model, change the `ean_barcode` line and the index. Find:

```prisma
  ean_barcode    String? @unique // EAN/UPC barkod numarası
```
Replace the `@unique` with a plain optional field:
```prisma
  ean_barcode    String? // EAN/UPC barkod numarası (benzersizlik ülke-scope: @@unique aşağıda)
```
Then find the existing `@@index([ean_barcode])` line in the `Product` model and replace it with a composite unique (Postgres treats NULLs as distinct, so many null-EAN products remain legal):
```prisma
  @@unique([country_id, ean_barcode])
```
(Keep all other `Product` indexes as-is.)

- [ ] **Step 4: Generate the migration**

Run: `cd cheep-backend-express && pnpm exec prisma migrate dev --name ean_unique_per_country`
Expected: creates `prisma/migrations/<timestamp>_ean_unique_per_country/migration.sql` that drops the old `Product_ean_barcode_key` unique index and adds a unique index on `(country_id, ean_barcode)`; Prisma client regenerates. If it reports a data conflict (two rows share an EAN globally), that means seed/dev data already violates per-country uniqueness — resolve by inspecting those rows; in a clean seeded DB there is only one EAN row (`7300000000001`) so it applies cleanly.

- [ ] **Step 5: Add the EAN-first branch to `findOrCreateProduct`**

In `cheep-backend-express/src/api/products/product-matcher.service.ts`, extend the parameter type of `findOrCreateProduct` to include `ean_barcode` (add the field alongside the existing ones, around line 157-166):

```ts
    async findOrCreateProduct(data: {
        name: string;
        brand?: string;
        quantity?: number;
        unit?: string;
        category_id?: number | string | null;
        image_url?: string;
        muadil_grup_id?: string | null;
        country_id?: number;
        country_code?: string;
        ean_barcode?: string;
    }): Promise<{ product: any; isNew: boolean }> {
```

Immediately inside the method body, before the `providedMuadil` block (before current line 168), insert the EAN-first stage. Resolve the country once and reuse it for both EAN lookup and create:

```ts
        // EAN-first: exact, language-neutral, cross-store. Country-scoped so the
        // same physical EAN in two countries stays two distinct products (Phase 1).
        const ean = data.ean_barcode?.trim() || undefined;
        const resolvedCountryId =
            data.country_id ?? (await getCountryIdByCode(data.country_code));
        if (ean && resolvedCountryId) {
            const existingByEan = await prisma.product.findFirst({
                where: { ean_barcode: ean, country_id: resolvedCountryId },
            });
            if (existingByEan) {
                return { product: existingByEan, isNew: false };
            }
        }
```

Then, in the final `prisma.product.create({ data: { ... } })` call (currently line 237-246), reuse `resolvedCountryId` instead of re-resolving, and persist the EAN. Replace the `countryId` line and the `create` data block so they read:

```ts
        const countryId = resolvedCountryId;

        const newProduct = await prisma.product.create({
            data: {
                name: data.name,
                brand: data.brand,
                category_id: categoryId,
                country_id: countryId,
                image_url: data.image_url,
                ean_barcode: ean,
                muadil_grup_id: muadilToPersist && muadilToPersist.length > 0 ? muadilToPersist : undefined,
            },
        });
```

Delete the now-duplicate `const countryId = data.country_id ?? (await getCountryIdByCode(data.country_code));` line that previously sat just above the create (line 235) so `resolvedCountryId` is the single source.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd cheep-backend-express && pnpm test -- product-ean-match`
Expected: PASS (4/4).

- [ ] **Step 7: Run the full backend suite (no regressions)**

Run: `cd cheep-backend-express && pnpm test`
Expected: PASS — all previously green tests (incl. `product-fingerprint`, `product-country-scope`, `store-branch*`) still pass.

- [ ] **Step 8: Commit**

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations cheep-backend-express/src/api/products/product-matcher.service.ts cheep-backend-express/test/product-ean-match.test.ts
git commit -m "feat(backend): EAN-first country-scoped product matching + persist ean_barcode"
```

---

### Task 2: Scraper — shared foreign pipeline (`countries/_common/`)

One DRY, EAN-forwarding pipeline all four countries share. Unlike Turkey (which runs the LLM matcher), foreign countries scrape → import straight to `bulk-upsert`; the backend now merges cross-store by EAN (Task 1). Turkey's files are not touched.

**Files:**
- Create: `Cheep-Scraper/countries/_common/__init__.py`
- Create: `Cheep-Scraper/countries/_common/runner.py` (config-driven scraper runner)
- Create: `Cheep-Scraper/countries/_common/foreign_import.py` (EAN-forwarding importer)
- Create: `Cheep-Scraper/countries/_common/pipeline.py` (scrape → import orchestration for one country)
- Test: `Cheep-Scraper/tests/test_foreign_import.py`

**Interfaces:**
- Consumes: `scrapers.base_scraper.Product` (field `barcode`, method `to_dict()` emitting key `"barcode"`); the ingest contract from Global Constraints.
- Produces:
  - `build_api_payloads(products: list[dict], store_id: int, category_map: dict[str,str] | None) -> list[dict]` — maps scraped product dicts to backend payloads, forwarding `barcode → ean_barcode`.
  - `ForeignImporter(api_url: str, country_code: str, api_key: str | None)` with `.import_products(products: list[dict], store_id: int, category_map=None) -> dict` (returns `{"total","successful","failed"}`), sending headers `x-country` and (if key present) `x-api-key`, chunked at 900.
  - `run_country_pipeline(config_path: str, api_url: str) -> dict` — runs the scraper runner then imports every enabled market's output; returns a per-market summary.
  - `CountryScraperRunner(config_path)` re-exported from `runner.py` (behaviourally identical to Turkey's, minus TR log emoji), with `async run_all() -> list[dict]` items `{market, output_file, product_count, store_id}`.

- [ ] **Step 1: Write the failing test**

Create `Cheep-Scraper/tests/test_foreign_import.py`:

```python
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from countries._common.foreign_import import build_api_payloads, ForeignImporter


def test_barcode_maps_to_ean_barcode():
    products = [{
        "name": "Bio Milch 1L", "brand": "Migros", "barcode": "7610200000001",
        "price": 1.55, "unit": "adet", "sku": "MIG-1",
    }]
    payloads = build_api_payloads(products, store_id=10, category_map=None)
    assert len(payloads) == 1
    p = payloads[0]
    assert p["ean_barcode"] == "7610200000001"
    assert p["store_id"] == 10
    assert p["store_sku"] == "MIG-1"
    assert p["price"] == "1.55"          # sent as decimal string
    assert p["source"] == "scrape"
    assert p["name"] == "Bio Milch 1L"


def test_missing_barcode_omits_ean_field():
    products = [{"name": "Brot 500g", "price": 2.0, "sku": "X1"}]
    payloads = build_api_payloads(products, store_id=30, category_map=None)
    assert "ean_barcode" not in payloads[0]
    # store_sku falls back to a deterministic value when sku is absent
    payloads2 = build_api_payloads([{"name": "Brot 500g", "price": 2.0}], store_id=30, category_map=None)
    assert payloads2[0]["store_sku"]


def test_unit_defaults_and_passthrough():
    payloads = build_api_payloads([{"name": "Cola 2L", "price": 1.2, "unit": "l", "sku": "C"}], 31, None)
    assert payloads[0]["unit"] == "l"
    payloads2 = build_api_payloads([{"name": "Egg", "price": 3.0, "sku": "E"}], 31, None)
    assert payloads2[0]["unit"] == "adet"


def test_importer_sends_country_and_key_headers(monkeypatch):
    captured = {}

    class FakeResp:
        ok = True
        status_code = 200
        content = b"{}"
        def json(self): return {"successful": 1, "success_count": 1}
        def raise_for_status(self): pass

    def fake_post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["body"] = json
        return FakeResp()

    import countries._common.foreign_import as fi
    monkeypatch.setattr(fi.requests, "post", fake_post)

    importer = ForeignImporter("http://localhost:3000/api/v1", country_code="DE", api_key="secret")
    result = importer.import_products(
        [{"name": "Milch", "price": 1.0, "sku": "M", "barcode": "1"}], store_id=30,
    )
    assert captured["url"].endswith("/store-prices/bulk-upsert")
    assert captured["headers"]["x-country"] == "DE"
    assert captured["headers"]["x-api-key"] == "secret"
    assert captured["body"]["prices"][0]["ean_barcode"] == "1"
    assert result["successful"] == 1
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Cheep-Scraper && python -m pytest tests/test_foreign_import.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'countries._common'`.

- [ ] **Step 3: Create the package marker**

Create `Cheep-Scraper/countries/_common/__init__.py` (empty file).

- [ ] **Step 4: Implement `foreign_import.py`**

Create `Cheep-Scraper/countries/_common/foreign_import.py`:

```python
"""
EAN-forwarding importer for foreign countries.
Scrape → bulk-upsert. No LLM matcher: the backend merges cross-store by EAN.
"""
import logging
import os
import requests
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

CHUNK_SIZE = 900          # backend hard limit is 1000
ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu"}


def build_api_payloads(
    products: List[Dict],
    store_id: int,
    category_map: Optional[Dict[str, str]] = None,
) -> List[Dict]:
    """Map scraped product dicts to backend bulk-upsert payloads.

    Forwards the scraped `barcode` to the backend field `ean_barcode`.
    `category_map` (raw category string -> canonical name) is optional; when a
    category can't be resolved the field is simply omitted (category is tertiary).
    """
    payloads: List[Dict] = []
    for i, product in enumerate(products):
        name = (product.get("name") or "").strip()
        if not name:
            continue
        try:
            price = float(product.get("price", 0))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue

        sku = product.get("sku") or product.get("store_sku") or f"{store_id}-{name[:24]}-{i}"
        unit = (product.get("unit") or "adet").lower()
        if unit not in ALLOWED_UNITS:
            unit = "adet"

        payload: Dict = {
            "store_id": int(store_id),
            "store_sku": str(sku),
            "price": f"{price:.2f}",
            "unit": unit,
            "source": "scrape",
            "confidence_score": 1.0,
            "name": name,
        }
        barcode = product.get("barcode")
        if barcode:
            payload["ean_barcode"] = str(barcode).strip()
        if product.get("brand"):
            payload["brand"] = str(product["brand"])
        if product.get("image_url"):
            payload["image_url"] = str(product["image_url"])
        payloads.append(payload)
    return payloads


class ForeignImporter:
    """Posts EAN-forwarded payloads to the backend, chunked and country-scoped."""

    def __init__(self, api_url: str, country_code: str, api_key: Optional[str] = None):
        self.api_url = api_url.rstrip("/")
        self.country_code = country_code
        self.headers = {"x-country": country_code}
        key = api_key if api_key is not None else os.getenv("INGEST_API_KEY")
        if key:
            self.headers["x-api-key"] = key

    def import_products(
        self,
        products: List[Dict],
        store_id: int,
        category_map: Optional[Dict[str, str]] = None,
    ) -> Dict:
        payloads = build_api_payloads(products, store_id, category_map)
        stats = {"total": 0, "successful": 0, "failed": 0}
        for i in range(0, len(payloads), CHUNK_SIZE):
            chunk = payloads[i:i + CHUNK_SIZE]
            stats["total"] += len(chunk)
            try:
                resp = requests.post(
                    f"{self.api_url}/store-prices/bulk-upsert",
                    json={"prices": chunk},
                    headers=self.headers,
                    timeout=120,
                )
                if not resp.ok:
                    logger.error("Ingest HTTP %s for store %s", resp.status_code, store_id)
                    stats["failed"] += len(chunk)
                    continue
                body = resp.json() if resp.content else {}
                ok = body.get("successful", body.get("success_count", len(chunk)))
                stats["successful"] += ok
                stats["failed"] += len(chunk) - ok
            except requests.RequestException as e:
                logger.error("Ingest failed for store %s: %s", store_id, e)
                stats["failed"] += len(chunk)
        return stats
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Cheep-Scraper && python -m pytest tests/test_foreign_import.py -v`
Expected: PASS (4/4).

- [ ] **Step 6: Implement `runner.py` (config-driven scraper runner)**

Create `Cheep-Scraper/countries/_common/runner.py` as a country-agnostic copy of Turkey's `CountryScraperRunner` — same dynamic `importlib` loading, `headless`/`user_data_dir` passthrough, per-market try/except isolation, and timestamped JSON output. Copy `countries/turkey/run_scrapers.py` verbatim into this module, then make exactly these changes: (a) remove the `🇹🇷` from the two startup log lines (replace with `self.config['country']`); (b) keep `async run_all()` returning items `{market, output_file, product_count, store_id}`; (c) keep the `if __name__ == "__main__"` block so it can still be run directly against a `config.json` in the CWD. No behavioural change beyond the log text.

- [ ] **Step 7: Implement `pipeline.py` (scrape → import for one country)**

Create `Cheep-Scraper/countries/_common/pipeline.py`:

```python
"""Run one country's foreign pipeline: scrape all enabled markets, then import
each market's freshest output to the backend (EAN-first). No LLM matcher."""
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict

from countries._common.runner import CountryScraperRunner
from countries._common.foreign_import import ForeignImporter

logger = logging.getLogger(__name__)


def _load_category_map(country_dir: Path) -> Dict[str, str]:
    path = country_dir / "category_map.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


async def run_country_pipeline(config_path: str, api_url: str = "http://localhost:3000/api/v1") -> Dict:
    config_path = Path(config_path)
    country_dir = config_path.parent
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    country_code = config["country_code"]
    category_map = _load_category_map(country_dir)

    runner = CountryScraperRunner(str(config_path))
    scrape_results = await runner.run_all()

    importer = ForeignImporter(api_url, country_code=country_code, api_key=os.getenv("INGEST_API_KEY"))
    summary = {"country": country_code, "markets": []}
    for r in scrape_results:
        with open(r["output_file"], "r", encoding="utf-8") as f:
            products = json.load(f)
        stats = importer.import_products(products, store_id=r["store_id"], category_map=category_map)
        logger.info("%s %s: scraped=%s imported=%s failed=%s",
                    country_code, r["market"], r["product_count"], stats["successful"], stats["failed"])
        summary["markets"].append({"market": r["market"], **stats})
    return summary


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("config", help="path to a country config.json")
    parser.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    asyncio.run(run_country_pipeline(args.config, args.api_url))


if __name__ == "__main__":
    main()
```

- [ ] **Step 8: Verify the whole scraper test set still passes**

Run: `cd Cheep-Scraper && python -m pytest tests/ -v`
Expected: PASS — new `test_foreign_import.py` green; existing tests unaffected.

- [ ] **Step 9: Commit**

```bash
git add Cheep-Scraper/countries/_common Cheep-Scraper/tests/test_foreign_import.py
git commit -m "feat(scraper): shared EAN-first foreign pipeline (_common runner/import/pipeline)"
```

---

### Task 3: Scraper — thin category-map helper + fixture harness

A tiny helper so each country ships a `category_map.json` (raw chain category → canonical neutral key) and a reusable fixture-based test harness the country tasks reuse. Category is tertiary; a missing mapping never blocks ingest.

**Files:**
- Create: `Cheep-Scraper/countries/_common/category.py`
- Create: `Cheep-Scraper/countries/_common/fixture_harness.py`
- Test: `Cheep-Scraper/tests/test_category_map.py`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `canonical_category(raw: str | None, category_map: dict[str,str]) -> str | None` — case-insensitive lookup; returns the canonical key or `None`.
  - `assert_valid_products(products: list, *, require_barcode: bool = False) -> None` — asserts each item (a `Product` or dict) has non-empty `name`, numeric `price > 0`, a set `country_code`, valid `unit`; when `require_barcode`, asserts `barcode` is digits-only. Raises `AssertionError` on the first violation. Used by every country scraper test.

- [ ] **Step 1: Write the failing test**

Create `Cheep-Scraper/tests/test_category_map.py`:

```python
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest
from countries._common.category import canonical_category, assert_valid_products


def test_canonical_category_case_insensitive():
    m = {"milch & käse": "dairy", "getränke": "beverages"}
    assert canonical_category("Milch & Käse", m) == "dairy"
    assert canonical_category("GETRÄNKE", m) == "beverages"
    assert canonical_category("unknown", m) is None
    assert canonical_category(None, m) is None


def test_assert_valid_products_accepts_good_dicts():
    good = [{"name": "Milch", "price": 1.5, "unit": "l", "country_code": "DE", "barcode": "40084004"}]
    assert_valid_products(good, require_barcode=True)  # no raise


def test_assert_valid_products_rejects_bad():
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "", "price": 1.0, "unit": "l", "country_code": "DE"}])
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "X", "price": 0, "unit": "l", "country_code": "DE"}])
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "X", "price": 1, "unit": "l"}])  # missing country_code
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "X", "price": 1, "unit": "l", "country_code": "DE", "barcode": "abc"}], require_barcode=True)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Cheep-Scraper && python -m pytest tests/test_category_map.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'countries._common.category'`.

- [ ] **Step 3: Implement `category.py`**

Create `Cheep-Scraper/countries/_common/category.py`:

```python
"""Thin category mapping + product validation shared by foreign country scrapers."""
from typing import Dict, List, Optional, Union

ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu"}


def canonical_category(raw: Optional[str], category_map: Dict[str, str]) -> Optional[str]:
    """Case-insensitive raw→canonical lookup. Returns None when unmapped/empty."""
    if not raw:
        return None
    lowered = {k.lower(): v for k, v in category_map.items()}
    return lowered.get(raw.strip().lower())


def _get(item: Union[dict, object], key: str, default=None):
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def assert_valid_products(products: List, *, require_barcode: bool = False) -> None:
    """Assert structural validity of scraped products (Product objects or dicts)."""
    assert products, "no products produced"
    for idx, p in enumerate(products):
        name = _get(p, "name")
        assert name and str(name).strip(), f"product[{idx}] has empty name"
        price = _get(p, "price")
        assert price is not None and float(price) > 0, f"product[{idx}] price must be > 0"
        unit = (_get(p, "unit") or "adet")
        assert str(unit).lower() in ALLOWED_UNITS, f"product[{idx}] invalid unit {unit!r}"
        cc = _get(p, "country_code")
        assert cc, f"product[{idx}] missing country_code"
        if require_barcode:
            bc = _get(p, "barcode")
            assert bc and str(bc).isdigit(), f"product[{idx}] barcode must be digits, got {bc!r}"
```

- [ ] **Step 4: Implement `fixture_harness.py`**

Create `Cheep-Scraper/countries/_common/fixture_harness.py`:

```python
"""Load a committed fixture (saved live response) and feed it to a scraper's
pure parse method, so parser correctness is tested without network access."""
import json
from pathlib import Path
from typing import Callable, List


def load_fixture(country_dir: Path, name: str) -> str:
    """Return the text of countries/<code>/fixtures/<name>."""
    path = country_dir / "fixtures" / name
    return path.read_text(encoding="utf-8")


def parse_fixture(fixture_text: str, parse_fn: Callable[[str], List]) -> List:
    """Run a scraper's pure parse function against saved fixture text."""
    return parse_fn(fixture_text)


def as_json(fixture_text: str):
    return json.loads(fixture_text)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Cheep-Scraper && python -m pytest tests/test_category_map.py -v`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add Cheep-Scraper/countries/_common/category.py Cheep-Scraper/countries/_common/fixture_harness.py Cheep-Scraper/tests/test_category_map.py
git commit -m "feat(scraper): shared category map + product-validation + fixture harness"
```

---

### Task 4: Switzerland package (Migros CH #10, Coop #11)

Create the CH country package: config with the two anchors enabled and discounters scaffolded, a category map, and a parser for each anchor built by recon against the live site (fixture saved if reachable) or scaffolded `enabled:false` with an observed-behaviour note if blocked.

**Files:**
- Create: `Cheep-Scraper/countries/switzerland/config.json`
- Create: `Cheep-Scraper/countries/switzerland/category_map.json`
- Create: `Cheep-Scraper/countries/switzerland/scrapers/__init__.py`
- Create: `Cheep-Scraper/countries/switzerland/scrapers/migros_ch.py`
- Create: `Cheep-Scraper/countries/switzerland/scrapers/coop_ch.py`
- Create (if reachable): `Cheep-Scraper/countries/switzerland/fixtures/migros_ch_sample.json`, `coop_ch_sample.*`
- Test: `Cheep-Scraper/tests/test_ch_scrapers.py`

**Interfaces:**
- Consumes: `scrapers.base_scraper.BaseScraper` / `Product`; `countries._common.category.assert_valid_products`; `countries._common.fixture_harness`.
- Produces: `MigrosCHScraper` and `CoopCHScraper`, each a `BaseScraper` subclass with `fetch_products() -> list[Product]` (live) and a **pure** `parse(raw_text: str) -> list[Product]` classmethod/staticmethod the fixture test calls. Every `Product` sets `country_code="CH"`, `store="Migros"`/`"Coop"`, and `barcode` when the source exposes it.

- [ ] **Step 1: Write the config**

Create `Cheep-Scraper/countries/switzerland/config.json`:

```json
{
  "country": "Switzerland",
  "country_code": "CH",
  "markets": [
    { "name": "Migros", "store_id": 10, "scraper_path": "scrapers/migros_ch.py", "scraper_class": "MigrosCHScraper", "scraper_method": "fetch_products", "output_pattern": "migros_ch_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: migros.ch product API" },
    { "name": "Coop", "store_id": 11, "scraper_path": "scrapers/coop_ch.py", "scraper_class": "CoopCHScraper", "scraper_method": "fetch_products", "output_pattern": "coop_ch_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: coop.ch" },
    { "name": "Denner", "store_id": 12, "scraper_path": "scrapers/denner.py", "scraper_class": "DennerScraper", "scraper_method": "fetch_products", "output_pattern": "denner_products_{timestamp}.json", "enabled": false, "note": "best-effort; needs Store seed row #12 before enabling" },
    { "name": "Aldi Suisse", "store_id": 13, "scraper_path": "scrapers/aldi_ch.py", "scraper_class": "AldiCHScraper", "scraper_method": "fetch_products", "output_pattern": "aldi_ch_products_{timestamp}.json", "enabled": false, "note": "hard discounter; leaflet-only likely; needs Store seed row #13" },
    { "name": "Lidl Suisse", "store_id": 14, "scraper_path": "scrapers/lidl_ch.py", "scraper_class": "LidlCHScraper", "scraper_method": "fetch_products", "output_pattern": "lidl_ch_products_{timestamp}.json", "enabled": false, "note": "hard discounter; leaflet-only likely; needs Store seed row #14" }
  ],
  "output_dir": "output",
  "log_dir": "logs"
}
```

- [ ] **Step 2: Write the category map**

Create `Cheep-Scraper/countries/switzerland/category_map.json` with a thin raw→canonical seed (extend during recon as real category strings appear). Canonical keys are neutral English tokens; UI localizes them via Phase-1 i18n:

```json
{
  "Milch, Käse, Eier": "dairy-eggs",
  "Früchte & Gemüse": "fruit-veg",
  "Getränke": "beverages",
  "Brot & Backwaren": "bakery",
  "Fleisch & Fisch": "meat-fish"
}
```

- [ ] **Step 3: Recon the live sites and capture a fixture (or record a block)**

For each anchor, attempt a live fetch from the dev environment and record what happens. Use `requests` first; if blocked (403/Cloudflare), try a Playwright persistent context like the A101 TR scraper. Concretely:

Run (recon, not committed as-is):
```bash
cd Cheep-Scraper && python -c "import requests; r=requests.get('https://www.migros.ch/', headers={'User-Agent':'Mozilla/5.0'}, timeout=20); print(r.status_code, len(r.text))"
```
- If you can retrieve a **product listing/API response**, save the raw payload to `countries/switzerland/fixtures/migros_ch_sample.json` (or `.html`) — this is the fixture the test asserts against. Discover the real product fields (name, price, unit/quantity, barcode/GTIN if present) from it.
- If the site is unreachable/anti-bot after a genuine attempt (requests + Playwright), set that market `enabled:false` in `config.json` and add a `note` describing the exact observation (e.g. `"note": "recon 2026-07-01: 403 Cloudflare on requests + Playwright headless; needs residential proxy"`). Do **not** fabricate a fixture. Skip that scraper's parser body (leave a `raise NotImplementedError` in `fetch_products`) but still ship the class + fixture-less test skip so the package imports cleanly.

- [ ] **Step 4: Write the failing fixture test**

Create `Cheep-Scraper/tests/test_ch_scrapers.py`. The test is fixture-driven and skips cleanly for any anchor scaffolded off in Step 3:

```python
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
CH_DIR = ROOT / "countries" / "switzerland"
sys.path.insert(0, str(CH_DIR))

from countries._common.category import assert_valid_products
from countries._common.fixture_harness import load_fixture

FIXTURES = CH_DIR / "fixtures"


@pytest.mark.skipif(not (FIXTURES / "migros_ch_sample.json").exists(),
                    reason="no Migros CH fixture (site unreachable at build time)")
def test_migros_ch_parses_fixture():
    from scrapers.migros_ch import MigrosCHScraper
    raw = load_fixture(CH_DIR, "migros_ch_sample.json")
    products = MigrosCHScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "CH" for p in products)
    assert all(p.store == "Migros" for p in products)


@pytest.mark.skipif(not (FIXTURES / "coop_ch_sample.html").exists() and not (FIXTURES / "coop_ch_sample.json").exists(),
                    reason="no Coop CH fixture (site unreachable at build time)")
def test_coop_ch_parses_fixture():
    from scrapers.coop_ch import CoopCHScraper
    name = "coop_ch_sample.json" if (FIXTURES / "coop_ch_sample.json").exists() else "coop_ch_sample.html"
    raw = load_fixture(CH_DIR, name)
    products = CoopCHScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "CH" for p in products)
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd Cheep-Scraper && python -m pytest tests/test_ch_scrapers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scrapers.migros_ch'` (or, if both anchors were blocked in Step 3, both tests SKIP — in which case implement the class stubs in Step 6 so imports succeed and the skips are honest).

- [ ] **Step 6: Implement the anchor scrapers**

Create `Cheep-Scraper/countries/switzerland/scrapers/__init__.py` (empty). Create `migros_ch.py` and `coop_ch.py`. Each follows this shape (pattern adapted from `carrefour/carrefour_scraper.py` and `migros/migros_api_scraper.py`), with a **pure `parse` staticmethod** so tests need no network:

```python
"""Migros CH scraper — anchor. Pure parse() is fixture-testable; fetch_products() is live."""
import json
from decimal import Decimal
from typing import List
import requests

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # repo root for `scrapers`
from scrapers.base_scraper import BaseScraper, Product


class MigrosCHScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Migros")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved Migros CH payload → Product list. FILL FROM THE FIXTURE
        discovered in Step 3: map the real name/price/unit/GTIN field paths here."""
        data = json.loads(raw_text)
        products: List[Product] = []
        for item in data.get("products", data if isinstance(data, list) else []):
            name = item.get("name") or item.get("title")
            price_raw = item.get("price") or item.get("displayPrice")
            if not name or price_raw in (None, ""):
                continue
            products.append(Product(
                name=str(name).strip(),
                price=Decimal(str(price_raw)),
                store="Migros",
                brand=item.get("brand"),
                barcode=item.get("gtin") or item.get("ean"),
                sku=str(item.get("id") or item.get("sku") or name)[:64],
                raw_category=item.get("category"),
                unit=(item.get("unit") or "adet"),
                image_url=item.get("image"),
                country_code="CH",
            ))
        return products

    def fetch_products(self) -> List[Product]:
        # Live path: use the endpoint discovered in Step 3. Respect rate limits
        # (self.delay_between_requests) and retries (self.max_retries).
        resp = requests.get(
            "https://www.migros.ch/...",  # endpoint from recon
            headers={"User-Agent": self.get_random_user_agent()},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return self.parse(resp.text)

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        return Decimal(str(price_str).replace("CHF", "").replace(",", ".").strip())
```

Implement `coop_ch.py` the same way (`store_name="Coop"`, `country_code="CH"`, `parse` matching Coop's real payload — JSON or HTML via BeautifulSoup like the ŞOK TR scraper). **If an anchor was blocked in Step 3**, keep the class and `parse` but make `fetch_products` `raise NotImplementedError("CH <chain>: site unreachable at build time — see config note")`, and leave no fixture so its test stays skipped.

- [ ] **Step 7: Run the test to verify it passes (or skips honestly)**

Run: `cd Cheep-Scraper && python -m pytest tests/test_ch_scrapers.py -v`
Expected: PASS for every anchor that produced a fixture; SKIP (with reason) for any anchor whose site was unreachable. No ERRORS/import failures.

- [ ] **Step 8: Commit**

```bash
git add Cheep-Scraper/countries/switzerland Cheep-Scraper/tests/test_ch_scrapers.py
git commit -m "feat(scraper): Switzerland package (Migros CH #10, Coop #11) + fixtures"
```

---

### Task 5: Sweden package (ICA #20, Willys #21)

Same shape as Task 4, for Sweden. Coop SE and Hemköp are scaffolded `enabled:false` (their Store rows are not seeded); City Gross scaffolded as best-effort.

**Files:**
- Create: `Cheep-Scraper/countries/sweden/config.json`
- Create: `Cheep-Scraper/countries/sweden/category_map.json`
- Create: `Cheep-Scraper/countries/sweden/scrapers/__init__.py`, `ica.py`, `willys.py`
- Create (if reachable): `Cheep-Scraper/countries/sweden/fixtures/ica_sample.json`, `willys_sample.*`
- Test: `Cheep-Scraper/tests/test_se_scrapers.py`

**Interfaces:**
- Consumes: as Task 4.
- Produces: `ICAScraper` (`store="ICA"`), `WillysScraper` (`store="Willys"`), each `country_code="SE"`, with pure `parse(raw_text)` + live `fetch_products`.

- [ ] **Step 1: Write the config**

Create `Cheep-Scraper/countries/sweden/config.json`:

```json
{
  "country": "Sweden",
  "country_code": "SE",
  "markets": [
    { "name": "ICA", "store_id": 20, "scraper_path": "scrapers/ica.py", "scraper_class": "ICAScraper", "scraper_method": "fetch_products", "output_pattern": "ica_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: handlaprivatkund.ica.se / ica.se API" },
    { "name": "Willys", "store_id": 21, "scraper_path": "scrapers/willys.py", "scraper_class": "WillysScraper", "scraper_method": "fetch_products", "output_pattern": "willys_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: willys.se (Axfood)" },
    { "name": "Coop", "store_id": 22, "scraper_path": "scrapers/coop_se.py", "scraper_class": "CoopSEScraper", "scraper_method": "fetch_products", "output_pattern": "coop_se_products_{timestamp}.json", "enabled": false, "note": "anchor-candidate; needs Store seed row #22 before enabling" },
    { "name": "Hemköp", "store_id": 23, "scraper_path": "scrapers/hemkop.py", "scraper_class": "HemkopScraper", "scraper_method": "fetch_products", "output_pattern": "hemkop_products_{timestamp}.json", "enabled": false, "note": "anchor-candidate (Axfood); needs Store seed row #23" },
    { "name": "City Gross", "store_id": 24, "scraper_path": "scrapers/citygross.py", "scraper_class": "CityGrossScraper", "scraper_method": "fetch_products", "output_pattern": "citygross_products_{timestamp}.json", "enabled": false, "note": "best-effort; needs Store seed row #24" }
  ],
  "output_dir": "output",
  "log_dir": "logs"
}
```

- [ ] **Step 2: Write the category map**

Create `Cheep-Scraper/countries/sweden/category_map.json`:

```json
{
  "Mejeri & Ost": "dairy-eggs",
  "Frukt & Grönt": "fruit-veg",
  "Dryck": "beverages",
  "Bröd & Kakor": "bakery",
  "Kött & Fågel": "meat-fish"
}
```

- [ ] **Step 3: Recon live + capture fixture (or record block)**

Same procedure as Task 4 Step 3, targeting `https://www.ica.se/` and `https://www.willys.se/`. ICA and Axfood (Willys) both expose JSON product APIs discoverable via the browser network tab; capture a real listing response to `countries/sweden/fixtures/ica_sample.json` / `willys_sample.json`. If blocked, scaffold `enabled:false` with a dated observation note; do not fabricate.

- [ ] **Step 4: Write the failing fixture test**

Create `Cheep-Scraper/tests/test_se_scrapers.py` mirroring Task 4 Step 4 (swap paths to `sweden`, classes `ICAScraper`/`WillysScraper`, `country_code == "SE"`, store assertions `"ICA"`/`"Willys"`, fixtures `ica_sample.json` / `willys_sample.json`).

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd Cheep-Scraper && python -m pytest tests/test_se_scrapers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scrapers.ica'` (or clean SKIPs if both blocked).

- [ ] **Step 6: Implement the anchor scrapers**

Create `countries/sweden/scrapers/__init__.py` (empty), `ica.py`, `willys.py` following the Task 4 Step 6 shape — pure `parse(raw_text)` mapping the real ICA/Willys fields (`name`, price incl. öre, `gtin`/`ean`, unit/`jamforpris`), `store` and `country_code="SE"`. Blocked anchors get `raise NotImplementedError` in `fetch_products` and no fixture.

- [ ] **Step 7: Run the test to verify it passes (or skips honestly)**

Run: `cd Cheep-Scraper && python -m pytest tests/test_se_scrapers.py -v`
Expected: PASS where fixtures exist; SKIP otherwise; no import errors.

- [ ] **Step 8: Commit**

```bash
git add Cheep-Scraper/countries/sweden Cheep-Scraper/tests/test_se_scrapers.py
git commit -m "feat(scraper): Sweden package (ICA #20, Willys #21) + fixtures"
```

---

### Task 6: Germany package (REWE #30, Kaufland #31)

Same shape, for Germany. Aldi Süd/Nord, Lidl, Penny, Netto, Edeka scaffolded `enabled:false`.

**Files:**
- Create: `Cheep-Scraper/countries/germany/config.json`
- Create: `Cheep-Scraper/countries/germany/category_map.json`
- Create: `Cheep-Scraper/countries/germany/scrapers/__init__.py`, `rewe.py`, `kaufland_de.py`
- Create (if reachable): `Cheep-Scraper/countries/germany/fixtures/rewe_sample.json`, `kaufland_de_sample.*`
- Test: `Cheep-Scraper/tests/test_de_scrapers.py`

**Interfaces:**
- Consumes: as Task 4.
- Produces: `REWEScraper` (`store="REWE"`), `KauflandDEScraper` (`store="Kaufland"`), each `country_code="DE"`, pure `parse` + live `fetch_products`.

- [ ] **Step 1: Write the config**

Create `Cheep-Scraper/countries/germany/config.json`:

```json
{
  "country": "Germany",
  "country_code": "DE",
  "markets": [
    { "name": "REWE", "store_id": 30, "scraper_path": "scrapers/rewe.py", "scraper_class": "REWEScraper", "scraper_method": "fetch_products", "output_pattern": "rewe_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: shop.rewe.de product API (market-scoped)" },
    { "name": "Kaufland", "store_id": 31, "scraper_path": "scrapers/kaufland_de.py", "scraper_class": "KauflandDEScraper", "scraper_method": "fetch_products", "output_pattern": "kaufland_de_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: kaufland.de" },
    { "name": "Aldi Süd", "store_id": 32, "scraper_path": "scrapers/aldi_sued.py", "scraper_class": "AldiSuedScraper", "scraper_method": "fetch_products", "output_pattern": "aldi_sued_products_{timestamp}.json", "enabled": false, "note": "hard discounter; leaflet-only likely; needs Store seed row #32" },
    { "name": "Lidl", "store_id": 33, "scraper_path": "scrapers/lidl_de.py", "scraper_class": "LidlDEScraper", "scraper_method": "fetch_products", "output_pattern": "lidl_de_products_{timestamp}.json", "enabled": false, "note": "hard discounter; needs Store seed row #33" },
    { "name": "Penny", "store_id": 34, "scraper_path": "scrapers/penny.py", "scraper_class": "PennyScraper", "scraper_method": "fetch_products", "output_pattern": "penny_products_{timestamp}.json", "enabled": false, "note": "best-effort; needs Store seed row #34" },
    { "name": "Netto", "store_id": 35, "scraper_path": "scrapers/netto.py", "scraper_class": "NettoScraper", "scraper_method": "fetch_products", "output_pattern": "netto_products_{timestamp}.json", "enabled": false, "note": "best-effort; needs Store seed row #35" },
    { "name": "Edeka", "store_id": 36, "scraper_path": "scrapers/edeka.py", "scraper_class": "EdekaScraper", "scraper_method": "fetch_products", "output_pattern": "edeka_products_{timestamp}.json", "enabled": false, "note": "best-effort; needs Store seed row #36" }
  ],
  "output_dir": "output",
  "log_dir": "logs"
}
```

- [ ] **Step 2: Write the category map**

Create `Cheep-Scraper/countries/germany/category_map.json`:

```json
{
  "Milch & Käse": "dairy-eggs",
  "Obst & Gemüse": "fruit-veg",
  "Getränke": "beverages",
  "Brot & Backwaren": "bakery",
  "Fleisch & Wurst": "meat-fish"
}
```

- [ ] **Step 3: Recon live + capture fixture (or record block)**

As Task 4 Step 3, targeting `https://shop.rewe.de/` (note: REWE requires a delivery/market context — capture a category listing response) and `https://www.kaufland.de/`. Save real payloads to `countries/germany/fixtures/`. Blocked → `enabled:false` + dated note; no fabricated fixtures.

- [ ] **Step 4: Write the failing fixture test**

Create `Cheep-Scraper/tests/test_de_scrapers.py` mirroring Task 4 Step 4 (paths `germany`, classes `REWEScraper`/`KauflandDEScraper`, `country_code == "DE"`, stores `"REWE"`/`"Kaufland"`, fixtures `rewe_sample.json` / `kaufland_de_sample.json`).

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd Cheep-Scraper && python -m pytest tests/test_de_scrapers.py -v`
Expected: FAIL with import error (or clean SKIPs if both blocked).

- [ ] **Step 6: Implement the anchor scrapers**

Create `countries/germany/scrapers/__init__.py` (empty), `rewe.py`, `kaufland_de.py` per Task 4 Step 6 shape. German prices use `,` decimal (`1,09 €`) — `parse_price` strips `€` and converts `,`→`.`. Map `gtin`/`ean` where present. Blocked anchors: `raise NotImplementedError` + no fixture.

- [ ] **Step 7: Run the test to verify it passes (or skips honestly)**

Run: `cd Cheep-Scraper && python -m pytest tests/test_de_scrapers.py -v`
Expected: PASS where fixtures exist; SKIP otherwise; no import errors.

- [ ] **Step 8: Commit**

```bash
git add Cheep-Scraper/countries/germany Cheep-Scraper/tests/test_de_scrapers.py
git commit -m "feat(scraper): Germany package (REWE #30, Kaufland #31) + fixtures"
```

---

### Task 7: Poland package (Carrefour PL #40, Auchan #41)

Same shape, for Poland. Kaufland PL and Frisco scaffolded `enabled:false`; Biedronka, Lidl PL, Dino, Żabka scaffolded as hard/best-effort. **Ignore the store IDs in `countries/poland/config.json.example` (10/11)** — this task writes a correct `config.json` alongside it.

**Files:**
- Create: `Cheep-Scraper/countries/poland/config.json`
- Create: `Cheep-Scraper/countries/poland/category_map.json`
- Create: `Cheep-Scraper/countries/poland/scrapers/__init__.py`, `carrefour_pl.py`, `auchan_pl.py`
- Create (if reachable): `Cheep-Scraper/countries/poland/fixtures/carrefour_pl_sample.*`, `auchan_pl_sample.*`
- Test: `Cheep-Scraper/tests/test_pl_scrapers.py`

**Interfaces:**
- Consumes: as Task 4.
- Produces: `CarrefourPLScraper` (`store="Carrefour"`), `AuchanPLScraper` (`store="Auchan"`), each `country_code="PL"`, pure `parse` + live `fetch_products`.

- [ ] **Step 1: Write the config**

Create `Cheep-Scraper/countries/poland/config.json`:

```json
{
  "country": "Poland",
  "country_code": "PL",
  "markets": [
    { "name": "Carrefour", "store_id": 40, "scraper_path": "scrapers/carrefour_pl.py", "scraper_class": "CarrefourPLScraper", "scraper_method": "fetch_products", "output_pattern": "carrefour_pl_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: carrefour.pl online catalog" },
    { "name": "Auchan", "store_id": 41, "scraper_path": "scrapers/auchan_pl.py", "scraper_class": "AuchanPLScraper", "scraper_method": "fetch_products", "output_pattern": "auchan_pl_products_{timestamp}.json", "enabled": true, "note": "anchor; recon: auchan.pl / zakupy.auchan.pl" },
    { "name": "Kaufland", "store_id": 42, "scraper_path": "scrapers/kaufland_pl.py", "scraper_class": "KauflandPLScraper", "scraper_method": "fetch_products", "output_pattern": "kaufland_pl_products_{timestamp}.json", "enabled": false, "note": "anchor-candidate; needs Store seed row #42 before enabling" },
    { "name": "Frisco", "store_id": 43, "scraper_path": "scrapers/frisco.py", "scraper_class": "FriscoScraper", "scraper_method": "fetch_products", "output_pattern": "frisco_products_{timestamp}.json", "enabled": false, "note": "online-only; needs Store seed row #43" },
    { "name": "Biedronka", "store_id": 44, "scraper_path": "scrapers/biedronka.py", "scraper_class": "BiedronkaScraper", "scraper_method": "fetch_products", "output_pattern": "biedronka_products_{timestamp}.json", "enabled": false, "note": "hard discounter; leaflet-only likely; needs Store seed row #44" },
    { "name": "Lidl", "store_id": 45, "scraper_path": "scrapers/lidl_pl.py", "scraper_class": "LidlPLScraper", "scraper_method": "fetch_products", "output_pattern": "lidl_pl_products_{timestamp}.json", "enabled": false, "note": "hard discounter; needs Store seed row #45" },
    { "name": "Dino", "store_id": 46, "scraper_path": "scrapers/dino.py", "scraper_class": "DinoScraper", "scraper_method": "fetch_products", "output_pattern": "dino_products_{timestamp}.json", "enabled": false, "note": "best-effort; needs Store seed row #46" },
    { "name": "Żabka", "store_id": 47, "scraper_path": "scrapers/zabka.py", "scraper_class": "ZabkaScraper", "scraper_method": "fetch_products", "output_pattern": "zabka_products_{timestamp}.json", "enabled": false, "note": "convenience; best-effort; needs Store seed row #47" }
  ],
  "output_dir": "output",
  "log_dir": "logs"
}
```

- [ ] **Step 2: Write the category map**

Create `Cheep-Scraper/countries/poland/category_map.json`:

```json
{
  "Nabiał i jaja": "dairy-eggs",
  "Owoce i warzywa": "fruit-veg",
  "Napoje": "beverages",
  "Pieczywo": "bakery",
  "Mięso i wędliny": "meat-fish"
}
```

- [ ] **Step 3: Recon live + capture fixture (or record block)**

As Task 4 Step 3, targeting `https://www.carrefour.pl/` and `https://zakupy.auchan.pl/`. Save real payloads to `countries/poland/fixtures/`. Polish prices use `,` decimal (`3,49 zł`). Blocked → `enabled:false` + dated note; no fabricated fixtures.

- [ ] **Step 4: Write the failing fixture test**

Create `Cheep-Scraper/tests/test_pl_scrapers.py` mirroring Task 4 Step 4 (paths `poland`, classes `CarrefourPLScraper`/`AuchanPLScraper`, `country_code == "PL"`, stores `"Carrefour"`/`"Auchan"`, fixtures `carrefour_pl_sample.json` / `auchan_pl_sample.json`; accept `.html` variants like the Coop test).

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd Cheep-Scraper && python -m pytest tests/test_pl_scrapers.py -v`
Expected: FAIL with import error (or clean SKIPs if both blocked).

- [ ] **Step 6: Implement the anchor scrapers**

Create `countries/poland/scrapers/__init__.py` (empty), `carrefour_pl.py`, `auchan_pl.py` per Task 4 Step 6 shape. `parse_price` strips `zł` and converts `,`→`.`. Map `ean`/`gtin` where present. Blocked anchors: `raise NotImplementedError` + no fixture.

- [ ] **Step 7: Run the test to verify it passes (or skips honestly)**

Run: `cd Cheep-Scraper && python -m pytest tests/test_pl_scrapers.py -v`
Expected: PASS where fixtures exist; SKIP otherwise; no import errors.

- [ ] **Step 8: Commit**

```bash
git add Cheep-Scraper/countries/poland/config.json Cheep-Scraper/countries/poland/category_map.json Cheep-Scraper/countries/poland/scrapers Cheep-Scraper/countries/poland/fixtures Cheep-Scraper/tests/test_pl_scrapers.py
git commit -m "feat(scraper): Poland package (Carrefour PL #40, Auchan #41) + fixtures"
```

---

### Task 8: Weekly scheduler (Sunday→Monday night) + orchestrator + deploy docs

An orchestrator that runs all four countries staggered with per-country isolation and logging, plus a host-cron entry on the droplet and the deploy runbook. The scheduler calls the backend over the container's published port (`http://localhost:3000/api/v1`) with the ingest key.

**Files:**
- Create: `Cheep-Scraper/countries/_common/run_all_countries.py` (orchestrator)
- Create: `Cheep-Scraper/scheduler/cheep-scrape.cron` (crontab fragment)
- Create: `Cheep-Scraper/scheduler/run_weekly.sh` (wrapper the cron calls)
- Create: `Cheep-Scraper/scheduler/README.md` (droplet install runbook)
- Test: `Cheep-Scraper/tests/test_run_all_countries.py`

**Interfaces:**
- Consumes: `run_country_pipeline(config_path, api_url)` from `countries._common.pipeline`.
- Produces: `run_all(configs: list[str], api_url: str, stagger_seconds: int = 1800, sleep_fn=time.sleep) -> list[dict]` — runs each country's pipeline in order, one country's failure never aborts the others (caught + logged), staggering between countries via `sleep_fn`; returns a summary list `[{country, ok, markets|error}]`.

- [ ] **Step 1: Write the failing test**

Create `Cheep-Scraper/tests/test_run_all_countries.py`:

```python
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import asyncio
import countries._common.run_all_countries as rac


def test_per_country_isolation_and_stagger(monkeypatch):
    calls = []

    async def fake_pipeline(config_path, api_url):
        calls.append(config_path)
        if "germany" in config_path:
            raise RuntimeError("DE site down")
        return {"country": config_path, "markets": []}

    slept = []
    monkeypatch.setattr(rac, "run_country_pipeline", fake_pipeline)

    summary = asyncio.run(rac.run_all(
        ["countries/switzerland/config.json", "countries/germany/config.json", "countries/poland/config.json"],
        api_url="http://localhost:3000/api/v1",
        stagger_seconds=0,
        sleep_fn=lambda s: slept.append(s),
    ))

    # all three attempted despite DE failing
    assert len(calls) == 3
    by_ok = {s["country"].split("/")[1]: s["ok"] for s in summary}
    assert by_ok["switzerland"] is True
    assert by_ok["germany"] is False
    assert by_ok["poland"] is True
    # DE failure recorded, not raised
    de = next(s for s in summary if "germany" in s["country"])
    assert "DE site down" in de["error"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Cheep-Scraper && python -m pytest tests/test_run_all_countries.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'countries._common.run_all_countries'`.

- [ ] **Step 3: Implement the orchestrator**

Create `Cheep-Scraper/countries/_common/run_all_countries.py`:

```python
"""Weekly orchestrator: run every country's foreign pipeline, staggered, isolated."""
import asyncio
import logging
import os
import time
from typing import Callable, List

from countries._common.pipeline import run_country_pipeline

logger = logging.getLogger(__name__)

DEFAULT_CONFIGS = [
    "countries/switzerland/config.json",
    "countries/sweden/config.json",
    "countries/germany/config.json",
    "countries/poland/config.json",
]


async def run_all(
    configs: List[str],
    api_url: str,
    stagger_seconds: int = 1800,
    sleep_fn: Callable[[int], None] = time.sleep,
) -> List[dict]:
    summary: List[dict] = []
    for i, cfg in enumerate(configs):
        if i > 0 and stagger_seconds:
            logger.info("Staggering %ss before %s", stagger_seconds, cfg)
            sleep_fn(stagger_seconds)
        try:
            result = await run_country_pipeline(cfg, api_url)
            summary.append({"country": cfg, "ok": True, "markets": result.get("markets", [])})
            logger.info("OK %s", cfg)
        except Exception as e:  # per-country isolation: never abort the batch
            logger.error("FAILED %s: %s", cfg, e, exc_info=True)
            summary.append({"country": cfg, "ok": False, "error": str(e)})
    return summary


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    api_url = os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1")
    stagger = int(os.getenv("CHEEP_STAGGER_SECONDS", "1800"))
    asyncio.run(run_all(DEFAULT_CONFIGS, api_url, stagger_seconds=stagger))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Cheep-Scraper && python -m pytest tests/test_run_all_countries.py -v`
Expected: PASS.

- [ ] **Step 5: Write the cron wrapper**

Create `Cheep-Scraper/scheduler/run_weekly.sh`:

```bash
#!/usr/bin/env bash
# Weekly foreign scrape (Sun→Mon night). Invoked by cron on the droplet.
# Reads INGEST_API_KEY + CHEEP_API_URL from the environment (set in the cron line
# or /opt/cheep-scraper/.env). Logs to logs/weekly-<date>.log.
set -euo pipefail
APP_DIR="${CHEEP_SCRAPER_DIR:-/opt/cheep-scraper}"
cd "$APP_DIR"
mkdir -p logs
STAMP="$(date +%Y%m%d_%H%M%S)"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
exec python3 -m countries._common.run_all_countries >> "logs/weekly-${STAMP}.log" 2>&1
```

- [ ] **Step 6: Write the crontab fragment**

Create `Cheep-Scraper/scheduler/cheep-scrape.cron`:

```cron
# Cheep foreign scrape — night between Sunday and Monday.
# 02:00 UTC Monday (~03:00 CET, ~05:00 İstanbul). Countries stagger +30m internally.
# Install: crontab -l | cat - scheduler/cheep-scrape.cron | crontab -   (edit paths first)
0 2 * * 1 CHEEP_SCRAPER_DIR=/opt/cheep-scraper CHEEP_API_URL=http://localhost:3000/api/v1 /opt/cheep-scraper/scheduler/run_weekly.sh
```

- [ ] **Step 7: Write the deploy runbook**

Create `Cheep-Scraper/scheduler/README.md` documenting droplet install (values, not secrets):

```markdown
# Cheep foreign scraper — droplet scheduler

Runs the CH/SE/DE/PL price pipeline weekly, the night between Sunday and Monday.

## One-time install (on droplet 129.212.193.203, as root)

1. Clone/copy the scraper repo to `/opt/cheep-scraper` (or set `CHEEP_SCRAPER_DIR`).
2. `cd /opt/cheep-scraper && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt`
   (or use system python3 if Playwright is not needed for the enabled anchors).
3. Create `/opt/cheep-scraper/.env` (gitignored, never committed):
   ```
   INGEST_API_KEY=<same value as backend .env>
   CHEEP_API_URL=http://localhost:3000/api/v1
   CHEEP_STAGGER_SECONDS=1800
   ```
4. `chmod +x scheduler/run_weekly.sh`
5. Install cron: `crontab -l 2>/dev/null | cat - scheduler/cheep-scrape.cron | crontab -`
   (edit the path in the cron line if not `/opt/cheep-scraper`).
6. Smoke test now (no wait): `scheduler/run_weekly.sh` then check `logs/weekly-*.log`.

## Notes
- The backend must be reachable at `CHEEP_API_URL` from the droplet (same host → localhost:3000).
- Each country is isolated: one country failing does not stop the others.
- Only anchors are `enabled` in each config; discounters are `enabled:false` until a
  scraper + a backend `Store` seed row exist for them.
- Secrets live only in `/opt/cheep-scraper/.env`. Rotate `INGEST_API_KEY` if ever exposed.
```

- [ ] **Step 8: Run the full scraper suite**

Run: `cd Cheep-Scraper && python -m pytest tests/ -v`
Expected: PASS — all foreign tests green or honestly skipped; existing Turkey tests unaffected.

- [ ] **Step 9: Commit**

```bash
git add Cheep-Scraper/countries/_common/run_all_countries.py Cheep-Scraper/scheduler Cheep-Scraper/tests/test_run_all_countries.py
git commit -m "feat(scraper): weekly Sun→Mon orchestrator + droplet cron scheduler + runbook"
```

---

## Notes for the executor (read before Task 1)

- **Spec discrepancy discovered during planning:** the design doc assumed the backend already merges cross-store by `Product.ean_barcode` (`@unique`). It does not — `findOrCreateProduct` ignored `ean_barcode` entirely and the column was globally unique (which would break the same EAN existing in two countries). Task 1 fixes both. This is intentional and supersedes the spec's assumption; it also benefits Turkey.
- **Scraper recon caveat:** live foreign sites cannot be reliably reached/validated from the dev environment (geo-block / anti-bot). Each country task's Step 3 attempts a genuine live fetch; the parser and its fixture are only as real as what that fetch returns. Blocked chains are scaffolded `enabled:false` with a dated observation note — never faked. The number of anchors producing real data will vary by reachability and is reported honestly in each task's Step 7.
- **Enabling a scaffolded chain later** requires two things: (1) a `Store` seed row at the reserved `store_id` in `cheep-backend-express/prisma/seed.ts`, and (2) a real scraper parser + fixture. Both are out of scope here by the "anchors only" constraint.
- **Deploy is deferred** (user decision 2026-07-01): the scrapers are built and tested first; the droplet deploy of Task 1's backend change + the scheduler install (Task 8 runbook) happen together in a later root deploy, before Google Play submission. Do not deploy from these tasks.
