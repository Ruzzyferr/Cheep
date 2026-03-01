"""
🚀 Scalable LLM Product Matcher - 3 Aşamalı Pipeline
Market-Level Normalization → Cross-Market Matching → Category Consolidation

Avantajlar:
- Scalable: 3-4 market için 50K+ ürün handle edebilir
- Cost-Efficient: LLM'i sadece gerektiğinde kullanır (embedding çok ucuz)
- Accurate: Embedding + LLM combo yüksek doğruluk sağlar
- Fast: Parallel processing + batch'ler
- Resumable: Her aşama bağımsız, hata durumunda devam edebilir

Maliyet Tahmini (16K ürün):
- Stage 1: 16K ürün ÷ 300 = ~53 LLM call × $0.15 = ~$8
- Stage 2: 16K embedding = ~$0.02 (çok ucuz!)
- Stage 3: Belirsiz gruplar için ~100 LLM call = ~$0.15
- TOPLAM: ~$8.17 (tek seferlik)
"""

import json
import os
import sys
import time
import logging
import asyncio
import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import requests
import numpy as np
from dotenv import load_dotenv

# Kategori normalizasyonu kaldırıldı - import script'te yapılacak

# .env dosyasını yükle
# Önce proje root'unda ara (Cheep-Scraper/.env)
script_dir = Path(__file__).resolve().parent
env_path = script_dir / '.env'

if env_path.exists():
    load_dotenv(env_path, override=True)
    print(f"✅ .env dosyası yüklendi: {env_path}")
else:
    # Eğer yoksa, bir üst dizinde dene (countries/turkey/ klasöründen çalıştırılıyorsa)
    parent_env = script_dir.parent / '.env'
    if parent_env.exists():
        load_dotenv(parent_env, override=True)
        print(f"✅ .env dosyası yüklendi: {parent_env}")
    else:
        # Son çare: mevcut dizinde ve parent dizinlerde ara
        load_dotenv(override=True)

# Logging setup (dotenv'den önce basit logger)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('scalable-matcher.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# ============================================
# STANDARD CATEGORIES (Backend'den uyumlu)
# ============================================

STANDARD_CATEGORIES = [
    {
        'name': 'Süt Ürünleri',
        'slug': 'sut-urunleri',
        'subcategories': [
            {'name': 'Süt', 'slug': 'sut'},
            {'name': 'Peynir', 'slug': 'peynir'},
            {'name': 'Yoğurt', 'slug': 'yogurt'},
            {'name': 'Krema ve Kaymak', 'slug': 'krema-kaymak'},
            {'name': 'Tereyağı', 'slug': 'tereyagi'},
            {'name': 'Margarin', 'slug': 'margarin'},
            {'name': 'Ayran', 'slug': 'ayran'},
            {'name': 'Kefir', 'slug': 'kefir'},
            {'name': 'Puding', 'slug': 'puding'},
            {'name': 'Dondurulmuş Süt Ürünleri', 'slug': 'dondurulmus-sut-urunleri'},
        ],
    },
    {
        'name': 'Meyve & Sebze',
        'slug': 'meyve-sebze',
        'subcategories': [
            {'name': 'Meyve', 'slug': 'meyve'},
            {'name': 'Sebze', 'slug': 'sebze'},
            {'name': 'Salata Malzemeleri', 'slug': 'salata-malzemeleri'},
            {'name': 'Kuru Meyve', 'slug': 'kuru-meyve'},
            {'name': 'Kuru Sebze', 'slug': 'kuru-sebze'},
        ],
    },
    {
        'name': 'Et, Tavuk, Balık',
        'slug': 'et-tavuk-balik',
        'subcategories': [
            {'name': 'Kırmızı Et', 'slug': 'kirmizi-et'},
            {'name': 'Tavuk', 'slug': 'tavuk'},
            {'name': 'Hindi', 'slug': 'hindi'},
            {'name': 'Balık', 'slug': 'balik'},
            {'name': 'Deniz Ürünleri', 'slug': 'deniz-urunleri'},
            {'name': 'Şarküteri', 'slug': 'sarkuteri'},
            {'name': 'Salam', 'slug': 'salam'},
            {'name': 'Sucuk', 'slug': 'sucuk'},
            {'name': 'Dondurulmuş Et Ürünleri', 'slug': 'dondurulmus-et-urunleri'},
        ],
    },
    {
        'name': 'Temel Gıda',
        'slug': 'temel-gida',
        'subcategories': [
            {'name': 'Un', 'slug': 'un'},
            {'name': 'Şeker', 'slug': 'seker'},
            {'name': 'Pirinç', 'slug': 'pirinç'},
            {'name': 'Makarna', 'slug': 'makarna'},
            {'name': 'Bulgur', 'slug': 'bulgur'},
            {'name': 'Bakliyat', 'slug': 'bakliyat'},
            {'name': 'Yağ', 'slug': 'yag'},
            {'name': 'Sirke', 'slug': 'sirke'},
            {'name': 'Baharat', 'slug': 'baharat'},
            {'name': 'Salça', 'slug': 'salca'},
            {'name': 'Hazır Çorba', 'slug': 'hazir-corba'},
        ],
    },
    {
        'name': 'İçecek',
        'slug': 'icecek',
        'subcategories': [
            {'name': 'Su', 'slug': 'su'},
            {'name': 'Meyve Suyu', 'slug': 'meyve-suyu'},
            {'name': 'Gazlı İçecek', 'slug': 'gazli-icecek'},
            {'name': 'Çay', 'slug': 'cay'},
            {'name': 'Kahve', 'slug': 'kahve'},
            {'name': 'Enerji İçeceği', 'slug': 'enerji-icecegi'},
            {'name': 'Bitki Çayı', 'slug': 'bitki-cayi'},
            {'name': 'Alkolsüz Bira', 'slug': 'alkolsuz-bira'},
        ],
    },
    {
        'name': 'Fırın & Pastane',
        'slug': 'firin-pastane',
        'subcategories': [
            {'name': 'Ekmek', 'slug': 'ekmek'},
            {'name': 'Simit', 'slug': 'simit'},
            {'name': 'Poğaça', 'slug': 'pogaca'},
            {'name': 'Börek', 'slug': 'borek'},
            {'name': 'Pasta', 'slug': 'pasta'},
            {'name': 'Kek', 'slug': 'kek'},
            {'name': 'Bisküvi', 'slug': 'bisküvi'},
            {'name': 'Çörek', 'slug': 'corek'},
        ],
    },
    {
        'name': 'Kahvaltılık',
        'slug': 'kahvaltilik',
        'subcategories': [
            {'name': 'Reçel', 'slug': 'recel'},
            {'name': 'Bal', 'slug': 'bal'},
            {'name': 'Zeytin', 'slug': 'zeytin'},
            {'name': 'Tahin & Pekmez', 'slug': 'tahin-pekmez'},
            {'name': 'Helva', 'slug': 'helva'},
            {'name': 'Yumurta', 'slug': 'yumurta'},
            {'name': 'Kahvaltılık Ezme', 'slug': 'kahvaltilik-ezme'},
            {'name': 'Kahvaltılık Sos', 'slug': 'kahvaltilik-sos'},
            {'name': 'Kahvaltılık Gevrek', 'slug': 'kahvaltilik-gevrek'},
            {'name': 'Müsli & Granola', 'slug': 'musli-granola'},
        ],
    },
    {
        'name': 'Atıştırmalık',
        'slug': 'atistirmalik',
        'subcategories': [
            {'name': 'Çikolata', 'slug': 'cikolata'},
            {'name': 'Bisküvi', 'slug': 'bisküvi-atistirmalik'},
            {'name': 'Gofret', 'slug': 'gofret'},
            {'name': 'Kuruyemiş', 'slug': 'kuruyemiş'},
            {'name': 'Cips', 'slug': 'cips'},
            {'name': 'Kraker', 'slug': 'kraker'},
            {'name': 'Şekerleme', 'slug': 'sekerleme'},
            {'name': 'Jelibon', 'slug': 'jelibon'},
        ],
    },
    {
        'name': 'Dondurma',
        'slug': 'dondurma',
        'subcategories': [
            {'name': 'Dondurma', 'slug': 'dondurma-alt'},
            {'name': 'Dondurma Çubuk', 'slug': 'dondurma-cubuk'},
            {'name': 'Donuk Tatlı', 'slug': 'donuk-tatli'},
        ],
    },
    {
        'name': 'Hazır Yemek & Donuk',
        'slug': 'hazir-yemek-donuk',
        'subcategories': [
            {'name': 'Hazır Yemek', 'slug': 'hazir-yemek'},
            {'name': 'Dondurulmuş Gıda', 'slug': 'dondurulmus-gida'},
            {'name': 'Pizza', 'slug': 'pizza'},
            {'name': 'Hamburger & Köfte', 'slug': 'hamburger-kofte'},
            {'name': 'Dondurulmuş Sebze', 'slug': 'dondurulmus-sebze'},
            {'name': 'Dondurulmuş Meyve', 'slug': 'dondurulmus-meyve'},
        ],
    },
    {
        'name': 'Temizlik',
        'slug': 'temizlik',
        'subcategories': [
            {'name': 'Bulaşık Deterjanı', 'slug': 'bulasik-deterjani'},
            {'name': 'Çamaşır Deterjanı', 'slug': 'camasir-deterjani'},
            {'name': 'Yüzey Temizleyici', 'slug': 'yuzey-temizleyici'},
            {'name': 'Tuvalet Temizleyici', 'slug': 'tuvalet-temizleyici'},
            {'name': 'Çöp Torbası', 'slug': 'cop-torbasi'},
            {'name': 'Eldiven', 'slug': 'eldiven-temizlik'},
            {'name': 'Sünger & Bez', 'slug': 'sünger-bez'},
        ],
    },
    {
        'name': 'Kişisel Bakım',
        'slug': 'kisisel-bakim',
        'subcategories': [
            {'name': 'Şampuan', 'slug': 'sampuan'},
            {'name': 'Sabun', 'slug': 'sabun'},
            {'name': 'Diş Macunu', 'slug': 'dis-macunu'},
            {'name': 'Deodorant', 'slug': 'deodorant'},
            {'name': 'Tuvalet Kağıdı', 'slug': 'tuvalet-kagidi'},
            {'name': 'Kağıt Havlu', 'slug': 'kagit-havlu'},
            {'name': 'Mendil', 'slug': 'mendil'},
            {'name': 'Peçete', 'slug': 'pecete'},
        ],
    },
    {
        'name': 'Bebek',
        'slug': 'bebek',
        'subcategories': [
            {'name': 'Bebek Bezi', 'slug': 'bebek-bezi'},
            {'name': 'Bebek Maması', 'slug': 'bebek-mamasi'},
            {'name': 'Bebek Bakım', 'slug': 'bebek-bakim'},
            {'name': 'Bebek Bezlenme', 'slug': 'bebek-bezlenme'},
        ],
    },
    {
        'name': 'Pet Shop',
        'slug': 'pet-shop',
        'subcategories': [
            {'name': 'Kedi Maması', 'slug': 'kedi-mamasi'},
            {'name': 'Köpek Maması', 'slug': 'kopek-mamasi'},
            {'name': 'Kuş Maması', 'slug': 'kus-mamasi'},
            {'name': 'Pet Aksesuar', 'slug': 'pet-aksesuar'},
        ],
    },
    {
        'name': 'Sağlıklı Yaşam',
        'slug': 'saglikli-yasam',
        'subcategories': [
            {'name': 'Vitamin & Takviye', 'slug': 'vitamin-takviye'},
            {'name': 'Organik Ürünler', 'slug': 'organik-urunler'},
            {'name': 'Glutensiz', 'slug': 'glutensiz'},
            {'name': 'Şekersiz', 'slug': 'sekersiz'},
        ],
    },
    {
        'name': 'Ev & Yaşam',
        'slug': 'ev-yasam',
        'subcategories': [
            {'name': 'Pil', 'slug': 'pil'},
            {'name': 'Ampul', 'slug': 'ampul'},
            {'name': 'Batteri', 'slug': 'batteri'},
        ],
    },
]

