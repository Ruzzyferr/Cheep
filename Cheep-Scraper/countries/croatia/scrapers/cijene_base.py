"""HIRVATİSTAN — `cijene.dev` günlük arşivinden zincir bazlı fiyat okuyucu.

KAYNAK VE HUKUK: Hırvatistan'da NN 75/2025 (2 Mayıs 2025) kararıyla her
perakendeci, HER MAĞAZASI için günlük fiyat listesini makine-okunur biçimde
YAYINLAMAK ZORUNDA. `cijene.dev` bu dağınık yayınları toplayıp tek bir günlük
ZIP arşivinde birleştiriyor (kaynak kodu açık: github.com/senko/cijene-api,
kullanım şartları §4 verinin uygulamalarda serbestçe kullanılabileceğini
açıkça söylüyor). Yani bu ülke için scrape ETMİYORUZ — devlet zorunluluğuyla
yayınlanmış veriyi okuyoruz. Almanya'yı batıran "teslimat platformu fiyatı raf
fiyatının %12,5 üstünde" sorunu burada YOK: bunlar tanımı gereği raf fiyatları.

ARŞİV YAPISI (2026-08-28 itibarıyla doğrulandı, 26 zincir / 105 dosya):
    <zincir>/stores.csv    store_id,type,address,city,zipcode
    <zincir>/products.csv  product_id,barcode,name,brand,category,unit,quantity
    <zincir>/prices.csv    store_id,product_id,price,unit_price,best_price_30,
                           anchor_price,special_price
Tümü UTF-8, BOM'suz, virgül ayraçlı.

NEDEN ZİNCİR BAŞINA AYRI SCRAPER: tek arşiv 26 zinciri birden içeriyor ama
mimarideki `store_id` market başına atanıyor. Zincir başına bir market girdisi
tutmak, `should_import` çöküş kapısının, kategori süzgecinin ve haftalık
rotasyonun zincir bazında çalışmaya devam etmesini sağlıyor. Arşiv ise
`daily_artifact` sayesinde gün başına YALNIZCA BİR KEZ indiriliyor — yoksa
beş zincir aynı 81 MB'ı beş kez indirirdi ve arşiv koşu ortasında güncellenirse
zincirler FARKLI günlerin fiyatlarını karıştırırdı.

REFERANS MAĞAZA — bu dosyadaki en önemli karar:
Arşiv mağaza bazında fiyat veriyor ve bu fiyatlar zincir içinde GERÇEKTEN
değişiyor. Ölçüldü (2026-08-28): ürünlerin tek-fiyatlı olma oranı Lidl %98,4,
Kaufland %97,0 ama Konzum yalnızca %26,5, Plodine %47,0. Yani Konzum için
"zincirin fiyatı" diye tek bir sayı YOKTUR.

Şemamızda `StorePrice` (store, product) çiftine bağlı — mağaza bazlı fiyat
şema değişikliği gerektirir. Ortalama/medyan almak ise UYDURMA bir sayı üretir:
kullanıcı mağazaya gidip o fiyatı göremez. Bu yüzden zincir başına GERÇEK bir
referans mağaza seçiyoruz ve o mağazanın gerçek raf fiyatlarını yayınlıyoruz —
Polonya'daki "sabitlenmiş Wolt venue" modelinin aynısı. Seçim `pick_reference_store`
ile deterministik: en geniş kataloglu mağaza (kullanıcıya en çok ürün gösterir),
eşitlikte tercih edilen şehir, sonra store_id — böylece aynı arşiv her koşuda
aynı mağazayı seçer ve fiyat geçmişi mağaza değiştirdiği için sahte sıçrama
yapmaz.
"""
from __future__ import annotations

import csv
import io
import logging
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import requests

from countries._common.daily_artifact import fetch_daily
from scrapers.units import parse_quantity_and_unit

logger = logging.getLogger(__name__)

LIST_URL = "https://api.cijene.dev/v0/list"
ARCHIVE_NAME = "cijene.zip"

#: Referans mağaza seçiminde eşitlik bozucu şehir sırası. Zagreb ülkenin en
#: büyük pazarı; oradaki bir mağaza kullanıcıların çoğunluğu için anlamlı.
CITY_PREFERENCE = ("Zagreb", "Split", "Rijeka", "Osijek")

