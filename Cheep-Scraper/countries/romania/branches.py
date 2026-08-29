"""ROMANYA market şubelerini Monitorul Prețurilor'ün kendi API'sinden çeker.

NEDEN OSM DEĞİL: kaynak zaten her mağaza için enlem/boylam, adres, posta kodu,
zincir kimliği ve mağaza tipi veriyor — hem OSM'den daha eksiksiz hem de
zincire kesin bağlı (OSM'de `brand` etiketi elle girildiği için eksik/yanlış
olabiliyor). Ayrıca araştırma sırasında Overpass aynalarının çoğu bu ağdan
erişilemez ya da bayat çıktı.

IZGARA TARAMASI GEREKİYOR — uç noktanın iki sert sınırı var (canlı doğrulandı
2026-08-29):
  • Sonuç sayısı 50 ile SINIRLI ve mesafeye göre sıralı. Tek bir sorgu ülkeyi
    kapsayamaz; yoğun bölgelerde (Bükreş) 50 kayıt birkaç km'de doluyor.
  • `buffer` büyüdükçe çalışmıyor: `buffer=9000` boş `{}` döndürüyor,
    `buffer=5000` çalışıyor. Yani "yarıçapı büyütüp tek seferde al" YOK —
    büyük yarıçap sessizce SIFIR sonuç verir, ki bu en tehlikeli arıza biçimi
    (hata yok, sadece veri yok).
  • `csvprodids` parametresi ZORUNLU; yoksa HTTP 404.

Bu yüzden ülke bir ızgarayla taranıyor ve 50 sonuç DOLAN her hücre, kaçırılan
mağaza olmaması için daha ince bir adımla yeniden bölünüyor.

Kullanım (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=https://api.cheep.live/api/v1 \
    python countries/romania/branches.py            # tam ülke taraması
  python countries/romania/branches.py --dry-run --step 0.25
"""
from __future__ import annotations

import argparse
import logging
import math
import os
import time
from typing import Dict, Iterable, List, Optional, Tuple

import requests

