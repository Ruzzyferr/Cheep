"""
EAN-forwarding importer for foreign countries.
Scrape → bulk-upsert. No LLM matcher: the backend merges cross-store by EAN.
"""
import logging
import os
import re
import requests
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

CHUNK_SIZE = 900          # backend hard limit is 1000
# Ulke basina paket birimi: TR "adet", PL "szt"/"opak", HR "kom" (komad),
# HU "db" (darab). Listede OLMAYAN birim sessizce ulkenin default_unit'ine
# dusuruluyor -- yani "kom" eklenmezse her Hirvat urunu Turkce "adet" olurdu.
ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu", "szt", "opak",
                 "kom", "db"}


# Bu koşuda eşlenemeyen ham kategori adları → ürün sayısı (bkz.
# report_unmapped_categories). Süreç ömrü boyunca birikir.
UNMAPPED_CATEGORIES: Dict[str, int] = {}


def _resolve_prefix_slug(raw_cat: str, category_map: Dict[str, str]) -> Optional[str]:
    """Longest-prefix-wins lookup over `category_map` entries keyed
    `"prefix:<breadcrumb-prefix>"`. Used as a fallback when an exact
    `category_map[raw_cat]` lookup misses — lets one entry cover an entire
    breadcrumb subtree (e.g. thousands of Lidl PL category paths) instead of
    requiring one exact key per leaf. Returns None when no prefix key
    matches."""
    best_prefix = ""
    best_slug: Optional[str] = None
    for key, slug in category_map.items():
        if not key.startswith("prefix:"):
            continue
        prefix = key[len("prefix:"):]
        if prefix and raw_cat.startswith(prefix) and len(prefix) > len(best_prefix):
            best_prefix = prefix
            best_slug = slug
    return best_slug


