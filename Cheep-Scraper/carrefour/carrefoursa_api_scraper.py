"""
CarrefourSA Playwright Scraper
Tam otomatik - Cloudflare bypass
Cookie yönetimi otomatik
"""

import asyncio
import logging
import time
import re
import sys
from pathlib import Path
from decimal import Decimal
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Page, Browser
import json

# Add parent directory to path for util imports
parent_dir = Path(__file__).resolve().parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from util.category_mapping import (
    CARREFOURSA_CATEGORIES,
    CARREFOURSA_SUBCATEGORIES,
    get_subcategories_for_store,
    normalize_category_name  # Sadece kategori listesi oluştururken kullanılıyor
)


@dataclass
class Product:
    """Ürün veri sınıfı"""
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
        data['price'] = str(self.price)
        return data


class CarrefourSAPlaywrightScraper:
    """CarrefourSA Playwright Scraper - Cloudflare Bypass"""

    def __init__(self, headless: bool = True, scrape_subcategories: bool = True, user_data_dir: Optional[str] = None):
        self.store_name = "CarrefourSA"
        self.base_url = "https://www.carrefoursa.com"
        self.headless = headless
        self.scrape_subcategories = scrape_subcategories
        self.user_data_dir = user_data_dir  # 🔥 Persistent browser context için
        self.logger = logging.getLogger(self.store_name)

        # Ana kategoriler (category_mapping.py'den)
        self.categories = {}
        for key, info in CARREFOURSA_CATEGORIES.items():
            # Normalize edilmiş ismi al
            normalized_name = normalize_category_name(info['name'])
            self.categories[normalized_name] = {
                'id': info['api_id'],
                'slug': info['slug'],
                'key': key,
                'has_subcategories': info.get('has_subcategories', False)
            }

        # Alt kategoriler (category_mapping.py'den)
        self.subcategories = CARREFOURSA_SUBCATEGORIES

        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def scrape_all_categories(self, category_names: List[str] = None) -> List[Product]:
        """Tüm kategorileri scrape et"""
        all_products = []

        async with async_playwright() as p:
            # 🔥 PERSISTENT BROWSER CONTEXT: Cloudflare bypass için gerçek Chrome profili kullan
            if self.user_data_dir:
                # User data directory ile persistent context (en iyi Cloudflare bypass)
                self.logger.info(f"🔐 Persistent browser context kullanılıyor: {self.user_data_dir}")
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=self.user_data_dir,
                    headless=self.headless,
                    viewport={'width': 1920, 'height': 1080},
                    locale='tr-TR',
                    timezone_id='Europe/Istanbul',
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-blink-features=AutomationControlled',
                    ],
                    extra_http_headers={
                        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Cache-Control': 'max-age=0',
                        'DNT': '1',
                    },
                )
                # Persistent context'te pages listesi var, ilk page'i al veya yeni oluştur
                if len(context.pages) > 0:
                    self.page = context.pages[0]
                else:
                    self.page = await context.new_page()
                self.browser = None  # Persistent context'te browser objesi yok
            else:
                # Normal browser launch (fallback)
                self.logger.info("⚠️  Normal browser context kullanılıyor (persistent context önerilir)")
                self.browser = await p.chromium.launch(
                    headless=self.headless,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--disable-site-isolation-trials',
                    ]
                )

                # Context ve page oluştur (gerçek browser gibi)
                context = await self.browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    viewport={'width': 1920, 'height': 1080},
                    locale='tr-TR',
                    timezone_id='Europe/Istanbul',
                    permissions=['geolocation'],
                    extra_http_headers={
                        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Cache-Control': 'max-age=0',
                        'DNT': '1',
                    },
                )
                
                # 🔥 Cloudflare bypass: WebDriver detection'ı devre dışı bırak
                await context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    
                    // Chrome runtime'ı ekle
                    window.chrome = {
                        runtime: {}
                    };
                    
                    // Permissions API
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );
                """)

                self.page = await context.new_page()
            
            self.context = context  # Context'i sakla (kapatmak için)

            self.logger.info("🚀 Playwright browser başlatıldı")

            # Ana sayfayı ziyaret et (cookie'ler için)
            self.logger.info("🔐 Ana sayfa yükleniyor (Cloudflare bypass)...")
            
            # 🔥 Cloudflare bypass: Önce domcontentloaded, sonra networkidle
            try:
                await self.page.goto(self.base_url, wait_until='domcontentloaded', timeout=60000)
                await asyncio.sleep(3)  # İlk yükleme sonrası bekle
                await self.page.wait_for_load_state('networkidle', timeout=30000)
            except Exception as e:
                self.logger.warning(f"⚠️ İlk yükleme timeout: {e}, devam ediliyor...")

            # Cloudflare challenge varsa bekle - DAHA UZUN BEKLE
            self.logger.info("⏳ Cloudflare challenge bekleniyor (20 saniye)...")
            await asyncio.sleep(20)  # 15'ten 20'ye çıkarıldı
            
            # İnsan gibi davran: Scroll yap (daha yavaş ve gerçekçi)
            self.logger.info("🖱️ İnsan gibi davranış simülasyonu...")
            await self.page.evaluate('window.scrollTo(0, 300)')
            await asyncio.sleep(2)  # 1'den 2'ye çıkarıldı
            await self.page.evaluate('window.scrollTo(0, 800)')
            await asyncio.sleep(2)
            await self.page.evaluate('window.scrollTo(0, 1200)')
            await asyncio.sleep(2)
            await self.page.evaluate('window.scrollTo(0, 0)')
            await asyncio.sleep(3)  # 2'den 3'e çıkarıldı
            
            # Mouse hareketi simülasyonu (Cloudflare için önemli)
            await self.page.mouse.move(100, 100)
            await asyncio.sleep(0.5)
            await self.page.mouse.move(500, 300)
            await asyncio.sleep(0.5)

            self.logger.info("✅ Ana sayfa yüklendi")

            try:
                # Kategorileri belirle
                if category_names:
                    categories = {k: v for k, v in self.categories.items() if k in category_names}
                else:
                    categories = self.categories

                # Her kategoriyi scrape et
                for category_name, category_info in categories.items():
                    self.logger.info(f"📂 Ana Kategori: {category_name}")

                    try:
                        # Alt kategorileri kontrol et
                        has_subcats = category_info.get('has_subcategories', False)
                        
                        if self.scrape_subcategories and has_subcats:
                            # Alt kategorileri scrape et
                            subcats = get_subcategories_for_store('CarrefourSA', category_info['key'])
                            
                            if subcats:
                                self.logger.info(f"  ↳ {len(subcats)} alt kategori bulundu")
                                
                                for subcat in subcats:
                                    self.logger.info(f"  📁 Alt Kategori: {subcat['name']}")
                                    
                                    try:
                                        products = await self.scrape_category_async(
                                            subcat['api_id'],
                                            subcat['slug'],
                                            subcat['standard_name']
                                        )
                                        all_products.extend(products)
                                        self.logger.info(f"  ✅ {subcat['name']}: {len(products)} ürün")
                                        await asyncio.sleep(2)
                                        
                                    except Exception as e:
                                        self.logger.error(f"  ❌ {subcat['name']}: {e}")
                                        continue
                            else:
                                # Alt kategori yok, ana kategoriyi scrape et
                                products = await self.scrape_category_async(
                                    category_info['id'],
                                    category_info['slug'],
                                    category_name
                                )
                                all_products.extend(products)
                                self.logger.info(f"✅ {category_name}: {len(products)} ürün")
                        else:
                            # Alt kategori desteği kapalı veya yok
                            products = await self.scrape_category_async(
                                category_info['id'],
                                category_info['slug'],
                                category_name
                            )
                            all_products.extend(products)
                            self.logger.info(f"✅ {category_name}: {len(products)} ürün")

                        await asyncio.sleep(2)

                    except Exception as e:
                        self.logger.error(f"❌ {category_name}: {e}")
                        continue

            finally:
                # Persistent context veya normal browser'ı kapat
                if self.browser:
                    await self.browser.close()
                    self.logger.info("🔚 Browser kapatıldı")
                elif hasattr(self, 'context'):
                    await self.context.close()
                    self.logger.info("🔚 Persistent context kapatıldı")

        # Final kontrol
        self.logger.info(f"📊 Toplam {len(all_products)} ürün scrape edildi")
        if all_products:
            self.logger.info(f"  → İlk ürün örneği: {all_products[0].name[:50]}...")
            self.logger.info(f"  → Ürün tipi: {type(all_products[0]).__name__}")
        
        return all_products

    async def scrape_category_async(
            self,
            category_id: str,
            category_slug: str,
            category_name: str
    ) -> List[Product]:
        """Bir kategorideki ürünleri çeker - TÜM ALT KATEGORİLER DAHİL"""
        products = []

        try:
            # Kategori sayfasına git
            category_url = f"{self.base_url}/{category_slug}/c/{category_id}"

            self.logger.info(f"  📄 Kategori sayfası: {category_url}")

            # 🔥 Cloudflare bypass: Yavaş ve insan gibi gezin
            await asyncio.sleep(5)  # 3'ten 5'e çıkarıldı - Rate limiting - Cloudflare için önemli
            
            try:
                await self.page.goto(category_url, wait_until='domcontentloaded', timeout=60000)
                await asyncio.sleep(3)  # İlk yükleme sonrası bekle
                await self.page.wait_for_load_state('networkidle', timeout=30000)
            except Exception as e:
                self.logger.warning(f"  ⚠️ Sayfa yükleme timeout: {e}, devam ediliyor...")

            # Sayfanın yüklenmesini bekle - DAHA UZUN
            self.logger.info("  ⏳ Sayfa yükleniyor ve Cloudflare challenge bekleniyor...")
            await asyncio.sleep(12)  # 8'den 12'ye çıkarıldı - Cloudflare için kritik
            
            # İnsan gibi scroll yap
            await self.page.evaluate('window.scrollTo(0, 300)')
            await asyncio.sleep(1)
            await self.page.evaluate('window.scrollTo(0, 800)')
            await asyncio.sleep(1)
            await self.page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            await asyncio.sleep(2)

            # HTML'i al
            html = await self.page.content()
            
            # 🚨 Cloudflare block kontrolü - daha kapsamlı
            is_blocked = (
                'Cloudflare' in html and ('blocked' in html.lower() or 'challenge' in html.lower() or 'checking your browser' in html.lower()) or
                'cf-browser-verification' in html.lower() or
                'cf-error-details' in html.lower()
            )
            
            if is_blocked:
                self.logger.error("  ❌ CLOUDFLARE BLOCKED! Sayfa bot olarak algılandı.")
                self.logger.error("  💡 Çözüm: headless=False ile çalıştır veya daha uzun bekle")
                # HTML'i kaydet
                debug_file = Path(__file__).parent / f"cloudflare_blocked_{category_slug}.html"
                debug_file.write_text(html, encoding='utf-8')
                self.logger.error(f"  💾 Blocked HTML saved to: {debug_file}")
                
                # Eğer headless moddaysa, tekrar dene (headless=False ile)
                if self.headless:
                    self.logger.warning("  ⚠️ Headless modda block edildi. Lütfen headless=False ile çalıştırın.")
                
                return []

            # 🐛 DEBUG: HTML'i kaydet (ilk 5000 karakter)
            self.logger.debug(f"  🐛 HTML preview (first 5000 chars):\n{html[:5000]}")
            
            # HTML'i dosyaya kaydet (debugging için)
            debug_file = Path(__file__).parent / f"debug_html_{category_slug}.html"
            debug_file.write_text(html, encoding='utf-8')
            self.logger.debug(f"  💾 HTML saved to: {debug_file}")

            # 🔥 YENİ: "Tüm Ürünleri Gör" linklerini bul
            subcategory_links = self.extract_subcategory_links(html)
            
            self.logger.info(f"  🔍 Checking for subcategory links...")
            self.logger.info(f"  🔍 Found {len(subcategory_links)} subcategory links")

            if subcategory_links:
                self.logger.info(f"  🔗 {len(subcategory_links)} alt kategori linki bulundu")
                
                # Her alt kategori için tüm ürünleri çek
                for link_info in subcategory_links:
                    try:
                        subcategory_products = await self.scrape_subcategory_with_pagination(
                            link_info['url'],
                            link_info['name'],
                            category_name
                        )
                        products.extend(subcategory_products)
                        self.logger.info(f"    ✅ {link_info['name']}: {len(subcategory_products)} ürün")
                        await asyncio.sleep(2)  # Rate limiting
                    except Exception as e:
                        self.logger.error(f"    ❌ {link_info['name']}: {e}")
                        continue
            else:
                # Alt kategori linki yoksa, mevcut sayfayı parse et
                self.logger.info(f"  ℹ️ Alt kategori linki bulunamadı, mevcut sayfa parse ediliyor...")
                category_products = self.parse_html(html, category_name)
                products.extend(category_products)

            if not products:
                self.logger.info(f"  ℹ️ Ürün bulunamadı")
                return []

            self.logger.info(f"  📦 TOPLAM {len(products)} ürün bulundu")

        except Exception as e:
            self.logger.error(f"  ❌ Scrape hatası: {e}")

        return products

    def extract_subcategory_links(self, html: str) -> List[Dict[str, str]]:
        """HTML'den 'Tüm Ürünleri Gör' linklerini çıkar"""
        links = []

        try:
            soup = BeautifulSoup(html, 'html.parser')

            # 🐛 DEBUG: Check if the page has the expected structure
            product_sliders = soup.select('div.product-slider-nav')
            self.logger.debug(f"    🔍 Found {len(product_sliders)} product-slider-nav divs")
            
            # "Tüm Ürünleri Gör" linklerini bul
            # <span class="cat-title"><a href="/krema-ve-kaymak/c/1385">Tüm Ürünleri Gör</a></span>
            cat_title_spans = soup.select('span.cat-title a')
            self.logger.debug(f"    🔍 Found {len(cat_title_spans)} cat-title links")

            for link in cat_title_spans:
                href = link.get('href')
                if href and '/c/' in href:
                    # Link URL'i oluştur
                    full_url = self.base_url + href if not href.startswith('http') else href
                    
                    # Kategori adını bul (parent element'in headline'ından)
                    parent_nav = link.find_parent('div', class_='product-slider-nav')
                    category_name = "Bilinmeyen"
                    
                    if parent_nav:
                        headline = parent_nav.select_one('span.headline')
                        if headline:
                            category_name = headline.get_text(strip=True)
                    
                    links.append({
                        'url': full_url,
                        'name': category_name,
                        'href': href
                    })

        except Exception as e:
            self.logger.error(f"Link extraction hatası: {e}")

        return links

    async def scrape_subcategory_with_pagination(
            self,
            subcategory_url: str,
            subcategory_name: str,
            parent_category: str
    ) -> List[Product]:
        """Alt kategoriyi pagination ile scrape et"""
        all_products = []
        page_num = 0
        max_pages = 50  # Güvenlik için max sayfa limiti

        try:
            while page_num < max_pages:
                try:
                    # Sayfa URL'i oluştur (pagination parametresi)
                    if page_num == 0:
                        page_url = subcategory_url
                    else:
                        # CarrefourSA pagination: ?q=:relevance:&page={page_num}
                        separator = '&' if '?' in subcategory_url else '?'
                        page_url = f"{subcategory_url}{separator}page={page_num}"

                    self.logger.info(f"      📄 Sayfa {page_num}: {page_url}")

                    # Cloudflare bypass: Rate limiting
                    await asyncio.sleep(2)
                    
                    await self.page.goto(page_url, wait_until='networkidle', timeout=60000)
                    await asyncio.sleep(3)

                    # İnsan gibi scroll yap
                    await self.page.evaluate('window.scrollTo(0, 500)')
                    await asyncio.sleep(0.5)
                    await self.page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                    await asyncio.sleep(2)

                    # HTML'i al ve parse et
                    html = await self.page.content()
                    page_products = self.parse_html(html, subcategory_name)

                    if not page_products:
                        # Ürün bulunamadı, pagination sonu
                        self.logger.info(f"      ℹ️ Sayfa {page_num}: Ürün bulunamadı (pagination sonu)")
                        break

                    all_products.extend(page_products)
                    self.logger.info(f"      ✅ Sayfa {page_num}: {len(page_products)} ürün")

                    # Bir sonraki sayfa var mı kontrol et
                    has_next_page = await self.check_next_page_exists(html)
                    
                    if not has_next_page:
                        self.logger.info(f"      ℹ️ Pagination sonu (next page yok)")
                        break

                    page_num += 1
                    await asyncio.sleep(1)  # Rate limiting

                except Exception as e:
                    self.logger.error(f"      ❌ Sayfa {page_num} hatası: {e}")
                    break

        except Exception as e:
            self.logger.error(f"    ❌ Subcategory pagination hatası: {e}")

        return all_products

    def check_next_page_exists(self, html: str) -> bool:
        """HTML'de sonraki sayfa olup olmadığını kontrol et"""
        try:
            soup = BeautifulSoup(html, 'html.parser')

            # 1. Ürün kartları var mı? (yoksa pagination sonu)
            product_cards = soup.select('li.product-listing-item')
            if not product_cards:
                # Eski selector'ı da dene
                product_cards = soup.select('.item.product-wrapper')
            if not product_cards:
                return False

            # 2. Pagination bilgisi - ul.product-listing içindeki data attribute'larından
            product_listing = soup.select_one('ul.product-listing')
            if product_listing:
                max_page = product_listing.get('data-maxpagenumber')
                current_page = product_listing.get('data-currentpagenumber')
                
                if max_page and current_page:
                    try:
                        max_page_num = int(max_page)
                        current_page_num = int(current_page)
                        # Eğer mevcut sayfa maksimum sayfadan küçükse, devam var
                        if current_page_num < max_page_num:
                            return True
                        else:
                            return False
                    except:
                        pass

            # 3. "Next" butonu var mı?
            next_button = soup.select_one('.pagination .next, .pagination a[rel="next"], a.next-page')
            if next_button:
                return True

            # 4. Ürün sayısı kontrolü - eğer sayfa doluysa (örn: 20+ ürün) devam olabilir
            # Ama bu kesin değil, bu yüzden default False döndür

            return False  # Default: devam yok

        except Exception as e:
            self.logger.error(f"Next page check hatası: {e}")
            return False

    def parse_html(self, html: str, category_name: str) -> List[Product]:
        """HTML'den ürünleri parse et"""
        products = []

        try:
            soup = BeautifulSoup(html, 'html.parser')

            # 🔥 YENİ: Doğru selector - HTML'de <li class="product-listing-item"> kullanılıyor
            product_cards_v1 = soup.select('li.product-listing-item')
            product_cards_v2 = soup.select('.item.product-wrapper')
            product_cards_v3 = soup.select('div.item.product-card')
            
            self.logger.debug(f"    🔍 Product cards found:")
            self.logger.debug(f"      - li.product-listing-item: {len(product_cards_v1)}")
            self.logger.debug(f"      - .item.product-wrapper: {len(product_cards_v2)}")
            self.logger.debug(f"      - div.item.product-card: {len(product_cards_v3)}")

            # Ürün kartlarını bul - ÖNCE li.product-listing-item dene
            product_cards = soup.select('li.product-listing-item')
            
            # Eğer bulunamazsa eski selector'ı dene
            if not product_cards:
                product_cards = soup.select('.item.product-wrapper')
                self.logger.debug(f"    ⚠️ li.product-listing-item bulunamadı, .item.product-wrapper deneniyor: {len(product_cards)}")

            if not product_cards:
                self.logger.warning(f"    ⚠️ Hiçbir selector ile ürün bulunamadı!")
                # Debug için HTML'in bir kısmını logla
                if len(html) > 1000:
                    self.logger.debug(f"    📄 HTML preview (first 1000 chars): {html[:1000]}")
                return []

            for card in product_cards:
                try:
                    product = self.parse_product_card(card, category_name)
                    if product and product.validate():
                        products.append(product)
                except Exception as e:
                    self.logger.debug(f"  ⚠️ Parse hatası: {e}")
                    continue

        except Exception as e:
            self.logger.error(f"HTML parse hatası: {e}")

        return products

    def parse_product_card(self, card, category_name: str) -> Optional[Product]:
        """Ürün kartından bilgileri çıkar"""
        try:
            # Ürün adı - li.product-listing-item içinde h3.item-name
            name_elem = card.select_one('h3.item-name')
            if not name_elem:
                self.logger.debug(f"  ⚠️ Ürün adı bulunamadı")
                return None
            name = name_elem.get_text(strip=True)

            # SKU - h3.item-name içindeki content attribute'undan
            sku = None
            if name_elem.get('content'):
                sku = name_elem.get('content')
            # Alternatif: dataLayerItemData'dan da alabiliriz
            if not sku:
                data_layer = card.select_one('.dataLayerItemData')
                if data_layer:
                    sku = data_layer.get('data-item_id')

            # Fiyat - .item-price.js-variant-discounted-price içindeki content attribute'undan
            price_elem = card.select_one('.item-price.js-variant-discounted-price')
            if not price_elem:
                price_elem = card.select_one('.item-price')
                if not price_elem:
                    # Son çare: price-cont içinde ara
                    price_cont = card.select_one('.price-cont')
                    if price_cont:
                        price_elem = price_cont.select_one('.item-price')

            if not price_elem:
                self.logger.debug(f"  ⚠️ Fiyat bulunamadı: {name}")
                return None

            # Fiyatı content attribute'undan al (79.9 gibi)
            price_content = price_elem.get('content')
            if price_content:
                try:
                    price = Decimal(str(price_content))
                except:
                    # Eğer content yoksa text'ten parse et
                    price_text = price_elem.get_text(strip=True)
                    price = self.parse_price(price_text)
            else:
                # Content yoksa text'ten parse et (79,90 TL gibi)
                price_text = price_elem.get_text(strip=True)
                price = self.parse_price(price_text)

            # Marka ve kategori bilgisi (data layer'dan)
            brand = None
            subcategory = category_name  # Default olarak verilen kategori
            
            data_layer = card.select_one('.dataLayerItemData')
            if data_layer:
                brand = data_layer.get('data-item_brand')
                
                # Alt kategori bilgilerini oku (data-item_category2 ve category3'ten)
                # Öncelik: category3 > category2 > category
                cat3 = data_layer.get('data-item_category3', '').strip()
                cat2 = data_layer.get('data-item_category2', '').strip()
                
                # En spesifik kategoriyi kullan
                if cat3 and cat3 != '':
                    subcategory = cat3
                elif cat2 and cat2 != '':
                    subcategory = cat2
                
                # 🔥 BEST PRACTICE: Normalizasyonu matcher'da yapacağız
                # Scraper sadece ham kategoriyi atar (raw_category)

            # Görsel
            image_url = None
            img_elem = card.select_one('img[itemprop="image"]')
            if img_elem:
                image_url = img_elem.get('src') or img_elem.get('data-src')
                if image_url and not image_url.startswith('http'):
                    if image_url.startswith('//'):
                        image_url = 'https:' + image_url
                    else:
                        image_url = self.base_url + image_url

            # URL
            product_url = None
            link_elem = card.select_one('a.product-return')
            if link_elem:
                product_url = link_elem.get('href')
                if product_url and not product_url.startswith('http'):
                    product_url = self.base_url + product_url

            # Birim ve miktar - dataLayerItemData'dan veya ürün adından
            quantity = 1.0
            unit = "adet"
            
            # Önce dataLayerItemData'dan al
            data_layer = card.select_one('.dataLayerItemData')
            if data_layer:
                # Quantity
                qty_str = data_layer.get('data-quantity')
                if qty_str:
                    try:
                        quantity = float(qty_str)
                    except:
                        pass
                
                # Unit - displayUnit input'undan veya dataLayerItemData'dan
                display_unit_input = card.select_one('input[name="displayUnit"]')
                if display_unit_input:
                    unit = display_unit_input.get('value', 'adet')
                else:
                    # Ürün adından parse et
                    quantity, unit = self.parse_unit_from_name(name)
            else:
                # Data layer yoksa ürün adından parse et
                quantity, unit = self.parse_unit_from_name(name)

            # Stok durumu - itemprop="availability" veya data-in_stock'dan
            in_stock = True
            availability_elem = card.select_one('span[itemprop="availability"]')
            if availability_elem:
                availability = availability_elem.get('content', '').strip()
                in_stock = availability == 'InStock'
            elif data_layer:
                in_stock_str = data_layer.get('data-in_stock', 'true')
                in_stock = in_stock_str.lower() == 'true'

            return Product(
                name=name,
                brand=brand,
                category=subcategory,  # Alt kategoriyi kullan
                price=price,
                unit=unit,
                quantity=quantity,
                in_stock=in_stock,
                image_url=image_url,
                product_url=product_url,
                store=self.store_name,
                sku=sku
            )

        except Exception as e:
            self.logger.debug(f"Parse error: {e}")
            return None

    def parse_price(self, price_str: str) -> Decimal:
        """Fiyat parse"""
        price_str = (
            price_str.replace('TL', '').replace('₺', '')
            .replace('.', '').replace(',', '.').strip()
        )
        price_str = re.sub(r'[^\d.]', '', price_str)
        return Decimal(price_str)

    def parse_unit_from_name(self, name: str) -> tuple[float, str]:
        """Birim parse"""
        patterns = [r'(\d+(?:[,.]\d+)?)\s*(kg|g|gr|l|lt|ml|cl|adet)']

        for pattern in patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                quantity = float(match.group(1).replace(',', '.'))
                unit = match.group(2).lower()
                unit_mapping = {
                    'kg': 'kg', 'g': 'g', 'gr': 'g',
                    'l': 'l', 'lt': 'l', 'ml': 'ml', 'cl': 'cl',
                    'adet': 'adet'
                }
                return (quantity, unit_mapping.get(unit, unit))

        return (1.0, "adet")

    def save_to_json(self, products: List[Product], filename: str):
        """JSON'a kaydet"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump([p.to_dict() for p in products], f, ensure_ascii=False, indent=2)
        self.logger.info(f"💾 {len(products)} ürün kaydedildi: {filename}")


async def main():
    """Ana fonksiyon"""
    logging.basicConfig(
        level=logging.DEBUG,  # Changed to DEBUG for detailed logging
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    print("""
╔═══════════════════════════════════════════════╗
║   CARREFOURSA PLAYWRIGHT SCRAPER 🎭         ║
║   (Tam Otomatik - Cloudflare Bypass)        ║
║   (ALT KATEGORİ DESTEKLİ)                   ║
╚═══════════════════════════════════════════════╝
    """)

    # 🔥 CLOUDFLARE BYPASS: headless=False ile çalıştır (görünür browser)
    # Eğer Cloudflare blok ediyorsa, headless=False yaparak test edin
    USE_HEADLESS = False  # False = Browser görünür (Cloudflare bypass için)
    
    scraper = CarrefourSAPlaywrightScraper(headless=USE_HEADLESS, scrape_subcategories=True)
    
    if not USE_HEADLESS:
        print("⚠️  Browser GÖRÜNÜR modda çalışıyor (Cloudflare bypass için)")
        print("⚠️  Browser penceresini KAPATMAYIN, otomatik kapanacak")

    # Test: Birkaç kategori (Süt Ürünleri alt kategorilere ayrılacak)
    categories = [
        'Süt Ürünleri',
        'Kahvaltılık',
    ]

    products = await scraper.scrape_all_categories(categories)

    print(f"\n{'='*60}")
    print(f"✅ TOPLAM: {len(products)} ürün")
    print(f"{'='*60}\n")

    if products:
        print("📦 İlk 5 ürün:\n")
        for i, p in enumerate(products[:5], 1):
            print(f"{i}. {p.name}")
            print(f"   💰 {p.price} TL")
            print(f"   🏷️  {p.brand}")
            if p.sku:
                print(f"   🔢 SKU: {p.sku}")
            print()

        scraper.save_to_json(products, 'carrefoursa_api_output.json')
    else:
        print("❌ Ürün çekilemedi")


if __name__ == "__main__":
    asyncio.run(main())