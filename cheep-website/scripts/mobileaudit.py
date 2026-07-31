"""Mobile audit: full-page shots at phone width + overflow/tap-target diagnostics.
Usage: python scripts/mobileaudit.py [tag]
"""
import sys, io, json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
TAG = sys.argv[1] if len(sys.argv) > 1 else "mob"
URL = os.environ.get("SITE", "http://localhost:5173")
OUT = Path("shots"); OUT.mkdir(exist_ok=True)

DIAG = """() => {
  const vw = document.documentElement.clientWidth;
  const over = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    if (r.right > vw + 1 || r.left < -1) {
      over.push({ tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().slice(0,90),
                  left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
    }
  });
  const small = [];
  document.querySelectorAll('a,button').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.height < 44 || r.width < 44) small.push({ text: (el.innerText||'').trim().slice(0,30), w: Math.round(r.width), h: Math.round(r.height) });
  });
  return { vw, scrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth,
           overflow: over.slice(0, 25), smallTargets: small.slice(0, 25) };
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, w, h in [("s", 360, 740), ("m", 390, 844)]:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2,
                            locale="tr-TR", reduced_motion="reduce", is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)[:200]))
        pg.goto(URL, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(OUT / f"{TAG}-{name}-hero.png"))
        d = pg.evaluate(DIAG)
        print(f"\n=== {w}x{h} ===")
        print(json.dumps(d, ensure_ascii=False, indent=1))
        if errs: print("ERRORS:", errs[:5])
        # scroll shots
        total = pg.evaluate("document.body.scrollHeight")
        y, i = 0, 1
        while y < total and i <= 10:
            pg.evaluate(f"window.scrollTo(0,{y})")
            pg.wait_for_timeout(900)
            pg.screenshot(path=str(OUT / f"{TAG}-{name}-{i:02d}.png"))
            y += int(h * 0.92); i += 1
        ctx.close()
    b.close()
print("\ndone")