# ============================================
# TYPE DEFINITIONS
# ============================================

@dataclass
class RawProductData:
    """Scraper'dan gelen ham ürün verisi"""
    name: str
    brand: Optional[str] = None
    store_id: int = 0
    store_name: str = ""
    store_sku: str = ""
    price: float = 0.0
    unit: Optional[str] = None
    raw_category: Optional[str] = None
    image_url: Optional[str] = None


@dataclass
class NormalizedProduct:
    """Aşama 1: Normalize edilmiş ürün"""
    original_name: str
    normalized_name: str
    normalized_brand: Optional[str] = None
    size: Optional[str] = None
    category: str = ""
    subcategory: Optional[str] = None
    category_confidence: float = 0.0
    needs_new_subcategory: bool = False
    new_subcategory_suggestion: Optional[str] = None
    store_id: int = 0
    store_name: str = ""
    store_sku: str = ""
    price: float = 0.0
    unit: Optional[str] = None
    image_url: Optional[str] = None


@dataclass
class ProductWithEmbedding(NormalizedProduct):
    """Aşama 2: Embedding ile ürün"""
    embedding: Optional[List[float]] = None


@dataclass
class ProductCluster:
    """Aşama 2: Benzer ürünler grubu"""
    items: List[ProductWithEmbedding] = field(default_factory=list)
    max_similarity: float = 0.0


@dataclass
class MatchedProduct:
    """Aşama 2-3: Eşleştirilmiş ürün"""
    muadil_grup_id: str = ""
    normalized_name: str = ""
    normalized_brand: Optional[str] = None
    size: Optional[str] = None
    category: str = ""
    subcategory: Optional[str] = None
    category_confidence: float = 0.0
    needs_new_subcategory: bool = False
    new_subcategory_suggestion: Optional[str] = None
    prices: List[Dict] = field(default_factory=list)


@dataclass
class ProcessedProduct:
    """Final: İşlenmiş ürün (backend'e gönderilecek format)"""
    normalized_name: str
    normalized_brand: Optional[str] = None
    category: str = ""
    subcategory: Optional[str] = None
    category_id: Optional[int] = None
    muadil_grup_id: str = ""
    prices: List[Dict] = field(default_factory=list)


# ============================================
# SCALABLE LLM PRODUCT MATCHER
# ============================================

