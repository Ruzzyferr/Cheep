"""
CarrefourSA scraper — 2026 (requests-based, SSR).

CarrefourSA category pages are server-rendered and publicly fetchable (no
Cloudflare on page routes), paginated via ?page=N. Each product card carries a
`.dataLayerItemData` element with structured attributes (brand, category,
quantity, id). We pick the main department categories from the live mega-menu
(by name, so it survives category-id changes), then page through each.

Modern replacement for the old async-Playwright carrefoursa_api_scraper.py:
unified Product model + units parser + name-first gramaj.
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
from scrapers.units import extract_size_from_name, normalize_unit, compute_unit_price  # noqa: E402

BASE = "https://www.carrefoursa.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Main departments selected by name (robust to category-id changes).
_DEPARTMENT_KEYWORDS = [
    "meyve, sebze", "et, tavuk", "şarküteri", "süt", "kahvaltılık", "temel gıda",
    "meşrubat", "içecek", "atıştırmalık", "dondurulmuş", "fırın", "pastane",
    "deterjan", "temizlik", "kağıt", "kozmetik", "kişisel bakım", "bebek",
    "ev ", "yaşam", "evcil", "pet",
]

# Skip campaign/promo "categories" (not real product taxonomy).
_PROMO_MARKERS = ["%", "indirim", "kampanya", "seçili", "secili", "hediye",
                  "fırsat", "firsat", "ocak", "şubat", "subat", "mart", "nisan",
                  "mayıs", "mayis", "haziran", "temmuz", "ağustos", "agustos",
                  "eylül", "eylul", "ekim", "kasım", "kasim", "aralık", "aralik",
                  "bu hafta", "haftanın", "afis", "broşür"]


class CarrefourScraper:
    def __init__(self, max_pages_per_cat: int = 50, delay: float = 0.7):
        self.store_name = "CarrefourSA"
        self.country_code = "TR"
        self.max_pages_per_cat = max_pages_per_cat
        self.delay = delay
        self.logger = logging.getLogger(self.store_name)
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": UA, "Accept-Language": "tr-TR"})

    def get_departments(self) -> List[Tuple[str, str]]:
        """All grocery categories from the mega-menu (leaves + parents), minus
        promo/campaign entries. Parent pages list only subcategories (they yield
        0 products in one request); leaf pages have the products. Global dedup
        across categories prevents any double-counting from parent/child overlap.
        """
        html = self.session.get(BASE + "/", timeout=25).text
        soup = BeautifulSoup(html, "lxml")
        out, seen_id = [], set()
        for a in soup.select('a[href*="/c/"]'):
            m = re.search(r"/([a-z0-9-]+)/c/(\d+)", a.get("href", ""))
            name = a.get_text(strip=True)
            if not m or not name or m.group(2) in seen_id:
                continue
            low = name.lower()
            if not any(k in low for k in _DEPARTMENT_KEYWORDS):
                continue
            if any(b in low for b in _PROMO_MARKERS):
                continue
            seen_id.add(m.group(2))
            out.append((name, m.group(0)))
        return out

    def _parse_card(self, card, fallback_cat: str, seen: set) -> Optional[Product]:
        name_el = card.select_one("h3.item-name")
        if not name_el:
            return None
        name = name_el.get_text(strip=True)
        dl = card.select_one(".dataLayerItemData")

        pid = None
        if dl:
            pid = dl.get("data-item_id")
        if not pid and name_el.get("content"):
            pid = name_el.get("content")
        if pid and pid in seen:
            return None

        price_el = (card.select_one(".item-price.js-variant-discounted-price")
                    or card.select_one(".item-price"))
        if not price_el:
            return None
        raw_price = price_el.get("content") or price_el.get_text(strip=True)
        pm = re.search(r"\d+[.,]?\d*", (raw_price or "").replace(".", "").replace(",", "."))
        # robust TL parse
        val = re.sub(r"[^\d,.]", "", raw_price or "")
        if not val:
            return None
        val = val.replace(".", "").replace(",", ".") if "," in val else val
        try:
            price = Decimal(val)
        except Exception:
            return None
        if price <= 0:
            return None

        brand = None
        raw_cat = fallback_cat
        if dl:
            b = dl.get("data-item_brand")
            if b and b.upper() != "MARKASIZ":
                brand = b
            raw_cat = dl.get("data-item_category3") or dl.get("data-item_category2") or fallback_cat

        qty, unit = extract_size_from_name(name)
        if unit == "adet" and qty == 1.0 and dl and dl.get("data-quantity"):
            try:
                q = float(dl.get("data-quantity"))
                if q > 0:
                    qty = q
            except ValueError:
                pass
        unit_price, upu = compute_unit_price(price, qty, unit)

        img = card.select_one('img[itemprop="image"]')
        image_url = None
        if img:
            image_url = img.get("src") or img.get("data-src")
            if image_url and image_url.startswith("//"):
                image_url = "https:" + image_url

        link = card.select_one("a.product-return") or card.select_one('a[href*="/p-"]')
        product_url = None
        if link and link.get("href"):
            h = link["href"]
            product_url = h if h.startswith("http") else BASE + h

        if pid:
            seen.add(pid)
        return Product(
            name=name, price=price, store=self.store_name, brand=brand, sku=pid,
            raw_category=raw_cat, unit=unit, quantity=qty,
            unit_price=unit_price, unit_price_unit=upu, in_stock=True,
            image_url=image_url, product_url=product_url, country_code=self.country_code,
        )

    def _scrape_category(self, name: str, path: str, seen: set) -> List[Product]:
        out: List[Product] = []
        url = BASE + path
        for page in range(0, self.max_pages_per_cat):
            try:
                r = self.session.get(url, params={"page": page} if page else None, timeout=25)
                if r.status_code != 200:
                    break
            except Exception as e:
                self.logger.warning(f"⚠️ {name} p{page}: {e}")
                break
            soup = BeautifulSoup(r.text, "lxml")
            cards = soup.select("li.product-listing-item") or soup.select(".item.product-wrapper")
            if not cards:
                break
            before = len(seen)
            for c in cards:
                p = self._parse_card(c, name, seen)
                if p:
                    out.append(p)
            if len(seen) == before:   # no new products -> end of category
                break
            time.sleep(self.delay)
        return out

    def fetch_products(self, departments: Optional[List[Tuple[str, str]]] = None) -> List[Product]:
        deps = departments or self.get_departments()
        self.logger.info(f"🗂️  {len(deps)} departman")
        seen: set = set()
        products: List[Product] = []
        for name, path in deps:
            try:
                got = self._scrape_category(name, path, seen)
                products.extend(got)
                self.logger.info(f"🛒 {name}: +{len(got)} (toplam {len(products)})")
            except Exception as e:
                self.logger.warning(f"⚠️ {name}: {e}")
            time.sleep(self.delay)
        return products

    def save_to_json(self, products: List[Product], filename: str):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in products], f, ensure_ascii=False, indent=2)
        self.logger.info(f"💾 {len(products)} ürün kaydedildi: {filename}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
    s = CarrefourScraper(max_pages_per_cat=2)
    prods = s.fetch_products([("Süt", "/sut-ve-kahvaltilik/c/1133")])
    s.save_to_json(prods, "carrefour_sample.json")
    print("total:", len(prods))
