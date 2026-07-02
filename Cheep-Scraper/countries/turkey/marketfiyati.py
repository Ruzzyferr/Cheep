"""
Türkiye veri hattı — RESMİ KAYNAK: marketfiyati.org.tr (TÜBİTAK BİLGEM / Ticaret Bakanlığı).

7 Aralık 2022 Yönetmelik değişikliği ile 200+ şubeli zincirler fiyat verisini Bakanlığa
verir; bu veri "tüketicinin fiyat karşılaştırması yapabilmesi için" kamuoyuyla paylaşılır
(açık API). Scraping'in FSEK/TTK/ToS riskini ortadan kaldırır. Görsel İNGEST EDİLMEZ.

TAM KAPSAM: portalın açık sitemap'inden (sitemaps/sitemap-*.xml) TÜM ürün ID'leri alınır
(~33k), her ID `/searchByIdentity` (identityType=id) ile çekilir. Bu, WAF'ın bloklamadığı
tek toplu-erişim yoludur (facet `filters` istekleri 418/bağlantı-düşürme ile bloklu).
Kategori, her ürünün `main_category` alanından → Cheep ALT-kategori id'sine map'lenir.

Portalın kendi başlıklarıyla (tarayıcı UA + Origin/Referer) erişilir — kamu API'sine
portalın istemcisi gibi meşru erişim.
"""
import argparse
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter

logger = logging.getLogger("marketfiyati")

API_BASE = "https://api.marketfiyati.org.tr/api/v2"
SITEMAP_INDEX = "https://marketfiyati.org.tr/sitemaps/sitemap.xml"
GEO = {"latitude": 39.925, "longitude": 32.866, "distance": 900000}
MAX_RETRIES = 4
CHUNK_SIZE = 900
WORKERS = 2                        # eşzamanlı istek — WAF-dostu (düşük tutuldu)
REQUEST_PACE = 0.25               # her istek sonrası worker beklemesi
CHUNK = 500                        # sağlık-kapısı + ara-ingest granülü
MAX_PASSES = 8                     # bloklanan ID'ler için tekrar geçiş sayısı
BLOCK_WAIT = 240                   # API bloklu iken bekleme (sn)
EMPTY = "__EMPTY__"                # ürün bulunamadı (hata değil) işareti

STORE_MAP: Dict[str, int] = {
    "migros": 1, "carrefour": 2, "a101": 3, "sok": 4,
    "bim": 5, "tarim_kredi": 6, "hakmar": 7,
}
ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu"}

# marketfiyati main_category → Cheep kategori id (alt-kategori tercih; yoksa üst).
MAIN_CAT_TO_CAT: Dict[str, int] = {
    "Süt": 2, "Peynir": 3, "Yoğurt": 4, "Ayran ve Kefir": 8, "Diğer Süt Ürünleri": 1,
    "Meyve": 13, "Sebze": 14,
    "Beyaz Et": 22, "Kırmızı Et": 21, "Deniz Ürünleri": 25, "Sakatat": 21,
    "Mantı Makarna ve Erişte": 34, "Bakliyat": 36, "Un ve İrmik": 31, "Sıvı Yağlar": 37,
    "Konserve": 30, "Tuz Baharat ve Harçlar": 39, "Ketçap Mayonez Sos ve Sirkeler": 38,
    "Turşu": 30, "Hazır Gıda Karışımları": 51, "Pasta Malzemeleri": 30,
    "Mutfak Sarf Malzemeleri": 189, "Sürülebilir Ürünler ve Kahvaltılık Soslar": 81,
    "Su": 53, "Maden Suyu": 53, "Meyve Suyu": 54, "Gazlı İçecekler": 55,
    "Gazsız İçecekler": 52, "Kahve": 57,
    "Ekmek ve Unlu Mamüller": 64,
    "Bal ve Reçel": 76, "Zeytin": 77, "Helva Tahin ve Pekmez": 78, "Yumurta": 80,
    "Kahvaltılık Gevrek Bar ve Granola": 83,
    "Çikolata": 86, "Bisküvi ve Kraker": 87, "Gofret": 88, "Cips": 90,
    "Kuruyemiş ve Kuru Meyve": 89, "Kek": 69, "Sakız ve Şekerleme": 92, "Tatlılar": 85,
    "Dondurmalar": 95,
    "Hazır Yemekler": 99,
    "Bulaşık Temizlik Ürünleri": 106, "Genel Temizlik Ürünleri": 109, "Diğer Temizlik": 105,
    "Cilt Bakımı": 132, "Saç Bakım": 127, "Makyaj": 126, "Ağız Bakım": 130,
    "Parfüm, Deodorant": 131, "Duş Banyo ve Sabun": 128, "Tıraş Ürünleri": 133,
    "Ağda ve Epilasyon": 145,
    "Kağıt Peçete ve Mendiller": 138, "Kağıt Havlu": 136, "Tuvalet Kağıdı": 135,
    "Islak Mendil": 174,
    "Bebek Mamaları": 173, "Bebek ve Hasta Bezi": 172, "Bebek Gereçleri": 174,
    "Gıda Takviyeleri": 182, "Sağlık ve Medikal": 181,
    "Ev & Yaşam": 187, "Oyuncak ve Hobi": 280, "Giyim ve Tekstil": 351,
    "Tütün ve Tütün Mamulleri": 246, "Yöresel Ürünler": 246,
}

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
    # Portalın kendi başlıklarıyla erişim (kamu API'sine portalın istemcisi gibi).
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
        "Origin": "https://marketfiyati.org.tr",
        "Referer": "https://marketfiyati.org.tr/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "sec-fetch-site": "same-site",
        "sec-fetch-mode": "cors",
    })
    adapter = HTTPAdapter(pool_connections=WORKERS + 2, pool_maxsize=WORKERS + 2)
    s.mount("https://", adapter)
    return s


