"""off_bulk.py — bulk (local dataset) Open Food Facts EAN enrichment.
No network in these tests: build_pl_index runs against a small committed
fixture (countries/_common/fixtures/off_sample.jsonl), enrich_from_index
runs purely against the resulting local SQLite index. ensure_pl_index's
network-touching dependencies (download_dataset/build_pl_index) are
monkeypatched so its staleness logic is exercised with no network."""
import os
import sqlite3
import tempfile
import time
from pathlib import Path

import countries._common.off_bulk as off_bulk
from countries._common.off_bulk import build_pl_index, enrich_from_index, build_keys, ensure_pl_index
from countries._common.off_enrich import _fold, _base_amount

FIXTURE = Path(__file__).parent.parent / "countries" / "_common" / "fixtures" / "off_sample.jsonl"


def _build(tmp_path):
    out = tmp_path / "off_index.sqlite"
    stats = build_pl_index(FIXTURE, out)
    return out, stats


# ---------------------------------------------------------------- builder --

def test_build_pl_index_filters_non_poland_rows():
    """8 fixture rows, 1 is Germany-only -> must not count as a PL row at all."""
    with tempfile.TemporaryDirectory() as td:
        out, stats = _build(Path(td))
        assert stats["rows_read"] == 8
        assert stats["pl_rows"] == 7  # excludes the Germany-only row


def test_build_pl_index_skips_rows_missing_brand_qty_or_valid_code():
    """Of the 7 PL rows: one has no parseable quantity, one has a malformed
    code, one has an empty brand -> none of those three become candidates."""
    with tempfile.TemporaryDirectory() as td:
        out, stats = _build(Path(td))
        assert stats["candidate_rows"] == 4


def test_build_pl_index_flags_colliding_key_as_ambiguous(tmp_path):
    """Two PL rows share brand+name+qty but have DIFFERENT EANs -> that key
    must end up AMBIGUOUS in both index tables, and absent from the
    resolved (unique) index tables — zero-error rule."""
    out, stats = _build(tmp_path)
    assert stats["ambiguous_keys1"] == 1
    assert stats["ambiguous_keys2"] == 1
    assert stats["unique_keys1"] == 2
    assert stats["unique_keys2"] == 2

    conn = sqlite3.connect(str(out))
    key1, key2 = build_keys("TestBrand", "Sok Pomarańczowy 100% 1L")
    assert conn.execute("SELECT ean FROM off_index1 WHERE key=?", (key1,)).fetchone() is None
    assert conn.execute("SELECT ean FROM off_index2 WHERE key=?", (key2,)).fetchone() is None
    assert conn.execute("SELECT 1 FROM off_ambiguous1 WHERE key=?", (key1,)).fetchone() is not None
    assert conn.execute("SELECT 1 FROM off_ambiguous2 WHERE key=?", (key2,)).fetchone() is not None


def test_build_pl_index_resolves_unambiguous_row(tmp_path):
    out, stats = _build(tmp_path)
    conn = sqlite3.connect(str(out))
    key1, _ = build_keys("Łaciate", "Mleko Łaciate UHT 3,2%", "1 l")
    row = conn.execute("SELECT ean FROM off_index1 WHERE key=?", (key1,)).fetchone()
    assert row == ("5900820000011",)


def test_build_pl_index_accepts_row_listed_under_multiple_countries(tmp_path):
    """countries_tags = ['en:poland', 'en:germany'] must still count as PL —
    a product need not be Poland-exclusive to be in scope."""
    out, stats = _build(tmp_path)
    conn = sqlite3.connect(str(out))
    key1, _ = build_keys("Winiary", "Zupa Pomidorowa 60g", "60 g")
    row = conn.execute("SELECT ean FROM off_index1 WHERE key=?", (key1,)).fetchone()
    assert row == ("5900123456789",)


# ------------------------------------------------------------ enrichment --

def test_enrich_from_index_hit_sets_barcode(tmp_path):
    out, _ = _build(tmp_path)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "barcode": None}]
    stats = enrich_from_index(products, out)
    assert products[0]["barcode"] == "5900820000011"
    assert stats == {"looked_up": 1, "enriched": 1, "ambiguous": 0, "misses": 0}


def test_enrich_from_index_ambiguous_never_sets_barcode(tmp_path):
    out, _ = _build(tmp_path)
    products = [{"name": "Sok Pomarańczowy 100% 1L", "brand": "TestBrand", "barcode": None}]
    stats = enrich_from_index(products, out)
    assert products[0]["barcode"] is None
    assert stats["ambiguous"] == 1
    assert stats["enriched"] == 0


def test_enrich_from_index_miss_leaves_barcode_none(tmp_path):
    out, _ = _build(tmp_path)
    products = [{"name": "Zupełnie Nieznany Produkt 250g", "brand": "Nikt", "barcode": None}]
    stats = enrich_from_index(products, out)
    assert products[0]["barcode"] is None
    assert stats["misses"] == 1


def test_enrich_from_index_skips_products_that_already_have_a_barcode(tmp_path):
    out, _ = _build(tmp_path)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "barcode": "1234567890123"}]
    stats = enrich_from_index(products, out)
    assert products[0]["barcode"] == "1234567890123"
    assert stats["looked_up"] == 0


