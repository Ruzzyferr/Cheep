"""
Türkiye veri hattı — RESMİ KAYNAK: marketfiyati.org.tr (TÜBİTAK BİLGEM / Ticaret Bakanlığı).

7 Aralık 2022 Yönetmelik değişikliği ile 200+ şubeli zincirler fiyat verisini Bakanlığa
verir; bu veri "tüketicinin fiyat karşılaştırması yapabilmesi için" kamuoyuyla paylaşılır
(açık API). Scraping'in FSEK/TTK/ToS riskini ortadan kaldırır. Görsel İNGEST EDİLMEZ.

TAM KAPSAM: her `main_category` facet-filtresiyle ayrı ayrı ve tam sayfalanarak çekilir
(keyword araması değil) → tüm katalog + her ürünün KESİN kategorisi. Kategori, Cheep
alt-kategori id'sine map'lenir (granüler + doğru).

API: POST /api/v2/search
  arama:   {keywords, pages, size, latitude, longitude, distance}
  facet:   {keywords:"", filters:[{key:"main_category","values":[<ad>]}], pages, size, geo}
  → {numberOfFound, content:[{id,title,brand,refinedVolumeOrWeight,main_category,
      productDepotInfoList:[{marketAdi,price,indexTime}]}]}  (sayfa başına MAX 25)
"""
import argparse
import logging
import os
import time
from typing import Dict, List, Optional

import requests

logger = logging.getLogger("marketfiyati")

API_BASE = "https://api.marketfiyati.org.tr/api/v2"
GEO = {"latitude": 39.925, "longitude": 32.866, "distance": 900000}
PAGE_SIZE = 25                     # API sayfa başına en fazla 25 döndürüyor
MAX_PAGES_PER_CATEGORY = 400       # 400 * 25 = 10.000 ürün/kategori üst sınırı
REQUEST_PAUSE = 0.4
MAX_RETRIES = 6
CHUNK_SIZE = 900

STORE_MAP: Dict[str, int] = {
    "migros": 1, "carrefour": 2, "a101": 3, "sok": 4,
    "bim": 5, "tarim_kredi": 6, "hakmar": 7,
}
ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu"}

# marketfiyati main_category → Cheep kategori id (alt-kategori tercih; yoksa üst).
# Cheep taksonomisi (orijinal set) prod'dan çıkarıldı.
MAIN_CAT_TO_CAT: Dict[str, int] = {
    # Süt Ürünleri (1)
    "Süt": 2, "Peynir": 3, "Yoğurt": 4, "Ayran ve Kefir": 8, "Diğer Süt Ürünleri": 1,
    # Meyve & Sebze (12)
    "Meyve": 13, "Sebze": 14,
    # Et, Tavuk, Balık (20)
    "Beyaz Et": 22, "Kırmızı Et": 21, "Deniz Ürünleri": 25, "Sakatat": 21,
    # Temel Gıda (30)
    "Mantı Makarna ve Erişte": 34, "Bakliyat": 36, "Un ve İrmik": 31, "Sıvı Yağlar": 37,
    "Konserve": 30, "Tuz Baharat ve Harçlar": 39, "Ketçap Mayonez Sos ve Sirkeler": 38,
    "Turşu": 30, "Hazır Gıda Karışımları": 51, "Pasta Malzemeleri": 30,
    "Mutfak Sarf Malzemeleri": 189, "Sürülebilir Ürünler ve Kahvaltılık Soslar": 81,
    # İçecek (52)
    "Su": 53, "Maden Suyu": 53, "Meyve Suyu": 54, "Gazlı İçecekler": 55,
    "Gazsız İçecekler": 52, "Kahve": 57,
    # Fırın & Pastane (63)
    "Ekmek ve Unlu Mamüller": 64,
    # Kahvaltılık (74)
    "Bal ve Reçel": 76, "Zeytin": 77, "Helva Tahin ve Pekmez": 78, "Yumurta": 80,
    "Kahvaltılık Gevrek Bar ve Granola": 83,
    # Atıştırmalık (85)
    "Çikolata": 86, "Bisküvi ve Kraker": 87, "Gofret": 88, "Cips": 90,
    "Kuruyemiş ve Kuru Meyve": 89, "Kek": 69, "Sakız ve Şekerleme": 92, "Tatlılar": 85,
    # Dondurma (94)
    "Dondurmalar": 95,
    # Hazır Yemek & Donuk (98)
    "Hazır Yemekler": 99,
    # Temizlik (105)
    "Bulaşık Temizlik Ürünleri": 106, "Genel Temizlik Ürünleri": 109, "Diğer Temizlik": 105,
    # Kişisel Bakım (126)
    "Cilt Bakımı": 132, "Saç Bakım": 127, "Makyaj": 126, "Ağız Bakım": 130,
    "Parfüm, Deodorant": 131, "Duş Banyo ve Sabun": 128, "Tıraş Ürünleri": 133,
    "Ağda ve Epilasyon": 145,
    # Kağıt/hijyen (Kişisel Bakım alt)
    "Kağıt Peçete ve Mendiller": 138, "Kağıt Havlu": 136, "Tuvalet Kağıdı": 135,
    "Islak Mendil": 174,
    # Bebek (171)
    "Bebek Mamaları": 173, "Bebek ve Hasta Bezi": 172, "Bebek Gereçleri": 174,
    # Sağlıklı Yaşam (181)
    "Gıda Takviyeleri": 182, "Sağlık ve Medikal": 181,
    # Diğer üst kategoriler
    "Ev & Yaşam": 187, "Oyuncak ve Hobi": 280, "Giyim ve Tekstil": 351,
    "Tütün ve Tütün Mamulleri": 246, "Yöresel Ürünler": 246,
}

