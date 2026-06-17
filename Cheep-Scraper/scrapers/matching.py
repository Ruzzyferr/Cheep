"""
Deterministic cross-market product matching.

Groups equivalent products across markets (the "same product, different store"
problem) so prices can be compared. No LLM: a size-bucketed fingerprint of the
significant name tokens (brand included), refined by Jaccard token similarity
within the same package size.

A fingerprint deliberately includes the package size — "Pınar Süt 1 L" and
"Pınar Süt 500 ml" are different purchasable products and must not be merged.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable, List

# Tokens that carry no product-identity signal.
_STOPWORDS = {
    "li", "lu", "lik", "luk", "adet", "paket", "kutu",
    "ve", "ile", "icin", "the", "no", "numara", "boy", "tane", "x",
}
# Unit / measurement tokens to drop from identity (size handled separately).
_UNIT_TOKENS = {"kg", "g", "gr", "l", "lt", "ml", "cl", "cc", "litre", "gram"}

_TR = str.maketrans({"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
                     "ç": "c", "Ç": "c", "ö": "o", "Ö": "o", "ü": "u", "Ü": "u",
                     "â": "a", "Â": "a"})


def _norm(text: str) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = t.translate(_TR).lower()
    t = re.sub(r"%\s*\d+([.,]\d+)?", " ", t)        # drop fat-percentages
    t = re.sub(r"[^a-z0-9\s]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def sig_tokens(name: str) -> frozenset:
    """Significant identity tokens from a product name (brand + descriptors)."""
    out = set()
    for tok in _norm(name).split():
        if tok in _UNIT_TOKENS or tok in _STOPWORDS:
            continue
        if tok.isdigit():
            continue
        if len(tok) <= 1:
            continue
        out.add(tok)
    return frozenset(out)


def _size_key(qty, unit) -> str:
    try:
        q = round(float(qty), 3)
    except (TypeError, ValueError):
        q = 0.0
    return f"{q}{(unit or 'adet').lower()}"


def fingerprint(name: str, qty, unit) -> str:
    """Order-invariant identity string: sorted significant tokens + size."""
    toks = "-".join(sorted(sig_tokens(name)))
    return f"{toks}|{_size_key(qty, unit)}"


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def group_products(products: List, threshold: float = 0.6) -> List[List]:
    """Cluster products into equivalence groups across markets.

    Two products may group only if they share the same package size; within a
    size bucket they merge when token-Jaccard >= threshold (exact fingerprint is
    the special case Jaccard == 1.0).
    """
    items = list(products)
    n = len(items)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    # bucket by size so we only compare same-size products
    buckets = {}
    toks = [sig_tokens(p.name) for p in items]
    for i, p in enumerate(items):
        buckets.setdefault(_size_key(p.quantity, p.unit), []).append(i)

    for idxs in buckets.values():
        for a_pos in range(len(idxs)):
            i = idxs[a_pos]
            for b_pos in range(a_pos + 1, len(idxs)):
                j = idxs[b_pos]
                if _jaccard(toks[i], toks[j]) >= threshold:
                    union(i, j)

    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(items[i])
    return list(groups.values())


def assign_group_ids(products: List) -> int:
    """Set `.muadil_grup` on each product to its group index. Returns group count."""
    groups = group_products(products)
    for gid, g in enumerate(groups):
        for p in g:
            try:
                setattr(p, "muadil_grup", gid)
            except Exception:
                pass
    return len(groups)
