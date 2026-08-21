"""App Store icin 6.7 inc ekran goruntuleri uretir.

Apple 6.7" (iPhone 15/16 Pro Max) icin 1290x2796 istiyor.
  viewport 430x932  x  device_scale_factor 3  =  1290x2796  (tam isabet)

Gezinme mumkun oldugunca METIN uzerinden yapiliyor; eski homeshot/detailshot
scriptlerindeki sabit piksel koordinatlari 390x844'e gore yazilmisti ve bu
viewport'ta kayiyor. Yalnizca ikon (arama) icin koordinat kullaniliyor.

Kullanim:  npx expo start --web  calisiyorken  ->  python appstore_shots.py
"""
import sys, io, argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Dil/ulke parametreleri: App Store yerellestirmeleri icin ayri setler uretilir.
# Lehce vitrinde Polonya zincirleri ve zloty gorunmeli -> Varsova koordinati.
# ui_lang: uygulama ICI dil secicisinden secilecek secenegin etiketi.
# Tarayici locale'i arayuz dilini DEGISTIRMIYOR (i18n `lng: 'tr'` ile sabit
# baslatiliyor), o yuzden Profil > Uygulama dili uzerinden gecmek sart.
PRESETS = {
    "tr":    dict(locale="tr-TR", lat=41.01, lon=28.98, out="appstore-screenshots",    lang="tr", country="TR"),
    "en":    dict(locale="en-US", lat=41.01, lon=28.98, out="appstore-screenshots-en", lang="en", country="TR"),
    "pl":    dict(locale="pl-PL", lat=52.23, lon=21.01, out="appstore-screenshots-pl", lang="pl", country="PL"),
}
ap = argparse.ArgumentParser()
ap.add_argument("preset", nargs="?", default="tr", choices=sorted(PRESETS))
CFG = PRESETS[ap.parse_args().preset]

OUT = Path(CFG["out"])
OUT.mkdir(exist_ok=True)

W, H, DSF = 430, 932, 3          # -> 1290 x 2796
SX, SY = W / 390, H / 844

def P(x, y):
    return round(x * SX), round(y * SY)

SET_SCROLL = """(t)=>{let b=null;document.querySelectorAll('*').forEach(e=>{
  if(e.scrollHeight>e.clientHeight+12&&(!b||e.scrollHeight>b.scrollHeight))b=e;});
  if(b){b.scrollTop=t;return b.scrollTop;}return -1;}"""

errs, shots = [], []

def shot(pg, name):
    path = OUT / f"{name}.png"
    pg.screenshot(path=str(path))
    shots.append(path)
    print(f"  cekildi: {name}.png")

def tap(pg, text, exact=True, to=6000):
    try:
        pg.get_by_text(text, exact=exact).first.click(timeout=to)
        return True
    except Exception as e:
        print(f"  ISKA '{text}': {str(e)[:60]}")
        return False