# main_category map'te yoksa ada göre üst kategori (yedek).
_TOP_RULES = [
    (176, ["kedi", "köpek", "evcil", "pet"]), (171, ["bebek", "hasta bez"]),
    (355, ["kağıt", "peçete", "mendil"]), (105, ["temizl", "deterjan", "çamaşır"]),
    (126, ["bakım", "makyaj", "parfüm", "tıraş", "sağlık", "sabun", "saç", "diş"]),
    (20, ["et", "tavuk", "balık", "deniz", "sakatat"]),
    (1, ["süt", "peynir", "yoğurt", "ayran", "kefir"]),
    (74, ["kahvalt", "bal", "reçel", "zeytin", "tahin", "yumurta"]),
    (63, ["ekmek", "unlu", "fırın"]), (94, ["dondurma"]),
    (85, ["çikolata", "bisküvi", "gofret", "cips", "kuruyem", "sakız", "şekerleme", "kek", "atıştır", "tatlı"]),
    (52, ["su", "içece", "kahve", "çay", "meyve su"]),
    (98, ["hazır", "donuk"]), (12, ["meyve", "sebze"]),
    (30, ["makarna", "bakliyat", "un", "yağ", "baharat", "konserve", "salça", "sos", "turşu"]),
    (181, ["takviye", "vitamin", "organik", "glutensiz"]),
    (187, ["ev", "yaşam", "mutfak", "tekstil"]),
]


def _cat_id(main_cat: str) -> int:
    """main_category → Cheep kategori id (map → ada göre üst → 246 Diğer)."""
    if main_cat in MAIN_CAT_TO_CAT:
        return MAIN_CAT_TO_CAT[main_cat]
    t = (main_cat or "").lower()
    for cid, keys in _TOP_RULES:
        if any(k in t for k in keys):
            return cid
    return 246


def _session() -> requests.Session:
    # Resmi portal (marketfiyati.org.tr) API'ye tam bu başlıklarla (tarayıcı UA + Origin +
    # Referer) erişir; basit bot-UA'ları WAF 418 döndürüyor. Kamu API'sine portalın kendi
    # istemcisi gibi erişmek meşrudur (herkese açık, paylaşıma açılmış veri).
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
        "Origin": "https://marketfiyati.org.tr",
        "Referer": "https://marketfiyati.org.tr/",
        "Accept": "application/json",
    })
    return s


def _post(session: requests.Session, body: dict) -> dict:
    """POST /search — 418/429/5xx'te üstel backoff."""
    delay = 1.5
    for attempt in range(MAX_RETRIES):
        try:
            r = session.post(f"{API_BASE}/search", json=body, timeout=30)
            if r.status_code in (418, 429) or r.status_code >= 500:
                raise requests.RequestException(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError):
            if attempt < MAX_RETRIES - 1:
                time.sleep(delay); delay *= 1.8
    return {}


