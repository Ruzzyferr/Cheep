"""Sosyal paylaşım kartlarını (og:image) üretir — 1200x630, dil başına bir dosya.

HTML'i Playwright ile ekran görüntüsüne çevirir; çıktı public/og.png ve
public/og-pl.png olur (src/seo/pages.ts bu adları bekler).

Kullanım:  python scripts/gen-og.py
"""
import io
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
BIRD = (PUBLIC / "cheep-favicon.svg").read_text(encoding="utf-8")

CARDS = {
    "og.png": {
        "title": "Aynı ürün.<br><span class='accent'>En ucuz fiyat.</span>",
        "sub": "Market fiyatlarını karşılaştır, alışveriş listeni en ucuz sepete taşı.",
        "chips": ["Türkiye · Polonya", "23.500+ market şubesi", "Ücretsiz"],
    },
    "og-pl.png": {
        "title": "Ten sam produkt.<br><span class='accent'>Najniższa cena.</span>",
        "sub": "Porównaj ceny w sklepach i przenieś listę zakupów do najtańszego koszyka.",
        "chips": ["Polska · Turcja", "23 500+ sklepów", "Bezpłatnie"],
    },
}

TEMPLATE = """
<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600&family=Space+Grotesk:wght@700&family=Space+Mono:wght@700&display=swap" rel="stylesheet">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: #FBFAF6; font-family: 'Hanken Grotesk', sans-serif; color: #14211B;
  }}
  .glow {{ position: absolute; border-radius: 50%; filter: blur(120px); }}
  .g1 {{ width: 520px; height: 520px; background: rgba(87,201,154,.55); left: -140px; top: -160px; }}
  .g2 {{ width: 460px; height: 460px; background: rgba(240,104,43,.40); right: -120px; bottom: -180px; }}
  .wrap {{ position: relative; padding: 72px 80px; height: 100%; display: flex; flex-direction: column; }}
  .brand {{ display: flex; align-items: center; gap: 18px; }}
  .brand svg {{ width: 76px; height: 76px; }}
  .brand span {{ font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 46px; color: #0F3A29; letter-spacing: -.02em; }}
  h1 {{
    font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 86px;
    line-height: .98; letter-spacing: -.04em; margin-top: 44px;
  }}
  .accent {{ color: #F0682B; }}
  p {{ font-size: 29px; line-height: 1.4; color: #5B6B62; margin-top: 26px; max-width: 830px; }}
  .chips {{ margin-top: auto; display: flex; gap: 14px; align-items: center; }}
  .chip {{
    font-family: 'Space Mono', monospace; font-weight: 700; font-size: 20px;
    padding: 13px 24px; border-radius: 999px; background: #E8F7EF; color: #1F6F4A;
  }}
  .url {{ margin-left: auto; font-family: 'Space Mono', monospace; font-weight: 700; font-size: 24px; color: #0F3A29; }}
</style></head>
<body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="wrap">
    <div class="brand">{bird}<span>Cheep</span></div>
    <h1>{title}</h1>
    <p>{sub}</p>
    <div class="chips">{chips}<span class="url">cheep.live</span></div>
  </div>
</body></html>
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)

    for filename, card in CARDS.items():
        chips = "".join(f'<span class="chip">{c}</span>' for c in card["chips"])
        html = TEMPLATE.format(bird=BIRD, title=card["title"], sub=card["sub"], chips=chips)
        page.set_content(html, wait_until="networkidle")
        page.wait_for_timeout(1200)  # web font yerleşsin
        out = PUBLIC / filename
        page.screenshot(path=str(out))
        print(f"{filename}: {out.stat().st_size // 1024} KB")

    browser.close()