with sync_playwright() as p:
    # CORS notu: backend localhost:8081 kaynagina izin vermiyor; native uygulama
    # CORS'a tabi olmadigi icin bu yalnizca web uzerinden gorsel uretirken cikan
    # bir engel. Uretim ayarina dokunmamak icin kisitlama sadece bu yerel
    # tarayici oturumunda kapatiliyor.
    b = p.chromium.launch(headless=True, args=[
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
    ])
    ctx = b.new_context(
        viewport={"width": W, "height": H},
        device_scale_factor=DSF,
        locale=CFG["locale"],
        geolocation={"latitude": CFG["lat"], "longitude": CFG["lon"]},
        permissions=["geolocation"],
    )
    # Depoyu ACILISTAN ONCE tohumla. Nedeni:
    #  - dil: App.tsx acilista user_language okuyup i18n.changeLanguage cagiriyor.
    #    Uygulama ici seciciden gecmek DENENDI ve ceviri KISMI kaldi (alt sekmeler
    #    ve urun detay ekrani Turkce kaldi) - bastan tohumlamak temiz sonuc veriyor.
    #  - ulke: tarayiciya geolocation izni vermek YETMIYOR; uygulamanin kendi KVKK
    #    riza kapisi ayri (kvkk_location_consent), o olmadan koordinat hic okunmuyor
    #    ve urunler TR olarak kaliyor.
    ctx.add_init_script(
        "try{"
        "localStorage.setItem('intro_seen','1');"
        "localStorage.setItem('onboarding_completed','1');"
        "localStorage.setItem('user_language','%s');"
        "localStorage.setItem('user_country','%s');"
        "localStorage.setItem('kvkk_location_consent','granted');"
        "localStorage.setItem('location_mode','auto');"
        "localStorage.setItem('user_location',JSON.stringify({lat:%s,lon:%s,ts:Date.now()}));"
        "}catch(e){}" % (CFG["lang"], CFG["country"], CFG["lat"], CFG["lon"])
    )
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)[:180]))

    print("uygulama yukleniyor...")
    pg.goto("http://localhost:8081", wait_until="domcontentloaded", timeout=120000)
    pg.wait_for_timeout(13000)

    # --- giris ---
    ins = pg.locator("input")
    if ins.count() >= 2:
        ins.nth(0).fill("test@cheep.com")
        ins.nth(1).fill("test123456")
        # Enter ile gonderim DENENDI ve CALISMADI (form submit'e baglanmiyor).
        # Buton metni her locale'de Turkce kaliyor: i18n `lng: 'tr'` ile sabit
        # baslatiliyor ve tarayici diline bakmiyor, o yuzden metinle tiklamak guvenli.
        tap(pg, "Giriş Yap")
        pg.wait_for_timeout(9000)
        print("giris yapildi (locale=%s)" % CFG["locale"])

    # --- 1) ana ekran: tasarruf kahramani ---
    shot(pg, "01-ana-sayfa")

    # --- 2) ana ekran, kategoriler + firsatlar gorunur ---
    pg.evaluate(SET_SCROLL, 700)
    pg.wait_for_timeout(1500)
    shot(pg, "02-kategoriler")

    # --- 3) arama sonuclari ---
    pg.evaluate(SET_SCROLL, 0)
    pg.wait_for_timeout(800)
    pg.mouse.click(*P(305, 40))                 # arama ikonu
    pg.wait_for_timeout(4000)
    sins = pg.locator("input")
    if sins.count() >= 1:
        sins.nth(0).fill("çay")
        pg.wait_for_timeout(5500)
    shot(pg, "03-arama-sonuclari")

    # --- 4) urun detayi: ilk sonuc kartina dokun ---
    # Not: sekme/kart konumlari CSS pikseli (430x932). Metin tabanli tiklama
    # denendi ve ISKALADI: ana sayfadaki "Firsatlar" BASLIGI ile alt sekme
    # ETIKETI ayni metni tasiyor, strict mod cakisiyor.
    pg.mouse.click(114, 150)
    pg.wait_for_timeout(5000)
    shot(pg, "04-urun-detay")

    # --- 5) firsatlar sekmesi (alt sekme cubugu) ---
    pg.mouse.click(280, 905)
    pg.wait_for_timeout(4500)
    shot(pg, "05-firsatlar")

    # --- 6) en ucuz rota: uygulamanin farklilastirici ozelligi ---
    pg.mouse.click(74, 905)                     # Ana Sayfa sekmesi
    pg.wait_for_timeout(4000)
    pg.evaluate(SET_SCROLL, 0)                  # sekme degisiminden sonra kaydirma
    pg.wait_for_timeout(2500)                   # konumu bozuk kaliyor, basa sar
    if tap(pg, "En Ucuz Rotayı Gör", exact=False, to=8000):
        pg.wait_for_timeout(7000)
        shot(pg, "06-liste-detay")
        if tap(pg, "Rotaları Göster", exact=False, to=8000):
            pg.wait_for_timeout(11000)
            shot(pg, "07-rota-karsilastirma")

    if errs:
        print("SAYFA HATALARI:", errs[:6])
    ctx.close()

print("\n=== uretilen dosyalar ===")
for s in shots:
    print(f"  {s}  ({s.stat().st_size} bayt)")
