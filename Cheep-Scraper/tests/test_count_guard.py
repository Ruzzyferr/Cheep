from countries._common.pipeline import (
    baseline_of,
    next_baseline,
    should_import,
    summary_is_healthy,
    filter_products_by_category_domain,
    resolve_enrich_mode,
)


def test_collapse_blocks_import():
    assert should_import("Biedronka", new_count=40, prev_counts={"Biedronka": 100}) is False


def test_normal_fluctuation_passes():
    assert should_import("Biedronka", new_count=85, prev_counts={"Biedronka": 100}) is True


def test_first_run_always_passes():
    assert should_import("Biedronka", new_count=10, prev_counts={}) is True


def test_summary_healthy_when_all_markets_ok():
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 100, "failed": 0},
            {"market": "Lidl", "successful": 80, "failed": 0},
        ],
    }
    assert summary_is_healthy(summary) is True


def test_summary_unhealthy_when_market_skipped():
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 100, "failed": 0},
            {"market": "Lidl", "skipped": "count_collapse"},
        ],
    }
    assert summary_is_healthy(summary) is False


def test_summary_unhealthy_when_market_has_failures():
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 90, "failed": 10},
        ],
    }
    assert summary_is_healthy(summary) is False


def test_summary_healthy_with_single_failure_within_tolerance():
    # 2026-07-23: 1 malformed item out of 1,003 (prod Biedronka 2026-07-21)
    # must NOT cancel the nightly prune + EAN harvest — tolerate up to
    # max(1, 1%) failed imports per market.
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 1002, "failed": 1},
        ],
    }
    assert summary_is_healthy(summary) is True


def test_summary_healthy_at_one_percent_failure_boundary():
    # 10 failed of 1000 attempted == exactly the 1% allowance -> healthy;
    # 11 of 1001 -> over the allowance -> unhealthy.
    at_boundary = {
        "country": "PL",
        "markets": [{"market": "Carrefour", "successful": 990, "failed": 10}],
    }
    over_boundary = {
        "country": "PL",
        "markets": [{"market": "Carrefour", "successful": 990, "failed": 11}],
    }
    assert summary_is_healthy(at_boundary) is True
    assert summary_is_healthy(over_boundary) is False


def test_summary_unhealthy_when_only_failures():
    # failed>0 with successful==0 is a collapsed market, never tolerated —
    # the min-1 allowance must not mask a market that imported nothing.
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Auchan", "successful": 0, "failed": 1},
        ],
    }
    assert summary_is_healthy(summary) is False


def test_summary_unhealthy_when_no_markets():
    summary = {"country": "PL", "markets": []}
    assert summary_is_healthy(summary) is False


def test_no_filters_keeps_everything_unchanged():
    products = [{"name": "Spodnie", "raw_category": "Kategorie/Moda/Dżinsy"}]
    kept, stats = filter_products_by_category_domain(products)
    assert kept == products
    assert stats == {"kept": 1, "dropped": 0}


def test_allow_prefix_keeps_matching_drops_rest():
    products = [
        {"name": "Jabłka", "raw_category": "Światy potrzeb/Żywność/Owoce"},
        {"name": "Spodnie", "raw_category": "Kategorie/Moda/Dżinsy"},
    ]
    kept, stats = filter_products_by_category_domain(products, allow_prefixes=["Światy potrzeb/Żywność"])
    assert [p["name"] for p in kept] == ["Jabłka"]
    assert stats == {"kept": 1, "dropped": 1}


def test_deny_prefix_drops_matching_keeps_rest():
    products = [
        {"name": "Wiertarka", "raw_category": "Kategorie/Warsztat/Narzędzia"},
        {"name": "Jabłka", "raw_category": "Światy potrzeb/Żywność/Owoce"},
    ]
    kept, stats = filter_products_by_category_domain(products, deny_prefixes=["Kategorie/Warsztat"])
    assert [p["name"] for p in kept] == ["Jabłka"]
    assert stats == {"kept": 1, "dropped": 1}


def test_deny_takes_precedence_over_allow():
    """A product matching both an allow and a deny prefix must be dropped —
    deny wins, so a coarse allow list can be safely narrowed by deny rules."""
    products = [{"name": "Chemikalia", "raw_category": "Kategorie/Dom/Chemia/Trujące"}]
    kept, stats = filter_products_by_category_domain(
        products, allow_prefixes=["Kategorie/Dom"], deny_prefixes=["Kategorie/Dom/Chemia"],
    )
    assert kept == []
    assert stats == {"kept": 0, "dropped": 1}


def test_resolve_enrich_mode_bulk():
    assert resolve_enrich_mode({"off_bulk": True}) == "bulk"


def test_resolve_enrich_mode_api():
    assert resolve_enrich_mode({"off_enrich": True}) == "api"


def test_resolve_enrich_mode_none_when_neither_set():
    assert resolve_enrich_mode({}) is None


def test_resolve_enrich_mode_bulk_takes_priority_over_api():
    """Configs should only ever set one of the two flags (off_bulk REPLACES
    off_enrich, it doesn't layer on top of it) — but if both were ever set,
    bulk (the local, non-rate-limited path) must win."""
    assert resolve_enrich_mode({"off_bulk": True, "off_enrich": True}) == "bulk"


