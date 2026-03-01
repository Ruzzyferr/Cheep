"""
Base Scraper - Tüm market scraper'larının türetileceği abstract class
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class Product:
    """Scrape edilen ürün modeli"""
    name: str
    price: Decimal
    store: str
    brand: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    unit: str = "adet"
    quantity: float = 1.0
    in_stock: bool = True
    image_url: Optional[str] = None
    product_url: Optional[str] = None
    scraped_at: datetime = None

    def __post_init__(self):
        if self.scraped_at is None:
            self.scraped_at = datetime.now()

    def to_dict(self) -> Dict:
        """Dictionary'ye çevir"""
        return {
            'name': self.name,
            'brand': self.brand,
            'barcode': self.barcode,
            'category': self.category,
            'price': float(self.price),
            'unit': self.unit,
            'quantity': self.quantity,
            'in_stock': self.in_stock,
            'image_url': self.image_url,
            'product_url': self.product_url,
            'store': self.store,
            'scraped_at': self.scraped_at.isoformat()
        }

    def validate(self) -> bool:
        """Ürün verisini validate et"""
        if not self.name or len(self.name.strip()) == 0:
            logger.warning(f"Invalid product: name is empty")
            return False

        if self.price <= 0:
            logger.warning(f"Invalid product {self.name}: price is <= 0")
            return False

        if self.quantity <= 0:
            logger.warning(f"Invalid product {self.name}: quantity is <= 0")
            return False

        return True


class BaseScraper(ABC):
    """
    Tüm market scraper'larının türetileceği base class
    """

    def __init__(self, store_name: str):
        self.store_name = store_name
        self.logger = logging.getLogger(f"{__name__}.{store_name}")
        self.products: List[Product] = []

        # Scraper ayarları
        self.delay_between_requests = 2  # saniye
        self.max_retries = 3
        self.timeout = 30  # saniye

        # User agents listesi
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]

    @abstractmethod
    def fetch_products(self) -> List[Product]:
        """
        Ana scraping metodu - tüm ürünleri çeker
        Her scraper kendi implementasyonunu yapmalı
        """
        pass

    @abstractmethod
    def fetch_product_detail(self, product_url: str) -> Dict:
        """
        Ürün detay sayfasından ek bilgi çeker (barkod vb.)
        """
        pass

    @abstractmethod
    def parse_price(self, price_str: str) -> Decimal:
        """
        Fiyat string'ini Decimal'e çevirir
        Örnek: "270,50 TL" -> Decimal("270.50")
        """
        pass

    def parse_quantity_and_unit(self, quantity_str: str) -> tuple[float, str]:
        """
        Gramaj/miktar bilgisini parse eder
        Örnek: "5 kg" -> (5.0, "kg")
        Örnek: "2x200 g" -> (400.0, "g")
        """
        import re

        quantity_str = quantity_str.strip().lower()

        # Çoklu paket durumu: 2x200 g -> 400 g
        multi_pattern = r'(\d+)\s*x\s*(\d+)\s*([a-z]+)'
        match = re.search(multi_pattern, quantity_str)
        if match:
            count = float(match.group(1))
            amount = float(match.group(2))
            unit = match.group(3)
            return (count * amount, unit)

        # Normal format: 5 kg
        normal_pattern = r'(\d+(?:[.,]\d+)?)\s*([a-z]+)'
        match = re.search(normal_pattern, quantity_str)
        if match:
            quantity = float(match.group(1).replace(',', '.'))
            unit = match.group(2)
            return (quantity, unit)

        # Sadece sayı varsa: "5" -> (5.0, "adet")
        number_pattern = r'(\d+(?:[.,]\d+)?)'
        match = re.search(number_pattern, quantity_str)
        if match:
            quantity = float(match.group(1).replace(',', '.'))
            return (quantity, "adet")

        self.logger.warning(f"Could not parse quantity: {quantity_str}")
        return (1.0, "adet")

    def normalize_unit(self, unit: str) -> str:
        """
        Birim isimlerini standardize eder
        """
        unit = unit.lower().strip()

        unit_mapping = {
            'kg': 'kg',
            'kilogram': 'kg',
            'gr': 'g',
            'gram': 'g',
            'g': 'g',
            'lt': 'l',
            'litre': 'l',
            'l': 'l',
            'ml': 'ml',
            'mililitre': 'ml',
            'adet': 'adet',
            'ad': 'adet',
            'paket': 'paket',
            'kutu': 'kutu'
        }

        return unit_mapping.get(unit, unit)

    def get_random_user_agent(self) -> str:
        """Random user agent döndürür"""
        import random
        return random.choice(self.user_agents)

    def save_to_json(self, filename: str):
        """Ürünleri JSON dosyasına kaydeder"""
        import json

        data = {
            'store': self.store_name,
            'scraped_at': datetime.now().isoformat(),
            'total_products': len(self.products),
            'products': [p.to_dict() for p in self.products]
        }

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        self.logger.info(f"Saved {len(self.products)} products to {filename}")

    def get_statistics(self) -> Dict:
        """Scraping istatistiklerini döndürür"""
        valid_products = [p for p in self.products if p.validate()]
        products_with_barcode = [p for p in valid_products if p.barcode]

        return {
            'store': self.store_name,
            'total_products': len(self.products),
            'valid_products': len(valid_products),
            'products_with_barcode': len(products_with_barcode),
            'barcode_coverage': f"{len(products_with_barcode) / len(valid_products) * 100:.1f}%" if valid_products else "0%",
            'categories': len(set([p.category for p in valid_products if p.category]))
        }

    def run(self) -> List[Product]:
        """
        Scraper'ı çalıştırır ve ürünleri döndürür
        """
        self.logger.info(f"Starting scraper for {self.store_name}")

        try:
            self.products = self.fetch_products()

            stats = self.get_statistics()
            self.logger.info(f"Scraping completed: {stats}")

            return self.products

        except Exception as e:
            self.logger.error(f"Error during scraping: {e}", exc_info=True)
            raise