def test_enrich_from_index_word_order_robust_via_secondary_key(tmp_path):
    """Scraped name has a different token ORDER than the OFF product_name —
    the exact key1 misses but the token-set key2 must still resolve it."""
    out, _ = _build(tmp_path)
    products = [{"name": "Pomidorowa Zupa 60g", "brand": "Winiary", "barcode": None}]
    stats = enrich_from_index(products, out)
    assert products[0]["barcode"] == "5900123456789"
    assert stats["enriched"] == 1


def test_enrich_from_index_missing_name_or_brand_not_looked_up(tmp_path):
    out, _ = _build(tmp_path)
    products = [{"name": "", "brand": "Łaciate", "barcode": None},
                {"name": "Coś", "brand": "", "barcode": None}]
    stats = enrich_from_index(products, out)
    assert stats["looked_up"] == 0
    assert products[0]["barcode"] is None
    assert products[1]["barcode"] is None


# --------------------------------------------------- key normalization ----

def test_build_keys_key1_matches_off_enrich_fold_and_base_amount():
    """Brand fold and base-quantity components of key1 must come from EXACTLY
    off_enrich._fold/_base_amount so a scraped product's key and the OFF
    index's key agree bit-for-bit on those parts."""
    key1, _ = build_keys("Łaciate", "Mleko Łaciate UHT 3,2%", "1 l")
    brand_part, name_part, qty_part = key1.split("|")
    assert brand_part == _fold("Łaciate")
    assert qty_part == _base_amount("1 l")
    # name has no embedded size, so size-stripping is a no-op -> agrees with
    # a plain off_enrich._fold of the name too.
    assert name_part == _fold("Mleko Łaciate UHT 3,2%")


def test_build_keys_uses_separate_quantity_text_when_given():
    """When an explicit quantity string is supplied (as OFF's own 'quantity'
    column is, separate from product_name), it takes precedence over trying
    to parse a size out of the name."""
    key1, _ = build_keys("Winiary", "Zupa Pomidorowa", "60 g")
    expected = f"{_fold('Winiary')}|{_fold('Zupa Pomidorowa')}|{_base_amount('60 g')}"
    assert key1 == expected


def test_build_keys_strips_embedded_size_so_it_matches_off_style_name():
    """A scraped product name embeds its size ('... 1L') while OFF's
    product_name never does (size lives in a separate 'quantity' column) —
    both must normalize to the SAME key1 for the same product."""
    off_style, _ = build_keys("Łaciate", "Mleko Łaciate UHT 3,2%", "1 l")
    scraped_style, _ = build_keys("Łaciate", "Mleko Łaciate UHT 3,2% 1L")
    assert off_style == scraped_style


def test_build_keys_returns_none_without_usable_quantity():
    assert build_keys("Marka", "Isimsiz Boyutsuz Urun") is None


def test_build_keys_returns_none_without_brand_or_name():
    assert build_keys("", "Bir Urun 100g") is None
    assert build_keys("Marka", "") is None


# --------------------------------------------------- ensure_pl_index ------

def test_ensure_pl_index_builds_when_missing(tmp_path, monkeypatch):
    calls = {"download": 0, "build": 0}

    def fake_download(dest_dir, url=None):
        calls["download"] += 1
        return Path(dest_dir) / "fake.csv.gz"

    def fake_build(dataset_path, out_sqlite):
        calls["build"] += 1
        Path(out_sqlite).write_bytes(b"")
        return {"rows_read": 0}

    monkeypatch.setattr(off_bulk, "download_dataset", fake_download)
    monkeypatch.setattr(off_bulk, "build_pl_index", fake_build)

    sqlite_path = ensure_pl_index(tmp_path)
    assert calls == {"download": 1, "build": 1}
    assert sqlite_path == tmp_path / "off_bulk_index.sqlite"
    assert sqlite_path.exists()


def test_ensure_pl_index_skips_rebuild_when_fresh(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "off_bulk_index.sqlite"
    sqlite_path.write_bytes(b"")  # freshly written -> mtime is now

    def boom(*a, **kw):
        raise AssertionError("should not be called when index is fresh")

    monkeypatch.setattr(off_bulk, "download_dataset", boom)
    monkeypatch.setattr(off_bulk, "build_pl_index", boom)

    result = ensure_pl_index(tmp_path)
    assert result == sqlite_path


def test_ensure_pl_index_rebuilds_when_stale(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "off_bulk_index.sqlite"
    sqlite_path.write_bytes(b"")
    old = time.time() - 31 * 86400
    os.utime(sqlite_path, (old, old))

    calls = {"download": 0, "build": 0}
    monkeypatch.setattr(off_bulk, "download_dataset",
                         lambda dest_dir, url=None: (calls.__setitem__("download", calls["download"] + 1),
                                                      Path(dest_dir) / "fake.csv.gz")[1])
    monkeypatch.setattr(off_bulk, "build_pl_index",
                         lambda dataset_path, out_sqlite: (calls.__setitem__("build", calls["build"] + 1),
                                                            Path(out_sqlite).write_bytes(b""))[0] or {})

    ensure_pl_index(tmp_path)
    assert calls == {"download": 1, "build": 1}