def test_products_without_raw_category_are_always_kept():
    """Żabka case: some scrapers never populate raw_category at all — those
    products must survive an allow/deny filter untouched, not get dropped
    for 'not matching' an allow prefix."""
    products = [{"name": "Bułka"}, {"name": "Mleko", "raw_category": None}]
    kept, stats = filter_products_by_category_domain(
        products, allow_prefixes=["Światy potrzeb/Żywność"],
    )
    assert len(kept) == 2
    assert stats == {"kept": 2, "dropped": 0}


# ─────────────────────────────────────────────────────────────────────────────
# EKSİK MARKET KURALI (2026-08-25)
#
# Sıfır ürün çeken bir zincir `runner`'dan None döner, `scrape_results`'a hiç
# girmez ve özette GÖRÜNMEZ. Kapı yalnızca var olan girdilere baktığı için
# tamamen çökmüş bir zincir "hiç istenmemiş" gibi davranıyordu: koşum sağlıklı
# sayılıyor, çıkış kodu 0 oluyor ve `run-daily.sh` ülke çapında prune'u
# tetikliyordu. 21 günlük TTL aşıldığında o zincirin tüm kataloğu siliniyor ve
# silme kullanıcıların liste kalemlerine CASCADE ediyor.
# ─────────────────────────────────────────────────────────────────────────────


def test_summary_unhealthy_when_expected_market_missing():
    """Çarşamba rotasyonu Lidl+Żabka+Carrefour istedi; iki Wolt zinciri sıfır
    ürün çekip özetten düştü. Kapı bunu YAKALAMALI."""
    summary = {
        "country": "PL",
        "expected_markets": ["Lidl", "Żabka", "Carrefour"],
        "markets": [
            {"market": "Lidl", "successful": 54, "failed": 0},
        ],
    }
    assert summary_is_healthy(summary) is False


def test_summary_healthy_when_all_expected_markets_reported():
    summary = {
        "country": "PL",
        "expected_markets": ["Lidl", "Żabka"],
        "markets": [
            {"market": "Lidl", "successful": 54, "failed": 0},
            {"market": "Żabka", "successful": 1990, "failed": 0},
        ],
    }
    assert summary_is_healthy(summary) is True


def test_missing_market_rule_skipped_when_expectation_absent():
    """Eski/sentetik özetlerde `expected_markets` yok — kural o zaman
    uygulanmaz; olmayan veriye dayanıp kapıyı kapatmak yanlış olurdu."""
    summary = {
        "country": "PL",
        "markets": [{"market": "Lidl", "successful": 54, "failed": 0}],
    }
    assert summary_is_healthy(summary) is True


def test_expected_market_that_collapsed_still_unhealthy():
    """Sayı çöküşüyle atlanan market özette VAR ama `skipped` işaretli —
    eksik-market kuralı bunu maskelememeli."""
    summary = {
        "country": "PL",
        "expected_markets": ["Lidl", "Żabka"],
        "markets": [
            {"market": "Lidl", "successful": 54, "failed": 0},
            {"market": "Żabka", "skipped": "count_collapse"},
        ],
    }
    assert summary_is_healthy(summary) is False

# ─────────────────────────────────────────────────────────────────────────────
# CENDERE (RATCHET) — 2026-08-26
#
# Kapının karşılaştırma tabanı SON kabul edilen sayıydı ve her kabulde üzerine
# yazılıyordu. 100 → 60 (geçer, taban 60) → 36 (geçer) → 21 → 12 … Her adım tek
# başına "normal dalgalanma" görünürken katalog bir haftada sessizce boşalıyor
# ve HİÇBİR adım alarm üretmiyordu. Artık kıyas tavan değerle (`hwm`) yapılıyor.
# ─────────────────────────────────────────────────────────────────────────────


def test_baseline_reads_legacy_int_format():
    """Eski `last_good_counts.json` market başına düz tamsayı tutuyordu;
    göç betiği yazmadan okunabilmeli."""
    assert baseline_of(100) == 100
    assert baseline_of({"last": 60, "hwm": 100}) == 100
    assert baseline_of(None) == 0
    assert baseline_of({}) == 0


def test_ratchet_cannot_walk_the_catalog_to_zero():
    """ASIL SINAV: arka arkaya her biri tek başına 'geçerli' olan düşüşler
    toplamda kataloğu boşaltamamalı."""
    entry = 100
    # Birinci gece 60: 100'ün %60'ı, sınırda geçer.
    assert should_import("Lidl", 60, {"Lidl": entry}) is True
    entry = next_baseline(entry, 60)
    # İkinci gece 36 ESKİDEN geçiyordu (60'ın %60'ı). Artık taban hâlâ ~98,
    # yani 36 reddedilmeli.
    assert should_import("Lidl", 36, {"Lidl": entry}) is False


def test_baseline_rises_freely_on_growth():
    assert next_baseline({"last": 60, "hwm": 100}, 500)["hwm"] == 500


def test_baseline_decays_slowly_so_real_shrink_is_eventually_accepted():
    """Zincir gerçekten küçüldüyse kapı sonsuza dek yüksekte kalmamalı —
    ama bu ~%2/koşum hızında olmalı, tek gecede değil."""
    entry = {"last": 100, "hwm": 100}
    entry = next_baseline(entry, 60)
    assert entry["hwm"] == 98          # 100 -> 98, 60'a DÜŞMEZ
    for _ in range(40):
        entry = next_baseline(entry, 60)
    assert entry["hwm"] == 60          # yeterince koşumda gerçeğe yakınsar


def test_first_run_still_passes_with_new_format():
    assert should_import("Yeni", 10, {}) is True
    assert should_import("Yeni", 10, {"Yeni": {"last": 0, "hwm": 0}}) is True
