"""Her ülkenin `category_map.json`'ı backend taksonomisiyle TUTARLI mı?

NEDEN BU TEST VAR: `category_map.json` elle yazılıyor ve hedef slug'lar başka
bir depoda, başka bir dilde (TypeScript) tanımlı. Slug'da tek harflik bir yazım
hatası HİÇBİR YERDE PATLAMAZ — `foreign_import` slug'ı olduğu gibi backend'e
gönderir, backend eşleşmeyen slug'ı yok sayar ve ürün KATEGORİSİZ kaydedilir.
Kategorisiz ürün hiçbir listede, hiçbir kategori sayfasında görünmez; yani
binlerce ürün sessizce kaybolur ve bunu fark ettiren tek şey aylar sonra
"neden bu kategoride hiç ürün yok?" sorusudur.

Test taksonomiyi TypeScript kaynağından okuyor. Bir JSON kopyası tutmak
ikisinin ayrışmasına davetiye olurdu — tam da bu testin engellemeye çalıştığı
şey.
"""
import json
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
TAXONOMY_TS = REPO / "cheep-backend-express" / "src" / "config" / "standard-categories.ts"
COUNTRIES = Path(__file__).resolve().parents[1] / "countries"

#: Sözlükte gerçek eşleme OLMAYAN, insan için yazılmış açıklama anahtarları.
_DOC_KEYS_PREFIX = "_"


def _canonical_slugs() -> set:
    source = TAXONOMY_TS.read_text(encoding="utf-8")
    return set(re.findall(r"slug:\s*'([^']+)'", source))


def _category_maps():
    for path in sorted(COUNTRIES.glob("*/category_map.json")):
        yield path.parent.name, path, json.loads(path.read_text(encoding="utf-8"))


def test_taxonomy_source_is_readable():
    """Bu test taksonomiyi başka bir depodan okuyor; yol kayarsa testin
    kendisi sessizce anlamsızlaşır (boş küme her şeyi geçirir)."""
    slugs = _canonical_slugs()
    assert len(slugs) > 100, f"taksonomi okunamadı ya da boş: {TAXONOMY_TS}"


def test_at_least_one_country_map_is_checked():
    """Glob bir gün hiçbir şey bulmazsa aşağıdaki testler boş parametreyle
    geçer görünür — o sessizliği burada yakalıyoruz."""
    assert list(_category_maps()), "hiç category_map.json bulunamadı"


@pytest.mark.parametrize("country,path,mapping", list(_category_maps()),
                         ids=[c for c, _, _ in _category_maps()])
def test_every_mapped_slug_exists_in_backend_taxonomy(country, path, mapping):
    canonical = _canonical_slugs()
    bad = {
        key: slug for key, slug in mapping.items()
        if not key.startswith(_DOC_KEYS_PREFIX) and slug and slug not in canonical
    }
    assert not bad, (
        f"{country}/category_map.json taksonomide OLMAYAN slug'lara işaret ediyor "
        f"(bu ürünler kategorisiz kaydedilir ve hiçbir listede görünmez): {bad}"
    )


@pytest.mark.parametrize("country,path,mapping", list(_category_maps()),
                         ids=[c for c, _, _ in _category_maps()])
def test_no_empty_slug_targets(country, path, mapping):
    """Boş hedef ("") bir 'sonra doldururum' işareti; üretimde ürünü
    kategorisiz bırakır."""
    empty = [k for k, v in mapping.items() if not k.startswith(_DOC_KEYS_PREFIX) and not v]
    assert not empty, f"{country}: boş slug hedefi olan anahtarlar: {empty}"


