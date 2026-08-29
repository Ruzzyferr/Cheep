"""Beş dilin görsel denetimi: ekran görüntüsü + taşma + konsol hatası.

Yeni bir dil eklendiğinde en sık kaçan iki şey:
  1. Uzun çeviri düğmeyi/başlığı taşırıyor (Macarca ve Almanca'da sık —
     "Bevásárlólista" gibi bileşik kelimeler Türkçe karşılığından uzun).
  2. Sözlükte eksik kalan bir anahtar ekranda HAM olarak görünüyor.
Otomatik yakalanıyor; ekran görüntüleri gözle bakmak için kaydediliyor.

Kullanım: python scripts/locale-audit.py [etiket]
"""
import io
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

TAG = sys.argv[1] if len(sys.argv) > 1 else "locale"
BASE = os.environ.get("SITE", "http://localhost:4173")
OUT = Path(__file__).resolve().parents[1] / "shots"
OUT.mkdir(exist_ok=True)

LOCALES = [("tr", ""), ("pl", "/pl"), ("hr", "/hr"), ("hu", "/hu"), ("ro", "/ro")]
WIDTHS = [("telefon", 390, 844), ("masaustu", 1440, 900)]

#: Çevrilmemiş anahtar ekranda böyle görünür ("nav.download", "home.title").
RAW_KEY = r"[a-z_]+\.[a-z_]{3,}"

problems = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    for code, prefix in LOCALES:
        for label, w, h in WIDTHS:
            page = browser.new_page(viewport={"width": w, "height": h})
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))

            url = f"{BASE}{prefix}/"
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(600)

            # Reveal animasyonu ScrollTrigger'la çalışıyor: sayfayı gezmezsek
            # görüntüler boş çıkar (content-audit.py'de aynı gerekçe).
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(500)
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(300)

            # 1) YATAY TAŞMA — gövde asla yatay kaymamalı.
            overflow = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            if overflow > 1:
                problems.append(f"{code}/{label}: yatay taşma {overflow}px")

            # 2) HAM ANAHTAR — çevrilmemiş metin.
            raw = page.evaluate(
                """(re) => {
                    const rx = new RegExp('^' + re + '$');
                    const out = [];
                    for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,span,li')) {
                        const t = (el.textContent || '').trim();
                        if (t && t.length < 60 && rx.test(t)) out.push(t);
                    }
                    return [...new Set(out)];
                }""",
                RAW_KEY,
            )
            if raw:
                problems.append(f"{code}/{label}: çevrilmemiş anahtar {raw[:5]}")

            # 3) <html lang> doğru mu (SEO + ekran okuyucu).
            lang = page.get_attribute("html", "lang")
            if lang != code:
                problems.append(f"{code}/{label}: html lang='{lang}' beklenen '{code}'")

            # 4) Konsol hatası (hydration uyuşmazlığı dahil).
            real = [e for e in errors if "favicon" not in e.lower()]
            if real:
                problems.append(f"{code}/{label}: konsol hatası {real[:2]}")

            page.screenshot(path=str(OUT / f"{TAG}-{code}-{label}.png"), full_page=(w == 390))
            print(f"  {code:3s} {label:9s} taşma={overflow}px lang={lang} hata={len(real)}")
            page.close()
    browser.close()

print()
if problems:
    print(f"SORUN ({len(problems)}):")
    for p_ in problems:
        print("  -", p_)
    sys.exit(1)
print("Beş dilde de sorun bulunmadı.")
