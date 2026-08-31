"""App Store ekran goruntulerini PLAY olcusune cevirir.

NEDEN AYRI BIR ADIM: `appstore_shots.py` Apple 6.7" icin 1290x2796 uretiyor
ve bunun orani 2.167. Play telefon ekran goruntusunde orani 2.000 ile
SINIRLIYOR, yani o dosyalar Play'e oldugu gibi YUKLENEMIYOR -- API onlari
reddediyor. Bu, gorseller hazir gorundugu icin kolayca gozden kacan bir
tuzak: `pl-PL` ve `en-US` listelemeleri uzun sure GORSELSIZ kaldi ve Play
eksik dilde varsayilan dile dustugu icin Polonyali kullanici Turkce vitrin
goruyordu.

Tarif yayindaki Hirvatca gorselden OLCULDU (alfa kanali taranarak): icerik
886x1920'ye olcekleniyor ve beyaz 1080x1920 tuvale yatayda ortalaniyor.
Diller arasi gorsel tutarlilik icin sayilar birebir korunmali.

Cikti klasorleri gitignore'da: bunlar turetilmis dosya, kaynak degil.

Kullanim:  python play_shots.py            (tum diller)
           python play_shots.py pl en      (yalnizca bunlar)
"""
import sys
from pathlib import Path

from PIL import Image

HEDEF_W, HEDEF_H = 1080, 1920
# Beyaz, cunku uygulamanin kendi zemini kirik beyaz (#FBFAF6) ve gorselin
# kenarinda koyu bir bant vitrinde cerceve gibi duruyor.
ZEMIN = (255, 255, 255)

# Dil -> (kaynak klasor, cikti klasoru). Kaynaklar appstore_shots.py ciktisi.
DILLER = {
    "tr": ("appstore-screenshots", "play-screenshots-tr"),
    "en": ("appstore-screenshots-en", "play-screenshots-en"),
    "pl": ("appstore-screenshots-pl", "play-screenshots-pl"),
    "hr": ("appstore-screenshots-hr", "play-screenshots-hr"),
    "hu": ("appstore-screenshots-hu", "play-screenshots-hu"),
    "ro": ("appstore-screenshots-ro", "play-screenshots-ro"),
}

secilen = sys.argv[1:] or list(DILLER)
bilinmeyen = [d for d in secilen if d not in DILLER]
if bilinmeyen:
    sys.exit(f"bilinmeyen dil: {', '.join(bilinmeyen)} (secenekler: {', '.join(DILLER)})")

for dil in secilen:
    kaynak_ad, cikti_ad = DILLER[dil]
    kaynak = Path(kaynak_ad)
    if not kaynak.is_dir():
        print(f"{dil}: {kaynak_ad} yok, atlandi")
        continue

    cikti = Path(cikti_ad)
    cikti.mkdir(exist_ok=True)
    for f in sorted(kaynak.glob("*.png")):
        im = Image.open(f).convert("RGB")
        olcek = min(HEDEF_W / im.width, HEDEF_H / im.height)
        yeni = im.resize((round(im.width * olcek), round(im.height * olcek)), Image.LANCZOS)
        tuval = Image.new("RGB", (HEDEF_W, HEDEF_H), ZEMIN)
        tuval.paste(yeni, ((HEDEF_W - yeni.width) // 2, (HEDEF_H - yeni.height) // 2))
        tuval.save(cikti / f.name, "PNG", optimize=True)
        print(f"{dil} {f.name}: {im.width}x{im.height} -> {yeni.width}x{yeni.height} @ {HEDEF_W}x{HEDEF_H}")