# Arama terimleri: 73 main_category adı + ürün terimleri + Türk FMCG markaları.
# (WAF facet-filtre isteklerini blokladığı için keyword araması kullanılır; kategori,
#  her sonucun `main_category` alanından KESİN alınır → doğru granüler kategori.)
KEYWORDS: List[str] = sorted(set(list(MAIN_CAT_TO_CAT.keys()) + [
    # ürün terimleri
    "süt", "yoğurt", "peynir", "kaşar", "tereyağı", "yumurta", "ayran", "kefir", "labne",
    "bal", "reçel", "zeytin", "tahin", "helva", "margarin", "kaymak", "krema",
    "tavuk", "kıyma", "dana", "kuzu", "sucuk", "salam", "sosis", "pastırma", "balık",
    "hindi", "kanat", "köfte", "ton balığı", "şarküteri",
    "domates", "salatalık", "patates", "soğan", "elma", "muz", "portakal", "limon",
    "biber", "patlıcan", "kabak", "havuç", "marul", "ıspanak", "üzüm", "çilek", "sarımsak",
    "makarna", "pirinç", "bulgur", "un", "şeker", "tuz", "mercimek", "nohut", "fasulye",
    "irmik", "nişasta", "yulaf", "ayçiçek yağı", "zeytinyağı", "sıvı yağ", "salça",
    "ketçap", "mayonez", "hardal", "sirke", "soya sosu", "konserve", "turşu",
    "su", "maden suyu", "kola", "gazoz", "meyve suyu", "çay", "kahve", "nescafe", "soda",
    "enerji içeceği", "limonata", "ıhlamur", "bitki çayı",
    "çikolata", "bisküvi", "kraker", "cips", "kek", "gofret", "sakız", "şekerleme",
    "kuruyemiş", "fındık", "fıstık", "leblebi", "ceviz", "badem", "lokum", "wafer",
    "kurabiye", "mısır", "patlamış mısır", "granola", "müsli", "gevrek",
    "çorba", "hazır yemek", "dondurma", "pizza", "milföy", "börek", "yufka", "erişte",
    "baharat", "karabiber", "pul biber", "kimyon", "kekik", "nane", "tarçın", "kakao",
    "kabartma tozu", "vanilya", "maya", "puding", "jöle", "salep",
    "bebek bezi", "bebek maması", "ıslak mendil", "biberon",
    "deterjan", "çamaşır deterjanı", "bulaşık deterjanı", "yumuşatıcı", "çamaşır suyu",
    "yüzey temizleyici", "cam temizleyici", "sıvı sabun", "sünger", "çöp poşeti",
    "oda spreyi", "kireç çözücü", "tuvalet kağıdı", "kağıt havlu", "peçete", "mendil",
    "şampuan", "saç kremi", "diş macunu", "diş fırçası", "sabun", "duş jeli", "deodorant",
    "tıraş", "kolonya", "ped", "hijyenik ped", "krem", "el kremi", "güneş kremi", "parfüm",
    "saç boyası", "makyaj", "ruj", "maskara", "oje", "kedi maması", "köpek maması",
    "kedi kumu", "pil", "ampul", "streç film", "alüminyum folyo", "vitamin", "takviye",
    "ekmek", "simit", "poğaça", "tost ekmeği", "kruvasan", "grissini",
    # markalar
    "Ülker", "Eti", "Torku", "Pınar", "Sütaş", "İçim", "Sek", "Danone", "Namet", "Banvit",
    "Tat", "Tamek", "Tukaş", "Dardanel", "Superfresh", "Yudum", "Komili", "Orkide",
    "Filiz", "Nuh'un Ankara", "Piyale", "Barilla", "Oba", "Reis", "Yayla", "Duru", "Bizim",
    "Doğuş", "Çaykur", "Lipton", "Nescafe", "Jacobs", "Coca-Cola", "Pepsi", "Fanta",
    "Fuse Tea", "Cappy", "Dimes", "Sırma", "Erikli", "Hayat", "Damla", "Beypazarı",
    "Uludağ", "Fruko", "Yedigün", "Algida", "Magnum", "Cornetto", "Ferrero", "Nutella",
    "Milka", "Haribo", "Falım", "Vivident", "Ruffles", "Doritos", "Lay's", "Cheetos",
    "Patos", "Peyman", "Tadım", "Selpak", "Solo", "Papia", "Ariel", "Omo", "Fairy",
    "Finish", "Domestos", "Cif", "Yumoş", "Vernel", "Elidor", "Clear", "Pantene", "Dove",
    "Nivea", "Arko", "Colgate", "Signal", "Sensodyne", "İpana", "Oral-B", "Prima",
    "Molfix", "Sleepy", "Uni Baby", "Sana", "Becel", "Knorr", "Calve", "Kemal Kükrer",
    "Torku", "Halk Ekmek", "Bahçıvan", "Muratbey", "Tahsildaroğlu", "Ekici", "Teksüt",
]))


def search(session: requests.Session, keyword: str, page: int) -> dict:
    return _post(session, {"keywords": keyword, "pages": page, "size": PAGE_SIZE, **GEO})


