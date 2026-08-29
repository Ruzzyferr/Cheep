"""`run-daily.sh` rotasyon betikleri ile `config.json` arasındaki tutarlılık.

NEDEN: rotasyon, market adlarını KABUK BETİĞİNDE düz metin olarak taşıyor
(`MARKETS="Kaufland,Mega Image"`). Config'te adı değişen ya da devre dışı
bırakılan bir market betikte kalırsa o gecenin koşusu `select_markets`
tarafından reddedilir ve zamanlayıcı hata verir; tersine, config'e eklenen
yeni bir market betiğe yazılmazsa HİÇ tazelenmez ve bunu hiçbir şey söylemez.

İkinci tehlike sessizdir ve bu testin asıl varlık sebebidir: Polonya'da
Carrefour tam olarak böyle unutulmuştu — config'te etkin, rotasyonda YOK, ve
fiyatları 12 gün boyunca donmuştu.
"""
import json
import re
from pathlib import Path

import pytest

COUNTRIES = Path(__file__).resolve().parents[1] / "countries"

#: `MARKETS="..."` atamalarını yakalar. Boş atama (dinlenme günü) yok sayılır.
_ASSIGN = re.compile(r'MARKETS="([^"]*)"')


def _rotation_scripts():
    for script in sorted(COUNTRIES.glob("*/run-daily.sh")):
        config = script.parent / "config.json"
        if config.exists():
            yield script.parent.name, script, config


def _names_in_script(script: Path):
    names = set()
    for raw in _ASSIGN.findall(script.read_text(encoding="utf-8")):
        for name in raw.split(","):
            name = name.strip()
            # `$MARKETS` gibi değişken genişletmeleri ve boş atamalar atlanır.
            if name and not name.startswith("$"):
                names.add(name)
    return names


def _enabled_in_config(config: Path):
    data = json.loads(config.read_text(encoding="utf-8"))
    return {m["name"] for m in data.get("markets", []) if m.get("enabled")}


def test_there_are_rotation_scripts_to_check():
    """Glob kayarsa aşağıdaki testler boş parametreyle 'geçer' görünür."""
    assert list(_rotation_scripts())


@pytest.mark.parametrize("country,script,config", list(_rotation_scripts()),
                         ids=[c for c, _, _ in _rotation_scripts()])
def test_every_rotated_market_exists_and_is_enabled(country, script, config):
    scripted = _names_in_script(script)
    enabled = _enabled_in_config(config)
    unknown = scripted - enabled
    assert not unknown, (
        f"{country}/run-daily.sh config'te ETKİN OLMAYAN market adı içeriyor "
        f"(o gecenin koşusu hata verip duracak): {sorted(unknown)}. "
        f"Config'te etkin olanlar: {sorted(enabled)}"
    )


@pytest.mark.parametrize("country,script,config", list(_rotation_scripts()),
                         ids=[c for c, _, _ in _rotation_scripts()])
def test_every_enabled_market_is_actually_rotated(country, script, config):
    """SESSİZ ARIZA: config'te etkin ama rotasyonda olmayan market HİÇ
    tazelenmez. Polonya'da Carrefour böyle 12 gün donmuştu."""
    scripted = _names_in_script(script)
    enabled = _enabled_in_config(config)
    if not scripted:
        # Rotasyon kullanmayan ülke (ör. Macaristan: tek dosya, bölmek
        # anlamsız) — betik tüm etkin marketleri birden koşuyor.
        pytest.skip(f"{country}: rotasyon kullanmıyor")
    missing = enabled - scripted
    assert not missing, (
        f"{country}: config'te ETKİN ama rotasyonda YOK — bu zincirler hiç "
        f"tazelenmez ve 21 günlük prune TTL'i sonunda katalogları silinir: "
        f"{sorted(missing)}"
    )
