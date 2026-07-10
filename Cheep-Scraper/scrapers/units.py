"""
Robust quantity / unit parsing and unit-price computation for grocery products.

Used by every market scraper so gramaj (size) and unit-price are consistent and
correct across markets — the basis for fair price comparison.
"""
from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple

# Canonical units we normalize to.
_UNIT_MAP = {
    "kg": "kg", "kilogram": "kg", "kilo": "kg",
    "g": "g", "gr": "g", "gram": "g", "grams": "g",
    "l": "l", "lt": "l", "litre": "l", "liter": "l", "lit": "l",
    "ml": "ml", "mililitre": "ml", "milliliter": "ml", "cc": "ml",
    "cl": "cl",
    "adet": "adet", "ad": "adet", "piece": "adet", "pcs": "adet", "x": "adet",
    "paket": "paket", "pk": "paket",
    "kutu": "kutu",
    "rulo": "rulo",
    "szt": "szt", "szt.": "szt", "sztuk": "szt", "sztuki": "szt", "sztuka": "szt",
    "opak": "opak", "opak.": "opak", "opakowanie": "opak", "opakowania": "opak",
    "litr": "l", "litry": "l", "litrów": "l",
}

# Unit tokens for regex, longest first so 'gram' wins over 'g', 'litre' over 'lt'/'l'.
_UNIT_TOKENS = [
    "kilogram", "mililitre", "milliliter", "kilo", "litre", "liter",
    "gram", "grams", "kg", "gr", "lt", "ml", "cl", "cc", "lit",
    "opakowanie", "opakowania", "sztuki", "sztuka", "sztuk", "litrów", "litry", "litr", "opak", "szt",
    "adet", "paket", "rulo", "g", "l",
]
_UNIT_ALT = "|".join(_UNIT_TOKENS)

_NUM = r"\d+(?:[.,]\d+)?"
# 2x200 g  /  6 x 1 L  /  6*180 ml  /  6X1L  (any of x × * as the multiplier)
_MULTIPACK_RE = re.compile(
    rf"(\d+)\s*[x×*]\s*({_NUM})\s*({_UNIT_ALT})\b", re.IGNORECASE
)
# 500 g  /  1,5 L  /  500ml
_SIMPLE_RE = re.compile(rf"({_NUM})\s*({_UNIT_ALT})\b", re.IGNORECASE)
# count packs: 10'lu / 32'li / 6 lı / 24'lük  -> count
_COUNTPACK_RE = re.compile(r"(\d+)\s*['’`]?\s*(?:li|lı|lu|lü|lük|lik|luk|adet|adetlik|ad)\b",
                           re.IGNORECASE)

# Units whose size is a real physical amount (volume / mass), as opposed to a
# discrete piece count. For these a count multiplier means "N items of X each".
_VOLUME_MASS_UNITS = frozenset({"l", "ml", "cl", "g", "kg"})

# Above this count a "N'li … Xg/ml" can mean N pieces of a TOTAL X (100'lü 320 g
# tea) rather than N units of X each; at/below it the size is per-unit (6'lı 200
# ml ayran = 1200 ml). Multipacks written "N x X" are ALWAYS per-unit.
_PER_UNIT_COUNT_MAX = 12


def _to_float(s: str) -> float:
    return float(s.replace(",", "."))


def _base(qty: float, unit: str) -> str:
    """Canonical (grams / millilitres / adet) numeric+unit string for a size."""
    u = normalize_unit(unit)
    if u == "kg":
        return f"{round(qty * 1000, 2)}g"
    if u in ("g",):
        return f"{round(qty, 2)}g"
    if u in ("l",):
        return f"{round(qty * 1000, 2)}ml"
    if u == "cl":
        return f"{round(qty * 10, 2)}ml"
    if u == "ml":
        return f"{round(qty, 2)}ml"
    return f"{round(qty, 2)}adet"


