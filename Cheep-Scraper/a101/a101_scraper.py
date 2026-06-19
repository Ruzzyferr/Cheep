"""
A101 (Kapıda) scraper — 2026.

A101 sits behind Cloudflare and renders via a custom RPC backend
(rio.a101.com.tr/.../CALL/...). Navigating a category page in a real browser
session triggers `Store/getProductsByCategory`, which returns the WHOLE category
(nested children -> products) in one JSON response. We drive Chromium with a
persistent context (passes Cloudflare), navigate each top category, capture that
JSON, and map it to the unified Product model.

Sync Playwright — call from a plain (non-asyncio) runner such as harvest.py.
"""
import re
import sys
import time
import json
import logging
from pathlib import Path
from decimal import Decimal
from typing import List, Optional

from playwright.sync_api import sync_playwright

parent_dir = Path(__file__).resolve().parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from scrapers.base_scraper import Product  # noqa: E402
from scrapers.units import extract_size_from_name, normalize_unit, compute_unit_price  # noqa: E402

BASE = "https://www.a101.com.tr"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
_NONCAT = ("search", "arama", "kampanya", "afis", "afisler", "brosur", "magaza",
           "kurumsal", "ekstra", "hediye", "iletisim", "yardim")


class A101Scraper:
    def __init__(self, headless: bool = True, user_data_dir: str = "browser_data/a101",
                 delay: float = 1.5):
        self.store_name = "A101"
        self.country_code = "TR"
        self.headless = headless
        self.user_data_dir = str(Path(parent_dir) / user_data_dir)
        self.delay = delay
        self.logger = logging.getLogger(self.store_name)

    # --- parsing ------------------------------------------------------------
    def _collect_products(self, node, out: list):
        if isinstance(node, dict):
            if isinstance(node.get("products"), list):
                out.extend(node["products"])
            for v in node.values():
                self._collect_products(v, out)
        elif isinstance(node, list):
            for v in node:
                self._collect_products(v, out)

    def _parse(self, it: dict, seen: set) -> Optional[Product]:
        attrs = it.get("attributes", {}) or {}
        name = attrs.get("name")
        pid = str(it.get("id", ""))
        if not name or (pid and pid in seen):
            return None
        price_obj = it.get("price", {}) or {}
        disc = price_obj.get("discounted") or price_obj.get("normal")
        if not disc:
            return None
        price = Decimal(str(disc)) / 100
        if price <= 0:
            return None
        normal = price_obj.get("normal")
        original = (Decimal(str(normal)) / 100) if normal and normal != disc else None

        cats = it.get("categories") or []
        raw_cat = cats[-1]["name"] if cats and isinstance(cats[-1], dict) else None

        # size: prefer the name (has "1,5 L" etc.); fall back to netWeight+baseUnit
        qty, unit = extract_size_from_name(name)
        if unit == "adet" and qty == 1.0 and attrs.get("netWeight"):
            base = normalize_unit(attrs.get("baseUnitOfMeasure") or attrs.get("salesUnitOfMeasure"))
            nw = float(attrs["netWeight"])
            if base in ("kg", "l"):      # netWeight is grams/ml -> keep as g/ml
                qty, unit = nw, ("g" if base == "kg" else "ml")
            elif base in ("g", "ml"):
                qty, unit = nw, base
        unit_price, upu = compute_unit_price(price, qty, unit)

        image_url = None
        for im in (it.get("images") or []):
            if isinstance(im, dict) and im.get("imageType") != "badge" and im.get("url"):
                image_url = im["url"]
                break

        seo = attrs.get("seoUrl")
        product_url = seo if (seo and seo.startswith("http")) else (BASE + "/" + seo if seo else None)

        if pid:
            seen.add(pid)
        return Product(
            name=name, price=price, store=self.store_name, brand=attrs.get("brand"),
            sku=pid, raw_category=raw_cat, unit=unit, quantity=qty,
            unit_price=unit_price, unit_price_unit=upu, original_price=original,
            in_stock=bool(it.get("stock", 0)) and it.get("isEnabled", True),
            image_url=image_url, product_url=product_url, country_code=self.country_code,
        )

    # --- driving ------------------------------------------------------------
    def _category_slugs(self, page) -> List[str]:
        page.goto(BASE + "/kapida", wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(3500)
        hrefs = page.eval_on_selector_all(
            'a[href*="/kapida/"]',
            "els => els.map(e => e.getAttribute('href')).filter(Boolean)")
        slugs = []
        for h in hrefs:
            m = re.match(r"^/kapida/([a-z0-9-]+)/?$", h or "")
            if not m:
                continue
            slug = m.group(1)
            if any(b in slug for b in _NONCAT) or "_p-" in (h or ""):
                continue
            if slug not in slugs:
                slugs.append(slug)
        return slugs

    def fetch_products(self, slugs: Optional[List[str]] = None) -> List[Product]:
        seen: set = set()
        products: List[Product] = []
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(
                self.user_data_dir, headless=self.headless, user_agent=UA,
                locale="tr-TR", viewport={"width": 1440, "height": 900},
                args=["--disable-blink-features=AutomationControlled"])
            page = ctx.pages[0] if ctx.pages else ctx.new_page()

            # Accumulate EVERY matching response body for the current slug — a
            # category can paginate over several getProductsByCategory calls and
            # keeping only the last one silently drops whole batches.
            captured = {"bodies": []}

            def on_resp(r):
                if "Store/getProductsByCategory" in r.url:
                    try:
                        captured["bodies"].append(r.text())
                    except Exception as e:  # playwright body already consumed/gone
                        self.logger.debug(f"response body alınamadı: {e}")
            page.on("response", on_resp)

            cats = slugs or self._category_slugs(page)
            self.logger.info(f"🗂️  {len(cats)} kategori: {cats}")
            for slug in cats:
                captured["bodies"] = []
                try:
                    page.goto(f"{BASE}/kapida/{slug}", wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_timeout(4500)
                except Exception as e:
                    self.logger.warning(f"⚠️ {slug}: {e}")
                    continue
                if not captured["bodies"]:
                    continue
                raw = []
                for body in captured["bodies"]:
                    try:
                        data = json.loads(body)
                    except (ValueError, TypeError) as e:
                        self.logger.warning(f"⚠️ {slug} JSON parse: {e}")
                        continue
                    self._collect_products(data, raw)
                got = 0
                for it in raw:
                    prod = self._parse(it, seen)
                    if prod:
                        products.append(prod); got += 1
                self.logger.info(f"🛒 {slug}: +{got} (toplam {len(products)})")
                time.sleep(self.delay)
            ctx.close()
        return products

    def save_to_json(self, products: List[Product], filename: str):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in products], f, ensure_ascii=False, indent=2)
        self.logger.info(f"💾 {len(products)} ürün kaydedildi: {filename}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
    s = A101Scraper(headless=True)
    prods = s.fetch_products(["temizlik-urunleri", "su-icecek"])
    s.save_to_json(prods, "a101_sample.json")
    print("total:", len(prods))