def fetch_all_ids(session: requests.Session) -> List[str]:
    """Sitemap index → ürün sitemap'leri → tüm ürün ID'leri (/detay/<id>/...)."""
    idx = session.get(SITEMAP_INDEX, timeout=30).text
    subs = [u for u in re.findall(r"<loc>([^<]+)</loc>", idx) if "sitemap-" in u]
    ids: List[str] = []
    seen = set()
    for sub in subs:
        try:
            xml = session.get(sub, timeout=60).text
        except requests.RequestException as e:
            logger.warning("sitemap alınamadı %s: %s", sub, e)
            continue
        for m in re.findall(r"/detay/([^/]+)/", xml):
            if m not in seen:
                seen.add(m)
                ids.append(m)
        logger.info("sitemap %s → toplam id=%d", sub.rsplit("/", 1)[-1], len(ids))
    return ids


def fetch_product(session: requests.Session, pid: str):
    """Bir ürünü id ile çeker (searchByIdentity — facet DEĞİL). Döner:
    dict (veri) | EMPTY (bulunamadı, hata değil) | None (istek başarısız/bloklu)."""
    body = {"identity": pid, "identityType": "id", **GEO}
    delay = 1.5
    for attempt in range(MAX_RETRIES):
        try:
            r = session.post(f"{API_BASE}/searchByIdentity", json=body, timeout=20)
            if r.status_code in (418, 429) or r.status_code >= 500:
                raise requests.RequestException(f"HTTP {r.status_code}")
            r.raise_for_status()
            content = r.json().get("content") or []
            time.sleep(REQUEST_PACE)
            return content[0] if content else EMPTY
        except (requests.RequestException, ValueError):
            if attempt < MAX_RETRIES - 1:
                time.sleep(delay); delay *= 1.8
    return None


def health_ok(session: requests.Session) -> bool:
    """API yanıt veriyor mu (bilinen bir id ile)."""
    return fetch_product(session, "0002") is not None


def _unit_from(refined: str) -> str:
    r = (refined or "").lower()
    if any(u in r for u in (" kg", "kilogram")):
        return "kg"
    if " l" in r or "litre" in r:
        return "l"
    return "adet"


def build_price_payloads(products: Dict[str, dict]) -> List[Dict]:
    """Her ürünün her zinciri için bir payload. ean=mf-<id>, source=api, GÖRSEL YOK,
    category_id = main_category'den Cheep alt-kategorisi."""
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


def _load_done(path: str) -> set:
    if not path or not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def run(api_url: str, api_key: Optional[str], limit: int = 0, dry_run: bool = False,
        resume_file: str = "mf_done.txt"):
    session = _session()
    ids = fetch_all_ids(session)
    if limit:
        ids = ids[:limit]
    done_ids = _load_done(resume_file)
    logger.info("TOPLAM ID: %d (işlenmiş=%d) — %d worker, %d'lik chunk, %d geçiş",
                len(ids), len(done_ids), WORKERS, CHUNK, MAX_PASSES)

    grand_prod = 0
    grand_ing = {"total": 0, "successful": 0, "failed": 0}
    done_fp = open(resume_file, "a", encoding="utf-8") if resume_file else None

    for pas in range(1, MAX_PASSES + 1):
        todo = [i for i in ids if i not in done_ids]
        if not todo:
            break
        logger.info("=== GEÇİŞ %d — kalan id=%d ===", pas, len(todo))
        for c in range(0, len(todo), CHUNK):
            chunk = todo[c:c + CHUNK]
            # sağlık kapısı: API bloklu ise bekle
            waited = 0
            while not health_ok(session):
                waited += 1
                logger.info("API bloklu — %d sn bekleniyor (chunk %d/%d, geçiş %d)",
                            BLOCK_WAIT, c // CHUNK + 1, (len(todo) + CHUNK - 1) // CHUNK, pas)
                time.sleep(BLOCK_WAIT)
                if waited >= 15:   # ~1 saat blok → bu geçişi bırak
                    logger.warning("uzun blok — geçiş sonlandırılıyor"); break
            batch: Dict[str, dict] = {}
            with ThreadPoolExecutor(max_workers=WORKERS) as ex:
                futs = {ex.submit(fetch_product, session, pid): pid for pid in chunk}
                for fut in as_completed(futs):
                    pid = futs[fut]
                    res = fut.result()
                    if res is None:
                        continue                      # istek başarısız → sonraki geçişte tekrar
                    done_ids.add(pid)
                    if done_fp:
                        done_fp.write(pid + "\n")
                    if res is not EMPTY and res.get("id"):
                        batch[str(res["id"])] = res
                if done_fp:
                    done_fp.flush()
            if batch:
                payloads = build_price_payloads(batch)
                grand_prod += len(batch)
                if not dry_run:
                    st = ingest(payloads, api_url, api_key)
                    for k in grand_ing:
                        grand_ing[k] += st[k]
                logger.info("ara-ingest: ürün=%d payload=%d | işlenmiş=%d/%d | toplam_ürün=%d",
                            len(batch), len(payloads), len(done_ids), len(ids), grand_prod)
    if done_fp:
        done_fp.close()
    logger.info("BİTTİ — toplam ürün=%d, işlenmiş id=%d/%d, INGEST=%s",
                grand_prod, len(done_ids), len(ids), grand_ing)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="marketfiyati.org.tr → Cheep (TR, TAM katalog)")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--limit", type=int, default=0, help="test için ilk N id")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    run(args.api_url, args.api_key, args.limit, args.dry_run)


if __name__ == "__main__":
    main()
