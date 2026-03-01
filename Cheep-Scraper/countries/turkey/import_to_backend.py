"""
🚀 Matched Products Backend Import Script
Matched products JSON dosyasını backend API'ye gönderir.
"""

import json
import requests
import logging
import sys
from pathlib import Path
from typing import List, Dict

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Kategori mapping modülünü import et
_script_dir = Path(__file__).resolve().parent
util_dir = _script_dir.parent.parent / 'util'
try:
    if (util_dir / 'category_mapping.py').exists():
        sys.path.insert(0, str(util_dir))
        from category_mapping import normalize_category_name, STANDARD_CATEGORIES  # type: ignore
        logger.info("✅ Kategori mapping modülü yüklendi")
    else:
        raise ImportError("category_mapping not found")
except ImportError as e:
    logger.error(f"❌ category_mapping modülü yüklenemedi: {e}")
    # Fallback: basit normalize fonksiyonu
    def normalize_category_name(cat: str, product_name: str = "") -> str:
        return cat.strip() if cat else "Diğer"
    
    STANDARD_CATEGORIES = {}


class MatchedProductsImporter:
    """
    Matched products'ı backend API'ye gönderir
    """
    
    def __init__(self, api_url: str = "http://localhost:3000/api/v1"):
        """
        Args:
            api_url: Backend API base URL
        """
        self.api_url = api_url.rstrip('/')
        self.category_map = {}  # category_name -> category_id
        self.missing_categories = set()  # Eksik kategorileri takip et (tekrar yazmamak için)
        self.stats = {
            'total': 0,
            'successful': 0,
            'failed': 0,
            'chunks_processed': 0
        }
    
    def load_matched_products(self, json_file: Path) -> Dict:
        """
        Matched products JSON dosyasını yükle
        
        Args:
            json_file: JSON dosya yolu
            
        Returns:
            JSON içeriği
        """
        logger.info(f"📂 Dosya yükleniyor: {json_file}")
        
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        products = data.get('products', [])
        logger.info(f"📦 {len(products)} ürün yüklendi")
        logger.info(f"   - Girdi: {data.get('input', {}).get('total_products', 0)} ürün")
        logger.info(f"   - Çıktı: {data.get('output', {}).get('unique_products', 0)} unique ürün")
        
        return data
    
    def normalize_product_category(self, product: Dict) -> Dict:
        """
        Ürünün kategorisini normalize et (alt kategoriye çevir)
        """
        raw_category = product.get('category')
        if not raw_category:
            product['category'] = 'Diğer'
            return product
        
        # Alt kategoriyi al
        product_name = product.get('name', '')
        subcategory = normalize_category_name(raw_category, product_name)
        
        # Ürünü güncelle
        product['category'] = subcategory  # Alt kategori (veya 'Diğer')
        
        return product
    
    def create_categories(self, products: List[Dict]):
        """
        Kategorileri normalize et ve backend'e gönder, ID'lerini al
        """
        logger.info("🔄 Ürün kategorileri normalize ediliyor...")
        
        # Önce tüm ürünlerin kategorilerini normalize et
        normalized_categories = set()
        for product in products:
            normalized_product = self.normalize_product_category(product.copy())
            category = normalized_product.get('category')
            if category:
                normalized_categories.add(category)
        
        if not normalized_categories:
            logger.warning("⚠️  Hiç kategori bulunamadı")
            return
        
        logger.info(f"📁 {len(normalized_categories)} normalize edilmiş kategori backend'e gönderiliyor...")
        
        for category_name in normalized_categories:
            if not category_name or category_name.strip() == '':
                continue
            
            if category_name in self.category_map:
                continue
            
            try:
                # Backend'e kategori adını gönder, ID'yi al
                category_data = {'name': category_name}
                response = requests.post(
                    f"{self.api_url}/categories",
                    json=category_data,
                    timeout=10
                )
                response.raise_for_status()
                response_data = response.json()
                
                category = response_data.get('data', response_data) if isinstance(response_data, dict) and 'data' in response_data else response_data
                self.category_map[category_name] = int(category['id'])
                
                logger.debug(f"   ✅ '{category_name}' → ID: {category['id']}")
                
            except requests.RequestException as e:
                logger.error(f"  ❌ Kategori hatası ({category_name}): {e}")
                continue
        
        logger.info(f"✅ {len(self.category_map)} kategori ID'si alındı")
    
    def convert_to_api_format(self, products: List[Dict]) -> List[Dict]:
        """
        Matched products formatını backend API formatına çevir
        
        Backend API beklenen format:
        {
            "store_id": int,
            "store_sku": string,
            "price": string (decimal string),
            "unit": string,
            "source": "scrape",
            "confidence_score": 1.0,
            "name": string,
            "brand": string (optional),
            "muadil_grup_id": string (optional),
            "image_url": string (optional),
            "category_id": int (optional)
        }
        """
        api_payloads = []
        
        for product in products:
            # Ürünün kategorisini normalize et
            normalized_product = self.normalize_product_category(product.copy())
            
            # Backend API formatına çevir
            payload = {
                "store_id": int(normalized_product.get("store_id")),
                "store_sku": normalized_product.get("store_sku", ""),
                "price": str(normalized_product.get("price", 0)),  # String olarak gönder
                "unit": normalized_product.get("unit", "adet"),
                "source": "scrape",
                "confidence_score": 1.0,
                "name": normalized_product.get("name", ""),
            }
            
            # Opsiyonel alanlar
            if normalized_product.get("brand"):
                payload["brand"] = normalized_product["brand"]
            
            if normalized_product.get("image_url"):
                payload["image_url"] = normalized_product["image_url"]
            
            if normalized_product.get("muadil_grup_id"):
                payload["muadil_grup_id"] = normalized_product["muadil_grup_id"]
            
            # Category: Category ID'yi ekle (normalize edilmiş kategori)
            if normalized_product.get("category"):
                category_id = self.category_map.get(normalized_product["category"])
                if category_id:
                    payload["category_id"] = category_id
                else:
                    # Aynı kategori uyarısını sadece bir kere göster
                    category_name = normalized_product["category"]
                    if category_name not in self.missing_categories:
                        self.missing_categories.add(category_name)
                        logger.warning(f"⚠️  Kategori ID bulunamadı: {category_name}")
            
            api_payloads.append(payload)
        
        return api_payloads
    
    def send_in_chunks(self, payloads: List[Dict]):
        """
        Verileri chunk'lar halinde API'ye gönderir
        
        Args:
            payloads: API formatında payload listesi
        """
        CHUNK_SIZE = 900  # Backend limiti 1000, güvenli değer
        total_payloads = len(payloads)
        
        logger.info(f"✅ {total_payloads} ürün API formatına çevrildi")
        logger.info(f"📤 {CHUNK_SIZE} boyutlu parçalar halinde gönderiliyor...")
        
        for i in range(0, total_payloads, CHUNK_SIZE):
            chunk = payloads[i:i + CHUNK_SIZE]
            chunk_num = (i // CHUNK_SIZE) + 1
            total_chunks = (total_payloads + CHUNK_SIZE - 1) // CHUNK_SIZE
            
            logger.info(f"--- Parça {chunk_num}/{total_chunks} ({len(chunk)} ürün)... ---")
            
            try:
                bulk_payload = {'prices': chunk}
                response = requests.post(
                    f"{self.api_url}/store-prices/bulk-upsert",
                    json=bulk_payload,
                    timeout=120  # Uzun timeout (çok veri varsa)
                )
                
                if not response.ok:
                    error_details = response.json() if response.content else {}
                    logger.error(f"❌ API Hatası ({response.status_code}): {error_details.get('message', 'Bilinmeyen hata')}")
                    
                    # Hata detaylarını logla
                    if 'errors' in error_details:
                        for error in error_details['errors'][:5]:  # İlk 5 hatayı göster
                            logger.error(f"   - {error}")
                    
                    self.stats['failed'] += len(chunk)
                else:
                    result = response.json()
                    success_count = result.get('success_count', len(chunk))
                    self.stats['successful'] += success_count
                    self.stats['failed'] += len(chunk) - success_count
                    logger.info(f"✅ Parça {chunk_num} başarıyla gönderildi ({success_count}/{len(chunk)})")
                
                self.stats['chunks_processed'] += 1
                self.stats['total'] += len(chunk)
                
            except requests.RequestException as e:
                logger.error(f"❌ Parça {chunk_num} gönderilirken hata: {e}")
                self.stats['failed'] += len(chunk)
                self.stats['total'] += len(chunk)
                continue
    
    def import_matched_products(self, json_file: Path):
        """
        Matched products JSON dosyasını yükle ve backend'e gönder
        """
        # 1. JSON dosyasını yükle
        data = self.load_matched_products(json_file)
        
        # 2. Ürünlerin kategorilerini normalize et ve backend'e gönder, ID'lerini al
        products = data.get('products', [])
        self.create_categories(products)
        
        # 3. API formatına çevir (normalize edilmiş kategorilerle)
        api_payloads = self.convert_to_api_format(products)
        
        # 4. Chunk'lar halinde gönder
        self.send_in_chunks(api_payloads)
        
        # 5. İstatistikleri göster
        self.print_statistics()
    
    def print_statistics(self):
        """İstatistikleri yazdır"""
        logger.info("")
        logger.info("=" * 60)
        logger.info("📊 IMPORT İSTATİSTİKLERİ")
        logger.info("=" * 60)
        logger.info(f"📤 Toplam gönderilen: {self.stats['total']}")
        logger.info(f"✅ Başarılı: {self.stats['successful']}")
        logger.info(f"❌ Başarısız: {self.stats['failed']}")
        logger.info(f"📦 İşlenen parça: {self.stats['chunks_processed']}")
        
        # Eksik kategorileri özetle
        if self.missing_categories:
            logger.info("")
            logger.info("⚠️  EKSİK KATEGORİLER (Backend'de bulunamadı):")
            for cat in sorted(self.missing_categories):
                logger.info(f"   - {cat}")
            logger.info("")
            logger.info("💡 Bu kategorileri STANDARD_CATEGORIES'e eklemeniz veya")
            logger.info("   backend seed dosyasına eklemeniz gerekebilir.")
        
        logger.info("=" * 60)


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Matched products backend import')
    parser.add_argument(
        '--file',
        type=str,
        help='Matched products JSON dosyası yolu',
        default=None
    )
    parser.add_argument(
        '--api-url',
        type=str,
        help='Backend API URL (default: http://localhost:3000/api/v1)',
        default='http://localhost:3000/api/v1'
    )
    
    args = parser.parse_args()
    
    # Script'in bulunduğu klasör (countries/turkey/)
    script_dir = Path(__file__).resolve().parent
    output_dir = script_dir / 'output'
    
    # Dosya belirtilmemişse en son matched products dosyasını bul
    if args.file:
        json_file = Path(args.file)
    else:
        matched_files = list(output_dir.glob('matched_products_*.json'))
        if not matched_files:
            logger.error("❌ Matched products dosyası bulunamadı!")
            logger.info(f"💡 '{output_dir}' klasöründe 'matched_products_*.json' dosyası olmalı")
            return
        
        # En yeni dosyayı al
        json_file = max(matched_files, key=lambda p: p.stat().st_mtime)
        logger.info(f"📂 En son matched products dosyası bulundu: {json_file.name}")
    
    if not json_file.exists():
        logger.error(f"❌ Dosya bulunamadı: {json_file}")
        return
    
    # Import işlemini başlat
    importer = MatchedProductsImporter(api_url=args.api_url)
    importer.import_matched_products(json_file)


if __name__ == '__main__':
    main()
