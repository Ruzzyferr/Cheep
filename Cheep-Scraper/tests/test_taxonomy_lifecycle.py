"""Taksonominin kaynakla birlikte BÜYÜMESİ ve KÜÇÜLMESİ.

Devlet yeni bir kategori açtığında bizde de açılmalı, kaldırdığında bizden de
düşmeli. İkisi de ham veriden türetilir; bu testler o türetmenin iki yönlü
çalıştığını kilitler.

Silme sinyali DOSYA YAŞI: daemon her ürünü ~5-6 günde bir yeniden çekip ham
dosyayı ÜZERİNE yazıyor (mf_daemon.py:163), yani mtime "en son ne zaman
görüldü" demek. Kaynaktan düşen ürünün dosyası tazelenmez ve yaşlanır.
Dosyayı silmek yerine yaşına bakmak, tek bir bozuk sitemap çekiminde tüm
kataloğu uçurma riskini ortadan kaldırır.
"""
import json
import os
import time

from countries.turkey.mf_taxonomy import build


def _write(raw_dir, pid, menu, main, age_days=0):
    path = os.path.join(raw_dir, f"{pid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"id": pid, "menu_category": menu, "main_category": main}, f)
    if age_days:
        old = time.time() - age_days * 86400
        os.utime(path, (old, old))
    return path


def test_yeni_kategori_taksonomiye_girer(tmp_path):
    raw = str(tmp_path)
    _write(raw, "1", "İçecek", "Kahve")
    _write(raw, "2", "İçecek", "Çay")

    tax = build(raw)
    subs = {c["name"] for t in tax["tops"] for c in t["children"]}
    assert subs == {"Kahve", "Çay"}

    # Devlet yeni bir alt kategori açtı → yeni ürün ham veriye düştü
    _write(raw, "3", "İçecek", "Enerji İçeceği")

    tax2 = build(raw)
    subs2 = {c["name"] for t in tax2["tops"] for c in t["children"]}
    assert "Enerji İçeceği" in subs2, "yeni kategori taksonomiye girmedi"


def test_yeni_ust_kategori_taksonomiye_girer(tmp_path):
    raw = str(tmp_path)
    _write(raw, "1", "İçecek", "Kahve")
    _write(raw, "2", "Kozmetik", "Parfüm")

    tops = {t["name"] for t in build(raw)["tops"]}
    assert "Kozmetik" in tops


def test_kaynaktan_dusen_kategori_taksonomiden_cikar(tmp_path):
    """Tazelenmeyen ham dosya = kaynakta artık yok."""
    raw = str(tmp_path)
    _write(raw, "1", "İçecek", "Kahve")                      # taze
    _write(raw, "2", "İçecek", "Şalgam Suyu", age_days=90)   # 90 gündür görülmedi

    # Yaş sınırı yokken ikisi de var (mevcut davranış)
    subs_all = {c["name"] for t in build(raw)["tops"] for c in t["children"]}
    assert subs_all == {"Kahve", "Şalgam Suyu"}

    # Yaş sınırıyla bayat olan düşer
    subs_fresh = {c["name"] for t in build(raw, max_age_days=45)["tops"] for c in t["children"]}
    assert subs_fresh == {"Kahve"}, "kaynaktan düşen kategori hâlâ taksonomide"


def test_bos_kalan_ust_kategori_de_duser(tmp_path):
    raw = str(tmp_path)
    _write(raw, "1", "İçecek", "Kahve")
    _write(raw, "2", "Kozmetik", "Parfüm", age_days=120)

    tops = {t["name"] for t in build(raw, max_age_days=45)["tops"]}
    assert tops == {"İçecek"}, "tüm ürünleri düşen üst kategori taksonomide kaldı"


def test_yas_siniri_her_seyi_silecekse_UYGULANMAZ(tmp_path):
    """Güvenlik freni.

    Daemon uzun süre durmuşsa TÜM dosyalar bayat görünür. Bu durumda yaş
    sınırını uygulamak taksonomiyi tamamen boşaltır ve bir sonraki seed
    kategorileri yok eder. Böyle bir durumda sınır yok sayılır.
    """
    raw = str(tmp_path)
    _write(raw, "1", "İçecek", "Kahve", age_days=200)
    _write(raw, "2", "İçecek", "Çay", age_days=200)

    tax = build(raw, max_age_days=45)
    subs = {c["name"] for t in tax["tops"] for c in t["children"]}
    assert subs == {"Kahve", "Çay"}, "güvenlik freni tutmadı — taksonomi boşaldı"
    assert tax.get("age_filter_skipped") is True


def test_yas_siniri_verilmezse_hicbir_sey_dusmez(tmp_path):
    raw = str(tmp_path)
    _write(raw, "1", "İçecek", "Kahve", age_days=999)
    subs = {c["name"] for t in build(raw)["tops"] for c in t["children"]}
    assert subs == {"Kahve"}
