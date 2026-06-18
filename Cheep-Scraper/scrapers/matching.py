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

from scrapers.units import extract_size_and_pack, _base

# Tokens that carry no product-identity signal (incl. marketing/sub-brand noise
# that must not split the same product across markets).
_STOPWORDS = {
    "li", "lu", "lik", "luk", "adet", "paket", "kutu",
    "ve", "ile", "icin", "the", "no", "numara", "boy", "tane", "x",
    "orijinal", "original", "klasik", "classic", "rahat", "lezzet",
    "nefis", "enfes", "essiz", "secme", "avantajli", "ekonomik",
    # bilingual gender dupes — "erkek"/"kadin" carry the real signal, so the English
    # tag is noise (Migros "NIVEA MEN Erkek …" must still equal A101 "Nivea … Erkek …")
    "men", "women",
}
# Unit / measurement tokens to drop from identity (size handled separately).
_UNIT_TOKENS = {"kg", "g", "gr", "l", "lt", "ml", "cl", "cc", "litre", "gram"}

# Discriminator tokens: if two same-brand, same-size products DISAGREE on any of
# these, they are NOT the same purchasable item and must never merge — even if the
# rest of the name (and Jaccard) matches. This stops the classic over-merge where
# "İçim Süt", "İçim Laktozsuz Süt", "İçim Light Süt" and even "İçim … Kefir"
# collapse into one card. Noise/sub-brand words (rahat, lezzet, gold…) are NOT
# here, so they are still tolerated.
_DISCRIMINATORS = frozenset({
    # fat / form / diet
    "laktozsuz", "light", "yarim", "tam", "yagsiz", "kaymakli", "kaymaksiz",
    "sekersiz", "glutensiz", "vegan", "diyet", "organik", "tuzsuz", "tuzlu",
    "probiyotik", "kepekli", "tahilli", "proteinli", "kafeinsiz", "gazsiz", "gazli",
    # product TYPE (same brand+size, different product)
    "sut", "sutu", "kefir", "ayran", "yogurt", "yogurdu", "peynir", "peyniri",
    "kasar", "lor", "krema", "kaymak", "tereyag", "tereyagi", "labne", "cokelek",
    "sucuk", "salam", "sosis", "jambon", "pastirma", "kavurma", "salca", "puding",
    # process / form variant (same brand+size, different shelf product)
    "granul", "granül", "cekirdek", "filtreli", "hazir kahve",
    "barista", "pastorize", "gunluk", "uht", "filtre", "cig", "kavrulmus",
    "kizarmis", "haslanmis", "tutsulu", "fume", "konsantre", "toz",
    "yedek", "doldurma", "refill", "yedekli", "biberonlu",
    # flavour (a flavour change = a different product)
    "sade", "cilek", "cilekli", "muz", "muzlu", "cikolata", "cikolatali",
    "kakao", "kakaolu", "vanilya", "vanilyali", "karamel", "karamelli",
    "findik", "findikli", "fistik", "fistikli", "orman", "meyveli", "ananas",
    "ananasli", "seftali", "visne", "visneli", "kayisi", "kayisili", "limon",
    "limonlu", "portakal", "portakalli", "naneli", "ballı", "balli", "kekikli",
    "sarimsakli", "baharatli", "peynirli", "sucuklu", "kahveli", "antep",
    # product sub-type / line (live QA: these were over-merging into fake "deals"
    # — e.g. plain "Sensodyne Diş Macunu" with "Sensodyne Whitening", "Hindi Sosis"
    # with "Hindi Kokteyl Sosis", men's vs women's deodorant). Normalized forms.
    "kokteyl", "whitening", "beyazlatici", "beyazlatma", "beyazlik",
    "erkek", "kadin", "unisex", "cocuk", "hassas", "hassasiyet",
})

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
    """Significant identity tokens from a product name (brand + descriptors).

    Model codes (Sinbo "SSM 2550", Piranha "7849") ARE identity — keeping them
    apart stops different appliance models merging into one mispriced group. But a
    SIZE number ("1000" in "1000 ml") is NOT identity (it equals "1 L"), so a
    digit token is kept only when it is a standalone code (>=3 digits and NOT
    immediately followed by a unit)."""
    out = set()
    parts = _norm(name).split()
    for idx, tok in enumerate(parts):
        if tok in _UNIT_TOKENS or tok in _STOPWORDS:
            continue
        if len(tok) <= 1:
            continue
        if tok.isdigit():
            nxt = parts[idx + 1] if idx + 1 < len(parts) else ""
            if len(tok) >= 3 and nxt not in _UNIT_TOKENS:
                out.add(tok)   # model number / code
            continue           # size digit (or short number) -> not identity
        out.add(tok)
    return frozenset(out)


def _size_key(qty, unit) -> str:
    """Canonical size bucket. Mass -> grams, volume -> millilitres, else adet.

    So 1 L and 1000 ml land in the same bucket, while 1 L (1000 ml) and 200 ml —
    or 5 kg (5000 g) and 500 g — never do. This is what keeps different package
    sizes from ever being matched as the same product.
    """
    try:
        q = float(qty)
    except (TypeError, ValueError):
        q = 0.0
    u = (unit or "adet").strip().lower()
    if u in ("kg", "kilogram", "kilo"):
        base_q, base_u = q * 1000.0, "g"
    elif u in ("g", "gr", "gram"):
        base_q, base_u = q, "g"
    elif u in ("l", "lt", "litre", "liter"):
        base_q, base_u = q * 1000.0, "ml"
    elif u == "cl":
        base_q, base_u = q * 10.0, "ml"
    elif u in ("ml", "mililitre"):
        base_q, base_u = q, "ml"
    else:
        base_q, base_u = q, "adet"
    return f"{round(base_q, 2)}{base_u}"


