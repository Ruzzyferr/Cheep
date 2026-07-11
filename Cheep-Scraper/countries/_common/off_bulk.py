"""Bulk Open Food Facts EAN enrichment for Poland — sıfır-hata kuralı korunur
(bkz. off_enrich.py), ama kaynak canlı arama API'si değil, OFF'un günlük
yayınladığı TAM veri seti dökümüdür. Per-product search API (off_enrich.py)
~6 sn/istek nezaket limitiyle 23k ürünlük bir katalogda pratik değil (>38
saat sürer, çoğu istek de hata veriyor); bu modül tüm veri setini TEK SEFER
indirip yerelde bir SQLite indeks kurar, sonrasında zenginleştirme saf yerel
sözlük aramasına döner (network yok, rate-limit yok).

Kaynak: OFF'un resmi "tam veri seti" dökümü —
  https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
  (302 -> https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/...) — TSV
  (tab-separated), gzip. 2026-07-11 itibarıyla Content-Length ~1.27 GB
  (indirilen boyut; sıkıştırılmamış onlarca GB olabilir, bu yüzden ASLA
  tamamı belleğe alınmaz — satır satır akıtılır). CSV, JSONL dökümünden
  (~12.4 GB gzip) çok daha küçük olduğu için tercih edilen varsayılan
  kaynaktır (bkz. https://world.openfoodfacts.org/data). JSONL de
  desteklenir (bkz. _iter_off_rows) — küçük sabit veri / test fixture'ları
  için, ve OFF gelecekte ülkeye-özel bir döküm yayınlarsa onun için.

Bellek disiplini:
  - download_dataset(): dosyayı diske chunk chunk yazar, hiçbir zaman
    tamamını RAM'e almaz; kesintiyse HTTP Range ile kaldığı yerden devam
    eder (best-effort — sunucu Range'i yok sayarsa baştan başlar).
  - build_pl_index(): kaynağı gzip + satır satır (csv.reader / jsonl per
    line) akıtır; Polonya'ya ait ADAY satırları toplu (batch) INSERT ile
    bir SQLite STAGING tablosuna yazar (yine sabit-boyutlu bellek), asıl
    anahtar->EAN çözümü (çakışma/AMBIGUOUS tespiti dahil) SQLite'ın kendi
    GROUP BY/agg motoruyla, Python tarafında büyük bir dict tutmadan yapılır.

Sıfır-hata: aynı anahtar (brand_norm, name_norm, base_qty) birden fazla FARKLI
EAN'a karşılık geliyorsa o anahtar AMBIGUOUS işaretlenir ve hiçbir zaman bir
EAN döndürmez (bkz. off_ambiguous1 / off_ambiguous2 tabloları).
"""
from __future__ import annotations

import csv
import gzip
import json
import logging
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple

import requests

from countries._common.off_enrich import _fold, _tokens, _base_amount
from scrapers.units import _MULTIPACK_RE, _SIMPLE_RE, _COUNTPACK_RE

logger = logging.getLogger(__name__)

OFF_CSV_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
USER_AGENT = "Cheep-PriceCompare/1.0 (bulutruzgarofficial@gmail.com)"
FRESH_S = 30 * 86400          # download_dataset: bu kadar taze bir dosya varsa yeniden indirme
INDEX_MAX_AGE_S = 30 * 86400  # ensure_pl_index: indeks bu yaştan eskiyse yeniden kurulur
_CODE_RE = re.compile(r"\d{8,14}")
_POLAND_LEAVES = {"poland", "polska"}
_COUNTRY_FIELDS = ("countries_tags", "countries_hierarchy", "countries", "countries_en")

# csv modülünün varsayılan alan-boyutu limiti (~131072 byte) OFF'un dev
# 'ingredients_text'/'categories_tags' gibi alanlarını aşabiliyor; Windows'ta
# sys.maxsize doğrudan C long'a sığmayabileceğinden kademeli düşürerek dene.
_field_limit = sys.maxsize
while True:
    try:
        csv.field_size_limit(_field_limit)
        break
    except OverflowError:
        _field_limit //= 10


