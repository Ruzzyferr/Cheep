# -*- coding: utf-8 -*-
"""
Lidl paket metni temizligi — PAKET fiyatinin KG fiyati olarak yayinlanmasi.

Uretimde yasanan hata: `_PACKAGING_REF_SUFFIX_RE` `$` ile ankrajliydi, yani
promosyon oncesi referans cumlesi YALNIZCA dizenin en sonundaysa siliniyordu.
Gercek veride cumlenin ardindan "zl" gelebiliyor ya da tamami parantez icinde
olabiliyor. O hallerde silinmiyor ve paylasilan miktar ayristiricisi (SON
boyut-benzeri belirteci secer) gercek paket boyutu yerine REFERANS birimini
aliyordu:

    "400 g 1 kg = 18,73 zl"  -> (1.0, kg)   paket fiyati KG fiyati sanildi
    "500 g (1 kg = 43,98)"   -> (1.0, kg)

Miktar tam olarak 1.0 ciktigi icin foreign_import'un "1 degilse szt'ye dusur"
korumasi da devreye girmiyordu. Uretim ciktisinda dogrulandi: PILOS Ser gouda
XXL, price 7.49, unit "kg", quantity 1.0. Lidl oldugundan cok daha ucuz
gorunuyordu.
"""
import pytest

from countries.poland.scrapers.lidl_pl import _clean_packaging_text


@pytest.mark.parametrize(
    "ham,beklenen",
    [
        # Duz hal — zaten calisiyordu, kilitleniyor.
        ("300 g  1 kg = 24,97", "300 g"),
        # ARIZALI olanlar: para birimi kuyrugu ve parantez.
        ("400 g 1 kg = 18,73 zl", "400 g"),
        ("400 g 1 kg = 18,73 zł", "400 g"),
        ("500 g (1 kg = 43,98)", "500 g"),
        ("500 g [1 kg = 43,98 zł]", "500 g"),
        # "cena przed obnizka" varyanti.
        ("1 kg * cena przed obniżką: 1 kg = 8,99", "1 kg"),
        # Referans cumlesi olmayan metne DOKUNULMAZ.
        ("750 ml", "750 ml"),
        ("250 g różne rodzaje", "250 g różne rodzaje"),
    ],
)
def test_referans_cumlesi_temizlenir(ham, beklenen):
    assert _clean_packaging_text(ham) == beklenen


def test_bos_girdi_none_doner():
    assert _clean_packaging_text(None) is None
    assert _clean_packaging_text("") is None
    assert _clean_packaging_text("   ") is None


def test_paket_boyutu_referans_birimine_kaymaz():
    """Asil koruma: temizlik sonrasi SON boyut belirteci PAKET boyutu olmali."""
    from scrapers.units import parse_quantity_and_unit

    for ham, qty, unit in [
        ("400 g 1 kg = 18,73 zl", 400.0, "g"),
        ("500 g (1 kg = 43,98)", 500.0, "g"),
        ("300 g  1 kg = 24,97", 300.0, "g"),
    ]:
        q, u = parse_quantity_and_unit(_clean_packaging_text(ham))
        assert (float(q), u) == (qty, unit), f"{ham} -> {q} {u}"
