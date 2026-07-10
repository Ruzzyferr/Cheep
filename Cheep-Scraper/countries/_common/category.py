"""Thin category mapping + product validation shared by foreign country scrapers."""
from typing import Dict, List, Optional, Union

ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu", "szt", "opak"}


def canonical_category(raw: Optional[str], category_map: Dict[str, str]) -> Optional[str]:
    """Case-insensitive raw→canonical lookup. Returns None when unmapped/empty."""
    if not raw:
        return None
    lowered = {k.lower(): v for k, v in category_map.items()}
    return lowered.get(raw.strip().lower())


def _get(item: Union[dict, object], key: str, default=None):
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def assert_valid_products(products: List, *, require_barcode: bool = False) -> None:
    """Assert structural validity of scraped products (Product objects or dicts)."""
    assert products, "no products produced"
    for idx, p in enumerate(products):
        name = _get(p, "name")
        assert name and str(name).strip(), f"product[{idx}] has empty name"
        price = _get(p, "price")
        assert price is not None and float(price) > 0, f"product[{idx}] price must be > 0"
        unit = (_get(p, "unit") or "adet")
        assert str(unit).lower() in ALLOWED_UNITS, f"product[{idx}] invalid unit {unit!r}"
        cc = _get(p, "country_code")
        assert cc, f"product[{idx}] missing country_code"
        if require_barcode:
            bc = _get(p, "barcode")
            assert bc and str(bc).isdigit(), f"product[{idx}] barcode must be digits, got {bc!r}"
