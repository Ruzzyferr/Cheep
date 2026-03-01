"""
Migros API Scraper - Safe Version (robots.txt uyumlu)
Rate-limited, transparent, and compliant version
"""

import time
import requests
import re
import sys
from pathlib import Path
from decimal import Decimal
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
import json
import logging

parent_dir = Path(__file__).resolve().parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from util.category_mapping import get_categories_for_store
# 🔥 normalize_category_name kaldırıldı - normalizasyon matcher'da yapılıyor


@dataclass
class Product:
    name: str
    brand: Optional[str]
    category: str
    price: Decimal
    unit: str
    quantity: float
    in_stock: bool
    image_url: Optional[str]
    product_url: Optional[str]
    store: str
    sku: Optional[str] = None

    def validate(self) -> bool:
        return bool(self.name and self.price and self.price > 0)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["price"] = str(self.price)
        return data


class MigrosAPISafeScraper:
    """Migros API Scraper - robots.txt ve etik kullanıma uyumlu sürüm"""

    def __init__(self):
        self.store_name = "Migros"
        self.base_url = "https://www.migros.com.tr"
        self.api_url = "https://www.migros.com.tr/rest/search/screens"
        self.logger = logging.getLogger(self.store_name)

        # Tüm kategorileri category_mapping.py'den al
        migros_categories = get_categories_for_store("Migros")
        self.category_slugs = {}
        for slug_key, cat_info in migros_categories.items():
            category_name = cat_info['name']
            category_slug = cat_info['slug']
            self.category_slugs[category_name] = category_slug
        
        self.logger.info(f"📋 {len(self.category_slugs)} kategori yüklendi: {list(self.category_slugs.keys())}")

        # Daha sade, etik header seti
        self.headers = {
            "Accept": "application/json",
            "Accept-Language": "tr",
            "User-Agent": "CheepBot/1.0 (+https://cheep.app)",
            "Referer": "https://www.migros.com.tr/",
        }

    def fetch_products(self, category_names: List[str] = None) -> List[Product]:
        """Kategorilerden ürün çeker (rate-limited)"""
        all_products = []

        if category_names:
            categories = {k: v for k, v in self.category_slugs.items() if k in category_names}
        else:
            categories = self.category_slugs

        for category_name, slug in categories.items():
            self.logger.info(f"📂 Kategori: {category_name}")
            try:
                products = self.scrape_category(slug, category_name)
                all_products.extend(products)
                self.logger.info(f"✅ {category_name}: {len(products)} ürün")
                time.sleep(5)  # rate-limit (etik scraping)
            except Exception as e:
                self.logger.error(f"❌ {category_name}: {e}")
                continue

        return all_products

    def scrape_category(self, slug: str, category_name: str) -> List[Product]:
        """Bir kategorideki ürünleri API'den çeker (robots.txt uyumlu)"""
        products = []
        page = 0

        while True:
            url = f"{self.api_url}/{slug}"
            params = {"reid": str(int(time.time() * 1000)), "sayfa": page, "sirala": "onerilenler"}
            self.headers["Referer"] = f"{self.base_url}/{slug}"

            try:
                resp = requests.get(url, headers=self.headers, params=params, timeout=30)
                resp.raise_for_status()
                data = resp.json()

                if not data.get("successful"):
                    self.logger.warning("⚠️ API unsuccessful response")
                    break

                page_products = self.parse_products(data, category_name)
                if not page_products:
                    break

                products.extend(page_products)
                self.logger.info(f"📦 Sayfa {page+1}: {len(page_products)} ürün")

                if not self.has_more_pages(data, page):
                    break

                page += 1
                time.sleep(5)  # her sayfa arası bekleme
            except Exception as e:
                self.logger.warning(f"⚠️ Sayfa {page+1} atlandı: {e}")
                break

        return products

    def parse_products(self, data: dict, category_name: str) -> List[Product]:
        """API yanıtından ürün listesi çıkarır"""
        try:
            product_list = data.get("data", {}).get("searchInfo", {}).get("storeProductInfos", [])
            results = []
            for item in product_list:
                name = item.get("name")
                if not name:
                    continue

                regular_price = item.get("regularPrice") or item.get("shownPrice")
                if not regular_price:
                    continue
                price = Decimal(str(regular_price)) / 100

                brand = item.get("brand", {}).get("name") if item.get("brand") else None
                sku = item.get("sku")

                cat = item.get("category", {}).get("name") or category_name
                # 🔥 BEST PRACTICE: Normalizasyonu matcher'da yapacağız
                # Scraper sadece ham kategoriyi atar (raw_category)
                category = cat

                status = item.get("status", "IN_SALE")
                in_stock = status == "IN_SALE"

                image_url = None
                images = item.get("images", [])
                if images:
                    urls = images[0].get("urls", {})
                    image_url = urls.get("PRODUCT_DETAIL") or urls.get("PRODUCT_HD")

                product_url = None
                pretty = item.get("prettyName")
                if pretty:
                    product_url = f"{self.base_url}/{pretty}"

                results.append(
                    Product(
                        name=name,
                        brand=brand,
                        category=category,
                        price=price,
                        unit="adet",
                        quantity=1.0,
                        in_stock=in_stock,
                        image_url=image_url,
                        product_url=product_url,
                        store=self.store_name,
                        sku=sku,
                    )
                )
            return results
        except Exception:
            return []

    def has_more_pages(self, data: dict, current_page: int) -> bool:
        try:
            page_count = data.get("data", {}).get("searchInfo", {}).get("pageCount", 0)
            return current_page < page_count - 1
        except:
            return False

    def save_to_json(self, products: List[Product], filename: str):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in products], f, ensure_ascii=False, indent=2)
        self.logger.info(f"💾 {len(products)} ürün kaydedildi: {filename}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
    scraper = MigrosAPISafeScraper()
    products = scraper.fetch_products(["Süt & Kahvaltılık"])
    scraper.save_to_json(products, "migros_safe_output.json")