class ScalableLLMProductMatcher:
    """
    🚀 3 Aşamalı Scalable Product Matching Pipeline
    """
    
    BATCH_SIZE = 300  # LLM batch boyutu (rate limit için azaltıldı: 300 -> 150)
    EMBEDDING_BATCH = 1000  # Embedding batch
    SIMILARITY_THRESHOLD = 0.70  # Benzerlik eşiği
    HIGH_SIMILARITY_THRESHOLD = 0.90  # Yüksek benzerlik eşiği
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: OpenAI API key (env'den otomatik alınır)
        """
        # Önce .env dosyasından oku (load_dotenv zaten yapıldı)
        openai_key = api_key or os.getenv('OPENAI_API_KEY')
        openrouter_key = os.getenv('OPENROUTER_API_KEY')
        use_openrouter_env = os.getenv('USE_OPENROUTER', '').lower().strip()
        
        # Debug: Hangi değişkenler set edilmiş?
        logger.info(f"[Matcher Config] OPENAI_API_KEY: {'SET ✅' if openai_key else 'NOT SET ❌'}")
        logger.info(f"[Matcher Config] OPENROUTER_API_KEY: {'SET ✅' if openrouter_key else 'NOT SET ❌'}")
        logger.info(f"[Matcher Config] USE_OPENROUTER: '{use_openrouter_env}'")
        
        # OpenRouter mu yoksa OpenAI mi?
        # ÖNEMLİ: OpenAI key varsa ve açıkça OpenRouter istenmediyse OpenAI kullan
        self.use_openrouter = False
        
        # Eğer USE_OPENROUTER=true VE OPENROUTER_API_KEY varsa → OpenRouter
        if use_openrouter_env == 'true' and openrouter_key:
            self.use_openrouter = True
            self.api_key = openrouter_key
            logger.info(f"[Matcher] OpenRouter seçildi (USE_OPENROUTER=true)")
        # OpenAI key varsa → OpenAI (öncelikli)
        elif openai_key:
            self.use_openrouter = False
            self.api_key = openai_key
            logger.info(f"[Matcher] OpenAI seçildi (OPENAI_API_KEY bulundu)")
        # Sadece OpenRouter key varsa ama USE_OPENROUTER=true değilse → OpenAI key bekleniyor
        elif openrouter_key:
            raise ValueError(
                f"OPENROUTER_API_KEY bulundu ama USE_OPENROUTER=true değil (değer: '{use_openrouter_env}'). "
                f"OpenAI kullanmak için OPENAI_API_KEY set edin veya OpenRouter kullanmak için USE_OPENROUTER=true ekleyin."
            )
        # Hiçbiri yoksa hata
        else:
            raise ValueError("OPENAI_API_KEY veya (OPENROUTER_API_KEY + USE_OPENROUTER=true) gerekli!")
        
        if self.use_openrouter:
            self.llm_api_url = 'https://openrouter.ai/api/v1/chat/completions'
            self.embedding_api_url = 'https://openrouter.ai/api/v1/embeddings'
            self.llm_model = os.getenv('LLM_MODEL', 'openai/gpt-4o-mini')
            logger.info(f"[Matcher] ✅ OpenRouter kullanılıyor - Model: {self.llm_model}")
        else:
            self.llm_api_url = os.getenv('LLM_API_URL', 'https://api.openai.com/v1/chat/completions')
            self.embedding_api_url = 'https://api.openai.com/v1/embeddings'
            self.llm_model = os.getenv('LLM_MODEL', 'gpt-4o-mini')
            logger.info(f"[Matcher] ✅ OpenAI API kullanılıyor - Model: {self.llm_model}")
        
        self.embedding_model = 'text-embedding-3-small'
        
        # 🔄 Retry / backoff ayarları
        self.max_retries = int(os.getenv("LLM_MAX_RETRIES", "6"))
        self.base_backoff = float(os.getenv("LLM_BASE_BACKOFF", "2.0"))  # saniye
        
        # ⏱️ Rate limiting ayarları (OpenAI best practices)
        self.batch_delay = float(os.getenv("LLM_BATCH_DELAY", "4.0"))  # Batch'ler arası delay (saniye) - rate limit için artırıldı
        self.embedding_batch_delay = float(os.getenv("EMBEDDING_BATCH_DELAY", "1.0"))  # Embedding batch'ler arası delay
        self.adaptive_delay = True  # 429 alırsa delay'i otomatik artır
        self.current_delay = self.batch_delay  # Dinamik delay (429 sonrası artar)
        self.adaptive_delay = True  # 429 alırsa delay'i otomatik artır
        self.current_delay = self.batch_delay  # Dinamik delay (429 sonrası artar)
    
    # ============================================
    # 🎯 ANA ENTRY POINT
    # ============================================
    
    async def process_multi_market_products(
        self,
        raw_products: List[RawProductData]
    ) -> List[ProcessedProduct]:
        """
        Ana entry point - Tüm pipeline'ı çalıştır
        
        Args:
            raw_products: Ham ürün verileri (tüm marketlerden)
        
        Returns:
            İşlenmiş ürünler
        """
        logger.info(f"[Pipeline] {len(raw_products)} ürün işleniyor...")
        
        # AŞAMA 1: Market bazlı normalizasyon
        normalized_by_market = await self.stage1_normalize_by_market(raw_products)
        
        # AŞAMA 2: Cross-market matching
        matched = await self.stage2_cross_market_matching(normalized_by_market)
        
        # AŞAMA 3: Kategori consolidation
        final = await self.stage3_category_consolidation(matched)
        
        return final
    
    # ============================================
    # 🎯 AŞAMA 1: MARKET-LEVEL NORMALİZASYON
    # ============================================
    
    async def stage1_normalize_by_market(
        self,
        raw_products: List[RawProductData]
    ) -> List[NormalizedProduct]:
        """
        Her market için ayrı ayrı normalize et
        """
        market_groups = self._group_by_market(raw_products)
        logger.info(f"[Stage 1] {len(market_groups)} market grubu bulundu")
        
        all_normalized: List[NormalizedProduct] = []
        
        # İlk batch'ten önce kısa bir delay (rate limit recovery için)
        await asyncio.sleep(2.0)
        
        for group in market_groups:
            logger.info(f"[Stage 1] {group['store_name']}: {len(group['products'])} ürün işleniyor...")
            
            # 🔥 LLM kullanmıyoruz, direkt tüm ürünleri normalize et
            try:
                normalized = await self._normalize_batch(group['products'], group['store_name'])
                all_normalized.extend(normalized)
            except Exception as e:
                logger.error(f"  Normalizasyon hatası: {e}")
                # Fallback
                fallback = self._fallback_normalize(group['products'])
                all_normalized.extend(fallback)
        
        logger.info(f"[Stage 1] ✅ {len(all_normalized)} ürün normalize edildi")
        return all_normalized
    
    async def _normalize_batch(
        self,
        products: List[RawProductData],
        store_name: str
    ) -> List[NormalizedProduct]:
        """Tek bir batch'i normalize et (KOD İLE - LLM KULLANMA!)"""
        # 🔥 LLM kullanmadan, tamamen kod ile normalizasyon yap
        # Async olmasına gerek yok ama interface uyumluluğu için async bırakıyoruz
        normalized_products = []
        for product in products:
            normalized = self._normalize_product_code_only(product)
            normalized_products.append(normalized)
        return normalized_products
    
    def _build_normalization_prompt(
        self,
        products: List[RawProductData],
        store_name: str
    ) -> str:
        """Normalizasyon promptu (SADECE ürün adı normalizasyonu - kategori atama YOK!)"""
        
        # Ürün listesi
        products_text = []
        for i, p in enumerate(products, 1):
            brand_part = f" [{p.brand}]" if p.brand else ""
            products_text.append(f"{i}. \"{p.name}\"{brand_part} - ₺{p.price:.2f}")
        products_text_str = '\n'.join(products_text)
        
        return f"""Sen bir ürün normalizasyon uzmanısın. {store_name} marketinden gelen ürünleri normalize et.

⚠️ SADECE NORMALİZASYON YAP - KATEGORİ ATAMA YAPMA, BAŞKA MARKET İLE KARŞILAŞTIRMA YAPMA!

ÜRÜNLER:

{products_text_str}

GÖREV:

1. Ürün adını normalize et (büyük/küçük harf, Türkçe karakter, fazla boşluk temizle)
2. Marka adını ayıkla ve normalize et
3. Ölçü bilgisini parse et (örn: "1L", "500g", "6'lı")

CEVAP FORMAT (SADECE JSON):

[
  {{
    "index": 1,
    "normalized_name": "Sütaş Süt",
    "normalized_brand": "Sütaş",
    "size": "1L"
  }}
]

ÖNEMLİ:
- SADECE ürün adı, marka ve ölçü normalize et
- KATEGORİ ATAMA YAPMA - kategori atama kod tarafından yapılacak

SADECE JSON döndür, başka açıklama yapma!"""
    
    def _parse_normalization_response(
        self,
        response: str,
        original_products: List[RawProductData]
    ) -> List[NormalizedProduct]:
        """LLM response'unu parse et ve kategori atamayı kendi kodumuzla yap"""
        try:
            # JSON extract
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()
            
            data = json.loads(response)
            
            normalized_products = []
            for item in data:
                idx = item.get('index', 1) - 1  # 1-based to 0-based
                if idx < 0 or idx >= len(original_products):
                    continue
                
                orig = original_products[idx]
                
                # Kategori normalizasyonu import script'te yapılacak
                normalized_category = orig.raw_category or 'Diğer'
                
                normalized = NormalizedProduct(
                    original_name=orig.name,
                    normalized_name=item.get('normalized_name', orig.name),
                    normalized_brand=item.get('normalized_brand'),
                    size=item.get('size'),
                    category=normalized_category,  # Raw kategori
                    subcategory=None,  # Import script'te belirlenecek
                    category_confidence=0.8 if normalized_category else 0.5,  # Kendi kodumuzla yapıldığı için confidence düşük
                    needs_new_subcategory=False,
                    new_subcategory_suggestion=None,
                    store_id=orig.store_id,
                    store_name=orig.store_name,
                    store_sku=orig.store_sku,
                    price=orig.price,
                    unit=orig.unit,
                    image_url=orig.image_url,
                )
                
                normalized_products.append(normalized)
            
            return normalized_products
            
        except Exception as e:
            logger.error(f"[Parse] JSON parse hatası: {e}")
            logger.error(f"[Parse] Response: {response[:500]}")
            # Fallback
            return self._fallback_normalize(original_products)
    
    def _normalize_product_code_only(self, product: RawProductData) -> NormalizedProduct:
        """
        🔥 Ürün normalizasyonu - TAMAMEN KOD İLE (LLM KULLANMA!)
        Backend'deki normalizasyon mantığını kullanır
        """
        # 1. Ürün adını normalize et
        normalized_name = self._normalize_product_name(product.name)
        
        # 2. Marka çıkar (eğer yoksa ürün adından dene)
        normalized_brand = product.brand
        if not normalized_brand:
            # Ürün adından marka çıkarmayı dene (ilk kelime genelde marka)
            words = normalized_name.split()
            if words and len(words[0]) > 2:
                normalized_brand = words[0].title()
        
        # Markayı da normalize et
        if normalized_brand:
            normalized_brand = self._normalize_text(normalized_brand).title()
        
        # 3. Size parse et (ürün adından veya mevcut size'tan)
        size = None
        if product.unit and product.unit != "adet":
            # Unit'ten size çıkarmayı dene
            size = product.unit
        else:
            # Ürün adından size çıkarmayı dene
            size_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(l|lt|litre|ml|g|gr|gram|kg|kilogram|adet|li|lı|lu|lü)', 
                                  product.name.lower())
            if size_match:
                value = size_match.group(1).replace(',', '.')
                unit = size_match.group(2)
                size = f"{value}{unit}"
        
        # 4. Kategori atama - raw_category'yi olduğu gibi kullan
        # Normalizasyon import script'te yapılacak
        category = product.raw_category or 'Diğer'
        
        return NormalizedProduct(
            original_name=product.name,
            normalized_name=normalized_name,
            normalized_brand=normalized_brand,
            size=size,
            category=category,  # Raw kategori
            subcategory=None,  # Import script'te belirlenecek
            category_confidence=0.5,
            needs_new_subcategory=False,
            new_subcategory_suggestion=None,
            store_id=product.store_id,
            store_name=product.store_name,
            store_sku=product.store_sku,
            price=product.price,
            unit=product.unit,
            image_url=product.image_url,
        )
    
    def _normalize_text(self, text: str) -> str:
        """Temel text normalizasyonu (Türkçe karakter, boşluk, vs.)"""
        if not text:
            return ""
        
        # Türkçe karakterleri normalize et
        text = (text
            .replace('ı', 'i').replace('İ', 'i')
            .replace('ğ', 'g').replace('Ğ', 'g')
            .replace('ü', 'u').replace('Ü', 'u')
            .replace('ş', 's').replace('Ş', 's')
            .replace('ö', 'o').replace('Ö', 'o')
            .replace('ç', 'c').replace('Ç', 'c')
        )
        
        # Özel karakterleri temizle
        text = re.sub(r'[^\w\s]', ' ', text)
        # Fazla boşlukları temizle
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def _normalize_product_name(self, name: str) -> str:
        """
        Ürün adını normalize et (Backend mantığına benzer)
        - Türkçe karakter normalize
        - Gereksiz kelimeleri temizle
        - Fazla boşlukları temizle
        """
        if not name:
            return ""
        
        # Temel normalizasyon
        normalized = self._normalize_text(name)
        
        # Gereksiz kelimeleri temizle (opsiyonel - çok agresif olmasın)
        # Sadece çok yaygın olanları temizle
        noise_words = ['orta', 'boy', 'büyük', 'küçük', 'mini', 'jumbo']
        words = normalized.split()
        words = [w for w in words if w.lower() not in noise_words or len(w) > 3]
        
        return ' '.join(words).strip()
    
    def _fallback_normalize(
        self,
        products: List[RawProductData]
    ) -> List[NormalizedProduct]:
        """Fallback normalizasyon - kod ile yap"""
        normalized = []
        for p in products:
            n = self._normalize_product_code_only(p)
            normalized.append(n)
        return normalized
    
    # ============================================
    # 🔄 AŞAMA 2: CROSS-MARKET MATCHING
    # ============================================
    
    async def stage2_cross_market_matching(
        self,
        normalized: List[NormalizedProduct]
    ) -> List[MatchedProduct]:
        """
        Two-phase matching:
        Phase 1: Exact match (brand + name + size)
        Phase 2: Fuzzy match (embedding-based, within same size bucket)
        """
        logger.info(f"[Stage 2] {len(normalized)} ürün için two-phase cross-market matching...")
        
        # PHASE 1: Exact match - hızlı, LLM yok
        exact_matched, remaining = self._phase1_exact_match(normalized)
        logger.info(f"[Stage 2 Phase 1] ✅ {len(exact_matched)} ürün exact match ile eşleştirildi")
        logger.info(f"[Stage 2 Phase 1] ⏳ {len(remaining)} ürün Phase 2'ye geçiyor")
        
        if not remaining:
            return exact_matched
        
        # PHASE 2: Fuzzy match - sadece exact match olmayanlar için
        # 1. Embedding'leri oluştur (sadece remaining için)
        with_embeddings = await self._generate_embeddings(remaining)
        
        # 2. Benzer ürünleri grupla (size bucket'ları içinde)
        groups = self._cluster_by_similarity(with_embeddings)
        logger.info(f"[Stage 2 Phase 2] {len(groups)} ürün grubu oluşturuldu")
        
        # 3. Her grup için LLM ile doğrulama (sadece belirsiz olanlar için)
        fuzzy_matched: List[MatchedProduct] = []
        
        for group in groups:
            if len(group.items) == 1:
                # Tek market, matching'e gerek yok
                fuzzy_matched.append(self._convert_to_matched(group.items[0]))
            elif group.max_similarity > self.HIGH_SIMILARITY_THRESHOLD:
                # Çok yüksek benzerlik, LLM'e sormaya gerek yok
                fuzzy_matched.append(self._merge_group(group, verified=True))
            elif group.max_similarity > self.SIMILARITY_THRESHOLD:
                # Belirsiz, LLM'e sor (sadece > 0.85 similarity için)
                if group.max_similarity > 0.85:
                    llm_verified = await self._verify_matching_with_llm(group)
                    fuzzy_matched.append(llm_verified)
                else:
                    # Düşük benzerlik, ayrı ürünler
                    fuzzy_matched.extend([self._convert_to_matched(item) for item in group.items])
            else:
                # Düşük benzerlik, ayrı ürünler
                fuzzy_matched.extend([self._convert_to_matched(item) for item in group.items])
        
        logger.info(f"[Stage 2 Phase 2] ✅ {len(fuzzy_matched)} ürün fuzzy match ile eşleştirildi")
        
        # Combine results
        all_matched = exact_matched + fuzzy_matched
        logger.info(f"[Stage 2] ✅ Toplam {len(all_matched)} unique ürün bulundu")
        return all_matched
    
    def _phase1_exact_match(
        self,
        normalized: List[NormalizedProduct]
    ) -> tuple[List[MatchedProduct], List[NormalizedProduct]]:
        """
        Phase 1: Exact match (brand + normalized name + normalized size)
        Returns: (matched_products, remaining_products)
        """
        # Normalize brand ve name için helper
        def normalize_text(text: Optional[str]) -> str:
            if not text:
                return ""
            import re
            text = text.lower().strip()
            # Türkçe karakterleri normalize et
            text = (text
                .replace('ı', 'i')
                .replace('ğ', 'g')
                .replace('ü', 'u')
                .replace('ş', 's')
                .replace('ö', 'o')
                .replace('ç', 'c')
            )
            # Özel karakterleri temizle
            text = re.sub(r'[^\w\s]', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text
        
        # Exact match key: brand + name + size
        exact_groups: Dict[str, List[NormalizedProduct]] = {}
        remaining: List[NormalizedProduct] = []
        
        for product in normalized:
            # Normalize brand
            normalized_brand = normalize_text(product.normalized_brand) if product.normalized_brand else ""
            # Normalize name
            normalized_name = normalize_text(product.normalized_name)
            # Normalize size
            size_value, size_unit = self.normalize_size(product.size)
            size_key = f"{int(size_value)}_{size_unit}" if size_value > 0 and size_unit != "unknown" else "no_size"
            
            # Exact match key
            exact_key = f"{normalized_brand}|{normalized_name}|{size_key}"
            
            if exact_key in exact_groups:
                exact_groups[exact_key].append(product)
            else:
                exact_groups[exact_key] = [product]
        
        # Convert exact matches to MatchedProduct
        matched: List[MatchedProduct] = []
        for key, products in exact_groups.items():
            if len(products) > 1:
                # Exact match bulundu - merge et
                # Convert to ProductWithEmbedding format (embedding olmadan)
                cluster_items = [
                    ProductWithEmbedding(**p.__dict__, embedding=None)
                    for p in products
                ]
                cluster = ProductCluster(items=cluster_items, max_similarity=1.0)
                matched.append(self._merge_group(cluster, verified=True))
            else:
                # Exact match yok, Phase 2'ye gönder
                remaining.append(products[0])
        
        return matched, remaining
    
    async def _generate_embeddings(
        self,
        products: List[NormalizedProduct]
    ) -> List[ProductWithEmbedding]:
        """
        Embedding oluştur (OpenAI text-embedding-3-small)
        """
        logger.info(f"[Embedding] {len(products)} ürün için embedding oluşturuluyor...")
        
        batches = self._split_into_batches(products, self.EMBEDDING_BATCH)
        results: List[ProductWithEmbedding] = []
        
        for batch_idx, batch in enumerate(batches):
            texts = [
                f"{p.normalized_brand or ''} {p.normalized_name} {p.size or ''}".strip()
                for p in batch
            ]
            
            try:
                payload = {
                    'model': self.embedding_model,
                    'input': texts,
                }
                
                data = await self._post_with_retry(self.embedding_api_url, payload)
                
                for i, product in enumerate(batch):
                    embedding_data = data['data'][i]['embedding']
                    product_with_emb = ProductWithEmbedding(
                        **product.__dict__,
                        embedding=embedding_data
                    )
                    results.append(product_with_emb)
                
                # Rate limiting (OpenAI best practices: embedding batch'ler arası delay)
                # Son batch'ten sonra bekleme
                if batch_idx < len(batches) - 1:
                    await asyncio.sleep(self.embedding_batch_delay)
                
            except Exception as e:
                logger.error(f"[Embedding] Batch hatası (tüm retry'lerden sonra): {e}")
                # Fallback: embedding olmadan devam et
                results.extend([
                    ProductWithEmbedding(**p.__dict__, embedding=None)
                    for p in batch
                ])
        
        logger.info(f"[Embedding] ✅ {len(results)} embedding oluşturuldu")
        return results
    
    def _cluster_by_similarity(
        self,
        products: List[ProductWithEmbedding]
    ) -> List[ProductCluster]:
        """
        Benzer ürünleri grupla (cosine similarity)
        BEST PRACTICE: ÖNCELİKLE size bucket'larına ayır, her bucket içinde ayrı clustering yap
        Bu sayede 16g Nutella asla 600g Nutella ile karşılaşmaz bile
        """
        logger.info(f"[Clustering] {len(products)} ürün için size-bucket clustering başlıyor...")
        
        # ÖNCELİKLE size bucket'larına ayır
        size_buckets: Dict[str, List[ProductWithEmbedding]] = {}
        for product in products:
            size_value, size_unit = self.normalize_size(product.size)
            # Size bucket key: "500_g" veya "1000_ml" veya "no_size"
            if size_value > 0 and size_unit != "unknown":
                size_key = f"{int(size_value)}_{size_unit}"
            else:
                size_key = "no_size"
            
            if size_key not in size_buckets:
                size_buckets[size_key] = []
            size_buckets[size_key].append(product)
        
        logger.info(f"[Clustering] {len(size_buckets)} size bucket oluşturuldu")
        for size_key, bucket_products in size_buckets.items():
            logger.info(f"  - {size_key}: {len(bucket_products)} ürün")
        
        # Her bucket içinde ayrı ayrı clustering yap
        all_clusters: List[ProductCluster] = []
        total_comparisons = 0
        
        for size_key, bucket_products in size_buckets.items():
            if len(bucket_products) == 1:
                # Tek ürün, cluster oluştur
                all_clusters.append(ProductCluster(items=bucket_products, max_similarity=1.0))
                continue
            
            logger.info(f"[Clustering] Size bucket '{size_key}' içinde {len(bucket_products)} ürün clustering yapılıyor...")
            
            # Market'lere göre grupla (cross-market matching için)
            by_market: Dict[int, List[ProductWithEmbedding]] = {}
            for product in bucket_products:
                if product.store_id not in by_market:
                    by_market[product.store_id] = []
                by_market[product.store_id].append(product)
            
            market_ids = list(by_market.keys())
            
            # Bu bucket içinde cross-market karşılaştırma sayısı
            bucket_comparisons = 0
            for i, market1_id in enumerate(market_ids):
                for market2_id in market_ids[i+1:]:
                    bucket_comparisons += len(by_market[market1_id]) * len(by_market[market2_id])
            
            logger.info(f"  Size bucket '{size_key}': {len(market_ids)} market, ~{bucket_comparisons:,} karşılaştırma")
            
            # Bucket içinde clustering
            bucket_clusters: List[ProductCluster] = []
            processed = set()
            last_log_time = time.time()
            
            for idx, product in enumerate(bucket_products):
                if idx in processed:
                    continue
                
                # Progress log (her 200 üründe bir)
                if idx % 200 == 0 and len(bucket_products) > 200:
                    elapsed = time.time() - last_log_time
                    progress_pct = idx * 100 // len(bucket_products) if len(bucket_products) > 0 else 0
                    logger.info(f"  [{size_key}] İşleniyor: {idx}/{len(bucket_products)} ({progress_pct}%) - {total_comparisons:,} karşılaştırma")
                    last_log_time = time.time()
                
                cluster = ProductCluster(
                    items=[product],
                    max_similarity=1.0
                )
                
                # Sadece diğer marketlerdeki ürünlerle karşılaştır (aynı size bucket içinde)
                for j in range(idx + 1, len(bucket_products)):
                    if j in processed:
                        continue
                    
                    other = bucket_products[j]
                    
                    # Aynı market ise skip (cross-market matching için)
                    if product.store_id == other.store_id:
                        continue
                    
                    total_comparisons += 1
                    
                    # Size zaten aynı bucket'ta, kontrol etmeye gerek yok
                    # Ama ekstra güvenlik için kontrol edelim
                    size_match = self._compare_sizes(product.size, other.size)
                    if not size_match:
                        # Bu durumda olmamalı (aynı bucket'ta), ama yine de kontrol
                        continue
                    
                    # Embedding varsa cosine similarity
                    similarity = 0.0
                    if product.embedding and other.embedding:
                        similarity = self._cosine_similarity(
                            product.embedding,
                            other.embedding
                        )
                    else:
                        # Fallback: string similarity
                        similarity = self._string_similarity(
                            f"{product.normalized_brand or ''} {product.normalized_name}",
                            f"{other.normalized_brand or ''} {other.normalized_name}"
                        )
                    
                    # Eşik üzerindeyse gruba ekle
                    if similarity > self.SIMILARITY_THRESHOLD:
                        cluster.items.append(other)
                        cluster.max_similarity = max(cluster.max_similarity, similarity)
                        processed.add(j)
                
                bucket_clusters.append(cluster)
                processed.add(idx)
            
            all_clusters.extend(bucket_clusters)
            logger.info(f"  Size bucket '{size_key}': ✅ {len(bucket_clusters)} cluster oluşturuldu")
        
        logger.info(f"[Clustering] ✅ Toplam {len(all_clusters)} cluster oluşturuldu ({total_comparisons:,} karşılaştırma yapıldı)")
        return all_clusters
    
    async def _verify_matching_with_llm(
        self,
        cluster: ProductCluster
    ) -> MatchedProduct:
        """
        LLM ile matching doğrulama (sadece belirsiz gruplar için)
        """
        prompt = f"""Bu ürünler aynı ürün mü, yoksa farklı ürünler mi?

{chr(10).join([f"{i + 1}. [{p.store_name}] {p.normalized_brand or ''} {p.normalized_name} {p.size or ''} - ₺{p.price:.2f}" for i, p in enumerate(cluster.items)])}

JSON dön:

{{
  "is_same_product": true/false,
  "confidence": 0.0-1.0,
  "reason": "Neden aynı veya farklı"
}}

SADECE JSON döndür!"""
        
        response = await self._call_llm(prompt)
        
        try:
            # JSON extract
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()
            
            parsed = json.loads(response)
            
            if parsed.get('is_same_product') and parsed.get('confidence', 0) > 0.70:
                return self._merge_group(cluster, verified=True)
            else:
                return self._convert_to_matched(cluster.items[0])  # İlkini al
                
        except Exception as e:
            logger.error(f"[LLM Verify] Parse hatası: {e}")
            # Belirsizse merge et
            return self._merge_group(cluster, verified=False)
    
    def _convert_to_matched(self, product: ProductWithEmbedding) -> MatchedProduct:
        """ProductWithEmbedding -> MatchedProduct"""
        # Generate muadil_grup_id including size
        muadil_id = self._generate_muadil_grup_id(
            product.normalized_brand,
            product.normalized_name,
            product.size
        )
        
        return MatchedProduct(
            muadil_grup_id=muadil_id,
            normalized_name=product.normalized_name,
            normalized_brand=product.normalized_brand,
            size=product.size,
            category=product.category,
            subcategory=product.subcategory,
            category_confidence=product.category_confidence,
            needs_new_subcategory=product.needs_new_subcategory,
            new_subcategory_suggestion=product.new_subcategory_suggestion,
            prices=[{
                'store_name': product.store_name,
                'store_id': product.store_id,
                'store_sku': product.store_sku,
                'price': product.price,
                'unit': product.unit,
                'image_url': product.image_url,
            }]
        )
    
    def _merge_group(
        self,
        cluster: ProductCluster,
        verified: bool = False
    ) -> MatchedProduct:
        """Grup ürünlerini merge et"""
        # En yüksek confidence'lı ürünü al (kategori için)
        best_product = max(cluster.items, key=lambda p: p.category_confidence)
        
        # Generate muadil_grup_id including size
        muadil_id = self._generate_muadil_grup_id(
            best_product.normalized_brand,
            best_product.normalized_name,
            best_product.size
        )
        
        # Tüm fiyatları topla
        prices = []
        for p in cluster.items:
            prices.append({
                'store_name': p.store_name,
                'store_id': p.store_id,
                'store_sku': p.store_sku,
                'price': p.price,
                'unit': p.unit,
                'image_url': p.image_url,
            })
        
        return MatchedProduct(
            muadil_grup_id=muadil_id,
            normalized_name=best_product.normalized_name,
            normalized_brand=best_product.normalized_brand,
            size=best_product.size,
            category=best_product.category,
            subcategory=best_product.subcategory,
            category_confidence=best_product.category_confidence,
            needs_new_subcategory=best_product.needs_new_subcategory,
            new_subcategory_suggestion=best_product.new_subcategory_suggestion,
            prices=prices
        )
    
    # ============================================
    # ✅ AŞAMA 3: KATEGORİ CONSOLİDATION
    # ============================================
    
    async def stage3_category_consolidation(
        self,
        matched: List[MatchedProduct]
    ) -> List[ProcessedProduct]:
        """
        Yeni kategori önerilerini topla ve işle
        """
        logger.info(f"[Stage 3] Kategori consolidation başlıyor...")
        
        # 1. Yeni kategori önerilerini topla
        new_subcategory_proposals = [
            {
                'parent': p.category,
                'name': p.new_subcategory_suggestion,
                'count': 1
            }
            for p in matched
            if p.needs_new_subcategory and p.new_subcategory_suggestion
        ]
        
        if new_subcategory_proposals:
            # Grupla ve say
            grouped = {}
            for proposal in new_subcategory_proposals:
                key = f"{proposal['parent']}::{proposal['name']}"
                grouped[key] = grouped.get(key, 0) + 1
            
            # Logla
            logger.info(f"[Stage 3] Yeni kategori önerileri:")
            for key, count in grouped.items():
                parent, name = key.split('::')
                logger.info(f"  - \"{name}\" ({parent}) - {count} ürün")
            
            # Auto-create (opsiyonel)
            if os.getenv('AUTO_CREATE_SUBCATEGORIES') == 'true':
                await self._create_new_subcategories(list(grouped.keys()))
        
        # 2. Final format'a çevir
        final = []
        for m in matched:
            processed = ProcessedProduct(
                normalized_name=m.normalized_name,
                normalized_brand=m.normalized_brand,
                category=m.category,
                subcategory=m.subcategory,
                muadil_grup_id=m.muadil_grup_id,
                prices=m.prices
            )
            final.append(processed)
        
        logger.info(f"[Stage 3] ✅ {len(final)} ürün hazır")
        return final
    
    async def _create_new_subcategories(self, proposals: List[str]):
        """Yeni alt kategorileri oluştur (backend API'ye istek)"""
        # TODO: Backend API'ye istek at
        logger.info(f"[Stage 3] {len(proposals)} yeni alt kategori önerisi (backend'e gönderilecek)")
    
    # ============================================
    # 🔧 HELPER METHODS
    # ============================================
    
    def normalize_size(self, size_str: Optional[str]) -> tuple[float, str]:
        """
        Size normalization pipeline
        "1 Litre" -> (1000, "ml")
        "500g" -> (500, "g")
        "6'lı" -> (6, "adet")
        "4 Adet x 28 gr" -> (112, "g")  # Çoklu paket formatı
        
        Returns:
            (value, unit) tuple - normalized value and base unit
        """
        if not size_str:
            return (0, "unknown")
        
        size_str = size_str.lower().strip()
        
        # Birim dönüşümleri
        conversions = {
            # Hacim
            ('l', 'lt', 'litre', 'liter'): ('ml', 1000),
            ('ml', 'mililitre'): ('ml', 1),
            ('cl'): ('ml', 10),
            # Ağırlık  
            ('kg', 'kilogram', 'kilo'): ('g', 1000),
            ('g', 'gr', 'gram'): ('g', 1),
            ('mg', 'miligram'): ('g', 0.001),
            # Adet
            ("'lı", "'li", "'lu", "'lü", "adet", "pk", "paket"): ('adet', 1),
        }
        
        # 🔥 ÇOKLU PAKET FORMATI: "4 Adet x 28 gr" veya "4x28g" veya "4 x 28 gr"
        # Pattern: sayı + (adet/paket/x) + x + sayı + birim
        multi_pattern = r'(\d+(?:[.,]\d+)?)\s*(?:adet|paket|x)\s*x\s*(\d+(?:[.,]\d+)?)\s*([a-zığüşöçı]+)'
        multi_match = re.search(multi_pattern, size_str)
        if multi_match:
            count = float(multi_match.group(1).replace(',', '.'))
            amount = float(multi_match.group(2).replace(',', '.'))
            unit = multi_match.group(3).lower()
            
            # Toplam miktarı hesapla
            total_value = count * amount
            
            # Birim eşleştirmesi
            for units, (base_unit, multiplier) in conversions.items():
                if unit in units or any(unit.endswith(u) for u in units if u not in ("'lı", "'li", "'lu", "'lü")):
                    if unit.endswith(("'lı", "'li", "'lu", "'lü")):
                        return (total_value, "adet")
                    return (total_value * multiplier, base_unit)
            
            return (total_value, unit)
        
        # Tek paket formatı: "500g" veya "1 Litre"
        # Pattern: sayı (nokta/virgül destekler) + birim
        match = re.search(r'(\d+(?:[.,]\d+)?)\s*([a-zığüşöçı\']+)', size_str)
        if match:
            value_str = match.group(1).replace(',', '.')
            try:
                value = float(value_str)
            except ValueError:
                return (0, "unknown")
            
            unit = match.group(2).lower()
            
            # Birim eşleştirmesi
            for units, (base_unit, multiplier) in conversions.items():
                if unit in units or any(unit.endswith(u) for u in units if u not in ("'lı", "'li", "'lu", "'lü")):
                    # "'lı" gibi suffix'ler için özel kontrol
                    if unit.endswith(("'lı", "'li", "'lu", "'lü")):
                        return (value, "adet")
                    return (value * multiplier, base_unit)
            
            # Eğer eşleşme yoksa, direkt birimi kullan
            # Ama değeri normalize et
            return (value, unit)
        
        # Sayı bulunamadı, sadece birim var mı?
        for units, (base_unit, multiplier) in conversions.items():
            for u in units:
                if u in size_str:
                    # Varsayılan olarak 1 kabul et
                    return (1 * multiplier, base_unit)
        
        return (0, "unknown")
    
    def _generate_muadil_grup_id(
        self,
        normalized_brand: Optional[str],
        normalized_name: str,
        size: Optional[str]
    ) -> str:
        """
        Generate muadil_grup_id including size
        Format: {brand}_{name}_{normalized_size}
        Example: "nutella_kakaolu_findik_kremasi_600g"
        """
        # Brand normalize
        brand_part = ""
        if normalized_brand:
            brand_part = normalized_brand.lower().strip()
            # Türkçe karakterleri normalize et
            brand_part = (brand_part
                .replace('ı', 'i')
                .replace('ğ', 'g')
                .replace('ü', 'u')
                .replace('ş', 's')
                .replace('ö', 'o')
                .replace('ç', 'c')
            )
            # Özel karakterleri temizle
            brand_part = re.sub(r'[^\w\s]', ' ', brand_part)
            brand_part = re.sub(r'\s+', '_', brand_part).strip('_')
        
        # Name normalize
        name_part = normalized_name.lower().strip()
        name_part = (name_part
            .replace('ı', 'i')
            .replace('ğ', 'g')
            .replace('ü', 'u')
            .replace('ş', 's')
            .replace('ö', 'o')
            .replace('ç', 'c')
        )
        # Özel karakterleri temizle
        name_part = re.sub(r'[^\w\s]', ' ', name_part)
        name_part = re.sub(r'\s+', '_', name_part).strip('_')
        
        # Size normalize
        size_part = ""
        if size:
            size_value, size_unit = self.normalize_size(size)
            if size_value > 0 and size_unit != "unknown":
                # Size'ı normalize et: "500_g" veya "1000_ml"
                size_part = f"{int(size_value)}_{size_unit}"
        
        # Birleştir
        parts = []
        if brand_part:
            parts.append(brand_part)
        if name_part:
            parts.append(name_part)
        if size_part:
            parts.append(size_part)
        
        if not parts:
            # Fallback: UUID
            import uuid
            return str(uuid.uuid4())
        
        return "_".join(parts)
    
    async def _post_with_retry(self, url: str, payload: dict) -> dict:
        """
        429 ve geçici network hataları için retry + exponential backoff
        """
        
        backoff = self.base_backoff
        
        for attempt in range(1, self.max_retries + 1):
            try:
                response = requests.post(
                    url,
                    headers={
                        'Authorization': f'Bearer {self.api_key}',
                        'Content-Type': 'application/json',
                    },
                    json=payload,
                    timeout=120
                )
                
                # 429 ise özel handling (OpenAI rate limit)
                if response.status_code == 429:
                    # Rate limit header'larını oku (OpenAI format)
                    rate_limit_remaining_req = response.headers.get("X-RateLimit-Remaining-Requests")
                    rate_limit_limit_req = response.headers.get("X-RateLimit-Limit-Requests")
                    rate_limit_reset_req = response.headers.get("X-RateLimit-Reset-Requests")
                    rate_limit_remaining_tokens = response.headers.get("X-RateLimit-Remaining-Tokens")
                    rate_limit_limit_tokens = response.headers.get("X-RateLimit-Limit-Tokens")
                    rate_limit_reset_tokens = response.headers.get("X-RateLimit-Reset-Tokens")
                    
                    # Reset zamanını parse et (format: "1s", "6m0s", "1h30m", vb.)
                    wait_for = backoff  # Default
                    if rate_limit_reset_req:
                        wait_for = self._parse_reset_time(rate_limit_reset_req)
                    elif response.headers.get("Retry-After"):
                        # Fallback: Retry-After header'ı
                        try:
                            wait_for = float(response.headers.get("Retry-After"))
                        except (ValueError, TypeError):
                            wait_for = backoff
                    
                    logger.warning(
                        f"[HTTP 429] Too Many Requests (attempt {attempt}/{self.max_retries})"
                    )
                    if rate_limit_remaining_req and rate_limit_limit_req:
                        req_pct = (float(rate_limit_remaining_req) / float(rate_limit_limit_req)) * 100
                        logger.warning(
                            f"  Request Limit: {rate_limit_remaining_req}/{rate_limit_limit_req} remaining ({req_pct:.1f}%)"
                        )
                    if rate_limit_remaining_tokens and rate_limit_limit_tokens:
                        token_pct = (float(rate_limit_remaining_tokens) / float(rate_limit_limit_tokens)) * 100
                        logger.warning(
                            f"  Token Limit: {rate_limit_remaining_tokens}/{rate_limit_limit_tokens} remaining ({token_pct:.1f}%)"
                        )
                    if rate_limit_reset_req:
                        logger.warning(f"  Request limit resets in: {rate_limit_reset_req}")
                    if rate_limit_reset_tokens:
                        logger.warning(f"  Token limit resets in: {rate_limit_reset_tokens}")
                    logger.warning(f"  Waiting {wait_for:.1f} seconds before retry...")
                    
                    # Adaptive delay: 429 alırsa batch delay'i artır
                    if self.adaptive_delay:
                        # Delay'i 1.5x artır (max: 15 saniye)
                        self.current_delay = min(self.current_delay * 1.5, 15.0)
                        logger.info(f"  [Adaptive Rate Limit] Batch delay artırıldı: {self.current_delay:.1f} sn")
                    
                    await asyncio.sleep(wait_for)
                    backoff *= 2
                    continue  # tekrar dene
                
                # Başarılı response - rate limit header'larını kontrol et ve logla
                rate_limit_remaining_req = response.headers.get("X-RateLimit-Remaining-Requests")
                rate_limit_limit_req = response.headers.get("X-RateLimit-Limit-Requests")
                rate_limit_remaining_tokens = response.headers.get("X-RateLimit-Remaining-Tokens")
                rate_limit_limit_tokens = response.headers.get("X-RateLimit-Limit-Tokens")
                
                if rate_limit_remaining_req and rate_limit_limit_req:
                    req_pct = (float(rate_limit_remaining_req) / float(rate_limit_limit_req)) * 100
                    if req_pct < 10:  # %10'dan az kaldıysa kritik uyarı
                        logger.error(
                            f"[Rate Limit] ⚠️ KRİTİK! Request limit çok düşük: %{req_pct:.1f} "
                            f"({rate_limit_remaining_req}/{rate_limit_limit_req})"
                        )
                    elif req_pct < 20:  # %20'den az kaldıysa uyar
                        logger.warning(
                            f"[Rate Limit] Dikkat! Request limit düşük: %{req_pct:.1f} "
                            f"({rate_limit_remaining_req}/{rate_limit_limit_req})"
                        )
                
                if rate_limit_remaining_tokens and rate_limit_limit_tokens:
                    token_pct = (float(rate_limit_remaining_tokens) / float(rate_limit_limit_tokens)) * 100
                    if token_pct < 10:  # %10'dan az kaldıysa kritik uyarı
                        logger.error(
                            f"[Rate Limit] ⚠️ KRİTİK! Token limit çok düşük: %{token_pct:.1f} "
                            f"({rate_limit_remaining_tokens}/{rate_limit_limit_tokens})"
                        )
                    elif token_pct < 20:  # %20'den az kaldıysa uyar
                        logger.warning(
                            f"[Rate Limit] Dikkat! Token limit düşük: %{token_pct:.1f} "
                            f"({rate_limit_remaining_tokens}/{rate_limit_limit_tokens})"
                        )
                
                # Diğer hatalar için raise_for_status
                response.raise_for_status()
                return response.json()
                
            except requests.HTTPError as e:
                # 5xx veya başka HTTP error
                status = e.response.status_code if e.response is not None else "?"
                logger.error(
                    f"[HTTP ERROR] status={status} attempt={attempt}/{self.max_retries}: {e}"
                )
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(backoff)
                backoff *= 2
                
            except requests.RequestException as e:
                # DNS, timeout vs. tüm network hataları
                logger.error(
                    f"[NETWORK ERROR] attempt={attempt}/{self.max_retries}: {e}"
                )
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(backoff)
                backoff *= 2
        
        # Buraya normalde gelmez, ama güvenlik için:
        raise RuntimeError("LLM isteği retry limitini aştı")
    
    def _parse_reset_time(self, reset_str: str) -> float:
        """
        OpenAI reset time format'ını parse et
        Format: "1s", "6m0s", "1h30m", "2h15m30s", vb. (Go duration format)
        Returns: seconds (float)
        """
        if not reset_str:
            return 2.0  # Default 2 saniye
        
        reset_str = reset_str.strip().lower()
        total_seconds = 0.0
        
        # Regex ile parse et: sayı + birim (h, m, s)
        pattern = r'(\d+(?:\.\d+)?)([hms])'
        matches = re.findall(pattern, reset_str)
        
        for value_str, unit in matches:
            try:
                value = float(value_str)
                if unit == 'h':
                    total_seconds += value * 3600  # saat → saniye
                elif unit == 'm':
                    total_seconds += value * 60    # dakika → saniye
                elif unit == 's':
                    total_seconds += value         # saniye
            except ValueError:
                continue
        
        # Eğer parse edilemediyse, sadece sayı varsa saniye olarak kabul et
        if total_seconds == 0.0:
            try:
                total_seconds = float(reset_str)
            except ValueError:
                total_seconds = 2.0  # Fallback
        
        return max(total_seconds, 1.0)  # En az 1 saniye
    
    async def _call_llm(self, prompt: str) -> str:
        """LLM API çağrısı (retry + backoff ile)"""
        payload = {
            'model': self.llm_model,
            'messages': [
                {'role': 'system', 'content': 'Sen bir ürün normalizasyon ve eşleştirme uzmanısın. Sadece JSON formatında cevap ver.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.3,
            'max_tokens': 4000,
        }
        
        try:
            data = await self._post_with_retry(self.llm_api_url, payload)
            return data['choices'][0]['message']['content']
        except Exception as e:
            logger.error(f"[LLM] API hatası (tüm retry'lerden sonra): {e}")
            raise
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Cosine similarity hesapla"""
        try:
            vec_a = np.array(a)
            vec_b = np.array(b)
            
            dot_product = np.dot(vec_a, vec_b)
            norm_a = np.linalg.norm(vec_a)
            norm_b = np.linalg.norm(vec_b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return float(dot_product / (norm_a * norm_b))
        except Exception:
            return 0.0
    
    def _string_similarity(self, a: str, b: str) -> float:
        """Levenshtein distance based similarity"""
        longer = a if len(a) > len(b) else b
        shorter = b if len(a) > len(b) else a
        
        if len(longer) == 0:
            return 1.0
        
        distance = self._levenshtein_distance(longer, shorter)
        return (len(longer) - distance) / len(longer)
    
    def _compare_sizes(self, size1: Optional[str], size2: Optional[str]) -> bool:
        """
        Size/gramaj karşılaştırması
        Farklı gramajlar farklı ürün olarak kabul edilir
        Uses normalize_size for consistency
        
        Returns:
            True: Size'lar uyumlu (aynı veya yok)
            False: Size'lar farklı, aynı ürün olamaz
        """
        # İkisi de yoksa veya boşsa, uyumlu kabul et
        if not size1 and not size2:
            return True
        
        # Biri yoksa, diğeri varsa - uyumlu kabul et (esnek davran)
        if not size1 or not size2:
            return True
        
        # Normalize et (normalize_size fonksiyonunu kullan)
        val1, unit1 = self.normalize_size(size1)
        val2, unit2 = self.normalize_size(size2)
        
        # İkisi de unknown ise, string similarity kullan
        if unit1 == "unknown" and unit2 == "unknown":
            s1 = size1.strip().lower() if size1 else ""
            s2 = size2.strip().lower() if size2 else ""
            if s1 == s2:
                return True
            similarity = self._string_similarity(s1, s2)
            return similarity > 0.5
        
        # Biri unknown, diğeri değil - farklı kabul et
        if unit1 == "unknown" or unit2 == "unknown":
            return False
        
        # Farklı birimler farklı ürün (birim dönüşümü yaparak kontrol et)
        if unit1 != unit2:
            # kg ve g karşılaştırması
            if (unit1 == 'kg' and unit2 == 'g') or (unit1 == 'g' and unit2 == 'kg'):
                val1_g = val1 * 1000 if unit1 == 'kg' else val1
                val2_g = val2 * 1000 if unit2 == 'kg' else val2
                # %20'den fazla fark varsa farklı ürün
                ratio = min(val1_g, val2_g) / max(val1_g, val2_g) if max(val1_g, val2_g) > 0 else 0
                return ratio > 0.8  # %80'den fazla benzerlik varsa aynı kabul et
            
            # l ve ml karşılaştırması
            if (unit1 == 'l' and unit2 == 'ml') or (unit1 == 'ml' and unit2 == 'l'):
                val1_ml = val1 * 1000 if unit1 == 'l' else val1
                val2_ml = val2 * 1000 if unit2 == 'l' else val2
                ratio = min(val1_ml, val2_ml) / max(val1_ml, val2_ml) if max(val1_ml, val2_ml) > 0 else 0
                return ratio > 0.8
            
            # Diğer farklı birimler - farklı ürün
            return False
        
        # Aynı birim, değerleri karşılaştır
        # %20'den fazla fark varsa farklı ürün (strict: %10 tolere et)
        if val1 == 0 and val2 == 0:
            return True
        
        ratio = min(val1, val2) / max(val1, val2) if max(val1, val2) > 0 else 0
        if ratio < 0.9:  # %90'dan az benzerlik varsa farklı (daha strict)
            logger.debug(f"Size farkı tespit edildi: '{size1}' ({val1} {unit1}) vs '{size2}' ({val2} {unit2}) (ratio: {ratio:.2f})")
            return False
        
        return True
    
    def _levenshtein_distance(self, a: str, b: str) -> int:
        """Levenshtein distance hesapla"""
        if len(a) < len(b):
            return self._levenshtein_distance(b, a)
        
        if len(b) == 0:
            return len(a)
        
        previous_row = list(range(len(b) + 1))
        for i, c1 in enumerate(a):
            current_row = [i + 1]
            for j, c2 in enumerate(b):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    def _group_by_market(
        self,
        products: List[RawProductData]
    ) -> List[Dict]:
        """Ürünleri market'e göre grupla"""
        groups = {}
        for product in products:
            key = product.store_id
            if key not in groups:
                groups[key] = {
                    'store_id': product.store_id,
                    'store_name': product.store_name,
                    'products': []
                }
            groups[key]['products'].append(product)
        
        return list(groups.values())
    
    def _split_into_batches(self, items: List, batch_size: int) -> List[List]:
        """Liste'yi batch'lere böl"""
        batches = []
        for i in range(0, len(items), batch_size):
            batches.append(items[i:i + batch_size])
        return batches


# ============================================
# MAIN ENTRY POINT
# ============================================

async def main():
    """Test/Example usage"""
    import json as json_module
    
    # Example usage
    raw_products = [
        RawProductData(
            name="Sütaş Tam Yağlı Süt 1L",
            brand="Sütaş",
            store_id=1,
            store_name="Migros",
            store_sku="MIG-123",
            price=25.90,
            unit="adet"
        ),
        RawProductData(
            name="Sutasi Sut 1 Litre",
            brand="Sütaş",
            store_id=2,
            store_name="CarrefourSA",
            store_sku="CF-456",
            price=24.50,
            unit="adet"
        ),
    ]
    
    matcher = ScalableLLMProductMatcher()
    result = await matcher.process_multi_market_products(raw_products)
    
    print(f"\n✅ {len(result)} ürün işlendi")
    for product in result:
        print(f"  - {product.normalized_name} ({len(product.prices)} market)")


if __name__ == "__main__":
    asyncio.run(main())

