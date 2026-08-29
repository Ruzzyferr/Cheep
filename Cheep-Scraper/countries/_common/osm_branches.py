"""Market ŞUBE (branch) konumlarını OpenStreetMap'ten (Overpass API) çeker ve
`store_branches`'e yükler — ÜLKEDEN BAĞIMSIZ ortak uygulama.

NEDEN BU DOSYA VAR: `countries/turkey/osm_branches.py` ve
`countries/poland/osm_branches.py` birbirinin neredeyse birebir kopyasıydı —
aynı mirror listesi, aynı geri-çekilme, aynı payload şeması, aynı chunk'lı
POST; tek fark `CHAINS` listesi ile ISO kodu. Üç ülke daha eklemek aynı ~180
satırın üç kopyası daha demekti ve kopyalar kaçınılmaz olarak birbirinden
ayrışır: bir mirror ölür, düzeltme yalnızca bir kopyaya girer, diğer ülkeler
sessizce şubesiz kalır. Şube verisi kaybolduğunda uygulama "yakında market yok"
diyerek BOŞ EKRAN gösterir — sessiz ve teşhisi zor bir arıza.

Bir ülkenin modülü artık şu kadar:

    from countries._common.osm_branches import Chain, main_for

    CHAINS = [Chain(50, "Konzum", r"Konzum"), ...]

    if __name__ == "__main__":
        main_for("HR", CHAINS)

TR/PL'nin mevcut dosyaları BİLEREK olduğu gibi bırakıldı: ikisi de üretimde
çalışıyor ve çalışan bir hattı yalnızca tekrarı gidermek için değiştirmek,
kazanılan faydadan büyük bir risk. Yeni ülkeler buradan gelir; TR/PL istenirse
sonra ayrı bir işte taşınır.

Kullanım (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=https://api.cheep.live/api/v1 \
    python countries/croatia/osm_branches.py
"""
import argparse
import logging
import os
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence

import requests

logger = logging.getLogger("osm_branches")

OVERPASS_MIRRORS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
)

#: Varsayılan OSM `shop` süzgeci. Süpermarket + bakkal/market: indirimci
#: zincirlerin (Żabka, Biedronka) bir kısmı `convenience` etiketli.
DEFAULT_SHOP = "supermarket|convenience"

#: Backend şemasının chunk üst sınırı (store-branch.schema.ts).
BRANCH_CHUNK = 2000

#: Bazı Overpass mirror'ları (ör. overpass-api.de) varsayılan `python-requests`
#: User-Agent'ını HTTP 406 ile REDDEDİYOR — tanımlı bir UA şart. OSM kullanım
#: etiği de kendini tanıtan bir UA istiyor.
USER_AGENT = "cheep-scraper/1.0 (+https://cheep.live)"


@dataclass(frozen=True)
class Chain:
    """Bir zincirin OSM'deki karşılığı.

    `brand_regex` OSM'in `brand` ETİKETİNE uygulanır, `name`'e değil — bkz.
    `build_overpass_query`.
    """
    store_id: int
    label: str
    brand_regex: str


def build_overpass_query(iso_code: str, brand_regex: str, shop: str = DEFAULT_SHOP) -> str:
    """Bir zincir için Overpass QL sorgusu üretir (SAF — ağ yok, test edilebilir).

    YALNIZCA `brand` etiketiyle eşleştiriyoruz, `name` ile DEĞİL. `name` regex'i
    ülke genelinde indekssiz olduğundan sorguyu ağırlaştırıp mirror'ları zaman
    aşımına (JSON yerine HTML hata sayfası) düşürüyordu. `brand` indeksli →
    hızlı ve güvenilir; büyük zincirlerde brand etiketlemesi güçlü.
    """
    iso = iso_code.strip().upper()
    return (
        "[out:json][timeout:180];"
        f'area["ISO3166-1"="{iso}"][admin_level=2]->.searchArea;'
        f'nwr["shop"~"{shop}"]["brand"~"{brand_regex}",i](area.searchArea);'
        "out center tags;"
    )


def overpass_query(
    iso_code: str,
    brand_regex: str,
    shop: str = DEFAULT_SHOP,
    mirrors: Sequence[str] = OVERPASS_MIRRORS,
    sleep=time.sleep,
) -> List[Dict]:
    """Sorguyu mirror'lar arasında dolaşarak çalıştırır.

    Overpass IP başına slot ile hız-sınırlar; sık sorguda JSON yerine 429/504
    (HTML) döner. Bu yüzden mirror başına birkaç deneme + UZUN geri-çekilme
    (rate-limit dakikalarla açılır). İçerik tipi `application/json` DEĞİLSE
    yanıt başarısız sayılır: HTML bir hata sayfası `r.ok` olabilir ve
    `r.json()` patlar ya da daha kötüsü boş liste döndürüp şubeleri sessizce
    sıfırlar.
    """
    q = build_overpass_query(iso_code, brand_regex, shop)
    for mirror in mirrors:
        for attempt in range(3):
            try:
                r = requests.post(
                    mirror, data={"data": q}, timeout=210,
                    headers={"User-Agent": USER_AGENT},
                )
                ctype = r.headers.get("content-type", "")
                if r.ok and ctype.startswith("application/json"):
                    return r.json().get("elements", [])
                logger.warning("mirror %s HTTP %s (%s) — %d. deneme",
                               mirror, r.status_code, ctype[:20], attempt + 1)
            except (requests.RequestException, ValueError) as e:
                logger.warning("mirror %s hata: %s", mirror, str(e)[:80])
            sleep(20 * (attempt + 1))   # 20s, 40s, 60s
    logger.error("tüm mirror'lar başarısız (regex=%s)", brand_regex)
    return []


