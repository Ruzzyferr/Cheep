# -*- coding: utf-8 -*-
"""
Barkod, urunleri marketler ARASINDA birlestiren anahtar. Scraper'lar
`barcode_gtin` alanini hicbir dogrulama yapmadan aynen iletiyordu ve iki ayri
sinif deger araya siziyordu:

1) GS1 ONEKI 20-29 = MAGAZA-ICI / SINIRLI DOLASIM. Magazaya ozel, kuresel
   olarak benzersiz DEGIL ve degisken agirlikli sarkuteri urunlerinde haneler
   PAKET AGIRLIGINI kodluyor. Yakalanan Carrefour ornekleri (Targ Swiezosci
   reyonu): 2020228700009, 2030269600008, 2030612100001.
   Sonuc: ayni peynir ertesi gun yeniden tartilinca BASKA bir "EAN" uretiyor
   (her gece yeni urun satiri + bolunmus fiyat gecmisi), ya da baska bir
   zincirin magaza-ici numarasi ayni 13 haneye denk gelip ALAKASIZ iki urun
   tek "en ucuz" karsilastirmasinda birlesiyor.

2) KONTROL HANESI TUTMAYAN barkodlar. Yazim hatasi ya da uydurma.
"""
import pytest

from countries._common.foreign_import import is_globally_unique_ean


@pytest.mark.parametrize("barkod", [
    "5901234123457",   # gecerli EAN-13 (PL onek 590)
    "12345670",        # gecerli EAN-8
    "04012345123456",  # gecerli GTIN-14
])
def test_gecerli_barkodlar_kabul(barkod):
    assert is_globally_unique_ean(barkod) is True


@pytest.mark.parametrize("barkod", [
    "2020228700009",   # magaza-ici (onek 20) — uretimde yakalandi
    "2030269600008",   # magaza-ici (onek 20)
    "2030612100001",   # magaza-ici (onek 20)
    "2112345678900",   # magaza-ici (onek 21)
    "2912345678909",   # magaza-ici (onek 29)
])
def test_magaza_ici_barkodlar_reddedilir(barkod):
    """Bunlar kuresel benzersiz DEGIL — birlestirme anahtari olamazlar."""
    assert is_globally_unique_ean(barkod) is False


@pytest.mark.parametrize("barkod", [
    "5900000000012",   # kontrol hanesi tutmuyor
    "5901234123456",   # son hane bozuk
])
def test_bozuk_kontrol_hanesi_reddedilir(barkod):
    assert is_globally_unique_ean(barkod) is False


@pytest.mark.parametrize("barkod", [
    None, "", "   ", "abc", "590123412345",  # 12 hane degil, 12'lik gecerli olsa da bu bozuk
    "1234567890123456",                       # 16 hane
])
def test_bicimsiz_girdiler_reddedilir(barkod):
    assert is_globally_unique_ean(barkod) is False


def test_sayi_tipi_de_kabul_edilir():
    """Scraper bazen int donduruyor."""
    assert is_globally_unique_ean(5901234123457) is True
