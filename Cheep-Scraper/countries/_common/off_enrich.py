"""Open Food Facts EAN zenginleştirme — sıfır-hata kuralı: TEK ve tüm kontrolleri
geçen aday yoksa EAN YAZMA. Brand + miktar + isim örtüşmesi hepsi şart.
SQLite cache: haftalık yeniden koşular OFF'a tekrar sormaz (TTL 30 gün)."""
import json
import logging
import re
import sqlite3
import time
import unicodedata
from typing import Dict, List, Optional

import requests

from scrapers.units import parse_quantity_and_unit

logger = logging.getLogger(__name__)

CACHE_TTL_S = 30 * 86400
REQUEST_GAP_S = 6.0          # OFF arama API'si nezaket sınırı (~10 istek/dk)
MIN_NAME_JACCARD = 0.5
USER_AGENT = "Cheep-PriceCompare/1.0 (bulutruzgarofficial@gmail.com)"


def _fold(s: str) -> str:
    """Küçük harf + diakritik düşür + alfanümerik dışını boşluğa çevir."""
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _tokens(s: str) -> set:
    return set(_fold(s).split())


def _base_amount(text: str) -> Optional[str]:
    """Metindeki miktarı taban birime çevir ('1 l' -> '1000.0ml'); yoksa None."""
    qty, unit = parse_quantity_and_unit(text or "")
    if unit in ("l",):
        return f"{qty * 1000}ml"
    if unit == "cl":
        return f"{qty * 10}ml"
    if unit == "ml":
        return f"{qty}ml"
    if unit == "kg":
        return f"{qty * 1000}g"
    if unit == "g":
        return f"{qty}g"
    if (qty, unit) == (1.0, "adet"):
        return None  # parse edilemedi — miktar kontrolü yapılamaz
    return f"{qty}{unit}"


class OffEnricher:
    def __init__(self, country_code: str, cache_path: str, session=None):
        self.cc = country_code.lower()
        self.session = session or requests.Session()
        self._own_session = session is None
        self.db = sqlite3.connect(cache_path)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS off_cache (k TEXT PRIMARY KEY, ean TEXT, ts REAL)"
        )
        self._last_call = 0.0

    def _cache_get(self, key: str):
        row = self.db.execute(
            "SELECT ean, ts FROM off_cache WHERE k=?", (key,)
        ).fetchone()
        if not row or time.time() - row[1] > CACHE_TTL_S:
            return None
        return row  # (ean|'', ts) — '' = kesin MISS cache'i

    def _cache_put(self, key: str, ean: str):
        self.db.execute(
            "INSERT OR REPLACE INTO off_cache VALUES (?,?,?)", (key, ean, time.time())
        )
        self.db.commit()

    def _search(self, terms: str) -> List[Dict]:
        gap = REQUEST_GAP_S - (time.time() - self._last_call)
        if self._own_session and gap > 0:
            time.sleep(gap)
        self._last_call = time.time()
        resp = self.session.get(
            f"https://{self.cc}.openfoodfacts.org/cgi/search.pl",
            params={
                "action": "process", "search_terms": terms, "search_simple": 1,
                "json": 1, "page_size": 10,
                "fields": "code,product_name,brands,quantity",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        if not resp.ok:
            return []
        try:
            return resp.json().get("products", []) or []
        except (ValueError, json.JSONDecodeError):
            return []

    def _candidates(self, name: str, brand: str) -> List[Dict]:
        want_brand = _tokens(brand)
        want_name = _tokens(name)
        want_qty = _base_amount(name)
        if not want_brand or want_qty is None:
            return []  # marka veya miktar yoksa kanıt kurulamaz — hiç arama yapma
        out = []
        for cand in self._search(f"{brand} {name}"):
            code = str(cand.get("code") or "").strip()
            if not re.fullmatch(r"\d{8,14}", code):
                continue
            cand_brand = _tokens(cand.get("brands") or "")
            if not want_brand <= cand_brand and not cand_brand <= want_brand:
                continue
            cand_qty = _base_amount(cand.get("quantity") or "") or _base_amount(cand.get("product_name") or "")
            if cand_qty != want_qty:
                continue
            cand_name = _tokens(cand.get("product_name") or "")
            union = want_name | cand_name
            if not union or len(want_name & cand_name) / len(union) < MIN_NAME_JACCARD:
                continue
            out.append(code)
        return sorted(set(out))

    def enrich(self, products: List[Dict]) -> Dict:
        stats = {"looked_up": 0, "cache_hits": 0, "enriched": 0, "ambiguous": 0, "misses": 0}
        for p in products:
            if p.get("barcode"):
                continue
            name, brand = (p.get("name") or "").strip(), (p.get("brand") or "").strip()
            if not name or not brand:
                continue
            key = f"{_fold(brand)}|{_fold(name)}"
            cached = self._cache_get(key)
            if cached is not None:
                stats["cache_hits"] += 1
                if cached[0]:
                    p["barcode"] = cached[0]
                    stats["enriched"] += 1
                continue
            stats["looked_up"] += 1
            codes = self._candidates(name, brand)
            if len(codes) == 1:
                p["barcode"] = codes[0]
                self._cache_put(key, codes[0])
                stats["enriched"] += 1
            elif len(codes) > 1:
                self._cache_put(key, "")
                stats["ambiguous"] += 1
            else:
                self._cache_put(key, "")
                stats["misses"] += 1
        logger.info("OFF enrichment: %s", stats)
        return stats