def brand_key(product) -> str:
    """Normalized brand for matching. Two products are the SAME purchasable item
    only if they share a brand — a shopper choosing "Bahçıvan" must never be shown
    "Tarabya" as the same product. Prefer the scraped brand field; fall back to the
    first significant name token (which is conventionally the brand in TR market
    names: "Bahçıvan Mozzarella …" -> bahcivan)."""
    b = _norm(getattr(product, "brand", "") or "")
    if b:
        # keep only the first 1-2 brand tokens (drop sub-brand noise)
        return " ".join(b.split()[:2])
    toks = [t for t in _norm(getattr(product, "name", "") or "").split()
            if t not in _UNIT_TOKENS and t not in _STOPWORDS and not t.isdigit()
            and len(t) > 1]
    return toks[0] if toks else ""


_FAT_RE = re.compile(r"%\s*\d+(?:[.,]\d+)?")

# Counted dimensions that define a distinct product even with the same gross size:
# "60 Kapsül" vs "40 Kapsül", "400 Yaprak" vs "100 Yaprak", "26 cm" vs "20 cm",
# "3 Katlı" vs "2 Katlı". Captured into the size bucket so they never merge.
_DIM_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*"
    r"(kapsul|kapsül|yaprak|yikama|yıkama|tablet|kisilik|kişilik|cm|mm|"
    r"katli|katlı|kat|metre|cap|cap|kese|kürek|kurek)\b",
    re.IGNORECASE,
)


def _dim_signature(name: str) -> str:
    out = set()
    for num, noun in _DIM_RE.findall(name or ""):
        n = num.replace(",", ".")
        noun = (noun.lower().replace("ı", "i").replace("ü", "u").replace("ş", "s")
                .replace("kapsül", "kapsul").replace("katlı", "kat").replace("katli", "kat"))
        out.add(f"{n}{noun}")
    return ",".join(sorted(out))


def variant_signature(name: str) -> str:
    """A discriminator fingerprint: the fat-% and any variant/flavour/type words
    in the name. Put in the matching BUCKET (not just a pairwise block) so that
    transitive chains can never merge "%1 Süt"—"Yağlı Süt"—"%3 Süt" into one, and
    "Çilekli"/"Muzlu"/"Laktozsuz"/"Barista" always stay separate products."""
    v = set(sig_tokens(name) & _DISCRIMINATORS)
    m = _FAT_RE.search(name or "")
    if m:
        v.add("fat" + re.sub(r"[^0-9]", "", m.group(0)))
    return "|".join(sorted(v))


def size_signature(name: str, qty=None, unit=None) -> str:
    """Pack-aware size bucket parsed from the NAME (the stored quantity can be
    inconsistent across scrapers). Combines the canonical TOTAL size with the
    pack count so a 6-pack never shares a bucket with a single bottle
    ("Cola 1,5 L 6'lı" -> 9000ml|p6, "Cola 1,5 L" -> 1500ml|p1) and two packs of
    the same total but different counts stay separate (1200ml|p6 vs 1200ml|p12)."""
    total, u, count = extract_size_and_pack(name or "")
    if total == 1.0 and u == "adet" and count == 1 and qty:
        # name carried no size token — fall back to the scraped quantity/unit
        total, u = float(qty), (unit or "adet")
    dim = _dim_signature(name)
    return f"{_base(total, u)}|p{count}" + (f"|d{dim}" if dim else "")


def fingerprint(name: str, qty, unit) -> str:
    """Order-invariant identity string: sorted significant tokens + size."""
    toks = "-".join(sorted(sig_tokens(name)))
    return f"{toks}|{size_signature(name, qty, unit)}"


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def group_products(products: List, threshold: float = 1.0) -> List[List]:
    """Cluster products into equivalence groups across markets.

    STRICT identity: two listings group only if they share the same brand, the same
    package size AND their *significant name tokens are identical* (modulo word order,
    units, sizes, and packaging/marketing noise stripped by `_STOPWORDS`). Any real
    descriptor difference keeps them apart — different versions / extra names are
    DIFFERENT products a shopper chooses between, not the same item:
      "Nivea Fresh Active" ≠ "Nivea Fresh Natural", "… Erkek" ≠ "… Kadın",
      "Sensodyne Diş Macunu" ≠ "Sensodyne Whitening Diş Macunu",
      "Hindi Sosis" ≠ "Hindi Kokteyl Sosis", "Pınar … Sosis" ≠ "Pınar Lezzet Keyfi … Sosis".
    This deliberately prefers UNDER-merging (a true twin may occasionally stay split
    if a market's naming differs) over FALSE-merging, which manufactures bogus price
    gaps / "deals". `threshold` is kept for signature compatibility but ignored.
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

    # bucket by (brand, size) so we only compare same-brand, same-size products
    buckets = {}
    toks = [sig_tokens(p.name) for p in items]
    for i, p in enumerate(items):
        sig = size_signature(p.name, getattr(p, "quantity", None), getattr(p, "unit", None))
        buckets.setdefault((brand_key(p), sig, variant_signature(p.name)), []).append(i)

    for idxs in buckets.values():
        for a_pos in range(len(idxs)):
            i = idxs[a_pos]
            for b_pos in range(a_pos + 1, len(idxs)):
                j = idxs[b_pos]
                # STRICT: merge only when the significant token sets are IDENTICAL.
                # (Word order, units, sizes and packaging/marketing noise are already
                # removed by sig_tokens/_STOPWORDS, so equality here means "same name".)
                if toks[i] == toks[j]:
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
