"""
Türkiye veri hattı — RESMİ KAYNAK: marketfiyati.org.tr (TÜBİTAK BİLGEM / Ticaret Bakanlığı).

Neden: 7 Aralık 2022 Yönetmelik değişikliği ile 200+ şubeli zincirler fiyat verisini
Bakanlığa vermek zorunda; bu veri "tüketicinin fiyat karşılaştırması yapabilmesi için"
kamuoyuyla paylaşılıyor (açık API). Bu, izinsiz scraping'in (FSEK Ek m.8 + TTK m.55 + ToS
ihlali) hukuki riskini ortadan kaldırır. Görsel İNGEST EDİLMEZ (retailer telifi).

API: POST https://api.marketfiyati.org.tr/api/v2/search
  body: {keywords, pages, size, latitude, longitude, distance}
  → {numberOfFound, content:[{id,title,brand,refinedVolumeOrWeight,categories,
      productDepotInfoList:[{marketAdi,price,unitPrice,indexTime,...}]}]}

Ürün `id`, devletçe ZATEN marketler-arası eşleştirilmiş çapraz-mağaza anahtarıdır →
backend'e `ean_barcode = "mf-<id>"` olarak gönderilir; tüm zincirlerin fiyatı tek Cheep
ürününde birleşir (backend (country_id, ean_barcode) ile eşleştirir).
"""
import argparse
import logging
import os
import time
from typing import Dict, List, Optional

import requests

logger = logging.getLogger("marketfiyati")

API_BASE = "https://api.marketfiyati.org.tr/api/v2"
# Ülke merkezinden geniş yarıçap → ulusal kapsam
GEO = {"latitude": 39.925, "longitude": 32.866, "distance": 900000}
PAGE_SIZE = 25                      # API sayfa başına en fazla 25 döndürüyor (size yok sayılıyor)
MAX_PAGES_PER_KEYWORD = 80          # 80 * 25 = 2000 ürün/anahtar üst sınırı
REQUEST_PAUSE = 0.5                 # nazik rate-limit (kamu API'sine saygı)
MAX_RETRIES = 5                     # 418/429/5xx'te üstel backoff ile yeniden dene
CHUNK_SIZE = 900                    # backend bulk-upsert limiti < 1000

# marketAdi → Cheep TR store_id (backend seed ile hizalı)
STORE_MAP: Dict[str, int] = {
    "migros": 1,
    "carrefour": 2,      # CarrefourSA
    "a101": 3,
    "sok": 4,            # ŞOK
    "bim": 5,
    "tarim_kredi": 6,    # Tarım Kredi Kooperatif Market
    "hakmar": 7,
}

ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu"}