from countries._common.osm_branches import USER_AGENT, ingest_branches
from countries.romania.scrapers.monitorul import (
    BASE,
    NETWORKS_URL,
    STORES_BY_LATLON_URL,
    STORE_QUERY_BUFFER_M,
    STORE_QUERY_LIMIT,
    ca_bundle_path,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("branches_ro")

#: Romanya'nın kabaca sınır kutusu (güney-batı → kuzey-doğu).
RO_BBOX = (43.6, 20.2, 48.3, 29.7)

#: Varsayılan ızgara adımı (derece). ~0.09° ≈ 10 km enlemde; 5 km yarıçaplı
#: sorgularla üst üste binerek tarar. Yoğun hücreler ayrıca bölünüyor.
DEFAULT_STEP_DEG = 0.09

#: Sorgu için gereken (zorunlu) ürün id'si. Herhangi bir yaygın ürün olur;
#: uç nokta bunu "bu ürünü satan mağazalar" süzgeci olarak değil, zorunlu
#: parametre olarak istiyor — pratikte tüm market tiplerini döndürüyor.
PROBE_PRODUCT_ID = "1016498"

#: Monitorul zincir kimliği -> `countries/romania/config.json` store_id.
#: Zincir kimlikleri `GetRetailNetworks`'ten (canlı doğrulandı).
CHAIN_STORE_IDS: Dict[str, int] = {
    "AUCHAN": 70,
    "5940475006709": 71,   # CARREFOUR
    "KAUFLAND": 72,
    "4055329000008": 73,   # LIDL DISCOUNT SRL
    "5940475870003": 74,   # MEGA IMAGE SRL
    "PENNY": 75,
    # Cora (5948914999995), Supeco, Profi ve Selgros config'te KAPALI —
    # fiyatı yayınlanmayan bir zincire şube yazmak, uygulamada ürünsüz
    # market pinleri üretir.
}


#: Şehir çözümlemesi için sorgulanan yerleşimler. Kaynak mağaza kaydında ŞEHİR
#: ALANI VERMİYOR — yalnızca `addr.uatid` (yerleşim kimliği) var. Şehir bilgisi
#: SEO şehir sayfalarının ve uygulamadaki "şehrindeki marketler" görünümünün
#: tek kaynağı, o yüzden `GetUATByName` ile bu adlar sorgulanıp TERS harita
#: (uatid -> şehir) kuruluyor. Liste Romanya'nın en kalabalık yerleşimleri;
#: listede olmayan bir yerleşimdeki mağaza şehirsiz kalır (kaybolmaz).
RO_CITIES = (
    "Bucuresti", "Cluj-Napoca", "Timisoara", "Iasi", "Constanta", "Craiova",
    "Brasov", "Galati", "Ploiesti", "Oradea", "Braila", "Arad", "Pitesti",
    "Sibiu", "Bacau", "Targu Mures", "Baia Mare", "Buzau", "Botosani",
    "Satu Mare", "Ramnicu Valcea", "Suceava", "Piatra Neamt", "Drobeta-Turnu Severin",
    "Targu Jiu", "Tulcea", "Focsani", "Bistrita", "Resita", "Slatina",
    "Calarasi", "Alba Iulia", "Giurgiu", "Deva", "Hunedoara", "Zalau",
    "Sfantu Gheorghe", "Barlad", "Vaslui", "Roman", "Turda", "Medias",
    "Slobozia", "Alexandria", "Voluntari", "Lugoj", "Medgidia", "Onesti",
)

#: Romence'nin DOĞRU yazımı virgül-altı ș/ț (U+0219/U+021B). Kaynak API eski
#: SEDİL biçimini kullanıyor ("Bucureşti", "Timişoara" — U+015F/U+0163).
#: Normalleştirilmezse aynı şehir iki farklı adla iki ayrı SEO sayfası üretir
#: ve ikisi de birbiriyle yarışır.
_CEDILLA_TO_COMMA = str.maketrans({
    "ş": "ș", "Ş": "Ș", "ţ": "ț", "Ţ": "Ț",
})


def normalize_city(raw: str) -> str:
    """`GetUATByName` adını görüntülenebilir şehir adına indirger (SAF).

    Gelen biçim: "Municipiul Bucureşti, Bucuresti" (yerleşim, il).
    İstenen: "București".
    """
    name = (raw or "").split(",")[0].strip()
    for prefix in ("Municipiul ", "Oraşul ", "Orașul ", "Comuna "):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return name.translate(_CEDILLA_TO_COMMA).strip()


def build_uat_index(session: requests.Session, cities: Iterable[str] = RO_CITIES) -> Dict[str, str]:
    """`{uatid: şehir adı}` — her şehir adı için bir arama isteği (SAF DEĞİL).

    Tek tek sorgulanıyor çünkü uç nokta uatid'den ADA giden bir çözümleme
    sunmuyor, yalnızca ADDAN aramaya izin veriyor. ~48 istek, ayda bir koşan
    bir işte önemsiz.
    """
    index: Dict[str, str] = {}
    for city in cities:
        try:
            resp = session.get(f"{BASE}/GetUATByName?uatname={city}", timeout=60)
            resp.raise_for_status()
            for item in resp.json().get("Items") or []:
                uat_id = str(item.get("id") or "").strip()
                if uat_id:
                    index.setdefault(uat_id, normalize_city(str(item.get("name") or city)))
        except (requests.RequestException, ValueError) as e:
            logger.warning("UAT araması başarısız (%s): %s", city, str(e)[:100])
    logger.info("UAT indeksi: %d yerleşim çözümlendi", len(index))
    return index


# Kaç noktada bir ilerleme satırı yazılsın.
# ~200 nokta ≈ birkaç dakika: log'u boğmadan "hâlâ çalışıyor" demeye yeter.
PROGRESS_EVERY = 200


def grid_points(bbox: Tuple[float, float, float, float], step: float) -> List[Tuple[float, float]]:
    """Sınır kutusunu tarayan (lat, lon) noktaları (SAF).

    ADIMLAMA TAM SAYIYLA yapılıyor, `+= step` ile DEĞİL. Kayan nokta toplamı
    biriktiriyor: 26.0 + 0.1 × 2 = 26.200000000000003 ve bu `<= 26.2`
    karşılaştırmasını GEÇMİYOR, yani ızgaranın SON SÜTUNU hiç üretilmiyordu.
    Pratikte bu, Romanya sınır kutusunun DOĞU KENARI boyunca ince bir şeridin
    hiç taranmaması demekti — oradaki mağazalar hiçbir zaman keşfedilmez ve
    bunu hiçbir hata bildirmez.
    """
    lat0, lon0, lat1, lon1 = bbox
    if step <= 0:
        raise ValueError(f"ızgara adımı pozitif olmalı: {step}")
    rows = int(round((lat1 - lat0) / step))
    cols = int(round((lon1 - lon0) / step))
    return [
        (round(lat0 + i * step, 4), round(lon0 + j * step, 4))
        for i in range(rows + 1)
        for j in range(cols + 1)
    ]


def parse_stores(
    payload: Dict,
    chain_store_ids: Dict[str, int] = CHAIN_STORE_IDS,
    uat_index: Optional[Dict[str, str]] = None,
) -> List[Dict]:
    """Mağaza kayıtlarını `/store-branches/bulk-upsert` payload'larına çevirir (SAF).

    Eşlenmemiş zincire ait ya da koordinatsız kayıtlar DÜŞÜRÜLÜR — backend Joi
    doğrulaması tek bozuk satır yüzünden tüm chunk'ı reddedebilir.
    """
    out: List[Dict] = []
    for store in payload.get("Items") or []:
        network_id = str((store.get("retailnetwork") or {}).get("id") or "")
        store_id = chain_store_ids.get(network_id)
        if store_id is None:
            continue
        addr = store.get("addr") or {}
        loc = addr.get("location") or {}
        lat, lon = loc.get("Lat"), loc.get("Lon")
        if lat is None or lon is None:
            continue
        try:
            latf, lonf = float(lat), float(lon)
        except (TypeError, ValueError):
            continue
        if not (-90 <= latf <= 90) or not (-180 <= lonf <= 180):
            continue
        ref = str(store.get("id") or "").strip()
        if not ref:
            continue
        out.append({
            "store_id": store_id,
            "external_ref": f"monitorul:{ref}",
            "name": (str(store.get("name") or "").strip() or ref)[:300],
            "lat": latf,
            "lon": lonf,
            # Kaynak ŞEHİR alanı vermiyor, yalnızca `uatid` (yerleşim
            # kimliği). `build_uat_index` bunu ada çeviriyor; listede olmayan
            # yerleşim şehirsiz kalır — mağaza yine kaydedilir, yalnızca SEO
            # şehir sayfasına girmez.
            "city": (uat_index or {}).get(str(addr.get("uatid") or "").strip()),
            "source": "monitorul",
        })
    return out


def sweep(
    session: requests.Session,
    step: float = DEFAULT_STEP_DEG,
    bbox: Tuple[float, float, float, float] = RO_BBOX,
    delay: float = 0.4,
    max_depth: int = 2,
    uat_index: Optional[Dict[str, str]] = None,
) -> Dict[str, Dict]:
    """Izgarayı tarar, `{external_ref: payload}` döner.

    50 sonuç DOLAN hücre daha ince adımla yeniden bölünür: dolu bir sonuç
    kümesi "burada daha fazlası var ama kesildi" demektir ve bölmezsek yoğun
    şehirlerdeki mağazaların çoğunu sessizce kaçırırız.
    """
    found: Dict[str, Dict] = {}

    def probe(lat: float, lon: float) -> int:
        url = (f"{STORES_BY_LATLON_URL}?lat={lat}&lon={lon}"
               f"&buffer={STORE_QUERY_BUFFER_M}&csvprodids={PROBE_PRODUCT_ID}")
        try:
            resp = session.get(url, timeout=90)
            resp.raise_for_status()
            payload = resp.json()
        except (requests.RequestException, ValueError) as e:
            logger.warning("nokta (%s,%s) alınamadı: %s", lat, lon, str(e)[:100])
            return 0
        items = payload.get("Items") or []
        for p in parse_stores(payload, uat_index=uat_index):
            found.setdefault(p["external_ref"], p)
        return len(items)

    # İLERLEME SAYACI — süslemeye benzer ama değil.
    #
    # Tarama 5.600+ nokta sürüyor ve önceden tek satır bile yazmıyordu:
    # başlangıçtaki "ızgara: N nokta" satırından sonra saatlerce sessizlik.
    # Sonuç: koşan bir iş ile ASILI KALMIŞ bir işi ayırt etmenin hiçbir yolu
    # yoktu. Üretimde tam olarak bu yaşandı — 34 dakika sessizlikten sonra
    # aynı anda İKİ sürecin koştuğu ancak `ps` ile fark edildi.
    progress = {"done": 0}
    started = time.monotonic()

    def walk(points: Iterable[Tuple[float, float]], current_step: float, depth: int) -> None:
        for lat, lon in points:
            n = probe(lat, lon)
            progress["done"] += 1
            if progress["done"] % PROGRESS_EVERY == 0:
                elapsed = time.monotonic() - started
                rate = progress["done"] / elapsed if elapsed else 0
                remaining = (total_points - progress["done"]) / rate if rate else 0
                logger.info(
                    "ilerleme: %d/%d nokta, %d şube, %.0f dk geçti, ~%.0f dk kaldı",
                    progress["done"], total_points, len(found), elapsed / 60, remaining / 60,
                )
            time.sleep(delay)
            if n >= STORE_QUERY_LIMIT and depth < max_depth:
                # Hücre doldu → daha ince tara (yarım adım, 4 alt nokta).
                half = current_step / 2
                walk(
                    [(lat - half / 2, lon - half / 2), (lat - half / 2, lon + half / 2),
                     (lat + half / 2, lon - half / 2), (lat + half / 2, lon + half / 2)],
                    half, depth + 1,
                )

    points = grid_points(bbox, step)
    # Alt bölünmeler (`walk` derinliği) bu sayıya dahil değil — tahmini süre
    # bu yüzden İYİMSER. Kaba bir gidişat göstergesi olarak yeterli.
    total_points = len(points)
    logger.info("ızgara: %d nokta (adım %.3f°)", total_points, step)
    walk(points, step, 0)
    return found


def main() -> None:
    ap = argparse.ArgumentParser(description="Monitorul'dan RO market şubelerini çek ve yükle")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--step", type=float, default=DEFAULT_STEP_DEG)
    ap.add_argument("--delay", type=float, default=0.4)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    session = requests.Session()
    session.headers.update({"Accept": "application/json", "User-Agent": USER_AGENT})
    session.verify = ca_bundle_path()

    # Şehir adları önce çözümleniyor: ızgara taraması saatler sürebilir ve
    # şehirsiz yazılmış bir şube kaydını sonradan düzeltmek ikinci bir tam
    # tarama demek olurdu.
    uat_index = build_uat_index(session)
    found = sweep(session, step=args.step, delay=args.delay, uat_index=uat_index)
    by_chain: Dict[int, int] = {}
    for p in found.values():
        by_chain[p["store_id"]] = by_chain.get(p["store_id"], 0) + 1
    logger.info("bulunan şube: %d — store_id başına %s", len(found), by_chain)

    if args.dry_run:
        logger.info("dry-run — backend'e yazılmadı")
        return
    stats = ingest_branches(list(found.values()), args.api_url, args.api_key, "RO")
    logger.info("TOPLAM ingest=%s", stats)


if __name__ == "__main__":
    main()
