"""Load a committed fixture (saved live response) and feed it to a scraper's
pure parse method, so parser correctness is tested without network access."""
import json
from pathlib import Path
from typing import Callable, List


def load_fixture(country_dir: Path, name: str) -> str:
    """Return the text of countries/<code>/fixtures/<name>."""
    path = country_dir / "fixtures" / name
    return path.read_text(encoding="utf-8")


def parse_fixture(fixture_text: str, parse_fn: Callable[[str], List]) -> List:
    """Run a scraper's pure parse function against saved fixture text."""
    return parse_fn(fixture_text)


def as_json(fixture_text: str):
    return json.loads(fixture_text)