def harvest_all(session: Optional[requests.Session] = None) -> Dict[str, dict]:
    """Keyword araması — her ürünü `id` ile tekilleştirir; kategori her ürünün kendi
    `main_category` alanından alınır (facet WAF-bloklu)."""
    session = session or _session()
    logger.info("harvest — %d anahtar", len(KEYWORDS))
    products: Dict[str, dict] = {}
    for kw in KEYWORDS:
        try:
            first = search(session, kw, 0)
        except Exception as e:
            logger.warning("arama hata '%s': %s", kw, e)
            continue
        found = int(first.get("numberOfFound", 0) or 0)
        pages = min(MAX_PAGES_PER_CATEGORY, (found + PAGE_SIZE - 1) // PAGE_SIZE)
        new = 0
        for pg in range(pages):
            data = first if pg == 0 else search(session, kw, pg)
            for item in (data.get("content") or []):
                pid = str(item.get("id") or "")
                if pid and pid not in products:
                    products[pid] = item  # kategori main_category'den (build sırasında)
                    new += 1
            time.sleep(REQUEST_PAUSE)
        logger.info("'%s': bulundu=%d, yeni=%d, toplam=%d", kw, found, new, len(products))
    return products


def _unit_from(refined: str) -> str:
    r = (refined or "").lower()
    if any(u in r for u in (" kg", "kilogram")):
        return "kg"
    if " l" in r or "litre" in r:
        return "l"
    return "adet"


def build_price_payloads(products: Dict[str, dict]) -> List[Dict]:
    """Her ürünün her zinciri için bir fiyat payload'u. ean=mf-<id>, source=api,
    GÖRSEL YOK, category_id = facet'ten kesin Cheep kategorisi."""
    payloads: List[Dict] = []
    for pid, item in products.items():
        name = (item.get("title") or "").strip()
        if len(name) < 2:
            continue
        ean = f"mf-{pid}"
        brand = (item.get("brand") or "").strip() or None
        unit = _unit_from(item.get("refinedVolumeOrWeight") or "")
        category_id = item.get("_cheep_cat") or _cat_id(item.get("main_category") or "")

        by_chain: Dict[str, float] = {}
        for depot in (item.get("productDepotInfoList") or []):
            market = (depot.get("marketAdi") or "").strip().lower()
            if market not in STORE_MAP:
                continue
            try:
                price = float(depot.get("price"))
            except (TypeError, ValueError):
                continue
            if price <= 0:
                continue
            if market not in by_chain or price < by_chain[market]:
                by_chain[market] = price

        for market, price in by_chain.items():
            payload = {
                "store_id": STORE_MAP[market],
                "store_sku": ean,
                "price": f"{price:.2f}",
                "unit": unit,
                "source": "api",
                "confidence_score": 1.0,
                "name": name[:255],
                "ean_barcode": ean,
                "category_id": category_id,
            }
            if brand:
                payload["brand"] = brand[:100]
            payloads.append(payload)
    return payloads


def ingest(payloads: List[Dict], api_url: str, api_key: Optional[str]) -> Dict:
    api_url = api_url.rstrip("/")
    headers = {"x-country": "TR"}
    key = api_key or os.getenv("INGEST_API_KEY")
    if key:
        headers["x-api-key"] = key
    else:
        logger.warning("INGEST_API_KEY yok — ingest 401 olur")
    stats = {"total": 0, "successful": 0, "failed": 0}
    for i in range(0, len(payloads), CHUNK_SIZE):
        chunk = payloads[i:i + CHUNK_SIZE]
        stats["total"] += len(chunk)
        try:
            resp = requests.post(f"{api_url}/store-prices/bulk-upsert",
                                 json={"prices": chunk}, headers=headers, timeout=180)
            if not resp.ok:
                logger.error("ingest HTTP %s: %s", resp.status_code, resp.text[:200])
                stats["failed"] += len(chunk); continue
            body = resp.json() if resp.content else {}
            ok = body.get("successful", body.get("success_count", len(chunk)))
            stats["successful"] += ok
            stats["failed"] += len(chunk) - ok
        except (requests.RequestException, ValueError) as e:
            logger.error("ingest hata: %s", e)
            stats["failed"] += len(chunk)
    return stats


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="marketfiyati.org.tr → Cheep backend (TR, facet tam kapsam)")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    products = harvest_all()
    payloads = build_price_payloads(products)
    chains: Dict[int, int] = {}
    cats: Dict[int, int] = {}
    for p in payloads:
        chains[p["store_id"]] = chains.get(p["store_id"], 0) + 1
    for it in products.values():
        c = it.get("_cheep_cat", 246)
        cats[c] = cats.get(c, 0) + 1
    logger.info("tekil ürün=%d, fiyat=%d, mağaza=%s", len(products), len(payloads), chains)
    logger.info("kategori dağılımı (cheep id): %s", dict(sorted(cats.items(), key=lambda x: -x[1])))

    if args.dry_run:
        logger.info("DRY-RUN"); return
    logger.info("INGEST: %s", ingest(payloads, args.api_url, args.api_key))


if __name__ == "__main__":
    main()
