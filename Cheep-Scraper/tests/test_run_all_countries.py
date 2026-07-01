import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import asyncio
import countries._common.run_all_countries as rac


def test_per_country_isolation_and_stagger(monkeypatch):
    calls = []

    async def fake_pipeline(config_path, api_url):
        calls.append(config_path)
        if "germany" in config_path:
            raise RuntimeError("DE site down")
        return {"country": config_path, "markets": []}

    slept = []
    monkeypatch.setattr(rac, "run_country_pipeline", fake_pipeline)

    summary = asyncio.run(rac.run_all(
        ["countries/switzerland/config.json", "countries/germany/config.json", "countries/poland/config.json"],
        api_url="http://localhost:3000/api/v1",
        stagger_seconds=0,
        sleep_fn=lambda s: slept.append(s),
    ))

    # all three attempted despite DE failing
    assert len(calls) == 3
    by_ok = {s["country"].split("/")[1]: s["ok"] for s in summary}
    assert by_ok["switzerland"] is True
    assert by_ok["germany"] is False
    assert by_ok["poland"] is True
    # DE failure recorded, not raised
    de = next(s for s in summary if "germany" in s["country"])
    assert "DE site down" in de["error"]
