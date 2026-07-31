"""Bölüm bazlı ekran görüntüsü: verilen #id'lere kaydırıp mobil/masaüstü çeker.

Kullanım:  SITE=http://localhost:4173 python scripts/sectionshots.py [yol] [etiket]
Örnek:     SITE=http://localhost:4173 python scripts/sectionshots.py /pl plhome
"""
import io
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = os.environ.get("SITE", "http://localhost:4173")
PATH = sys.argv[1] if len(sys.argv) > 1 else "/"
TAG = sys.argv[2] if len(sys.argv) > 2 else "sec"
OUT = Path("shots")
OUT.mkdir(exist_ok=True)

SECTIONS = ["compare", "how", "savings", "coverage", "features", "faq", "download"]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, w, h, mobile in [("m", 390, 844, True), ("d", 1440, 900, False)]:
        ctx = browser.new_context(
            viewport={"width": w, "height": h},
            device_scale_factor=2 if mobile else 1,
            locale="tr-TR",
            reduced_motion="reduce",
            is_mobile=mobile,
            has_touch=mobile,
        )
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.on("console", lambda m: errs.append("console.error: " + m.text[:200]) if m.type == "error" else None)
        page.goto(BASE + PATH, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2000)

        for sec in SECTIONS:
            el = page.query_selector(f"#{sec}")
            if not el:
                print(f"  !! #{sec} yok")
                continue
            el.scroll_into_view_if_needed()
            page.wait_for_timeout(900)
            page.screenshot(path=str(OUT / f"{TAG}-{name}-{sec}.png"))

        # footer
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT / f"{TAG}-{name}-footer.png"))

        print(f"{name} ({w}x{h}): {len(SECTIONS) + 1} kare" + (f" | HATA {errs[:3]}" if errs else " | hatasız"))
        ctx.close()
    browser.close()