def download_dataset(dest_dir, url: Optional[str] = None) -> Path:
    """OFF tam veri setini (varsayılan: CSV.gz) dest_dir altına indirir ve
    yolunu döner. dest_dir'de aynı isimde FRESH_S'ten daha taze bir dosya
    varsa AĞA HİÇ ÇIKMADAN onu döner (haftalık koşularda gereksiz ~1.3 GB
    indirmeyi önler). Yarım kalmış bir '.part' dosyası varsa HTTP Range ile
    kaldığı yerden devam etmeyi dener; sunucu Range'i yok sayarsa (200 döner)
    baştan başlar."""
    url = url or OFF_CSV_URL
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = url.rsplit("/", 1)[-1]
    dest = dest_dir / filename

    if dest.exists() and (time.time() - dest.stat().st_mtime) < FRESH_S:
        logger.info("off_bulk: %s taze (< %d gün), yeniden indirilmiyor", dest, FRESH_S // 86400)
        return dest

    part = dest_dir / (filename + ".part")
    headers = {"User-Agent": USER_AGENT}
    resume_from = part.stat().st_size if part.exists() else 0
    if resume_from:
        headers["Range"] = f"bytes={resume_from}-"

    with requests.get(url, headers=headers, stream=True, timeout=60) as resp:
        if resume_from and resp.status_code == 200:
            # Sunucu Range'i desteklemedi/yok saydı — 200 tam gövde demek, baştan yaz.
            resume_from = 0
        resp.raise_for_status()
        mode = "ab" if resume_from else "wb"
        with open(part, mode) as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)

    part.replace(dest)
    logger.info("off_bulk: indirildi -> %s (%.1f MB)", dest, dest.stat().st_size / 1e6)
    return dest


def _primary_brand(row: Dict) -> str:
    b = row.get("brands")
    if isinstance(b, list):
        b = b[0] if b else ""
    return str(b or "").split(",")[0].strip()


def _product_name(row: Dict) -> str:
    name = row.get("product_name") or row.get("product_name_pl") or ""
    if isinstance(name, dict):
        name = name.get("pl") or name.get("en") or next(iter(name.values()), "")
    if isinstance(name, list):
        name = name[0] if name else ""
    return str(name or "").strip()


def _quantity_text(row: Dict) -> str:
    q = row.get("quantity")
    if isinstance(q, list):
        q = q[0] if q else ""
    return str(q or "").strip()


def _row_code(row: Dict) -> str:
    code = re.sub(r"\D", "", str(row.get("code") or row.get("_id") or ""))
    return code if _CODE_RE.fullmatch(code) else ""


def _is_poland(row: Dict) -> bool:
    for field in _COUNTRY_FIELDS:
        val = row.get(field)
        if val is None or val == "":
            continue
        candidates = val if isinstance(val, list) else str(val).split(",")
        for c in candidates:
            c = str(c or "").strip().lower()
            if not c:
                continue
            leaf = c.rsplit(":", 1)[-1]
            if leaf in _POLAND_LEAVES:
                return True
    return False


