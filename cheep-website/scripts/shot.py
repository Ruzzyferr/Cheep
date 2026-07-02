"""Screenshot the Cheep website at desktop + mobile, capturing console errors.
Usage: python scripts/shot.py [tag] [full]
  tag  = filename prefix (default 'cheep')
  full = if 'full', capture full-page scroll screenshots too
"""
import sys, io
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
TAG = sys.argv[1] if len(sys.argv) > 1 else "cheep"
FULL = len(sys.argv) > 2 and sys.argv[2] == "full"
URL = "http://localhost:5173"
OUT = Path("shots"); OUT.mkdir(exist_ok=True)
errs = []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5, locale="tr-TR",
                        reduced_motion="reduce")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)[:300]))
    pg.on("console", lambda m: errs.append("console.error: " + m.text[:240]) if m.type == "error" else None)
    pg.goto(URL, wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(3500)  # fonts + canvas warmup

    # viewport hero
    pg.screenshot(path=str(OUT / f"{TAG}-hero.png"))
    print("shot hero")

    if FULL:
        h = pg.evaluate("document.body.scrollHeight")
        vh = 900
        i = 1
        y = 0
        while y < h and i <= 12:
            pg.evaluate(f"window.scrollTo(0, {y})")
            pg.wait_for_timeout(1200)
            pg.screenshot(path=str(OUT / f"{TAG}-{i:02d}.png"))
            print(f"shot {i} @ y={y}")
            y += int(vh * 0.9)
            i += 1
        # full page
        pg.evaluate("window.scrollTo(0,0)")
        pg.wait_for_timeout(800)
        pg.screenshot(path=str(OUT / f"{TAG}-fullpage.png"), full_page=True)
        print("shot fullpage")

    # close desktop context first so we don't run two WebGL contexts at once
    ctx.close()

    # mobile
    m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="tr-TR",
                      reduced_motion="reduce")
    mp = m.new_page()
    mp.goto(URL, wait_until="networkidle", timeout=60000)
    mp.wait_for_timeout(3000)
    mp.screenshot(path=str(OUT / f"{TAG}-mobile.png"))
    print("shot mobile")

    if errs:
        print("\n--- ERRORS ---")
        for e in errs[:20]:
            print(e)
    else:
        print("\nno console/page errors")
    b.close()