def build_payloads(elements: Iterable[Dict], store_id: int) -> List[Dict]:
    """OSM elemanlarını `/store-branches/bulk-upsert` payload'larına çevirir.

    SAF (ağ yok) — fixture'la test edilir. `way`/`relation` için merkez nokta
    (`center`) kullanılır; koordinatı olmayan ya da geçersiz koordinatlı eleman
    DÜŞÜRÜLÜR (backend Joi doğrulaması tüm chunk'ı reddedebilir — tek bozuk
    satır 2000 şubeyi birden düşürmesin).
    """
    out: List[Dict] = []
    for el in elements:
        el_type, el_id = el.get("type"), el.get("id")
        if el_type == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:  # way / relation → centroid
            center = el.get("center") or {}
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue
        try:
            latf, lonf = float(lat), float(lon)
        except (TypeError, ValueError):
            continue
        if not (-90 <= latf <= 90) or not (-180 <= lonf <= 180):
            continue
        tags = el.get("tags") or {}
        name = (tags.get("name") or tags.get("brand") or f"{el_type}/{el_id}")[:300]
        out.append({
            "store_id": store_id,
            "external_ref": f"osm:{el_type}/{el_id}",
            "name": name,
            "lat": latf,
            "lon": lonf,
            "city": (tags.get("addr:city") or None),
            "source": "osm",
        })
    return out


def dedupe_new(payloads: Iterable[Dict], seen: set) -> List[Dict]:
    """`seen` kümesinde OLMAYAN payload'ları döner ve kümeyi günceller (SAF).

    Aynı OSM nesnesi iki zincirin regex'ine birden uyabilir (ör. "Carrefour" ve
    "CarrefourSA"); aynı `external_ref`'i iki farklı `store_id` ile göndermek
    şubeyi yanlış zincire bağlar. İlk eşleşen zincir kazanır — bu yüzden
    `CHAINS` sırası ÖNEMLİ: daha özgül regex'i öne koyun.
    """
    fresh: List[Dict] = []
    for p in payloads:
        ref = p["external_ref"]
        if ref in seen:
            continue
        seen.add(ref)
        fresh.append(p)
    return fresh


def ingest_branches(
    payloads: List[Dict],
    api_url: str,
    api_key: Optional[str],
    country_code: str,
) -> Dict[str, int]:
    """Şubeleri `/store-branches/bulk-upsert`'e chunk'lar hâlinde gönderir."""
    stats = {"total": 0, "successful": 0, "failed": 0}
    if not payloads:
        return stats
    api_url = api_url.rstrip("/")
    headers = {"x-country": country_code.upper(), "User-Agent": USER_AGENT}
    key = api_key or os.getenv("INGEST_API_KEY")
    if key:
        headers["x-api-key"] = key
    else:
        logger.warning("INGEST_API_KEY yok — istekler 401 dönecek")
    for i in range(0, len(payloads), BRANCH_CHUNK):
        chunk = payloads[i:i + BRANCH_CHUNK]
        stats["total"] += len(chunk)
        try:
            resp = requests.post(
                f"{api_url}/store-branches/bulk-upsert",
                json={"branches": chunk}, headers=headers, timeout=120,
            )
            if not resp.ok:
                logger.error("branch ingest HTTP %s: %s", resp.status_code, resp.text[:200])
                stats["failed"] += len(chunk)
                continue
            body = resp.json() if resp.content else {}
            ok = body.get("successful", len(chunk))
            stats["successful"] += ok
            stats["failed"] += len(chunk) - ok
        except (requests.RequestException, ValueError) as e:
            # ValueError = JSONDecodeError: HTTP 200 ama bozuk gövde tüm döngüyü
            # düşürmesin, hata bu chunk'la sınırlı kalsın.
            logger.error("branch ingest hata: %s", e)
            stats["failed"] += len(chunk)
    return stats


def run(
    country_code: str,
    chains: Sequence[Chain],
    api_url: str,
    api_key: Optional[str] = None,
    dry_run: bool = False,
    shop: str = DEFAULT_SHOP,
    sleep=time.sleep,
) -> Dict[str, int]:
    """Bir ülkenin tüm zincirlerini çeker ve yükler.

    Zincir başına HEMEN yükleme yapılır: ilerleme görünür olur ve KISMİ BAŞARI
    korunur — bir zincir mirror'da takılırsa önceki zincirler zaten kaydedilmiş
    olur.
    """
    seen: set = set()
    grand = {"total": 0, "successful": 0, "failed": 0}
    for chain in chains:
        elements = overpass_query(country_code, chain.brand_regex, shop, sleep=sleep)
        fresh = dedupe_new(build_payloads(elements, chain.store_id), seen)
        if fresh and not dry_run:
            st = ingest_branches(fresh, api_url, api_key, country_code)
            for k in grand:
                grand[k] += st[k]
            logger.info("%-14s osm=%d yüklendi=%d (ingest=%s)",
                        chain.label, len(elements), len(fresh), st)
        else:
            logger.info("%-14s osm=%d yeni_şube=%d", chain.label, len(elements), len(fresh))
        sleep(4)
    logger.info("TOPLAM ingest=%s", grand)
    return grand


def main_for(country_code: str, chains: Sequence[Chain], shop: str = DEFAULT_SHOP) -> None:
    """Bir ülke modülünün `__main__` gövdesi. CLI'ı burada tanımlı tutar."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(
        description=f"OSM'den {country_code.upper()} market şubelerini çek ve yükle",
    )
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    run(country_code, chains, a.api_url, a.api_key, dry_run=a.dry_run, shop=shop)