def test_category_maps_are_not_gitignored():
    """Harita dosyası VAR OLMAK yetmez, COMMIT EDİLEBİLİR olmalı.

    Gerçek olay: `Cheep-Scraper/.gitignore` içinde marketfiyati'nin KÖK
    dizinde ürettiği dosya için yazılmış `category_map.json` deseni vardı.
    Desen dosya ADINA göre olduğu için elle tutulan ülke haritalarını da
    yutuyordu — mevcut ülkelerinki ancak `git add -f` ile girebilmiş, yeni
    eklenen ülkelerinki ise SESSİZCE dışarıda kalmıştı.

    O hâliyle deploy edilseydi: kod sunucuya gider, `category_map.json`
    GİTMEZ, `foreign_import` hiçbir slug çözemez ve o ülkenin TÜM ürünleri
    kategorisiz kaydedilir. Hiçbir hata çıkmaz; ürünler yalnızca hiçbir
    listede ve hiçbir kategori sayfasında görünmez.
    """
    import subprocess

    paths = [str(path) for _, path, _ in _category_maps()]
    assert paths, "hiç category_map.json bulunamadı"
    result = subprocess.run(
        ["git", "check-ignore", *paths],
        capture_output=True, text=True, cwd=REPO,
    )
    ignored = [line for line in result.stdout.splitlines() if line.strip()]
    assert not ignored, (
        "Bu kategori haritaları .gitignore'a takılıyor, yani deploy'a "
        f"ÇIKMAZLAR ve ülkenin tüm ürünleri kategorisiz kalır: {ignored}"
    )


# ---------------------------------------------- store_id ↔ backend seed tutarlılığı

SEED_TS = REPO / "cheep-backend-express" / "src" / "config" / "countries-seed.ts"

#: Market satırları hâlâ `prisma/seed.ts`'te elle duran ülkeler.
LEGACY_SEED_COUNTRIES = {"TR", "PL", "DE", "CH", "SE"}


def _seeded_stores():
    """`countries-seed.ts`'ten {store_id: ülke_kodu} (kaba ama yeterli ayrıştırma)."""
    source = SEED_TS.read_text(encoding="utf-8")
    rows = re.findall(
        r"\{\s*id:\s*(\d+),\s*name:\s*'[^']*',\s*countryCode:\s*'([A-Z]{2})'", source,
    )
    return {int(sid): code for sid, code in rows}


def test_seed_source_is_readable():
    assert _seeded_stores(), f"backend market tohumu okunamadı: {SEED_TS}"


@pytest.mark.parametrize("country,path,mapping", list(_category_maps()),
                         ids=[c for c, _, _ in _category_maps()])
def test_enabled_market_store_ids_exist_in_backend_seed(country, path, mapping):
    """Scraper'ın yazdığı `store_id`, backend'de o ÜLKEYE ait bir market olmalı.

    Uyuşmazlığın bedeli sessiz ve büyük: `store_id` yanlışsa fiyatlar BAŞKA
    bir zincire (ya da başka bir ülkenin zincirine) yazılır ve hiçbir hata
    çıkmaz — kullanıcı Konzum fiyatını Lidl'da görür.

    ESKİ ÜLKELER BU KONTROLÜN DIŞINDA: TR/PL/DE/CH/SE'nin market satırları
    hâlâ `prisma/seed.ts` içinde elle tanımlı (gerçek logo ve adres
    verileriyle). Çalışan ve doğrulanmış tanımları yalnızca tekrarı gidermek
    için taşımak, kazanılan faydadan büyük bir risk olurdu. Bir ülke
    `countries-seed.ts`'e taşındığında bu listeden çıkarılmalı ve kontrol
    kendiliğinden devreye girer.
    """
    config_path = path.parent / "config.json"
    if not config_path.exists():
        pytest.skip(f"{country}: config.json yok")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    code = config.get("country_code")
    if code in LEGACY_SEED_COUNTRIES:
        pytest.skip(f"{code}: market satırları prisma/seed.ts'te elle tanımlı")

    seeded = _seeded_stores()
    problems = []
    for market in config.get("markets", []):
        if not market.get("enabled"):
            continue
        store_id = market.get("store_id")
        if store_id not in seeded:
            problems.append(f"{market['name']} -> store_id {store_id} backend'de YOK")
        elif seeded[store_id] != code:
            problems.append(
                f"{market['name']} -> store_id {store_id} backend'de {seeded[store_id]} ülkesine ait, {code} değil"
            )
    assert not problems, f"{country}: {problems}"