#: `cijene.dev` EAN yoksa barkod alanına "<zincir>:<product_id>" yazıyor.
#: Bu bir GTIN değil; birleştirme anahtarı olarak kullanılamaz (bkz.
#: foreign_import.is_globally_unique_ean) ve barkod olarak İLETİLMEZ.
_SYNTHETIC_BARCODE_MARK = ":"


@dataclass
class Product:
    name: str
    brand: Optional[str]
    price: float
    quantity: Optional[float]
    unit: Optional[str]
    barcode: Optional[str]
    raw_category: Optional[str]
    sku: str
    image_url: Optional[str] = None

    def to_dict(self) -> Dict:
        return asdict(self)


# --------------------------------------------------------------- saf yardımcılar

def latest_archive_url(payload: Dict) -> Tuple[str, str]:
    """`/v0/list` yanıtından EN YENİ arşivin (url, tarih) çiftini döner (SAF).

    Listenin sırasına GÜVENMİYORUZ — kaynak sırayı değiştirirse sessizce eski
    bir günü indirmek, fiyatların donduğunu gizleyen tam da o sessiz arıza
    sınıfıdır. Tarihe göre açıkça en büyüğü seçiliyor.
    """
    archives = payload.get("archives") or []
    if not archives:
        raise ValueError("cijene.dev /v0/list boş 'archives' döndürdü")
    newest = max(archives, key=lambda a: a.get("date", ""))
    url = newest.get("url")
    if not url:
        raise ValueError(f"arşiv kaydında url yok: {newest!r}")
    return url, newest.get("date", "")


def pick_reference_store(
    price_row_counts: Dict[str, int],
    stores: Dict[str, Dict[str, str]],
    city_preference: Iterable[str] = CITY_PREFERENCE,
) -> Optional[str]:
    """Zincirin referans mağazasını DETERMİNİSTİK olarak seçer (SAF).

    Sıra: (1) en çok ürünü olan mağaza, (2) eşitlikte tercih edilen şehir,
    (3) yine eşitlikte en küçük store_id. Determinizm şart: seçim koşudan
    koşuya oynarsa aynı ürünün fiyatı mağaza değiştiği için sıçrar ve fiyat
    geçmişi ile düşüş bildirimleri yalan söyler.
    """
    if not price_row_counts:
        return None
    prefs = list(city_preference)

    def rank(store_id: str) -> Tuple[int, int, str]:
        city = (stores.get(store_id, {}).get("city") or "").strip()
        try:
            city_rank = prefs.index(city)
        except ValueError:
            city_rank = len(prefs)
        # Negatif sayı: büyük katalog önce gelsin (min ile seçiyoruz).
        return (-price_row_counts[store_id], city_rank, store_id)

    return min(price_row_counts, key=rank)


def clean_barcode(raw: Optional[str]) -> Optional[str]:
    """Sentetik "<zincir>:<id>" barkodunu DÜŞÜRÜR, gerçek EAN'ı geçirir (SAF).

    Sentetik kod zincire özeldir; onu barkod diye iletmek iki farklı zincirin
    alakasız ürünlerini aynı ürün sanıp fiyatlarını birleştirebilir.
    """
    if not raw:
        return None
    value = raw.strip()
    if not value or _SYNTHETIC_BARCODE_MARK in value or not value.isdigit():
        return None
    return value


def parse_quantity_field(quantity: str, name: str) -> Tuple[Optional[float], Optional[str]]:
    """`products.csv`'deki `quantity` alanını ("0.20 kg") miktar+birime çevirir.

    Alan boş ya da anlamsızsa ÜRÜN ADINDAN ayrıştırmaya düşer — çoklu paketleri
    ad üzerinden doğru okuyan ortak `parse_quantity_and_unit` kullanılır
    (Polonya'da `unit_info`'nun çoklu paketi eksik saydığı, "2x75 g"ı 75 g
    gösterdiği tuzağın aynısı burada da geçerli).
    """
    field = (quantity or "").strip()
    if field:
        qty, unit = parse_quantity_and_unit(field)
        if qty is not None and unit not in (None, "adet"):
            return qty, unit
    return parse_quantity_and_unit(name or "")