def _slugify(name: str) -> str:
    """Deterministic slug for the store_sku fallback: lowercase, non-alphanumeric
    runs collapsed to a single '-', trimmed. Never returns an empty string."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        slug = f"h{abs(hash(name))}"
    return slug


def build_api_payloads(
    products: List[Dict],
    store_id: int,
    category_map: Optional[Dict[str, str]] = None,
    default_unit: str = "adet",
) -> List[Dict]:
    """Map scraped product dicts to backend bulk-upsert payloads.

    Forwards the scraped `barcode` to the backend field `ean_barcode`.
    `category_map` (raw category string -> canonical name) is optional; when a
    category can't be resolved the field is simply omitted (category is tertiary).
    `default_unit` can be per-country (e.g., "szt" for Poland).
    """
    payloads: List[Dict] = []
    for product in products:
        name = (product.get("name") or "").strip()
        if not name:
            IMPORT_COUNTERS["dropped_no_name"] = IMPORT_COUNTERS.get("dropped_no_name", 0) + 1
            continue
        # BOZUK FIYAT ARTIK SAYILIYOR.
        #
        # Eskiden `except: continue` sessizdi: kaynak fiyat bicimini
        # degistirirse (or. Biedronka GA4 yuku "4,99" ya da "4.99 zl" dondurmeye
        # baslarsa) urunlerin TAMAMI dusuyor, `products == []` oluyor, market
        # ozetten kayboluyor, saglik kapisi geciyor ve prune tetikleniyordu.
        # Bu zincirin hicbir adiminda TEK BIR SAYI kayda gecmiyordu.
        try:
            price = float(product.get("price", 0))
        except (TypeError, ValueError):
            IMPORT_COUNTERS["dropped_bad_price"] = IMPORT_COUNTERS.get("dropped_bad_price", 0) + 1
            continue
        if price <= 0:
            IMPORT_COUNTERS["dropped_nonpositive_price"] = IMPORT_COUNTERS.get("dropped_nonpositive_price", 0) + 1
            continue

        sku = product.get("sku") or product.get("store_sku") or f"{store_id}-{_slugify(name)[:48]}"
        unit = (product.get("unit") or default_unit).lower()
        if unit not in ALLOWED_UNITS:
            unit = default_unit
        if unit == "adet" and default_unit != "adet":
            # Türkçe fallback yabancı ülke satırına sızmasın (spec: sıfır 'adet' PL'de)
            unit = default_unit

        # Fiyat her zaman PAKET başına (raf fiyatı). g/ml/cl asla fiyat birimi olamaz;
        # kg/l ancak paket tam 1 kg/1 l ise fiyat birimiyle çakışır. Aksi halde paket
        # birimi (szt/adet) gönder — yoksa uygulama 200g tereyağını 'zł/kg' gibi gösterir.
        qty = product.get("quantity")
        if unit in ("g", "ml", "cl"):
            unit = default_unit
        elif unit in ("kg", "l") and qty is not None and float(qty) != 1.0:
            unit = default_unit

        payload: Dict = {
            "store_id": int(store_id),
            "store_sku": str(sku),
            "price": f"{price:.2f}",
            "unit": unit,
            "source": "scrape",
            "confidence_score": 1.0,
            "name": name,
        }
        barcode = product.get("barcode")
        merge_key = product.get("merge_key")
        if barcode and is_globally_unique_ean(barcode):
            payload["ean_barcode"] = str(barcode).strip()
        elif merge_key:
            # ACIK, GTIN OLMAYAN BIRLESTIRME ANAHTARI.
            #
            # Bazi ulkelerde barkod yok ama DEVLETIN kendi tuttugu, zincirler
            # arasi kanonik bir urun kimligi var (Romanya: Rekabet Konseyi'nin
            # `catprod.id` alani). Bu kimlik EAN degil -- kontrol hanesi
            # tutmaz, `is_globally_unique_ean` onu hakli olarak reddeder --
            # ama ULKE ICINDE tam olarak EAN'in isini gorur ve onu atmak,
            # elimizdeki en iyi eslestirme sinyalini bulanik isim
            # benzerligiyle degistirmek olurdu.
            #
            # `ean_barcode` alanina ONEKLI yaziliyor ("catprod:1016498"):
            # kimse onu GTIN sanmasin. Benzersizlik kisiti (country_id,
            # ean_barcode) ULKEYE KAPSAMLI oldugu icin baska bir ulkenin
            # gercek EAN'iyla carpisamaz. Ayni konvansiyon Turkiye'de
            # zaten kullaniliyor ("mf-" onekli marketfiyati anahtarlari).
            #
            # Scraper bu alani ancak kaynak GERCEKTEN kararli ve kanonik bir
            # kimlik veriyorsa doldurmali; kendi urettigi bir hash ASLA
            # buraya yazilmamali (o zaman zincirler arasi hicbir sey birlesmez
            # ama birlesmis gibi gorunur).
            payload["ean_barcode"] = str(merge_key).strip()
        elif barcode:
            # Dogrulanamayan barkod DUSURULUR (bkz. is_globally_unique_ean).
            # Urun yine ice aktarilir; yalnizca marketler-arasi birlestirmeye
            # girmez. Yanlis birlestirmektense birlestirmemek dogru.
            IMPORT_COUNTERS["dropped_barcodes"] = IMPORT_COUNTERS.get("dropped_barcodes", 0) + 1
        if product.get("brand"):
            payload["brand"] = str(product["brand"])
        image_url = product.get("image_url")
        if image_url and _is_clean_absolute_url(str(image_url)):
            payload["image_url"] = str(image_url)
        raw_cat = (product.get("raw_category") or product.get("category") or "").strip()
        if category_map and raw_cat:
            slug = category_map.get(raw_cat) or _resolve_prefix_slug(raw_cat, category_map)
            if slug:
                payload["category_slug"] = slug
            else:
                # SESSİZ KAYIP OLMASIN: eşlenmemiş kategori `category_slug`
                # göndermez, ürün KATEGORİSİZ kaydedilir ve hiçbir listede
                # görünmez. Eskiden bu hiçbir yere yazılmıyordu; kaynak yeni bir
                # kategori açtığında aylarca fark edilmiyordu.
                UNMAPPED_CATEGORIES[raw_cat] = UNMAPPED_CATEGORIES.get(raw_cat, 0) + 1
        payloads.append(payload)
    return payloads


def report_import_counters(logger=None) -> Dict[str, int]:
    """Bu kosumda SESSIZCE dusurulen satirlarin dokumu.

    Dusurmeler tek tek `continue` ile yapiliyor ve hicbiri gorunmuyordu.
    Kaynak fiyat bicimini degistirdiginde tum katalog dusebilir ve zincir
    "sifir urun" -> "ozetten kaybolma" -> "saglik kapisi gecer" -> "prune"
    seklinde ilerleyip VERI SILEBILIR. Sayilar en azindan kayda gecsin.
    """
    if IMPORT_COUNTERS and logger is not None:
        ozet = ", ".join(f"{k}={v}" for k, v in sorted(IMPORT_COUNTERS.items()))
        logger.warning("ICE AKTARIMDA DUSURULEN SATIRLAR: %s", ozet)
    return dict(IMPORT_COUNTERS)


def report_unmapped_categories(logger=None) -> Dict[str, int]:
    """Bu koşuda eşlenemeyen ham kategori adları → ürün sayısı.

    `category_map.json` elle yönetiliyor; kaynak yeni bir kategori açtığında
    buraya düşer. Günlük koşunun sonunda basılır ki eklenmesi gerektiği
    görünsün.
    """
    if UNMAPPED_CATEGORIES and logger is not None:
        total = sum(UNMAPPED_CATEGORIES.values())
        logger.warning(
            "EŞLENMEMİŞ KATEGORİ: %d farklı ad, %d ürün kategorisiz kaldı. "
            "category_map.json'a ekleyin:",
            len(UNMAPPED_CATEGORIES), total,
        )
        for name, n in sorted(UNMAPPED_CATEGORIES.items(), key=lambda kv: -kv[1])[:20]:
            logger.warning('    "%s": "",   # %d ürün', name, n)
    return dict(UNMAPPED_CATEGORIES)


# Kosum boyunca biriken sayaclar (sessiz kayiplari gorunur kilar).
IMPORT_COUNTERS: Dict[str, int] = {}


def is_globally_unique_ean(barcode) -> bool:
    """GS1 barkodu KURESEL OLARAK BENZERSIZ mi? (birlestirme anahtari olarak
    kullanilabilir mi?)

    NEDEN: barkod, urunleri marketler ARASINDA birlestiren anahtar. Scraper'lar
    `barcode_gtin` alanini hicbir dogrulama yapmadan aynen iletiyordu ve iki
    ayri sinif deger araya siziyordu:

    1) GS1 ONEKI 20-29 = MAGAZA-ICI / SINIRLI DOLASIM. Magazaya ozel, kuresel
       olarak benzersiz DEGIL ve degisken agirlikli sarkuteri urunlerinde
       haneler PAKET AGIRLIGINI kodluyor. Yakalanan Carrefour ornekleri:
       2020228700009, 2030269600008, 2030612100001 (Targ Swiezosci reyonu).
       Sonuc: ayni peynir ertesi gun yeniden tartilinca BASKA bir "EAN"
       uretiyor (her gece yeni urun satiri + bolunmus fiyat gecmisi), ya da
       baska bir zincirin magaza-ici numarasi ayni 13 haneye denk gelip
       ALAKASIZ iki urun tek "en ucuz" karsilastirmasinda birlesiyor.

    2) KONTROL HANESI TUTMAYAN barkodlar (or. 5900000000012). Bunlar ya yazim
       hatasi ya da uydurma; birlestirme anahtari olamazlar.

    Gecersizse barkod DUSURULUR, urun yine ice aktarilir (yalnizca
    marketler-arasi birlestirmeye girmez). Yanlis birlestirmektense
    birlestirmemek dogru.
    """
    if barcode is None:
        return False
    digits = str(barcode).strip()
    if not digits.isdigit():
        return False
    # GTIN-8 / GTIN-12 / GTIN-13 / GTIN-14 disindaki uzunluklar kabul edilmez.
    if len(digits) not in (8, 12, 13, 14):
        return False
    # GS1 oneki 02 ve 20-29: magaza-ici / sinirli dolasim.
    if len(digits) == 13 and (digits.startswith("02") or digits[:2] in
                              {"20", "21", "22", "23", "24", "25", "26", "27", "28", "29"}):
        return False
    # Kontrol hanesi (mod 10): sagdan sola 3,1,3,1... agirliklandirma.
    govde, kontrol = digits[:-1], int(digits[-1])
    toplam = 0
    for i, ch in enumerate(reversed(govde)):
        toplam += int(ch) * (3 if i % 2 == 0 else 1)
    return (10 - (toplam % 10)) % 10 == kontrol


def _is_clean_absolute_url(url: str) -> bool:
    """True only for a non-empty absolute http(s) URL with no unresolved
    placeholder braces or whitespace.

    The backend validates `image_url` with `Joi.string().uri({allowRelative:
    false})` and rejects the WHOLE bulk-upsert chunk (up to 900 items) if any
    single item fails validation — e.g. Migros CH's `{stack}` CDN size
    placeholder. Omitting a malformed image_url here (rather than sending it)
    means one bad URL can never take down an entire ingest chunk, regardless
    of which chain/scraper produced it.
    """
    if not url.startswith("http://") and not url.startswith("https://"):
        return False
    return not any(c in url for c in ("{", "}", " ", "\t", "\n", "\r"))


class ForeignImporter:
    """Posts EAN-forwarded payloads to the backend, chunked and country-scoped."""

    def __init__(self, api_url: str, country_code: str, api_key: Optional[str] = None):
        self.api_url = api_url.rstrip("/")
        self.country_code = country_code
        self.headers = {"x-country": country_code}
        key = api_key if api_key is not None else os.getenv("INGEST_API_KEY")
        if key:
            self.headers["x-api-key"] = key
        else:
            logger.warning(
                "INGEST_API_KEY not set — all ingest requests will 401 (no x-api-key header)"
            )

    def import_products(
        self,
        products: List[Dict],
        store_id: int,
        category_map: Optional[Dict[str, str]] = None,
        default_unit: str = "adet",
    ) -> Dict:
        payloads = build_api_payloads(products, store_id, category_map, default_unit)
        stats = {"total": 0, "successful": 0, "failed": 0}
        for i in range(0, len(payloads), CHUNK_SIZE):
            chunk = payloads[i:i + CHUNK_SIZE]
            stats["total"] += len(chunk)
            try:
                resp = requests.post(
                    f"{self.api_url}/store-prices/bulk-upsert",
                    json={"prices": chunk},
                    headers=self.headers,
                    timeout=120,
                )
                if not resp.ok:
                    logger.error("Ingest HTTP %s for store %s", resp.status_code, store_id)
                    stats["failed"] += len(chunk)
                    continue
                body = resp.json() if resp.content else {}
                ok = body.get("successful", body.get("success_count", len(chunk)))
                stats["successful"] += ok
                stats["failed"] += len(chunk) - ok
            except (requests.RequestException, ValueError) as e:
                # ValueError covers json.JSONDecodeError: an HTTP-200-but-malformed
                # body must not abort the whole loop — isolate the failure to this chunk.
                logger.error("Ingest failed for store %s: %s", store_id, e)
                stats["failed"] += len(chunk)
        return stats