def _iter_off_rows(dataset_path: Path) -> Iterator[Dict]:
    """Kaynağı satır satır akıtır — dosyanın tamamı asla belleğe alınmaz.
    Uzantıya göre CSV (tab-separated, OFF'un resmi tam döküm formatı) veya
    JSONL (OFF'un alternatif dökümü / test fixture'ları) olarak ayrıştırır."""
    dataset_path = Path(dataset_path)
    name = dataset_path.name.lower()
    opener = gzip.open if name.endswith(".gz") else open
    stem = name[:-3] if name.endswith(".gz") else name

    if stem.endswith(".csv"):
        # OFF'un TSV dökümü CSV-tarzı tırnaklama KULLANMAZ (alan içindeki
        # tab/newline zaten dışa aktarımda temizlenmiştir); QUOTE_NONE ile
        # okumazsak, veri içinde geçen düz bir '"' karakteri csv modülünü
        # "tırnak içinde" moduna sokup birden çok satırı tek satıra
        # birleştirebilir (satır kayması / bozuk satır -> yanlış EAN eşleşmesi
        # riski). QUOTE_NONE bunu tamamen devre dışı bırakır.
        with opener(dataset_path, "rt", encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
            for row in reader:
                yield row
    elif stem.endswith(".jsonl") or stem.endswith(".json"):
        with opener(dataset_path, "rt", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
    else:
        raise ValueError(f"off_bulk: tanınmayan veri seti biçimi: {dataset_path}")


def _strip_size(text: str) -> str:
    """Metinden miktar/boyut alt dizesini ('1L', '200 g', '6x200ml' ...) çıkarır.

    OFF'un 'product_name' alanı miktarı İÇERMEZ (ayrı 'quantity' sütunu
    vardır), ama taranan Cheep ürün isimleri miktarı isme gömer ('Mleko ...
    1L'). Bu ikisinin name_norm'u aynı anahtara düşsün diye, hangi kaynaktan
    gelirse gelsin isim metninden miktarı ÖNCE çıkarıyoruz — aksi halde
    aynı ürün bile sırf scraped isim "1L" taşıyor diye anahtar uyuşmaz."""
    text = _MULTIPACK_RE.sub(" ", text)
    text = _SIMPLE_RE.sub(" ", text)
    text = _COUNTPACK_RE.sub(" ", text)
    return text


def build_keys(brand: str, name: str, qty_text: Optional[str] = None) -> Optional[Tuple[str, str]]:
    """(key1, key2) döner ya da eksik marka/isim/miktar varsa None.

    key1 = brand_norm|name_norm|base_qty (tam sıra) — name_norm, miktarı
    isimden çıkarılmış metnin off_enrich._fold'udur (bkz. _strip_size) ki
    OFF'un ayrı-miktarlı isimleriyle taranan ürünlerin gömülü-miktarlı
    isimleri AYNI anahtara düşsün.
    key2 = brand_norm|sorted(name_tokens)|base_qty — kelime sırası
    farklılıklarına karşı ikincil, daha kaba anahtar (aynı miktarsız-isim
    token kümesi üzerinden).

    qty_text verilirse önce o denenir (OFF'un ayrı 'quantity' sütunu gibi);
    yoksa/parse edilemezse `name` içinden miktar çıkarılır (taranan ürün
    isimleri miktarı isim içinde taşır, bkz. off_enrich._candidates)."""
    brand_n = _fold(brand)
    base_qty = _base_amount(qty_text) if qty_text else None
    if base_qty is None:
        base_qty = _base_amount(name)
    stripped_name = _strip_size(name or "")
    name_n = _fold(stripped_name)
    if not brand_n or not name_n:
        return None
    if base_qty is None:
        return None
    key1 = f"{brand_n}|{name_n}|{base_qty}"
    key2 = f"{brand_n}|{' '.join(sorted(_tokens(stripped_name)))}|{base_qty}"
    return key1, key2


def build_pl_index(dataset_path, out_sqlite, batch_size: int = 5000) -> Dict:
    """Kaynağı (CSV/JSONL, gzip olabilir) satır satır akıtır, yalnızca
    Polonya'ya ait satırları tutar, ve normalize edilmiş anahtar -> EAN
    SQLite indeksini kurar. Aynı anahtara 2+ FARKLI EAN düşerse o anahtar
    AMBIGUOUS'a taşınır ve off_index tablolarına asla girmez (sıfır-hata).

    Döndürdüğü stats: rows_read, pl_rows, candidate_rows, unique_keys1,
    ambiguous_keys1, unique_keys2, ambiguous_keys2."""
    dataset_path = Path(dataset_path)
    out_sqlite = Path(out_sqlite)
    out_sqlite.parent.mkdir(parents=True, exist_ok=True)
    if out_sqlite.exists():
        out_sqlite.unlink()

    conn = sqlite3.connect(str(out_sqlite))
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("CREATE TABLE off_raw (key1 TEXT, key2 TEXT, ean TEXT)")

    stats = {"rows_read": 0, "pl_rows": 0, "candidate_rows": 0}
    batch: List[Tuple[str, str, str]] = []

    def _flush():
        if batch:
            conn.executemany("INSERT INTO off_raw VALUES (?,?,?)", batch)
            batch.clear()

    for row in _iter_off_rows(dataset_path):
        stats["rows_read"] += 1
        if not _is_poland(row):
            continue
        stats["pl_rows"] += 1

        code = _row_code(row)
        if not code:
            continue
        brand = _primary_brand(row)
        name = _product_name(row)
        if not brand or not name:
            continue
        keys = build_keys(brand, name, _quantity_text(row))
        if keys is None:
            continue
        key1, key2 = keys
        batch.append((key1, key2, code))
        stats["candidate_rows"] += 1
        if len(batch) >= batch_size:
            _flush()
    _flush()
    conn.commit()

    conn.execute("CREATE INDEX idx_raw_key1 ON off_raw(key1)")
    conn.execute("CREATE INDEX idx_raw_key2 ON off_raw(key2)")

    conn.execute("CREATE TABLE off_index1 (key TEXT PRIMARY KEY, ean TEXT NOT NULL)")
    conn.execute("CREATE TABLE off_index2 (key TEXT PRIMARY KEY, ean TEXT NOT NULL)")
    conn.execute("CREATE TABLE off_ambiguous1 (key TEXT PRIMARY KEY)")
    conn.execute("CREATE TABLE off_ambiguous2 (key TEXT PRIMARY KEY)")

    conn.execute(
        "INSERT INTO off_index1 (key, ean) "
        "SELECT key1, MIN(ean) FROM off_raw GROUP BY key1 HAVING COUNT(DISTINCT ean) = 1"
    )
    conn.execute(
        "INSERT INTO off_ambiguous1 (key) "
        "SELECT key1 FROM off_raw GROUP BY key1 HAVING COUNT(DISTINCT ean) > 1"
    )
    conn.execute(
        "INSERT INTO off_index2 (key, ean) "
        "SELECT key2, MIN(ean) FROM off_raw GROUP BY key2 HAVING COUNT(DISTINCT ean) = 1"
    )
    conn.execute(
        "INSERT INTO off_ambiguous2 (key) "
        "SELECT key2 FROM off_raw GROUP BY key2 HAVING COUNT(DISTINCT ean) > 1"
    )
    conn.commit()

    stats["unique_keys1"] = conn.execute("SELECT COUNT(*) FROM off_index1").fetchone()[0]
    stats["ambiguous_keys1"] = conn.execute("SELECT COUNT(*) FROM off_ambiguous1").fetchone()[0]
    stats["unique_keys2"] = conn.execute("SELECT COUNT(*) FROM off_index2").fetchone()[0]
    stats["ambiguous_keys2"] = conn.execute("SELECT COUNT(*) FROM off_ambiguous2").fetchone()[0]

    conn.execute("DROP TABLE off_raw")
    conn.commit()
    conn.execute("VACUUM")
    conn.close()

    logger.info("off_bulk: build_pl_index %s", stats)
    return stats


def ensure_pl_index(country_dir, dataset_dir=None, url: Optional[str] = None,
                     max_age_s: int = INDEX_MAX_AGE_S) -> Path:
    """İndeks eksikse veya max_age_s'ten eskiyse (yaklaşık 30 gün) yeniden
    kurar (gerekirse önce veri setini indirir); tazeyse doğrudan yolunu
    döner. Haftalık pipeline koşusunda çağrılır — 30 günlük eşik, her koşuda
    ~1.3 GB'lık gereksiz indirme+yeniden-kurmayı önler."""
    country_dir = Path(country_dir)
    sqlite_path = country_dir / "off_bulk_index.sqlite"
    if sqlite_path.exists() and (time.time() - sqlite_path.stat().st_mtime) < max_age_s:
        return sqlite_path

    dataset_dir = Path(dataset_dir) if dataset_dir else (country_dir / "off_bulk_data")
    dataset_path = download_dataset(dataset_dir, url=url)
    build_pl_index(dataset_path, sqlite_path)
    return sqlite_path


def enrich_from_index(products: List[Dict], sqlite_path) -> Dict:
    """OffEnricher.enrich ile AYNI yerinde-değiştirme (in-place) sözleşmesi:
    yalnızca belirsiz olmayan (unambiguous) eşleşmelerde product['barcode']
    yazar. Ağa hiç çıkmaz — tamamı yerel SQLite arama."""
    stats = {"looked_up": 0, "enriched": 0, "ambiguous": 0, "misses": 0}
    conn = sqlite3.connect(str(sqlite_path))
    try:
        for p in products:
            if p.get("barcode"):
                continue
            name = (p.get("name") or "").strip()
            brand = (p.get("brand") or "").strip()
            if not name or not brand:
                continue
            stats["looked_up"] += 1

            keys = build_keys(brand, name)
            if keys is None:
                stats["misses"] += 1
                continue
            key1, key2 = keys

            row = conn.execute("SELECT ean FROM off_index1 WHERE key=?", (key1,)).fetchone()
            if row is None:
                row = conn.execute("SELECT ean FROM off_index2 WHERE key=?", (key2,)).fetchone()
            if row is not None:
                p["barcode"] = row[0]
                stats["enriched"] += 1
                continue

            ambiguous = conn.execute(
                "SELECT 1 FROM off_ambiguous1 WHERE key=? "
                "UNION SELECT 1 FROM off_ambiguous2 WHERE key=?",
                (key1, key2),
            ).fetchone()
            if ambiguous is not None:
                stats["ambiguous"] += 1
            else:
                stats["misses"] += 1
    finally:
        conn.close()
    logger.info("OFF bulk enrichment: %s", stats)
    return stats
