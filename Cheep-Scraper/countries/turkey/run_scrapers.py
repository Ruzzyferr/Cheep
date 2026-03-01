"""
🚀 Turkey Market Scrapers Runner
Config dosyasından marketleri okuyup otomatik scrape eder
Yeni market eklemek için sadece config.json'ı güncellemek yeterli!
"""

import json
import sys
import importlib.util
import inspect
import logging
import asyncio
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)


class CountryScraperRunner:
    """Ülke bazlı scraper runner - config tabanlı"""
    
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
        
        logger.info(f"🇹🇷 {self.config['country']} Scraper Runner başlatıldı")
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
    
    def _load_scraper_module(self, market: Dict) -> Any:
        """
        Scraper modülünü dinamik olarak yükle
        
        Args:
            market: Market config dict
        
        Returns:
            Scraper class instance
        """
        # Path'i resolve et (relative veya absolute olabilir)
        scraper_path_str = market['scraper_path']
        if Path(scraper_path_str).is_absolute():
            scraper_path = Path(scraper_path_str)
        else:
            # Relative path: country_dir'den başla
            scraper_path = (self.country_dir / scraper_path_str).resolve()
        
        if not scraper_path.exists():
            raise FileNotFoundError(f"Scraper dosyası bulunamadı: {scraper_path}")
        
        # Modülü yükle
        spec = importlib.util.spec_from_file_location(
            f"scraper_{market['name'].lower()}",
            scraper_path
        )
        
        if spec is None or spec.loader is None:
            raise ImportError(f"Modül yüklenemedi: {scraper_path}")
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Scraper class'ını al
        scraper_class = getattr(module, market['scraper_class'], None)
        if scraper_class is None:
            raise AttributeError(
                f"Class '{market['scraper_class']}' bulunamadı: {scraper_path}"
            )
        
        # Instance oluştur - headless ve user_data_dir parametreleri varsa geç
        # 🔥 Cloudflare bypass için varsayılan olarak headless=False
        headless = market.get('headless', False)  # Varsayılan: False (görünür browser)
        user_data_dir = market.get('user_data_dir')  # Persistent browser context için
        
        # Scraper class'ının parametrelerini kontrol et
        sig = inspect.signature(scraper_class.__init__)
        
        # Parametreleri dinamik olarak geç
        kwargs = {}
        if 'headless' in sig.parameters:
            kwargs['headless'] = headless
        if 'user_data_dir' in sig.parameters and user_data_dir:
            kwargs['user_data_dir'] = user_data_dir
        
        if kwargs:
            return scraper_class(**kwargs)
        else:
            return scraper_class()
    
    def _get_output_file(self, market: Dict) -> Path:
        """Output dosya yolunu oluştur"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pattern = market['output_pattern'].replace('{timestamp}', timestamp)
        return self.output_dir / pattern
    
    async def _run_scraper(self, market: Dict) -> Optional[Path]:
        """
        Tek bir market scraper'ını çalıştır
        
        Args:
            market: Market config dict
        
        Returns:
            Output file path veya None
        """
        market_name = market['name']
        
        logger.info(f"\n{'='*60}")
        logger.info(f"🏪 {market_name} scraping başlıyor...")
        logger.info(f"{'='*60}")
        
        try:
            # Scraper'ı yükle
            scraper = self._load_scraper_module(market)
            
            # Scraper method'unu çağır
            scraper_method = getattr(scraper, market['scraper_method'], None)
            if scraper_method is None:
                raise AttributeError(
                    f"Method '{market['scraper_method']}' bulunamadı"
                )
            
            # Method'u çağır (async veya sync olabilir)
            if asyncio.iscoroutinefunction(scraper_method):
                products = await scraper_method()
            else:
                products = scraper_method()
            
            # Products kontrolü
            if not products:
                logger.warning(f"⚠️  {market_name}: Hiç ürün bulunamadı!")
                return None
            
            if not isinstance(products, list):
                logger.error(f"❌ {market_name}: Products bir liste değil! Tip: {type(products)}")
                return None
            
            logger.info(f"📦 {market_name}: {len(products)} ürün döndü")
            if products:
                logger.info(f"  → İlk ürün tipi: {type(products[0]).__name__}")
                logger.info(f"  → İlk ürün örneği: {str(products[0])[:100]}...")
            
            # Output dosyasını oluştur
            output_file = self._get_output_file(market)
            
            # Products'ı kaydet
            try:
                products_data = []
                
                # Format kontrolü ve dönüştürme
                if products and hasattr(products[0], 'to_dict'):
                    # Dataclass Product objeleri (Migros, CarrefourSA)
                    logger.info(f"  → Dataclass Product objeleri tespit edildi, to_dict() kullanılıyor...")
                    for i, p in enumerate(products):
                        try:
                            products_data.append(p.to_dict())
                        except Exception as e:
                            logger.warning(f"  ⚠️ Ürün {i} to_dict() hatası: {e}, asdict() deneniyor...")
                            from dataclasses import asdict
                            products_data.append(asdict(p))
                            products_data[-1]['price'] = str(p.price)  # Decimal'ı string'e çevir
                    
                elif products and isinstance(products[0], dict):
                    # Dict formatında
                    logger.info(f"  → Dict formatı tespit edildi")
                    products_data = products
                    
                elif products:
                    # Diğer formatlar için asdict dene
                    logger.info(f"  → Bilinmeyen format, asdict() deneniyor...")
                    from dataclasses import asdict
                    for p in products:
                        if hasattr(p, '__dict__'):
                            products_data.append(asdict(p))
                        else:
                            products_data.append(p)
                else:
                    logger.error(f"  ❌ Products listesi boş!")
                    return None
                
                logger.info(f"  → {len(products_data)} ürün JSON formatına dönüştürüldü")
                
                # JSON'a kaydet
                logger.info(f"  💾 JSON'a yazılıyor: {output_file}...")
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(products_data, f, ensure_ascii=False, indent=2, default=str)
                
                # Dosyanın gerçekten yazıldığını kontrol et
                file_size = output_file.stat().st_size
                if file_size == 0:
                    logger.error(f"  ❌ JSON dosyası boş! (0 bytes)")
                    return None
                
                # JSON'un geçerli olduğunu kontrol et
                try:
                    with open(output_file, 'r', encoding='utf-8') as f:
                        test_data = json.load(f)
                        if not isinstance(test_data, list):
                            logger.error(f"  ❌ JSON geçersiz format! Liste bekleniyor, {type(test_data)} geldi")
                            return None
                        if len(test_data) == 0:
                            logger.warning(f"  ⚠️ JSON dosyası boş liste içeriyor!")
                except json.JSONDecodeError as e:
                    logger.error(f"  ❌ JSON geçersiz! {e}")
                    return None
                
                logger.info(f"✅ {market_name}: {len(products_data)} ürün scrape edildi ve kaydedildi")
                logger.info(f"💾 Dosya: {output_file} ({file_size:,} bytes)")
                
                return output_file
                
            except Exception as e:
                logger.error(f"  ❌ JSON yazma hatası: {e}", exc_info=True)
                import traceback
                logger.error(f"  Traceback: {traceback.format_exc()}")
                return None
            
        except FileNotFoundError as e:
            logger.warning(f"⚠️  {market_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ {market_name} scraping hatası: {e}", exc_info=True)
            return None
    
    async def run_all(self) -> List[Dict[str, Any]]:
        """
        Tüm enabled marketleri scrape et
        
        Returns:
            [{'market': 'Migros', 'output_file': Path, 'product_count': 123}, ...]
        """
        markets = [m for m in self.config['markets'] if m.get('enabled', False)]
        
        if not markets:
            logger.warning("⚠️  Aktif market bulunamadı!")
            return []
        
        logger.info(f"\n🚀 {len(markets)} market scraping başlatılıyor...\n")
        
        results = []
        for market in markets:
            output_file = await self._run_scraper(market)
            
            if output_file:
                # Product count'u al
                try:
                    with open(output_file, 'r', encoding='utf-8') as f:
                        products = json.load(f)
                        product_count = len(products) if isinstance(products, list) else 0
                    
                    # Dosya boşsa uyar
                    if product_count == 0:
                        file_size = Path(output_file).stat().st_size
                        logger.warning(f"⚠️  {market['name']}: JSON dosyası boş veya geçersiz! (Size: {file_size} bytes)")
                except Exception as e:
                    logger.error(f"❌ {market['name']}: JSON okuma hatası: {e}")
                    product_count = 0
                
                results.append({
                    'market': market['name'],
                    'output_file': str(output_file),
                    'product_count': product_count,
                    'store_id': market['store_id']
                })
        
        return results
    
    def print_summary(self, results: List[Dict[str, Any]]):
        """Özet istatistikleri yazdır"""
        logger.info(f"\n{'='*60}")
        logger.info(f"📊 SCRAPING ÖZET")
        logger.info(f"{'='*60}")
        
        total_products = sum(r['product_count'] for r in results)
        
        for result in results:
            logger.info(
                f"✅ {result['market']:15} - "
                f"{result['product_count']:>6} ürün - "
                f"{Path(result['output_file']).name}"
            )
        
        logger.info(f"{'='*60}")
        logger.info(f"📦 Toplam: {total_products} ürün ({len(results)} market)")
        logger.info(f"{'='*60}\n")


async def main():
    """Ana entry point"""
    # Script'in bulunduğu klasörü bul
    script_dir = Path(__file__).resolve().parent
    config_path = script_dir / "config.json"
    
    if not config_path.exists():
        logger.error(f"❌ Config dosyası bulunamadı: {config_path}")
        logger.info(f"📝 Örnek config için config.json.example dosyasına bakın")
        sys.exit(1)
    
    # Runner oluştur
    runner = CountryScraperRunner(config_path)
    
    # Tüm marketleri scrape et
    results = await runner.run_all()
    
    # Özet yazdır
    runner.print_summary(results)
    
    # Sonuçları kaydet
    summary_file = runner.output_dir / f"scraping_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'country': runner.config['country'],
            'results': results
        }, f, ensure_ascii=False, indent=2)
    
    logger.info(f"💾 Özet kaydedildi: {summary_file}")


if __name__ == "__main__":
    asyncio.run(main())

