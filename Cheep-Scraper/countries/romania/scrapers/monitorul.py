"""ROMANYA — Consiliul Concurenței "Monitorul Prețurilor" fiyat API'si.

KAYNAK VE HUKUK: `monitorulpreturilor.info`, Romanya Rekabet Konseyi'nin
(Consiliul Concurenței — kamu kurumu) işlettiği resmî perakende fiyat izleme
portalı. Zincirler fiyatlarını buraya bildiriyor. Uç noktalar BELGELENMEMİŞ
ama tamamen açık: kimlik doğrulama yok, çerez yok, referer kontrolü yok,
`robots.txt` yok (HTTP 404), gözlemlenen hız sınırı yok. Kamu kurumu +
dinamik veri olduğu için AB Açık Veri Direktifi (2019/1024; RO'da Legea
179/2022) kapsamında yeniden kullanıma açık.

NEZAKET: eşzamanlılık sınırlı tutuluyor ve kendini tanıtan bir User-Agent
gönderiliyor. Kaynak kamu altyapısı; ölçülen tavan ~30 istek/sn olsa da
gerekli olan bunun çok altında.

NEDEN BU ÜLKEDE BARKOD YOK AMA EŞLEŞTİRME YİNE DE ÇALIŞIYOR:
API ürünlerde EAN vermiyor, ama her ürün `catprod.id` taşıyor — DEVLETİN
tuttuğu, ZİNCİRLER ARASI kanonik ürün kimliği. Aynı `catprod.id` Kaufland'da
da Auchan'da da aynı ürünü gösteriyor. Bu, barkodun ülke içindeki işlevini
birebir görüyor, o yüzden `merge_key` alanıyla ("catprod:<id>" öneğiyle)
iletiliyor — bkz. `countries/_common/foreign_import.py`. Öneki koymak şart:
kimse onu GTIN sanmasın. Benzersizlik kısıtı ülkeye kapsamlı olduğu için
başka bir ülkenin gerçek EAN'iyla çarpışamaz.

REFERANS MAĞAZA: API mağaza bazında çalışıyor (`GetProductsFromStore?
categid=&storeid=`). Şemamızda fiyat zincir başına tek satır olduğu için
Hırvatistan'daki ilkenin aynısı uygulanıyor: zincir başına GERÇEK bir referans
mağaza sabitleniyor ve onun gerçek raf fiyatları yayınlanıyor. Mağazalar
`countries/romania/config.json`'da açıkça yazılı; katalog büyüklüğü ölçülerek
seçildiler (bkz. discover_stores.py).

BİLİNEN TUZAKLAR (canlı doğrulandı 2026-08-29):
  • `GetStoresForProductsByLatLon` çağrısında `csvprodids` ZORUNLU — yoksa
    HTTP 404. Ayrıca sonuç 50 kayıtla SINIRLI ve `buffer=9000` boş `{}`
    döndürüyor (`buffer=5000` çalışıyor) — büyük yarıçap sessizce sıfır verir.
  • Kategori ağacında YALNIZCA yaprak id'leri ürün döndürür; ara/kök id'ler
    boş liste verir.
  • `retailnetwork.name` MAĞAZA adıdır ("CORA SUN PLAZA"), zincir adı değil;
    zincir kimliği `retailnetwork.id` ile `GetRetailNetworks`'ten çözülür.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set

import requests

from scrapers.units import parse_quantity_and_unit

logger = logging.getLogger(__name__)

BASE = "https://monitorulpreturilor.info/pmonsvc/Retail"
CATEGORIES_URL = f"{BASE}/GetProductCategoriesNetwork"
NETWORKS_URL = f"{BASE}/GetRetailNetworks"
PRODUCTS_URL = f"{BASE}/GetProductsFromStore"
STORES_BY_LATLON_URL = f"{BASE}/GetStoresForProductsByLatLon"

USER_AGENT = "cheep-scraper/1.0 (+https://cheep.live)"
HEADERS = {"Accept": "application/json", "User-Agent": USER_AGENT}

#: Kaynak kamu altyapısı — ölçülen tavan çok daha yüksek olsa da nazik davran.
MAX_WORKERS = 6

#: `GetStoresForProductsByLatLon` sonuçları 50 ile sınırlı ve büyük buffer
#: sessizce boş döner. 5000 m canlı doğrulandı.
STORE_QUERY_BUFFER_M = 5000
STORE_QUERY_LIMIT = 50


#: Kaynağın TLS zinciri EKSİK — kendi ara sertifikasını göndermiyor.
#:
#: Yaprak sertifikayı "Sectigo Public Server Authentication CA DV R36"
#: imzalamış, ama sunucu zincirde BAŞKA bir ara sertifika ("Sectigo RSA Domain
#: Validation Secure Server CA") sunuyor. Sonuç: `openssl s_client` bile
#: "unable to verify the first certificate (21)" diyor.
#:
#: NEDEN BU ÖNEMLİ: Windows ve curl eksik halkayı sertifikadaki AIA
#: adresinden KENDİLERİ indirip zinciri tamamlıyor, bu yüzden geliştirme
#: makinesinde her şey çalışıyor gibi görünüyor. `requests` (certifi) ve
#: üretimdeki Linux droplet bunu YAPMAZ — orada her istek
#: SSLCertVerificationError ile düşer ve ülke sessizce sıfır ürün verir.
#: Bu tuzak yerelde ASLA görünmez, yalnızca üretimde patlar.
#:
#: ÇÖZÜM: eksik ara sertifika depoya konuldu (AIA adresinden alındı:
#: http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt,
#: geçerlilik 2036-03-21) ve certifi paketiyle BİRLEŞTİRİLİP doğrulama
#: paketi olarak kullanılıyor. `verify=False` YAPILMADI — doğrulamayı kapatmak
#: ortadaki-adam saldırısına açık hale getirirdi; burada yapılan, eksik ama
#: MEŞRU halkayı tamamlamak.
_INTERMEDIATE_PEM = "sectigo_intermediate.pem"
_ca_bundle_cache: Optional[str] = None


def ca_bundle_path() -> str:
    """certifi + kaynağın eksik ara sertifikasından birleşik doğrulama paketi.

    Bir kez üretilip ülke klasörünün `cache/` dizinine yazılır.
    """
    global _ca_bundle_cache
    if _ca_bundle_cache:
        return _ca_bundle_cache
    import certifi

    country_dir = Path(__file__).resolve().parents[1]
    intermediate = country_dir / _INTERMEDIATE_PEM
    cache_dir = country_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    bundle = cache_dir / "ca-bundle.pem"

    if not intermediate.exists():
        # Ara sertifika yoksa certifi'ye düş: istek muhtemelen SSL hatasıyla
        # düşer ama SESSİZCE doğrulamasız devam etmekten iyidir.
        logger.error("eksik ara sertifika dosyası yok: %s — TLS doğrulaması başarısız olabilir",
                     intermediate)
        _ca_bundle_cache = certifi.where()
        return _ca_bundle_cache

    source = (
        Path(certifi.where()).read_text(encoding="utf-8").rstrip("\n")
        + "\n"
        + intermediate.read_text(encoding="utf-8")
    )
    if not bundle.exists() or bundle.read_text(encoding="utf-8") != source:
        bundle.write_text(source, encoding="utf-8")
    _ca_bundle_cache = str(bundle)
    return _ca_bundle_cache


@dataclass
class Product:
    name: str
    brand: Optional[str]
    price: float
    quantity: Optional[float]
    unit: Optional[str]
    barcode: Optional[str]
    merge_key: Optional[str]
    raw_category: Optional[str]
    sku: str

    def to_dict(self) -> Dict:
        return asdict(self)


# --------------------------------------------------------------- saf yardımcılar

def leaf_category_ids(payload: Dict) -> List[str]:
    """Yalnızca YAPRAK kategori id'lerini döner (SAF).

    Ara ve kök id'lerle sorgu atmak boş liste döndürüyor; hepsini denemek
    kaynağa gereksiz yük ve koşuyu iki katına çıkarma anlamına gelirdi.
    """
    items = payload.get("Items") or []
    parents: Set[Optional[str]] = {c.get("parentId") for c in items}
    return [c["id"] for c in items if c.get("id") and c["id"] not in parents]


def category_paths(payload: Dict) -> Dict[str, str]:
    """`{kategori_id: "ÜST/ALT/YAPRAK"}` (SAF).

    Tam yol kullanılıyor çünkü `category_map.json` `prefix:` anahtarlarıyla bir
    üst dalın tamamını tek satırda eşleyebiliyor; kaynak yeni bir yaprak
    eklediğinde ürün kategorisiz kalmıyor, dalın slug'ını devralıyor.
    """
    items = payload.get("Items") or []
    by_id = {c["id"]: c for c in items if c.get("id")}
    out: Dict[str, str] = {}
    for cid, node in by_id.items():
        parts = [str(node.get("name") or "").strip()]
        parent = node.get("parentId")
        seen = {cid}
        while parent and parent in by_id and parent not in seen:
            seen.add(parent)
            parts.append(str(by_id[parent].get("name") or "").strip())
            parent = by_id[parent].get("parentId")
        out[cid] = "/".join(reversed([p for p in parts if p]))
    return out


def parse_products(
    payload: Dict,
    raw_category: Optional[str] = None,
) -> List[Product]:
    """Bir kategori yanıtını Product'lara çevirir (SAF)."""
    out: List[Product] = []
    for item in payload.get("Items") or []:
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        try:
            price = float(item.get("price"))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue

        catprod = item.get("catprod") or {}
        catprod_id = str(catprod.get("id") or "").strip()

        # Gramaj: API ayrı bir boyut alanı vermiyor ("unit" yalnızca
        # "BUCATI"/"KG" gibi bir ölçü TÜRÜ). Boyut ürün adının içinde
        # ("LAPTE ZUZU 1.5% 1L"), o yüzden addan ayrıştırılıyor — çoklu
        # paketleri doğru okuyan ortak ayrıştırıcıyla.
        qty, unit = parse_quantity_and_unit(name)

        out.append(Product(
            name=name,
            brand=(str(item.get("brand") or "").strip() or None),
            price=price,
            quantity=qty,
            unit=unit,
            # Kaynak EAN vermiyor — uydurma yok.
            barcode=None,
            # Devletin kanonik, zincirler-arası ürün kimliği. Bu ülkede
            # barkodun işlevini görür (bkz. modül docstring'i).
            merge_key=f"catprod:{catprod_id}" if catprod_id else None,
            raw_category=raw_category,
            # Mağaza içi ürün id'si; zincir başına tek referans mağaza
            # olduğu için store_sku olarak doğrudan kullanılabilir.
            sku=str(item.get("id") or f"{catprod_id or name[:40]}"),
        ))
    return out


