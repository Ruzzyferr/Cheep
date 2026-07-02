"""Screenshot specific routes. Usage: python scripts/shotpaths.py"""
import sys, io
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = "http://localhost:5173"
OUT = Path("shots"); OUT.mkdir(exist_ok=True)
SHOTS = [
    ("/", "r-home", 0),
    ("/", "r-coverage", 4050),
    ("/privacy", "r-privacy", 0),
    ("/delete", "r-delete", 0),
    ("/terms", "r-terms", 0),
]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5,
                        locale="tr-TR", reduced_motion="reduce")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)[:300]))
    pg.on("console", lambda m: errs.append("console.error: " + m.text[:240]) if m.type == "error" else None)
    for path, tag, y in SHOTS:
        pg.goto(BASE + path, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)
        if y:
            pg.evaluate(f"window.scrollTo(0,{y})")
            pg.wait_for_timeout(1200)
        pg.screenshot(path=str(OUT / f"{tag}.png"))
        print("shot", tag)
    if errs:
        print("\n--- ERRORS ---")
        for e in errs[:20]:
            print(e)
    else:
        print("\nno errors")
    b.close()
