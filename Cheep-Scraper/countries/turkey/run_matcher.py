"""
🚀 Turkey Market Matcher Runner
Config dosyasından marketleri okuyup otomatik match eder
Scalable 3-stage pipeline kullanır
Yeni market eklemek için sadece config.json'ı güncellemek yeterli!
"""

import json
import sys
import importlib.util
import logging
import asyncio
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# Scalable matcher'ı yükle
root_dir = Path(__file__).resolve().parent.parent.parent
matcher_path = root_dir / "scalable-llm-matcher.py"
spec = importlib.util.spec_from_file_location("scalable_llm_matcher", matcher_path)
scalable_llm_matcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scalable_llm_matcher)

ScalableLLMProductMatcher = scalable_llm_matcher.ScalableLLMProductMatcher
RawProductData = scalable_llm_matcher.RawProductData
ProcessedProduct = scalable_llm_matcher.ProcessedProduct

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)


class CountryMatcherRunner:
    """Ülke bazlı matcher runner - config tabanlı"""
    
    def __init__(self, config_path: str):
        """
        Args:
            config_path: config.json dosya yolu
        """
        self.config_path = Path(config_path)
        self.country_dir = self.config_path.parent
        self.config = self._load_config()
        
        # Output ve log klasörlerini oluştur
        self.output_dir = self.country_dir / self.config.get('output_dir', 'output')
        self.log_dir = self.country_dir / self.config.get('log_dir', 'logs')
        self.output_dir.mkdir(exist_ok=True)
        self.log_dir.mkdir(exist_ok=True)
        
        logger.info(f"🇹🇷 {self.config['country']} Matcher Runner başlatıldı")
        logger.info(f"📁 Output: {self.output_dir}")
        logger.info(f"📁 Logs: {self.log_dir}")
    
    def _load_config(self) -> Dict:
        """Config dosyasını yükle"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"❌ Config yükleme hatası: {e}")
            sys.exit(1)
    
    def _find_latest_json(self, market: Dict) -> Optional[Path]:
        """
        Market için en son JSON dosyasını bul
        
        Args:
            market: Market config dict
        
        Returns:
            En son JSON dosya yolu veya None
        """
        # Output klasöründe bu market'e ait dosyaları bul
        pattern = market['output_pattern']
        
        # {timestamp} kısmını wildcard ile değiştir
        # "migros_products_{timestamp}.json" -> "migros_products_*.json"
        search_pattern = pattern.replace('{timestamp}', '*')
        
        matching_files = list(self.output_dir.glob(search_pattern))
        
        if not matching_files:
            # Summary dosyalarını kontrol et
            summary_files = list(self.output_dir.glob("scraping_summary_*.json"))
            if summary_files:
                # En son summary'yi oku
                latest_summary = max(summary_files, key=lambda p: p.stat().st_mtime)
                try:
                    with open(latest_summary, 'r', encoding='utf-8') as f:
                        summary = json.load(f)
                        for result in summary.get('results', []):
                            if result.get('market') == market['name']:
                                return Path(result['output_file'])
                except:
                    pass
            
            return None
        
        # En yeni dosyayı bul
        latest = max(matching_files, key=lambda p: p.stat().st_mtime)
        return latest
    
    def _load_products_from_json(self, json_file: Path, market: Dict) -> List[RawProductData]:
        """
        JSON dosyasından ürünleri yükle ve RawProductData'ya çevir
        
        Args:
            json_file: JSON dosya yolu
            market: Market config dict
        
        Returns:
            RawProductData listesi
        """
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                products_data = json.load(f)
            
            if not isinstance(products_data, list):
                products_data = [products_data]
            
            raw_products = []
            for product in products_data:
                # Farklı formatları handle et
                if isinstance(product, dict):
                    raw_product = RawProductData(
                        name=product.get("name", ""),
                        brand=product.get("brand"),
                        store_id=market['store_id'],
                        store_name=market['name'],
                        store_sku=product.get("sku") or product.get("store_sku") or f"{market['name']}-{product.get('name', '')[:20]}",
                        price=float(product.get("price", 0)),
                        unit=product.get("unit", "adet"),
                        raw_category=product.get("category"),
                        image_url=product.get("image_url"),
                    )
                    
                    if raw_product.name and raw_product.price > 0:
                        raw_products.append(raw_product)
            
            logger.info(f"📦 {market['name']}: {len(raw_products)} ürün yüklendi")
            return raw_products
            
        except Exception as e:
            logger.error(f"❌ {market['name']} JSON yükleme hatası: {e}")
            return []
    
    async def run_matching(self) -> Dict[str, Any]:
        """
        Tüm enabled marketlerin JSON'larını bulup match et
        
        Returns:
            Matching sonuçları dict
        """
        markets = [m for m in self.config['markets'] if m.get('enabled', False)]
        
        if not markets:
            logger.warning("⚠️  Aktif market bulunamadı!")
            return {}
        
        logger.info(f"\n🚀 {len(markets)} market için matching başlatılıyor...\n")
        
        # Tüm marketlerden ürünleri topla
        all_raw_products = []
        market_files = {}
        
        for market in markets:
            json_file = self._find_latest_json(market)
            if not json_file:
                logger.warning(f"⚠️  {market['name']}: JSON dosyası bulunamadı, atlanıyor...")
                logger.info(f"   💡 Önce 'python run_scrapers.py' çalıştırın!")
                continue
            
            logger.info(f"📂 {market['name']}: {json_file.name}")
            products = self._load_products_from_json(json_file, market)
            all_raw_products.extend(products)
            market_files[market['name']] = str(json_file)
        
        if not all_raw_products:
            logger.error("❌ Hiç ürün bulunamadı!")
            logger.info("💡 Önce 'python run_scrapers.py' çalıştırarak ürünleri scrape edin!")
            return {}
        
        logger.info(f"\n📦 Toplam {len(all_raw_products)} ürün bulundu")
        logger.info(f"🚀 Scalable 3-Stage Pipeline başlatılıyor...\n")
        
        # Scalable matcher oluştur
        try:
            matcher = ScalableLLMProductMatcher()
            processed_products = await matcher.process_multi_market_products(all_raw_products)
            
            logger.info(f"\n✅ Matching tamamlandı!")
            logger.info(f"   - Girdi: {len(all_raw_products)} ürün")
            logger.info(f"   - Çıktı: {len(processed_products)} unique ürün")
            
            # Sonuçları kaydet
            output_file = self.output_dir / f"matched_products_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            # Backend formatına çevir
            backend_products = []
            for product in processed_products:
                for price_info in product.prices:
                    backend_products.append({
                        "name": product.normalized_name,
                        "brand": product.normalized_brand,
                        "store_id": price_info["store_id"],
                        "store_name": price_info["store_name"],
                        "store_sku": price_info["store_sku"],
                        "price": price_info["price"],
                        "unit": price_info.get("unit"),
                        "category": product.category,
                        "subcategory": product.subcategory,
                        "image_url": price_info.get("image_url"),
                        "muadil_grup_id": getattr(product, 'muadil_grup_id', ''),
                    })
            
            result = {
                'timestamp': datetime.now().isoformat(),
                'country': self.config['country'],
                'input': {
                    'total_products': len(all_raw_products),
                    'markets': list(market_files.keys()),
                    'market_files': market_files
                },
                'output': {
                    'unique_products': len(processed_products),
                    'total_price_entries': len(backend_products),
                    'avg_stores_per_product': len(backend_products) / len(processed_products) if processed_products else 0
                },
                'products': backend_products
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2, default=str)
            
            logger.info(f"💾 Sonuçlar kaydedildi: {output_file}")
            
            # Özet yazdır
            self._print_summary(result)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Matching hatası: {e}", exc_info=True)
            return {}
    
    def _print_summary(self, result: Dict[str, Any]):
        """Özet istatistikleri yazdır"""
        logger.info(f"\n{'='*60}")
        logger.info(f"📊 MATCHING ÖZET")
        logger.info(f"{'='*60}")
        logger.info(f"📥 Girdi: {result['input']['total_products']} ürün ({len(result['input']['markets'])} market)")
        logger.info(f"📤 Çıktı: {result['output']['unique_products']} unique ürün")
        logger.info(f"💰 Toplam fiyat girişi: {result['output']['total_price_entries']}")
        logger.info(f"📊 Ortalama market/ürün: {result['output']['avg_stores_per_product']:.2f}")
        logger.info(f"{'='*60}\n")


async def main():
    """Ana entry point"""
    # Script'in bulunduğu klasörü bul
    script_dir = Path(__file__).resolve().parent
    config_path = script_dir / "config.json"
    
    if not config_path.exists():
        logger.error(f"❌ Config dosyası bulunamadı: {config_path}")
        sys.exit(1)
    
    # Runner oluştur
    runner = CountryMatcherRunner(config_path)
    
    # Matching çalıştır
    result = await runner.run_matching()
    
    if result:
        logger.info(f"✅ Tüm işlemler başarıyla tamamlandı!")


if __name__ == "__main__":
    asyncio.run(main())

