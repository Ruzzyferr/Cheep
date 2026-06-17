"""Re-classify the latest matched_*.json with the current taxonomy (no re-scrape).
New name-based classification wins; if it yields 'Diğer', keep the existing
(raw-category-derived) assignment. Writes matched_reclassified_<ts>.json."""
import json, glob, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
from util.taxonomy import classify

OUT = Path(__file__).resolve().parent / "output"
f = sorted(glob.glob(str(OUT / "matched_2*.json")))[-1]
cat = json.load(open(f, encoding="utf-8"))
changed = 0
for c in cat:
    nt, ns = classify(c["name"], None)
    if nt != "Diğer" and (nt != c["category_top"] or ns != c["category_sub"]):
        c["category_top"], c["category_sub"] = nt, ns
        changed += 1
import collections
ts = f.split("matched_")[-1].replace(".json", "")
newf = OUT / f"matched_reclassified_{ts}.json"
json.dump(cat, open(newf, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
dist = collections.Counter(c["category_top"] for c in cat)
print(f"yeniden sınıflandı: {changed}/{len(cat)} ürün kategori değiştirdi -> {newf.name}")
print("Diğer:", dist.get("Diğer", 0), f"({100*dist.get('Diğer',0)/len(cat):.1f}%)")
print("dağılım:", ", ".join(f"{k}={v}" for k,v in dist.most_common()))
