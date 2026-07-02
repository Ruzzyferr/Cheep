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
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "User-Agent": "CheepPriceCompare/1.0 (+https://cheep.live; public price data)",
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


def fetch_main_categories(session: requests.Session) -> List[str]:
    """Bilinen 73 kategori + API facet'inden keşfedilenlerin birleşimi."""
    cats = set(MAIN_CAT_TO_CAT.keys())
    seeds = ["a", "e", "i", "o", "u", "süt", "et", "su", "deterjan", "çikolata",
             "şampuan", "bebek", "kahve", "meyve", "cips", "peynir"]
    for kw in seeds:
        d = _post(session, {"keywords": kw, "pages": 0, "size": 1, **GEO})
        for f in ((d.get("facetMap") or {}).get("main_category") or []):
            cats.add(f["name"])
        time.sleep(0.2)
    return sorted(cats)


def harvest_category(session: requests.Session, main_cat: str, products: Dict[str, dict]) -> int:
    """Bir main_category'nin TÜM ürünlerini facet-filtresiyle sayfalayarak çeker."""
    body0 = {"keywords": "", "pages": 0, "size": PAGE_SIZE, **GEO,
             "filters": [{"key": "main_category", "values": [main_cat]}]}
    first = _post(session, body0)
    found = int(first.get("numberOfFound", 0) or 0)
    pages = min(MAX_PAGES_PER_CATEGORY, (found + PAGE_SIZE - 1) // PAGE_SIZE)
    new = 0
    for pg in range(pages):
        data = first if pg == 0 else _post(session, {**body0, "pages": pg})
        for item in (data.get("content") or []):
            pid = str(item.get("id") or "")
            if pid and pid not in products:
                # kategoriyi bu facet'ten KESİN biliyoruz
                item["_cheep_cat"] = _cat_id(main_cat)
                products[pid] = item
                new += 1
        time.sleep(REQUEST_PAUSE)
    logger.info("[%s] bulundu=%d, sayfa=%d, yeni=%d, toplam=%d", main_cat, found, pages, new, len(products))
    return new


def harvest_all(session: Optional[requests.Session] = None) -> Dict[str, dict]:
    session = session or _session()
    cats = fetch_main_categories(session)
    logger.info("harvest — %d kategori", len(cats))
    products: Dict[str, dict] = {}
    for mc in cats:
        try:
            harvest_category(session, mc, products)
        except Exception as e:
            logger.warning("kategori hata '%s': %s", mc, e)
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