def read_csv_rows(archive: zipfile.ZipFile, member: str) -> List[Dict[str, str]]:
    """Arşiv içindeki bir CSV'yi sözlük satırları olarak okur."""
    with archive.open(member) as fh:
        return list(csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8")))


def build_products(
    products: Iterable[Dict[str, str]],
    prices: Dict[str, Dict[str, str]],
    classifier=None,
) -> List[Product]:
    """Ürün kataloğu + referans mağazanın fiyatlarını Product'lara birleştirir (SAF).

    Referans mağazada FİYATI OLMAYAN ürün atlanır: katalogda duran ama o
    mağazada satılmayan ürünü fiyatsız yayınlamak kullanıcıya olmayan bir raf
    gösterir.
    """
    out: List[Product] = []
    for row in products:
        pid = (row.get("product_id") or "").strip()
        price_row = prices.get(pid)
        if not price_row:
            continue
        # `special_price` (indirimli) varsa RAFTA ÖDENEN fiyat odur.
        raw_price = (price_row.get("special_price") or "").strip() or (price_row.get("price") or "").strip()
        try:
            price = float(raw_price.replace(",", "."))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue

        name = (row.get("name") or "").strip()
        if not name:
            continue
        qty, unit = parse_quantity_field(row.get("quantity", ""), name)
        brand = (row.get("brand") or "").strip() or None
        coarse = (row.get("category") or "").strip()
        raw_category = classifier(name, coarse) if classifier else (coarse or None)

        out.append(Product(
            name=name,
            brand=brand,
            price=price,
            quantity=qty,
            unit=unit,
            barcode=clean_barcode(row.get("barcode")),
            raw_category=raw_category,
            sku=pid,
        ))
    return out


# ------------------------------------------------------------------ scraper tabanı

class CijeneChainScraper:
    """Bir Hırvat zincirinin günlük arşivden okunan fiyatları.

    Alt sınıflar yalnızca `chain` (arşivdeki klasör adı) tanımlar; istenirse
    `classifier` ile ada dayalı kategori türetici verilir.
    """

    chain: str = ""
    classifier = None

    def __init__(self, cache_dir: Optional[Path] = None, session: Optional[requests.Session] = None):
        if not self.chain:
            raise ValueError(f"{type(self).__name__}: `chain` tanımlanmalı")
        self.cache_dir = Path(cache_dir or Path(__file__).resolve().parents[1] / "cache")
        self.session = session or requests.Session()
        self.reference_store: Optional[str] = None

    # -- ağ ------------------------------------------------------------------

    def _archive_path(self) -> Path:
        resp = self.session.get(LIST_URL, timeout=60,
                                headers={"User-Agent": "cheep-scraper/1.0 (+https://cheep.live)"})
        resp.raise_for_status()
        url, day = latest_archive_url(resp.json())
        logger.info("HR arşivi: %s (%s)", url, day)
        # min_bytes: sağlıklı arşiv ~75-82 MB. 10 MB altı, kaynağın 200 ile
        # kısa bir hata gövdesi döndürdüğü anlamına gelir — önbelleğe yazılmaz.
        return fetch_daily(url, self.cache_dir, ARCHIVE_NAME,
                           session=self.session, min_bytes=10 * 1024 * 1024)

    # -- ana giriş ------------------------------------------------------------

    def fetch_products(self) -> List[Dict]:
        path = self._archive_path()
        with zipfile.ZipFile(path) as archive:
            members = set(archive.namelist())
            needed = [f"{self.chain}/{f}.csv" for f in ("stores", "products", "prices")]
            missing = [m for m in needed if m not in members]
            if missing:
                # KAYNAK BU ZİNCİRİ BUGÜN YAYINLAMAMIŞ — bu bir hata DEĞİL,
                # yukarı akıştaki normal bir değişkenlik. Gözlendi: 2026-08-28
                # arşivinde 26 zincir vardı, 2026-08-29'da 22 (konzum, dm,
                # roto, branka, lorenco yoktu). Perakendeci o gün yayınını
                # geciktirdiğinde ya da atladığında oluyor.
                #
                # Yine de AÇIK HATA fırlatılıyor, sessiz boş liste değil:
                # sessiz sıfır, pipeline'ın çöküş kapısını atlatıp prune'u
                # tetikler ve 21 günlük TTL sonunda o zincirin TÜM kataloğu
                # silinir. Hata sayesinde koşum "sağlıksız" işaretleniyor,
                # prune ÇALIŞMIYOR ve mevcut fiyatlar olduğu gibi kalıyor —
                # ertesi gün zincir geri geldiğinde kendiliğinden tazeleniyor.
                available = sorted({n.split("/")[0] for n in members if "/" in n})
                raise KeyError(
                    f"{self.chain}: bugünkü arşivde YOK (kaynak yayınlamamış). "
                    f"Arşivdeki zincirler: {available}"
                )

            stores = {r["store_id"]: r for r in read_csv_rows(archive, f"{self.chain}/stores.csv")}

            # prices.csv İKİ KEZ OKUNUYOR — bilerek.
            #
            # Bu döngü eskiden TEK geçişte tüm mağazaların fiyatlarını
            # `{mağaza: {ürün: satır}}` sözlüğüne dolduruyor, sonra yalnızca
            # BİR mağazanınkini kullanıyordu. Konzum'un prices.csv'si 1,75
            # MİLYON satır (Plodine 2,05 milyon): ölçülen tepe bellek TEK
            # ZİNCİR için **923 MB**. Üretim droplet'i 1 vCPU / 2 GB ve
            # üzerinde Postgres + Node + Caddy çalışıyor — bu, gecenin
            # ortasında OOM ile ölen bir koşu demekti (ve OOM'la ölen koşu
            # hiçbir özet üretmez, yani sessizdir).
            #
            # İlk geçiş yalnızca mağaza başına SAYAÇ tutuyor (birkaç yüz
            # tamsayı), referans mağaza seçildikten sonra ikinci geçiş yalnızca
            # O MAĞAZANIN satırlarını alıyor. Zip yerel dosya, ikinci okuma
            # ucuz; bellek 1,75 milyon satırdan ~19 bine iniyor.
            # İlk geçiş `csv.reader` kullanıyor, `DictReader` DEĞİL: burada
            # yalnızca İLK SÜTUN (store_id) gerekiyor ve satır başına bir sözlük
            # kurmak 1,75 milyon satırda ölçülebilir zaman yiyor.
            counts: Dict[str, int] = {}
            with archive.open(f"{self.chain}/prices.csv") as fh:
                reader = csv.reader(io.TextIOWrapper(fh, encoding="utf-8"))
                next(reader, None)   # başlık
                for row in reader:
                    if row:
                        counts[row[0]] = counts.get(row[0], 0) + 1

            ref = pick_reference_store(counts, stores)
            if ref is None:
                raise ValueError(f"{self.chain}: fiyat satırı yok, referans mağaza seçilemedi")
            self.reference_store = ref
            store_meta = stores.get(ref, {})
            logger.info("%s referans mağaza=%s (%s, %s) katalog=%d",
                        self.chain, ref, store_meta.get("address", "?"),
                        store_meta.get("city", "?"), counts[ref])

            # İkinci geçiş de `csv.reader` ile: satırların çok büyük çoğunluğu
            # başka mağazalara ait ve onlar için sözlük kurmak boşa iş.
            # Yalnızca eşleşen satır sözlüğe çevriliyor.
            reference_prices: Dict[str, Dict[str, str]] = {}
            with archive.open(f"{self.chain}/prices.csv") as fh:
                reader = csv.reader(io.TextIOWrapper(fh, encoding="utf-8"))
                header = next(reader, None) or []
                for row in reader:
                    if row and row[0] == ref:
                        reference_prices[row[1]] = dict(zip(header, row))

            products = read_csv_rows(archive, f"{self.chain}/products.csv")

        built = build_products(products, reference_prices, self.classifier)
        logger.info("%s: %d ürün (katalog %d)", self.chain, len(built), len(products))
        return [p.to_dict() for p in built]
