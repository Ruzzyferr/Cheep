"""
ŞOK Market scraper (sokmarket.com.tr) — 2026.

ŞOK renders product listings server-side (Next.js). The product/category API is
session-gated (x-platform / x-store-id / x-service-type / x-ecommerce-* + cookies),
but the *category pages* are publicly fetchable and paginate via ?page=N. So we:

  1. Prime a requests.Session on the homepage (sets the session cookies),
  2. Read the category taxonomy from /api/v1/cms/categories (with the gated headers),
  3. For each real category (`-c-{id}`), fetch ?page=1..N and parse product cards
     from the rendered HTML (title / price / image / product id).

Human-paced (polite delays) — public price data only.
"""
import re
import sys
import time
import json
import logging
from pathlib import Path
from decimal import Decimal
from typing import List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

parent_dir = Path(__file__).resolve().parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from scrapers.base_scraper import Product  # noqa: E402
from scrapers.units import extract_size_from_name, compute_unit_price  # noqa: E402

BASE = "https://www.sokmarket.com.tr"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
# Match TR prices with OR without decimals so integer-TL ("45 TL") isn't dropped.
_PRICE_RE = re.compile(r"([\d.]+(?:,\d+)?)")
_PID_RE = re.compile(r"-p-(\d+)")


class SokScraper:
    """ŞOK category-page scraper (requests + BeautifulSoup, paginated)."""

    def __init__(self, max_pages_per_cat: int = 40, delay: float = 1.3):
        self.store_name = "ŞOK"
        self.country_code = "TR"
        self.max_pages_per_cat = max_pages_per_cat
        self.delay = delay
        self.logger = logging.getLogger(self.store_name)
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": UA, "Accept-Language": "tr-TR"})
        self._api_headers = {}

    # --- session / taxonomy -------------------------------------------------
    def _prime(self):
        self.session.get(BASE + "/", timeout=25)
        ck = {c.name: c.value for c in self.session.cookies}
        self._api_headers = {
            "Accept": "*/*", "Content-Type": "application/json", "Referer": BASE + "/",
            "x-platform": "WEB", "x-service-type": "MARKET",
            "x-store-id": ck.get("X-Store-Id", "13412"),
            "x-app-version": "a7e60a34",
            "x-ecommerce-deviceid": ck.get("X-Ecommerce-Deviceid", ""),
            "x-ecommerce-sid": ck.get("X-Ecommerce-Sid", ""),
        }

    def get_categories(self) -> List[Tuple[str, str]]:
        """Return [(name, path)] for real product categories (`-c-{id}`)."""
        r = self.session.get(BASE + "/api/v1/cms/categories",
                             headers=self._api_headers, timeout=25)
        r.raise_for_status()
        pairs: List[Tuple[str, str]] = []

        def walk(n):
            if isinstance(n, dict):
                u, t = n.get("url"), (n.get("title") or n.get("name"))
                if u and t and re.search(r"-c-\d+$", str(u)):
                    pairs.append((t.strip(), u))
                for v in n.values():
                    walk(v)
            elif isinstance(n, list):
                for v in n:
                    walk(v)
        walk(r.json())
        # de-dup preserving order
        seen, out = set(), []
        for t, u in pairs:
            if u not in seen:
                seen.add(u); out.append((t, u))
        return out

    # --- parsing ------------------------------------------------------------
    def _parse_card(self, a, raw_category: str, seen: set) -> Optional[Product]:
        href = a.get("href", "")
        m = _PID_RE.search(href)
        pid = m.group(1) if m else None
        if pid and pid in seen:
            return None

        title_el = a.select_one('[class*="CProductCard-module_title"]')
        if not title_el:
            return None
        name = title_el.get_text(strip=True)

        price_el = a.select_one('[class*="CPriceBox-module_price__"]')
        if not price_el:
            return None
        pm = _PRICE_RE.search(price_el.get_text(strip=True))
        if not pm:
            return None
        price = Decimal(pm.group(1).replace(".", "").replace(",", "."))
        if price <= 0:
            return None

        # original (struck) price, if any
        original = None
        old_el = a.select_one('[class*="oldPrice"], [class*="OldPrice"], [class*="strikethrough"]')
        if old_el:
            om = _PRICE_RE.search(old_el.get_text(strip=True))
            if om:
                ov = Decimal(om.group(1).replace(".", "").replace(",", "."))
                if ov > price:
                    original = ov

        img_el = a.select_one("img")
        image_url = None
        if img_el:
            # guard empty src="" so we fall back to srcset instead of storing ""
            src = (img_el.get("src") or "").strip()
            image_url = src or (img_el.get("srcset", "").split(" ")[0] or None)

        qty, unit = extract_size_from_name(name)
        unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

        if pid:
            seen.add(pid)
        return Product(
            name=name, price=price, store=self.store_name, sku=pid,
            raw_category=raw_category, unit=unit, quantity=qty,
            unit_price=unit_price, unit_price_unit=unit_price_unit,
            original_price=original, in_stock=True,
            image_url=image_url, product_url=BASE + href if href else None,
            country_code=self.country_code,
        )

    def _scrape_category(self, name: str, path: str, seen: set) -> List[Product]:
        out: List[Product] = []
        url = BASE + path
        for page in range(1, self.max_pages_per_cat + 1):
            try:
                r = self.session.get(url, params={"page": page}, timeout=25)
                if r.status_code != 200:
                    break
            except Exception as e:
                self.logger.warning(f"⚠️ {name} p{page}: {e}")
                break
            soup = BeautifulSoup(r.text, "lxml")
            anchors = [a for a in soup.select('a[href*="-p-"]')
                       if a.select_one('[class*="CProductCard-module_title"]')]
            if not anchors:
                break
            before = len(seen)
            for a in anchors:
                p = self._parse_card(a, name, seen)
                if p:
                    out.append(p)
            # stop if this page added no new products (reached the end / clamped)
            if len(seen) == before:
                break
            time.sleep(self.delay)
        return out

    # --- entrypoint ---------------------------------------------------------
    def fetch_products(self, categories: Optional[List[Tuple[str, str]]] = None) -> List[Product]:
        self._prime()
        cats = categories or self.get_categories()
        self.logger.info(f"🗂️  {len(cats)} kategori")
        seen: set = set()
        products: List[Product] = []
        for name, path in cats:
            try:
                got = self._scrape_category(name, path, seen)
                products.extend(got)
                self.logger.info(f"🛒 {name}: +{len(got)} (toplam {len(products)})")
            except Exception as e:
                self.logger.warning(f"⚠️ {name} atlandı: {e}")
            time.sleep(self.delay)
        return products

    def save_to_json(self, products: List[Product], filename: str):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in products], f, ensure_ascii=False, indent=2)
        self.logger.info(f"💾 {len(products)} ürün kaydedildi: {filename}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
    s = SokScraper(max_pages_per_cat=2)
    s._prime()
    prods = s.fetch_products([("Süt & Süt Ürünleri", "/sut-ve-sut-urunleri-c-460")])
    s.save_to_json(prods, "sok_sample.json")
    print("total:", len(prods))