def dedupe_by_sku(products: Iterable[Product]) -> List[Product]:
    """Aynı ürün birden çok kategoride görünebiliyor; ilk görülen kazanır (SAF)."""
    seen: Set[str] = set()
    out: List[Product] = []
    for p in products:
        if p.sku in seen:
            continue
        seen.add(p.sku)
        out.append(p)
    return out


# ------------------------------------------------------------------ scraper tabanı

class MonitorulChainScraper:
    """Bir Romen zincirinin referans mağazasından okunan fiyatlar.

    Alt sınıflar `store_id_ro` (Monitorul'ün mağaza kimliği) ve `label` tanımlar.
    """

    store_id_ro: str = ""
    label: str = ""

    def __init__(self, session: Optional[requests.Session] = None, max_workers: int = MAX_WORKERS):
        if not self.store_id_ro:
            raise ValueError(f"{type(self).__name__}: `store_id_ro` tanımlanmalı")
        self.session = session or requests.Session()
        self.session.headers.update(HEADERS)
        # Kaynağın TLS zinciri eksik; birleşik paketle doğrula (bkz. ca_bundle_path).
        self.session.verify = ca_bundle_path()
        self.max_workers = max_workers

    def _get(self, url: str) -> Dict:
        resp = self.session.get(url, timeout=90)
        resp.raise_for_status()
        return resp.json()

    def fetch_products(self) -> List[Dict]:
        tree = self._get(CATEGORIES_URL)
        leaves = leaf_category_ids(tree)
        paths = category_paths(tree)
        if not leaves:
            raise ValueError("Monitorul kategori ağacı boş döndü — şema değişmiş olabilir")

        def one(cat_id: str) -> List[Product]:
            url = f"{PRODUCTS_URL}?categid={cat_id}&storeid={self.store_id_ro}"
            try:
                return parse_products(self._get(url), paths.get(cat_id))
            except (requests.RequestException, ValueError) as e:
                # Tek bir ölü/yeniden adlandırılmış kategori TÜM koşuyu
                # düşürmesin; kayıp görünür olsun diye loglanıyor.
                logger.warning("%s kategori %s alınamadı: %s", self.label, cat_id, str(e)[:120])
                return []

        collected: List[Product] = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            for chunk in pool.map(one, leaves):
                collected.extend(chunk)

        products = dedupe_by_sku(collected)
        with_key = sum(1 for p in products if p.merge_key)
        logger.info("%s (mağaza %s): %d ürün, %d kategori, %%%.1f kanonik kimlik",
                    self.label, self.store_id_ro, len(products), len(leaves),
                    (with_key / len(products) * 100) if products else 0.0)
        if not products:
            raise ValueError(
                f"{self.label}: referans mağaza {self.store_id_ro} sıfır ürün döndürdü "
                "— mağaza kapanmış ya da id değişmiş olabilir"
            )
        return [p.to_dict() for p in products]