def extract_size_and_pack(text):
    """Return (total_qty, unit, pack_count) parsed from a name/size string.

    - "6x200 ml" / "6*200 ml"      -> (1200, ml, 6)   (explicit per-unit pack)
    - "İçim Ayran 6'lı 200 ml"     -> (1200, ml, 6)   (count<=12 -> per-unit)
    - "Lipton 100'lü 320 g"        -> (320,  g, 100)  (count>12  -> size is total)
    - "Süt 1 L"                    -> (1.0,  l, 1)
    - "Yumurta 10'lu"              -> (10,   adet, 1) (no size -> count is the qty)
    """
    if not text:
        return (1.0, "adet", 1)

    m = _MULTIPACK_RE.search(text)
    if m:
        count = int(m.group(1))
        amount = _to_float(m.group(2))
        return (round(count * amount, 4), normalize_unit(m.group(3)), count)

    size_matches = list(_SIMPLE_RE.finditer(text))
    cm = _COUNTPACK_RE.search(text)
    count = int(cm.group(1)) if cm else 1

    if size_matches:
        last = size_matches[-1]
        amount = _to_float(last.group(1))
        unit = normalize_unit(last.group(2))
        if count > 1:
            # Small counts are unambiguous per-unit multipacks (6'lı 200 ml).
            if count <= _PER_UNIT_COUNT_MAX:
                return (round(count * amount, 4), unit, count)
            # Large counts: only suppress the count for DISCRETE/piece sizes. For a
            # volume/mass per-pack size we must not collapse to a single unit. When
            # the per-pack amount is a typical per-unit size (small relative to the
            # count, e.g. "24'lü 1 L"), multiply count×size for the true total;
            # when it is clearly already a TOTAL (large, e.g. "100'lü 320 g" tea),
            # keep it as-is.
            if unit in _VOLUME_MASS_UNITS and amount <= count:
                return (round(count * amount, 4), unit, count)
        return (amount, unit, count if count > 1 else 1)

    if cm:  # count pack with no mass/volume size -> the count IS the quantity
        return (float(count), "adet", 1)

    return (1.0, "adet", 1)


def normalize_unit(unit: Optional[str]) -> str:
    if not unit:
        return "adet"
    return _UNIT_MAP.get(unit.strip().lower(), unit.strip().lower())


def parse_quantity_and_unit(text: Optional[str]) -> Tuple[float, str]:
    """Parse a quantity string. Returns (TOTAL quantity, canonical_unit).

    "2x200 g" -> (400.0, "g"); "1,5 L" -> (1.5, "l"); "6'lı 200 ml" -> (1200.0,
    "ml"); falls back to (1.0, "adet"). A multipack's TOTAL content is returned so
    a 6-pack never compares as a single bottle.
    """
    qty, unit, _ = extract_size_and_pack(text or "")
    return (qty, unit)


def extract_size_from_name(name: Optional[str]) -> Tuple[float, str]:
    """Extract TOTAL package size from a product name (see extract_size_and_pack)."""
    qty, unit, _ = extract_size_and_pack(name or "")
    return (qty, unit)


def compute_unit_price(
    price: Decimal, quantity: float, unit: str
) -> Tuple[Optional[Decimal], Optional[str]]:
    """Compute price per base unit (kg / l / adet) for fair comparison.

    g -> per kg, ml -> per l, kg/l/adet -> per themselves. Returns (None, None)
    on invalid input.
    """
    if price is None or quantity is None or quantity <= 0:
        return (None, None)
    u = normalize_unit(unit)
    price = Decimal(str(price))
    q = Decimal(str(quantity))

    if u == "g":
        base_qty, base_unit = q / Decimal(1000), "kg"
    elif u == "ml":
        base_qty, base_unit = q / Decimal(1000), "l"
    elif u in ("kg", "l"):
        base_qty, base_unit = q, u
    elif u == "cl":
        base_qty, base_unit = q / Decimal(100), "l"
    else:  # adet, szt, paket, kutu, opak, rulo, ...
        base_qty, base_unit = q, u if u in ("adet", "szt") else "adet"

    if base_qty <= 0:
        return (None, None)
    unit_price = (price / base_qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return (unit_price, base_unit)
