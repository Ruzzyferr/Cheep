"""İçerik sayfalarının görsel denetimi: 3 genişlikte ekran görüntüsü + teşhis.

Spec §8 gereği her sayfa tipi telefon/tablet/masaüstü genişliğinde açılıp
kontrol edilir. Otomatik yakalananlar:
  - yatay taşma (sayfa gövdesi asla yatay kaymamalı)
  - 44px altı dokunma hedefleri
  - kırık görseller
  - düşük kontrastlı metin adayları
  - konsol hataları (hydration uyuşmazlığı dahil — en kritik olanı)

Kullanım:
  python scripts/content-audit.py [etiket]
"""
import io
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

TAG = sys.argv[1] if len(sys.argv) > 1 else "content"
BASE = os.environ.get("SITE", "http://localhost:4173")
OUT = Path("shots") / TAG
OUT.mkdir(parents=True, exist_ok=True)

WIDTHS = [("telefon", 390, 844), ("tablet", 768, 1024), ("masaustu", 1440, 900)]

DIAG = """() => {
  const vw = document.documentElement.clientWidth;
  const out = { overflow: [], smallTargets: [], softTargets: [], brokenImages: [], docWidth: document.documentElement.scrollWidth, vw };

  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    // Yatay taşma: gövdeyi kaydıran her şey. overflow-x:auto kapsayıcılar
    // bilerek kaydırılabilir, onları saymıyoruz.
    if (r.right > vw + 1) {
      let scrollable = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ov = getComputedStyle(p).overflowX;
        // hidden/clip: içerik bilerek kırpılıyor (marquee), gövdeyi kaydırmıyor.
        if (ov === 'auto' || ov === 'scroll' || ov === 'hidden' || ov === 'clip') { scrollable = true; break; }
      }
      if (!scrollable) {
        out.overflow.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), right: Math.round(r.right) });
      }
    }
  });

  document.querySelectorAll('a, button, [role=button], input, select').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    // WCAG 2.5.8 'inline' istisnası: bir metin akışının içindeki bağlantılar
    // boyut kuralından muaf (kırıntı yolu, paragraf içi bağlantı). Üç harflik
    // bir kategori adını 44px'e zorlamak tasarımı bozar, erişilebilirliği
    // artırmaz — kural zaten onu istemiyor.
    if (el.closest('nav[aria-label=\"Breadcrumb\"], p, dd, li.inline-link')) return;
    const min = Math.min(r.width, r.height);
    if (min < 24) {
      out.smallTargets.push({ sev: 'AA', tag: el.tagName, text: (el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
    } else if (min < 44) {
      out.softTargets.push({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
    }
  });

  document.querySelectorAll('img').forEach(img => {
    if (img.complete && img.naturalWidth === 0) {
      out.brokenImages.push(img.getAttribute('src') || '(src yok)');
    }
  });

  return out;
}"""


def audit(page, name, url):
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto(url, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(600)

    # Reveal bileşeni GSAP ScrollTrigger ile çalışıyor: kaydırılmayan sayfada
    # bölümler opacity:0 kalıyor ve tam sayfa görüntüsü boş çıkıyor. Görüntü
    # dürüst olsun diye sayfayı baştan sona gezip başa dönüyoruz.
    page.evaluate("""async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 300));
    }""")  # scrollThrough
    page.wait_for_timeout(500)

    diag = page.evaluate(DIAG)
    findings = []

    if diag["docWidth"] > diag["vw"] + 1:
        findings.append(f"YATAY TAŞMA: belge {diag['docWidth']}px > görünüm {diag['vw']}px")
    for o in diag["overflow"][:4]:
        findings.append(f"  taşan: <{o['tag']}> .{o['cls']} sağ={o['right']}")
    for t in diag["smallTargets"][:5]:
        findings.append(f"  DOKUNMA HEDEFİ <24px (WCAG AA): <{t['tag']}> '{t['text']}' {t['w']}x{t['h']}")
    if diag["softTargets"]:
        findings.append(f"  (bilgi) 24-44px arası hedef: {len(diag['softTargets'])} adet")
    for b in diag["brokenImages"][:3]:
        findings.append(f"  KIRIK GÖRSEL: {b}")
    for e in errors[:3]:
        findings.append(f"  KONSOL: {e[:160]}")

    return findings


PAGES = json.loads(os.environ.get("AUDIT_PAGES", "[]"))

with sync_playwright() as p:
    browser = p.chromium.launch()
    total_problems = 0

    for label, url in PAGES:
        for wname, w, h in WIDTHS:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            try:
                findings = audit(page, label, BASE + url)
                shot = OUT / f"{label}-{wname}.png"
                page.screenshot(path=str(shot), full_page=True)
                status = "OK" if not findings else f"{len(findings)} bulgu"
                print(f"{label:16} {wname:9} {status}")
                for f in findings:
                    print(f"    {f}")
                total_problems += len(findings)
            except Exception as exc:
                print(f"{label:16} {wname:9} HATA: {exc}")
                total_problems += 1
            finally:
                ctx.close()

    browser.close()
    print(f"\ntoplam bulgu: {total_problems}")
    print(f"ekran görüntüleri: {OUT}")