class AuchanRoScraper(MonitorulChainScraper):
    store_id_ro, label = "2528", "Auchan"          # AUCHAN COTROCENI, Bükreş


class CarrefourRoScraper(MonitorulChainScraper):
    store_id_ro, label = "540", "Carrefour"        # CARREFOUR VULCAN, Bükreş


class KauflandRoScraper(MonitorulChainScraper):
    store_id_ro, label = "1408", "Kaufland"        # Mihai Bravu, Bükreş


class MegaImageRoScraper(MonitorulChainScraper):
    store_id_ro, label = "9940", "Mega Image"      # MI HERCULANE, Cluj


class LidlRoScraper(MonitorulChainScraper):
    store_id_ro, label = "3230", "Lidl"


class PennyRoScraper(MonitorulChainScraper):
    store_id_ro, label = "6358", "Penny"           # Str. 23 August, Bükreş


class ProfiRoScraper(MonitorulChainScraper):
    store_id_ro, label = "5227", "Profi"           # BUCURESTI LIBERTATII


class CoraRoScraper(MonitorulChainScraper):
    store_id_ro, label = "2508", "Cora"            # SUN PLAZA, Bükreş


class SupecoRoScraper(MonitorulChainScraper):
    store_id_ro, label = "7271", "Supeco"          # Constanța