# Türk market kataloğunu geniş kapsayan arama terimleri (kategori + yaygın ürün).
KEYWORDS: List[str] = [
    # Süt & kahvaltılık
    "süt", "yoğurt", "peynir", "beyaz peynir", "kaşar", "tereyağı", "yumurta", "ayran",
    "kaymak", "labne", "krem peynir", "bal", "reçel", "pekmez", "tahin", "helva",
    "zeytin", "kahvaltılık", "margarin", "krema", "süzme yoğurt",
    # Et, tavuk, balık, şarküteri
    "tavuk", "kıyma", "et", "dana", "kuzu", "sucuk", "salam", "sosis", "pastırma",
    "balık", "ton balığı", "hindi", "kanat", "but", "köfte", "şarküteri",
    # Meyve & sebze
    "domates", "salatalık", "patates", "soğan", "elma", "muz", "portakal", "limon",
    "biber", "patlıcan", "kabak", "havuç", "marul", "ıspanak", "mandalina", "üzüm",
    "çilek", "karpuz", "kavun", "sarımsak", "maydanoz", "meyve", "sebze",
    # Temel gıda / bakliyat / kuru
    "makarna", "pirinç", "bulgur", "un", "şeker", "tuz", "mercimek", "nohut",
    "fasulye", "barbunya", "irmik", "nişasta", "yulaf", "kuskus", "bezelye",
    # Yağ & sos
    "ayçiçek yağı", "zeytinyağı", "sıvı yağ", "mısır yağı", "salça", "ketçap",
    "mayonez", "hardal", "sos", "sirke", "soya sosu",
    # İçecek
    "su", "maden suyu", "kola", "gazoz", "meyve suyu", "çay", "kahve", "türk kahvesi",
    "nescafe", "ıhlamur", "bitki çayı", "ayran", "soda", "enerji içeceği", "limonata",
    # Atıştırmalık & tatlı
    "çikolata", "bisküvi", "kraker", "cips", "kek", "gofret", "sakız", "şekerleme",
    "kuruyemiş", "fındık", "fıstık", "leblebi", "ceviz", "badem", "lokum", "wafer",
    "kurabiye", "çubuk kraker", "mısır", "patlamış mısır",
    # Konserve & hazır
    "konserve", "hazır çorba", "çorba", "hazır yemek", "turşu", "közlenmiş",
    "mısır konserve", "bezelye konserve", "domates konserve",
    # Dondurulmuş
    "dondurma", "dondurulmuş", "pizza", "patates kızartması", "milföy",
    # Baharat & bakliyat
    "baharat", "karabiber", "pul biber", "kimyon", "kekik", "nane", "tarçın",
    "kabartma tozu", "vanilya", "maya", "kakao", "puding", "jöle",
    # Bebek
    "bebek bezi", "bebek maması", "ıslak mendil", "biberon", "devam sütü",
    # Temizlik
    "deterjan", "çamaşır deterjanı", "bulaşık deterjanı", "yumuşatıcı", "çamaşır suyu",
    "yüzey temizleyici", "cam temizleyici", "sıvı sabun", "temizlik", "sünger",
    "çöp poşeti", "oda spreyi", "kireç çözücü", "tuz ruhu",
    # Kağıt
    "tuvalet kağıdı", "kağıt havlu", "peçete", "ıslak havlu", "mendil",
    # Kişisel bakım
    "şampuan", "saç kremi", "diş macunu", "diş fırçası", "sabun", "duş jeli",
    "deodorant", "tıraş", "kolonya", "ped", "hijyenik ped", "krem", "makyaj temizleme",
    "el kremi", "güneş kremi", "parfüm", "saç boyası",
    # Ev / bebek / evcil
    "kedi maması", "köpek maması", "kedi kumu", "pil", "ampul", "streç film",
    "alüminyum folyo", "kürdan", "çakmak",
    # Daha fazla ürün terimi (kapsam genişletme)
    "gofret", "çikolatalı", "sürülebilir", "kavrulmuş", "kuru üzüm", "kuru kayısı",
    "hurma", "incir", "susam", "keten tohumu", "chia", "granola", "müsli",
    "mısır gevreği", "çikolatalı gevrek", "bal kaymak", "labne", "kaşkaval",
    "tulum peyniri", "lor", "ezine", "hellim", "mozzarella", "cheddar", "krem şanti",
    "puf böreği", "börek", "yufka", "erişte", "mantı", "gözleme", "pide", "lavash",
    "galeta unu", "kadayıf", "baklava", "şerbet", "sos çeşitleri", "acı sos",
    "barbekü sos", "ranch", "cheddar sos", "köri", "zerdeçal", "sumak", "nar ekşisi",
    "limon sosu", "salamura", "közlenmiş biber", "domates püresi", "biber salçası",
    "enerji bar", "protein bar", "protein tozu", "sporcu içeceği", "aromalı süt",
    "kefir", "probiyotik", "taze fasulye", "bamya", "brokoli", "karnabahar",
    "pırasa", "kereviz", "turp", "pancar", "avokado", "mango", "ananas", "kivi",
    "nar", "ayva", "erik", "kayısı", "şeftali", "kiraz", "vişne", "böğürtlen",
    "yaban mersini", "greyfurt", "mısır cipsi", "tortilla", "kraker çeşitleri",
    "çubuk kraker", "grissini", "kek çeşitleri", "brownie", "muffin", "poğaça",
    "açma", "simit", "tost ekmeği", "hamburger ekmeği", "sandviç ekmeği",
    "tam buğday ekmeği", "çavdar ekmeği", "glutensiz", "diyet", "light",
    "şekersiz", "tam tahıllı", "organik", "vegan",
    # Türk FMCG markaları (her marka kendi ürünlerini getirir → kapsam ↑)
    "Ülker", "Eti", "Torku", "Pınar", "Sütaş", "İçim", "Sek", "Danone", "Activia",
    "Namet", "Banvit", "Şeker Piliç", "Erpiliç", "Maret", "Aytaç", "Polonez",
    "Tat", "Tamek", "Tukaş", "Dardanel", "Superfresh", "Yudum", "Komili", "Orkide",
    "Kırlangıç", "Filiz", "Nuh'un Ankara", "Piyale", "Barilla", "Bella", "Oba",
    "Reis", "Yayla", "Duru", "Bizim", "Halk", "Doğuş", "Çaykur", "Lipton", "Beta",
    "Nescafe", "Jacobs", "Mahmood", "Coca-Cola", "Pepsi", "Fanta", "Sprite",
    "Fuse Tea", "Cappy", "Dimes", "Meysu", "Sırma", "Erikli", "Hayat", "Damla",
    "Beypazarı", "Uludağ", "Çamlıca", "Fruko", "Yedigün", "Redbull",
    "Algida", "Magnum", "Cornetto", "Golf", "Panda", "Ferrero", "Nutella", "Milka",
    "Toblerone", "Haribo", "Mabel", "Falım", "Vivident", "Olips", "First",
    "Ruffles", "Doritos", "Lay's", "Cheetos", "Patos", "Çerezza", "Peyman",
    "Tadım", "Çerezking", "Selpak", "Solo", "Servis", "Sofia", "Familia", "Papia",
    "Ariel", "Omo", "Alo", "Bingo", "Fairy", "Pril", "Finish", "Domestos", "Cif",
    "Marc", "Yumoş", "Vernel", "Cin", "Hijyeni", "Elidor", "Clear", "Head Shoulders",
    "Pantene", "Blendax", "Dove", "Duru sabun", "Nivea", "Arko", "Colgate", "Signal",
    "Sensodyne", "İpana", "Oral-B", "Prima", "Molfix", "Sleepy", "Uni Baby",
    "Evy Baby", "Canbebe", "Sana", "Becel", "Kalbim", "Rama", "Teremyağı",
    "Kızılay", "Sarıyer", "Hunts", "Knorr", "Calve", "Kemal Kükrer",
]


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "User-Agent": "CheepPriceCompare/1.0 (+https://cheep.live; public price data)",
        "Accept": "application/json",
    })
    return s


