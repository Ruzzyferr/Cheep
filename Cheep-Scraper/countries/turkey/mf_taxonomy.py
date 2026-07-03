"""
Ham veriden (mf_raw) devletin KENDİ kategori ağacını çıkarır.

Her ürün `menu_category` (üst) + `main_category` (alt) taşır. Ham ve$rideki TÜM
çiftlerin birleşimi = devletin tam taksonomisi. Böylece her kategoride ≥1 ürün olur
(boş kategori yok) ve her ürün kesin bir alt-kategoriye oturur.

Çıktı: taxonomy.json
  { "tops": [ {name, slug, order, icon, children:[{name,slug,order,count}]} ],
    "main_to_slug": { "<main_category>": "<sub-slug>" },
    "counts": {...} }
"""
import argparse
import io
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Üst kategori (menu_category) → MaterialCommunityIcons glyph + sıra.
TOP_META = {
    "Süt Ürünleri ve Kahvaltılık": ("cheese", 1),
    "Et, Tavuk ve Balık": ("food-steak", 2),
    "Meyve ve Sebze": ("fruit-watermelon", 3),
    "Temel Gıda": ("rice", 4),
    "Fırın ve Pastane": ("bread-slice", 5),
    "İçecek": ("bottle-soda-classic", 6),
    "Atıştırmalık ve Tatlı": ("cookie", 7),
    "Dondurma": ("ice-cream", 8),
    "Hazır Yemek ve Donuk": ("fridge-outline", 9),
    "Temizlik ve Kişisel Bakım Ürünleri": ("spray-bottle", 10),
    "Bebek": ("baby-carriage", 11),
    "Ev, Pet ve Yaşam": ("sofa-single", 12),
    "Sağlık ve Kozmetik": ("pill", 13),
    "Diğer Ürünler": ("dots-horizontal", 99),
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    repl = {"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
            "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c"}
    s = "".join(repl.get(c, c) for c in s)
    s = s.encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "diger"


def build(raw_dir: str):
    pairs = Counter()               # (menu, main) -> adet
    for fn in os.listdir(raw_dir):
        if not fn.endswith(".json"):
            continue
        try:
            d = json.load(open(os.path.join(raw_dir, fn), encoding="utf-8"))
        except Exception:
            continue
        menu = (d.get("menu_category") or "").strip() or "Diğer Ürünler"
        main = (d.get("main_category") or "").strip() or menu
        pairs[(menu, main)] += 1

    tops = defaultdict(list)         # menu -> [(main, count)]
    menu_count = Counter()
    for (menu, main), n in pairs.items():
        tops[menu].append((main, n))
        menu_count[menu] += n

    menu_order = sorted(tops, key=lambda m: (TOP_META.get(m, ("", 50))[1], m))
    # Tüm TOP slug'ları önce ayrılır → sub'lar bunlara karşı da benzersiz olur (global)
    top_slug_of = {menu: slugify(menu) for menu in menu_order}
    used = set(top_slug_of.values())

    out_tops = []
    main_to_slug = {}
    for menu in menu_order:
        icon, order = TOP_META.get(menu, ("shape", 50))
        top_slug = top_slug_of[menu]
        children = []
        for co, (main, n) in enumerate(sorted(tops[menu], key=lambda x: -x[1]), 1):
            base = slugify(main)
            sub_slug = base
            if sub_slug in used:                         # TOP dahil her slug'a karşı benzersiz
                sub_slug = f"{base}-{top_slug}"
            k = 2
            while sub_slug in used:
                sub_slug = f"{base}-{top_slug}-{k}"; k += 1
            used.add(sub_slug)
            children.append({"name": main, "slug": sub_slug, "order": co, "count": n})
            main_to_slug[main] = sub_slug
        out_tops.append({"name": menu, "slug": top_slug, "order": order,
                         "icon": icon, "count": menu_count[menu], "children": children})

    return {"tops": out_tops, "main_to_slug": main_to_slug,
            "total_products": sum(pairs.values()),
            "n_top": len(out_tops), "n_sub": len(main_to_slug)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", default="mf_raw")
    ap.add_argument("--out", default="taxonomy.json")
    a = ap.parse_args()
    tax = build(a.raw_dir)
    json.dump(tax, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"ÜST={tax['n_top']} ALT={tax['n_sub']} (raw ürün={tax['total_products']})")
    for t in tax["tops"]:
        subs = ", ".join(f"{c['name']}({c['count']})" for c in t["children"][:6])
        print(f"  [{t['order']:2d}] {t['name']} ({t['count']}) → {subs}{' …' if len(t['children'])>6 else ''}")
    print(f"→ {a.out}")


if __name__ == "__main__":
    main()
