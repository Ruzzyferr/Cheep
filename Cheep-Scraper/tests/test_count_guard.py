from countries._common.pipeline import should_import


def test_collapse_blocks_import():
    assert should_import("Biedronka", new_count=40, prev_counts={"Biedronka": 100}) is False


def test_normal_fluctuation_passes():
    assert should_import("Biedronka", new_count=85, prev_counts={"Biedronka": 100}) is True


def test_first_run_always_passes():
    assert should_import("Biedronka", new_count=10, prev_counts={}) is True
