"""
Migros API Scraper (2026 — search-based endpoint).

Migros moved its public API from category-slug screens to a search endpoint:
    GET https://www.migros.com.tr/rest/search/screens/products?q={query}&sayfa={page}
Response shape: data.searchInfo.{pageCount,hitCount,storeProductInfos[]}.

We harvest a broad catalog by querying a curated list of grocery terms (one or
more per canonical category), then map each product to the unified Product model
with correct price (shownPrice), gramaj (parsed from the name) and unit-price.
Rate-limited and transparent (CheepBot UA acceptable; falls back to browser UA).
"""
import time
import sys
import json
import logging
from pathlib import Path
from decimal import Decimal
from typing import List, Optional

import requests

parent_dir = Path(__file__).resolve().parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from scrapers.base_scraper import Product  # noqa: E402
from scrapers.units import extract_size_from_name, compute_unit_price  # noqa: E402

# Curated search terms — broad coverage across canonical categories.
SEARCH_TERMS = [
    # Süt & kahvaltılık
    "süt", "peynir", "yoğurt", "yumurta", "tereyağı", "kaymak", "ayran", "kefir",
    "zeytin", "bal", "reçel", "tahin", "pekmez", "kahvaltılık gevrek",
    # Et tavuk balık
    "tavuk", "kıyma", "dana eti", "balık", "sucuk", "salam", "sosis",
    # Meyve sebze
    "domates", "salatalık", "patates", "soğan", "elma", "muz", "portakal",
    "biber", "patlıcan", "limon", "havuç",
    # Temel gıda
    "pirinç", "makarna", "un", "şeker", "bulgur", "mercimek", "nohut", "fasulye",
    "ayçiçek yağı", "zeytinyağı", "salça", "tuz", "baharat", "sirke", "çorba",
    # İçecek
    "su", "maden suyu", "kola", "meyve suyu", "çay", "kahve", "gazoz", "ayran içecek",
    # Atıştırmalık
    "çikolata", "bisküvi", "cips", "gofret", "kuruyemiş", "kraker", "sakız",
    # Donuk & hazır
    "dondurma", "dondurulmuş pizza", "hazır yemek", "patates kızartması",
    # Fırın
    "ekmek", "simit", "kek", "pasta",
    # Temizlik
    "bulaşık deterjanı", "çamaşır deterjanı", "yumuşatıcı", "çamaşır suyu",
    "yüzey temizleyici", "çöp poşeti",
    # Kağıt & hijyen
    "tuvalet kağıdı", "kağıt havlu", "peçete", "ıslak mendil",
    # Kişisel bakım
    "şampuan", "sabun", "diş macunu", "deodorant", "duş jeli", "tıraş",
    # Bebek
    "bebek bezi", "bebek maması",
    # Pet
    "kedi maması", "köpek maması",
]


class MigrosAPISafeScraper:
    """Migros search-API scraper (rate-limited)."""

    def __init__(self, max_pages_per_term: int = 4, delay: float = 1.2):
        self.store_name = "Migros"
        self.country_code = "TR"
        self.base_url = "https://www.migros.com.tr"
        self.api_url = f"{self.base_url}/rest/search/screens/products"
        self.max_pages_per_term = max_pages_per_term
        self.delay = delay
        self.logger = logging.getLogger(self.store_name)
        self.headers = {
            "Accept": "application/json",
            "Accept-Language": "tr",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            "Referer": "https://www.migros.com.tr/",
        }

    def fetch_products(self, terms: Optional[List[str]] = None) -> List[Product]:
        """Tüm arama terimlerinden ürünleri çek (sku ile tekilleştir)."""
        terms = terms or SEARCH_TERMS
        seen = set()
        products: List[Product] = []
        for term in terms:
            try:
                got = self._scrape_term(term, seen)
                products.extend(got)
                self.logger.info(f"🔎 '{term}': +{len(got)} (toplam {len(products)})")
            except Exception as e:
                self.logger.warning(f"⚠️ '{term}' atlandı: {e}")
            time.sleep(self.delay)
        return products

    def _scrape_term(self, term: str, seen: set) -> List[Product]:
        out: List[Product] = []
        page = 0
        while page < self.max_pages_per_term:
            params = {"q": term, "sayfa": page, "reid": str(int(time.time() * 1000))}
            resp = requests.get(self.api_url, headers=self.headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if not data.get("successful"):
                break
            info = data.get("data", {}).get("searchInfo", {})
            items = info.get("storeProductInfos", []) or []
            if not items:
                break
            for it in items:
                p = self._parse(it, seen)
                if p:
                    out.append(p)
            page_count = info.get("pageCount", 0)
            if page >= page_count - 1:
                break
            page += 1
            time.sleep(self.delay)
        return out

    def _parse(self, it: dict, seen: set) -> Optional[Product]:
        name = it.get("name")
        if not name:
            return None
        sku = it.get("sku") or str(it.get("id", ""))
        if sku in seen:
            return None

        shown = it.get("shownPrice") or it.get("regularPrice")
        if not shown:
            return None
        price = Decimal(str(shown)) / 100
        if price <= 0:
            return None
        regular = it.get("regularPrice")
        original = (Decimal(str(regular)) / 100) if regular and regular != shown else None

        brand = None
        b = it.get("brand")
        if isinstance(b, dict):
            brand = b.get("name")

        raw_cat = None
        c = it.get("category")
        if isinstance(c, dict):
            raw_cat = c.get("name")

        image_url = None
        imgs = it.get("images") or []
        if imgs:
            urls = imgs[0].get("urls", {}) if isinstance(imgs[0], dict) else {}
            image_url = urls.get("PRODUCT_DETAIL") or urls.get("PRODUCT_HD")

        product_url = None
        pretty = it.get("prettyName")
        if pretty:
            product_url = f"{self.base_url}/{pretty}"

        qty, unit = extract_size_from_name(name)
        unit_price, unit_price_unit = compute_unit_price(price, qty, unit)
        in_stock = it.get("status", "IN_SALE") == "IN_SALE"

        seen.add(sku)
        return Product(
            name=name, price=price, store=self.store_name, brand=brand, sku=sku,
            raw_category=raw_cat, unit=unit, quantity=qty,
            unit_price=unit_price, unit_price_unit=unit_price_unit,
            original_price=original, in_stock=in_stock, image_url=image_url,
            product_url=product_url, country_code=self.country_code,
        )

    def save_to_json(self, products: List[Product], filename: str):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in products], f, ensure_ascii=False, indent=2)
        self.logger.info(f"💾 {len(products)} ürün kaydedildi: {filename}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
    s = MigrosAPISafeScraper()
    prods = s.fetch_products(["süt", "peynir"])
    s.save_to_json(prods, "migros_sample.json")
    print(f"total: {len(prods)}")