def search(session: requests.Session, keyword: str, page: int, size: int = PAGE_SIZE) -> dict:
    """Tek sayfa arama. 418/429/5xx'te üstel backoff ile yeniden dener (kamu API'si
    hızlı ardışık isteklerde 418 döndürüyor — nazik davran)."""
    body = {"keywords": keyword, "pages": page, "size": size, **GEO}
    delay = 1.5
    last_exc: Optional[Exception] = None
    for attempt in range(MAX_RETRIES):
        try:
            r = session.post(f"{API_BASE}/search", json=body, timeout=30)
            if r.status_code in (418, 429) or r.status_code >= 500:
                raise requests.RequestException(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            last_exc = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(delay)
                delay *= 1.8
    raise last_exc if last_exc else requests.RequestException("search failed")


def harvest(keywords: List[str], session: Optional[requests.Session] = None) -> Dict[str, dict]:
    """Anahtar listesini gezer, ürünleri `id` ile tekilleştirir. id→product döner."""
    session = session or _session()
    products: Dict[str, dict] = {}
    for kw in keywords:
        try:
            first = search(session, kw, 0)
        except requests.RequestException as e:
            logger.warning("arama hatası '%s': %s", kw, e)
            continue
        found = int(first.get("numberOfFound", 0) or 0)
        pages = min(MAX_PAGES_PER_KEYWORD, (found + PAGE_SIZE - 1) // PAGE_SIZE)
        new = 0
        for pg in range(pages):
            data = first if pg == 0 else _safe_search(session, kw, pg)
            for item in (data.get("content") or []):
                pid = str(item.get("id") or "")
                if pid and pid not in products:
                    products[pid] = item
                    new += 1
            time.sleep(REQUEST_PAUSE)
        logger.info("'%s': bulundu=%d, sayfa=%d, yeni=%d, toplam_tekil=%d", kw, found, pages, new, len(products))
    return products


def _safe_search(session, kw, pg) -> dict:
    try:
        return search(session, kw, pg)
    except requests.RequestException as e:
        logger.warning("sayfa hatası '%s' p%d: %s", kw, pg, e)
        return {"content": []}


def _unit_from(refined: str) -> str:
    """Ürün etiketinden makul birim; belirsizse 'adet' (fiyat paket/ürün fiyatıdır)."""
    r = (refined or "").lower()
    if any(u in r for u in (" kg", "kilogram")):
        return "kg"
    if " l" in r or "litre" in r:
        return "l"
    return "adet"


def build_price_payloads(products: Dict[str, dict]) -> List[Dict]:
    """Her ürünün her ZİNCİRİ için bir fiyat payload'u (chain başına tek temsili fiyat).

    - ean_barcode = "mf-<id>"  → çapraz-mağaza birleştirme anahtarı (devletçe eşleştirilmiş)
    - store_sku   = "mf-<id>"  → mağaza içi ürün kimliği
    - source      = "api"      → resmi API (dürüst kaynak etiketi)
    - image_url   = YOK        → retailer görsel telifinden kaçınılır
    """
    payloads: List[Dict] = []
    for pid, item in products.items():
        name = (item.get("title") or "").strip()
        if len(name) < 2:
            continue
        ean = f"mf-{pid}"
        brand = (item.get("brand") or "").strip() or None
        unit = _unit_from(item.get("refinedVolumeOrWeight") or "")

        # chain başına tek fiyat (en düşük temsili)
        by_chain: Dict[str, float] = {}
        for depot in (item.get("productDepotInfoList") or []):
            market = (depot.get("marketAdi") or "").strip().lower()
            store_id = STORE_MAP.get(market)
            if store_id is None:
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
                stats["failed"] += len(chunk)
                continue
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
    ap = argparse.ArgumentParser(description="marketfiyati.org.tr → Cheep backend (TR)")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--limit-keywords", type=int, default=0, help="test için ilk N anahtar")
    ap.add_argument("--dry-run", action="store_true", help="ingest etme, sadece özet yaz")
    args = ap.parse_args()

    kws = KEYWORDS[: args.limit_keywords] if args.limit_keywords else KEYWORDS
    logger.info("harvest başlıyor — %d anahtar", len(kws))
    products = harvest(kws)
    payloads = build_price_payloads(products)
    chains = {}
    for p in payloads:
        chains[p["store_id"]] = chains.get(p["store_id"], 0) + 1
    logger.info("tekil ürün=%d, fiyat kaydı=%d, mağaza dağılımı=%s", len(products), len(payloads), chains)

    if args.dry_run:
        logger.info("DRY-RUN — ingest atlandı")
        return
    stats = ingest(payloads, args.api_url, args.api_key)
    logger.info("INGEST: %s", stats)


if __name__ == "__main__":
    main()
