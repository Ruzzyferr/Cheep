"""Daemon, kategori haritası diskte değişince YENİDEN OKUMALI.

Haftalık taksonomi tazelemesi `category_map.json`'u yeniliyor ama daemon
sonsuza kadar çalışıyor (`Restart=always`, `Type=simple`). Harita döngüden
ÖNCE bir kez okunsaydı, devletin yeni açtığı kategori daemon elle yeniden
başlatılana kadar hiçbir ürüne uygulanmaz, hepsi "Diğer"e düşerdi.
"""
import json
import os
import time

from countries.turkey.mf_daemon import CatMap


def _write_map(path, mapping, other_id=99):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"main_to_id": mapping, "other_id": other_id}, f)


def test_ilk_okuma(tmp_path):
    p = str(tmp_path / "category_map.json")
    _write_map(p, {"Kahve": 1})
    cm = CatMap(p)
    assert cm.resolve("Kahve") == 1
    assert cm.resolve("Bilinmeyen") == 99


def test_dosya_degisince_yeniden_okur(tmp_path):
    p = str(tmp_path / "category_map.json")
    _write_map(p, {"Kahve": 1})
    cm = CatMap(p)
    assert cm.resolve("Enerji İçeceği") == 99  # henüz yok → Diğer

    # Haftalık iş haritayı yeniledi
    time.sleep(0.01)
    _write_map(p, {"Kahve": 1, "Enerji İçeceği": 7})
    os.utime(p, None)

    assert cm.resolve("Enerji İçeceği") == 7, "daemon yenilenen haritayı görmedi"


def test_dosya_degismediyse_diske_gitmez(tmp_path):
    p = str(tmp_path / "category_map.json")
    _write_map(p, {"Kahve": 1})
    cm = CatMap(p)
    cm.resolve("Kahve")
    before = cm.loads
    for _ in range(50):
        cm.resolve("Kahve")
    assert cm.loads == before, "değişmemiş dosya her çağrıda yeniden okunuyor"


def test_bozuk_dosya_eski_haritayi_korur(tmp_path):
    """Yarım yazılmış dosyaya denk gelirsek kataloğu 'Diğer'e boşaltmayalım."""
    p = str(tmp_path / "category_map.json")
    _write_map(p, {"Kahve": 1})
    cm = CatMap(p)
    assert cm.resolve("Kahve") == 1

    time.sleep(0.01)
    with open(p, "w", encoding="utf-8") as f:
        f.write("{ bozuk")
    os.utime(p, None)

    assert cm.resolve("Kahve") == 1, "bozuk dosya eski haritayı sildi"


def test_dosya_yoksa_kategorisiz_devam(tmp_path):
    cm = CatMap(str(tmp_path / "yok.json"))
    assert cm.resolve("Kahve") is None
