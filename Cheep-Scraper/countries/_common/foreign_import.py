"""
EAN-forwarding importer for foreign countries.
Scrape → bulk-upsert. No LLM matcher: the backend merges cross-store by EAN.
"""
import logging
import os
import re
import requests
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

CHUNK_SIZE = 900          # backend hard limit is 1000
ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu", "szt", "opak"}


def _resolve_prefix_slug(raw_cat: str, category_map: Dict[str, str]) -> Optional[str]:
    """Longest-prefix-wins lookup over `category_map` entries keyed
    `"prefix:<breadcrumb-prefix>"`. Used as a fallback when an exact
    `category_map[raw_cat]` lookup misses — lets one entry cover an entire
    breadcrumb subtree (e.g. thousands of Lidl PL category paths) instead of
    requiring one exact key per leaf. Returns None when no prefix key
    matches."""
    best_prefix = ""
    best_slug: Optional[str] = None
    for key, slug in category_map.items():
        if not key.startswith("prefix:"):
            continue
        prefix = key[len("prefix:"):]
        if prefix and raw_cat.startswith(prefix) and len(prefix) > len(best_prefix):
            best_prefix = prefix
            best_slug = slug
    return best_slug


def _slugify(name: str) -> str:
    """Deterministic slug for the store_sku fallback: lowercase, non-alphanumeric
    runs collapsed to a single '-', trimmed. Never returns an empty string."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        slug = f"h{abs(hash(name))}"
    return slug


def build_api_payloads(
    products: List[Dict],
    store_id: int,
    category_map: Optional[Dict[str, str]] = None,
    default_unit: str = "adet",
) -> List[Dict]:
    """Map scraped product dicts to backend bulk-upsert payloads.

    Forwards the scraped `barcode` to the backend field `ean_barcode`.
    `category_map` (raw category string -> canonical name) is optional; when a
    category can't be resolved the field is simply omitted (category is tertiary).
    `default_unit` can be per-country (e.g., "szt" for Poland).
    """
    payloads: List[Dict] = []
    for product in products:
        name = (product.get("name") or "").strip()
        if not name:
            continue
        try:
            price = float(product.get("price", 0))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue

        sku = product.get("sku") or product.get("store_sku") or f"{store_id}-{_slugify(name)[:48]}"
        unit = (product.get("unit") or default_unit).lower()
        if unit not in ALLOWED_UNITS:
            unit = default_unit
        if unit == "adet" and default_unit != "adet":
            # Türkçe fallback yabancı ülke satırına sızmasın (spec: sıfır 'adet' PL'de)
            unit = default_unit

        # Fiyat her zaman PAKET başına (raf fiyatı). g/ml/cl asla fiyat birimi olamaz;
        # kg/l ancak paket tam 1 kg/1 l ise fiyat birimiyle çakışır. Aksi halde paket
        # birimi (szt/adet) gönder — yoksa uygulama 200g tereyağını 'zł/kg' gibi gösterir.
        qty = product.get("quantity")
        if unit in ("g", "ml", "cl"):
            unit = default_unit
        elif unit in ("kg", "l") and qty is not None and float(qty) != 1.0:
            unit = default_unit

        payload: Dict = {
            "store_id": int(store_id),
            "store_sku": str(sku),
            "price": f"{price:.2f}",
            "unit": unit,
            "source": "scrape",
            "confidence_score": 1.0,
            "name": name,
        }
        barcode = product.get("barcode")
        if barcode:
            payload["ean_barcode"] = str(barcode).strip()
        if product.get("brand"):
            payload["brand"] = str(product["brand"])
        image_url = product.get("image_url")
        if image_url and _is_clean_absolute_url(str(image_url)):
            payload["image_url"] = str(image_url)
        raw_cat = (product.get("raw_category") or product.get("category") or "").strip()
        if category_map and raw_cat:
            slug = category_map.get(raw_cat) or _resolve_prefix_slug(raw_cat, category_map)
            if slug:
                payload["category_slug"] = slug
        payloads.append(payload)
    return payloads


def _is_clean_absolute_url(url: str) -> bool:
    """True only for a non-empty absolute http(s) URL with no unresolved
    placeholder braces or whitespace.

    The backend validates `image_url` with `Joi.string().uri({allowRelative:
    false})` and rejects the WHOLE bulk-upsert chunk (up to 900 items) if any
    single item fails validation — e.g. Migros CH's `{stack}` CDN size
    placeholder. Omitting a malformed image_url here (rather than sending it)
    means one bad URL can never take down an entire ingest chunk, regardless
    of which chain/scraper produced it.
    """
    if not url.startswith("http://") and not url.startswith("https://"):
        return False
    return not any(c in url for c in ("{", "}", " ", "\t", "\n", "\r"))


class ForeignImporter:
    """Posts EAN-forwarded payloads to the backend, chunked and country-scoped."""

    def __init__(self, api_url: str, country_code: str, api_key: Optional[str] = None):
        self.api_url = api_url.rstrip("/")
        self.country_code = country_code
        self.headers = {"x-country": country_code}
        key = api_key if api_key is not None else os.getenv("INGEST_API_KEY")
        if key:
            self.headers["x-api-key"] = key
        else:
            logger.warning(
                "INGEST_API_KEY not set — all ingest requests will 401 (no x-api-key header)"
            )

    def import_products(
        self,
        products: List[Dict],
        store_id: int,
        category_map: Optional[Dict[str, str]] = None,
        default_unit: str = "adet",
    ) -> Dict:
        payloads = build_api_payloads(products, store_id, category_map, default_unit)
        stats = {"total": 0, "successful": 0, "failed": 0}
        for i in range(0, len(payloads), CHUNK_SIZE):
            chunk = payloads[i:i + CHUNK_SIZE]
            stats["total"] += len(chunk)
            try:
                resp = requests.post(
                    f"{self.api_url}/store-prices/bulk-upsert",
                    json={"prices": chunk},
                    headers=self.headers,
                    timeout=120,
                )
                if not resp.ok:
                    logger.error("Ingest HTTP %s for store %s", resp.status_code, store_id)
                    stats["failed"] += len(chunk)
                    continue
                body = resp.json() if resp.content else {}
                ok = body.get("successful", body.get("success_count", len(chunk)))
                stats["successful"] += ok
                stats["failed"] += len(chunk) - ok
            except (requests.RequestException, ValueError) as e:
                # ValueError covers json.JSONDecodeError: an HTTP-200-but-malformed
                # body must not abort the whole loop — isolate the failure to this chunk.
                logger.error("Ingest failed for store %s: %s", store_id, e)
                stats["failed"] += len(chunk)
        return stats
