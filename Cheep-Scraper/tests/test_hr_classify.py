"""Hırvatça ürün adı → kategori etiketi sınıflandırıcısı.

Testlerin çoğu GERÇEK katalog adlarından alınmıştır (cijene.dev arşivi,
2026-08-28) — uydurma örnek, gerçek veride var olmayan bir davranışı
doğrulama riski taşır.
"""
import pytest

from countries.croatia.classify import classify


# --------------------------------------------------- doğrulanmış kısaltmalar
# Bu üçü sezgiye aykırı ve tahminle yazılsaydı ürünler yanlış kategoriye
# giderdi. Gerçek katalog adlarıyla doğrulandı; regresyon olarak kilitleniyor.

def test_sv_is_pork_not_candle():
    assert classify("SV VRAT BK", "HRANA") == "Meso"
    assert classify("SV SLABINA I LEĐA SK BEZ FILEA", "HRANA") == "Meso"


def test_pel_in_food_is_pelinkovac_liqueur_not_diapers():
    assert classify("PELINKOVAC GORKI 0.10L 31% BADEL", "PIĆE") == "Alkohol"


def test_pel_in_cosmetics_is_diapers():
    """Aynı önek, kaba kategoriye göre BAŞKA anlam — ikinci katmanın varlık
    sebebi tam olarak bu."""
    assert classify("PEL PAMPERS PREMIUM 3", "KOZMETIKA") == "Pelene"


def test_neg_pice_is_non_carbonated_drink_not_skincare():
    assert classify("NEG PIĆE MULTIVIT CAPRI SONNE 0.2L", "PIĆE") == "Negazirano pice"


@pytest.mark.parametrize("name,coarse,expected", [
    ("ZP SENSOD FLUORID 75ML 0350", "KOZMETIKA", "Zubna pasta"),
    ("OM FROSCH CVIJET PAMUKA 750ml", "SREDSTVA ZA ČIŠĆENJE", "Omeksivac"),
    ("TP PALOMA EXC ŽUTI 3SL 8+2", "TOALETNE POTREPŠTINE", "Toaletni papir"),
    ("OSVJ GLADE 150g GEL CVIJ 6517", "PROIZVODI ZA KUĆANSTVO", "Osvjezivac"),
    ("SLAD LEDO KORNET VANILIJA 120ML", "HRANA", "Sladoled"),
    ("GAZ PIĆE PEPSI COLA 2L PET", "PIĆE", "Gazirano pice"),
    ("JUNETINA MLJEVENA", "HRANA", "Meso"),
    ("CAPP ANAMARIA CL 200g VR", "HRANA", "Kava"),
    ("HIG UL ALWAYS UL NOR PL DUO 20/1", "TOALETNE POTREPŠTINE", "Higijenski ulosci"),
    ("SALVETE VIOLETA 38X38 2SL LILA 25/1", "PROIZVODI ZA KUĆANSTVO", "Salvete"),
])
def test_verified_abbreviations(name, coarse, expected):
    assert classify(name, coarse) == expected


# ------------------------------------------------------------- aksan katlama

def test_accents_are_folded():
    """Konzum 'PIĆE', Plodine 'PICE' yazıyor — aksana duyarlı eşleştirme
    zincirlerin yarısını ıskalardı."""
    assert classify("ČOKOLADA MILKA 100g", "HRANA") == "Cokolada"
    assert classify("COKOLADA MILKA 100g", "HRANA") == "Cokolada"
    assert classify("SIR DUKAT 250g", "HRANA") == classify("SÍR DUKAT 250g", "HRANA")


def test_dj_character_is_folded():
    """'đ' tek kod noktası — NFKD onu ayrıştırmıyor, elle katlanıyor."""
    assert classify("HLAĐENO PILEĆE MESO", "HRANA") is not None


# --------------------------------------------------------- kelime sınırları

def test_sir_does_not_match_sirup():
    """'SIR' (peynir) 'SIRUP' (şurup) içinde eşleşmemeli."""
    assert classify("SIRUP MALINA 1L", "PIĆE") != "Sir"


def test_pil_does_not_match_piling():
    """'PIL' (piletina/tavuk) kozmetikteki 'PILING' (peeling) ile eşleşmemeli."""
    assert classify("PILING ZA LICE 100ML", "KOZMETIKA") != "Piletina"


# ------------------------------------------------------------- öncelik sırası

def test_alcohol_wins_over_generic_drink():
    """Alkol kuralı genel içecek kuralından ÖNCE gelmeli — yoksa bira
    'içecek' olarak sınıflanıp config'teki alkol süzgecinden kaçar."""
    assert classify("PIVO OŽUJSKO 0.5L", "PIĆE") == "Alkohol"
    assert classify("VINO PLAVAC MALI 0.75L", "PIĆE") == "Alkohol"


def test_sladoled_wins_over_nothing_else():
    assert classify("SLAD SNJEGULJICA 65ML LEDO", "HRANA") == "Sladoled"


# ------------------------------------------------------------ yedek davranış

def test_falls_back_to_coarse_bucket_when_no_rule_matches():
    """Hiçbir kural tutmazsa ürün KAYBOLMAZ — doğru üst kovaya düşer."""
    assert classify("XYZZY MARKA 123", "HRANA") == "Hrana"
    assert classify("XYZZY MARKA 123", "KOZMETIKA") == "Kozmetika"


def test_returns_none_when_nothing_is_known():
    """Ne ad ne kaba kategori bilgi veriyorsa None — ürün kategorisiz kaydedilir
    ve pipeline'ın eşlenmemiş-kategori raporunda GÖRÜNÜR (sessiz kayıp yok)."""
    assert classify("XYZZY MARKA 123", "") is None
    assert classify("", None) is None


def test_coarse_only_rule_does_not_leak_into_wrong_bucket():
    """'SPREJ' kozmetikte deodorant; temizlikte deodorant OLMAMALI."""
    assert classify("SPREJ NIVEA 150ML", "KOZMETIKA") == "Dezodorans"
    assert classify("SPREJ ZA STAKLO 500ML", "SREDSTVA ZA ČIŠĆENJE") != "Dezodorans"
