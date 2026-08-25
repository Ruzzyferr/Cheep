# -*- coding: utf-8 -*-
"""
Ters yazimli coklu paket: "1 l x 6".

Yalnizca "N x BOYUT" bicimi taniniyordu. Lehce ve Turkce urun adlarinda
carpanin SONA yazilmasi da yaygin ("Mleko Laciate 1 l x 6"). O bicimde coklu
paket hic gorulmuyor, boyut tek birim (1 l) aliniyor ve paketin ~17 zl lik
TOPLAM fiyati LITRE fiyati gibi yayinlaniyordu: alti litrelik bir koli,
ulkenin en pahali sutu olarak siralaniyordu.
"""
import pytest

from scrapers.units import extract_size_and_pack


@pytest.mark.parametrize(
    "ad,beklenen",
    [
        # ARIZALI olanlar (ters yazim).
        ("Mleko Laciate 1 l x 6", (6.0, "l", 6)),
        ("Ayran 200 ml x 4", (800.0, "ml", 4)),
        ("Cikolata 180 g*6", (1080.0, "g", 6)),
        ("Woda 1,5 l × 6", (9.0, "l", 6)),
        # Onden yazim — zaten calisiyordu, kilitleniyor.
        ("Sut 6 x 1 L", (6.0, "l", 6)),
        ("Ayran 6x200 ml", (1200.0, "ml", 6)),
        # Tekil boyut carpan sanilmamali.
        ("Sut 1 L", (1.0, "l", 1)),
        ("Kola 2,5 L", (2.5, "l", 1)),
        # Adet paketi.
        ("Yumurta 10'lu", (10.0, "adet", 1)),
    ],
)
def test_coklu_paket_iki_yazimda_da_cozulur(ad, beklenen):
    assert extract_size_and_pack(ad) == beklenen
