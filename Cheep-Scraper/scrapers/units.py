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
}

# Unit tokens for regex, longest first so 'gram' wins over 'g', 'litre' over 'lt'/'l'.
_UNIT_TOKENS = [
    "kilogram", "mililitre", "milliliter", "kilo", "litre", "liter",
    "gram", "grams", "kg", "gr", "lt", "ml", "cl", "cc", "lit",
    "adet", "paket", "rulo", "g", "l",
]
_UNIT_ALT = "|".join(_UNIT_TOKENS)

_NUM = r"\d+(?:[.,]\d+)?"
# 2x200 g  /  6 x 1 L
_MULTIPACK_RE = re.compile(
    rf"(\d+)\s*[x×]\s*({_NUM})\s*({_UNIT_ALT})\b", re.IGNORECASE
)
# 500 g  /  1,5 L  /  500ml
_SIMPLE_RE = re.compile(rf"({_NUM})\s*({_UNIT_ALT})\b", re.IGNORECASE)
# count packs: 10'lu / 32'li / 6 lı / 24'lük  -> (count, adet)
_COUNTPACK_RE = re.compile(r"(\d+)\s*['’`]?\s*(?:li|lı|lu|lü|lük|lik|luk|adet|adetlik)\b",
                           re.IGNORECASE)


def _to_float(s: str) -> float:
    return float(s.replace(",", "."))


def normalize_unit(unit: Optional[str]) -> str:
    if not unit:
        return "adet"
    return _UNIT_MAP.get(unit.strip().lower(), unit.strip().lower())


def parse_quantity_and_unit(text: Optional[str]) -> Tuple[float, str]:
    """Parse a quantity string. Returns (quantity, canonical_unit).

    "2x200 g" -> (400.0, "g"); "1,5 L" -> (1.5, "l"); falls back to (1.0, "adet").
    """
    if not text:
        return (1.0, "adet")
    s = text.strip()

    m = _MULTIPACK_RE.search(s)
    if m:
        count = float(m.group(1))
        amount = _to_float(m.group(2))
        return (round(count * amount, 4), normalize_unit(m.group(3)))

    m = _SIMPLE_RE.search(s)
    if m:
        return (_to_float(m.group(1)), normalize_unit(m.group(2)))

    return (1.0, "adet")


def extract_size_from_name(name: Optional[str]) -> Tuple[float, str]:
    """Extract package size from a product name.

    Prefers a multipack token; otherwise the last size token in the name
    (sizes are conventionally at the end). Returns (1.0, "adet") if none found.
    """
    if not name:
        return (1.0, "adet")

    m = _MULTIPACK_RE.search(name)
    if m:
        count = float(m.group(1))
        amount = _to_float(m.group(2))
        return (round(count * amount, 4), normalize_unit(m.group(3)))

    matches = list(_SIMPLE_RE.finditer(name))
    if matches:
        last = matches[-1]
        return (_to_float(last.group(1)), normalize_unit(last.group(2)))

    # no mass/volume size -> try a count pack (10'lu, 32'li, 24'lük)
    cm = _COUNTPACK_RE.search(name)
    if cm:
        return (float(cm.group(1)), "adet")

    return (1.0, "adet")


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
    else:  # adet, paket, kutu, rulo, ...
        base_qty, base_unit = q, "adet"

    if base_qty <= 0:
        return (None, None)
    unit_price = (price / base_qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return (unit_price, base_unit)
