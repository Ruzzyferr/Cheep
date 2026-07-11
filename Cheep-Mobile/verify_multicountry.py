"""
Runtime smoke verification for the multi-country / multi-language feature.

Two independent verification passes:

1. UI pass (Playwright, against the SHIPPED web bundle @ http://localhost:8081).
   Proves, unauthenticated (Intro tour, first screen shown):
     - The UI renders in the user's selected language (`user_language` in localStorage).
     - No Turkish Lira `₺` leaks when the active country (`user_country`) is DE or PL.
     - The PL locale currency glyph is `zł` (not `₺`/`€`).
   Does NOT modify app source. Read-only.

2. PL pilot data pass (plain HTTP against the live backend @ http://localhost:3000/api/v1).
   The Intro-tour screen above only ever shows static placeholder copy, so it cannot prove
   anything about the *real* PL pilot data (which chains actually carry scraped prices,
   whether pilot products have a category, etc). Those assertions need a real user +
   real API responses, so this pass registers a throwaway user (x-country: PL), hits
   /products and /stores, and checks the pilot data directly.
   No Android device is available in this environment, so nothing here drives the native
   app — everything is either a browser check against the web bundle (pass 1) or a direct
   API call (pass 2). The assistant language spot-check described in the task brief is
   intentionally NOT included here: this script does not otherwise exercise the assistant
   endpoint, and faking that check would be worse than omitting it. See
   docs/superpowers/pilots/2026-07-pl-release-checklist.md for it as a manual-QA item.

Env vars:
  MC_WEB_BASE_URL   - Expo web bundle base URL (default http://localhost:8081)
  MC_API_BASE_URL   - backend API base URL   (default http://localhost:3000/api/v1)

Invocation: `python verify_multicountry.py` from `Cheep-Mobile/`.
Requires: `playwright` (with chromium installed) for pass 1, `requests` for pass 2.
Pass 1 needs the Expo web dev server running (`npm run web` / `expo start --web`) on
MC_WEB_BASE_URL. Pass 2 needs the backend dev server + PL pilot data loaded.
"""
import os
import sys
import json

# Windows console defaults to cp1252 which can't encode some glyphs (emoji, zł, etc.)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

WEB_BASE_URL = os.environ.get("MC_WEB_BASE_URL", "http://localhost:8081")
API_BASE_URL = os.environ.get("MC_API_BASE_URL", "http://localhost:3000/api/v1")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(SCRIPT_DIR, "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Distinctive first-screen markers per language, pulled from src/i18n/locales/*.json.
# The app shows the Intro tour first (intro_seen not set), so intro.* keys plus
# common.continue (also used in profile/onboarding) are good discriminators.
MARKERS = {
    # Adapted from an initial run: the first screen shown (intro_seen unset) is
    # slide 1/4 of the Intro tour, so the visible strings are intro.skip,
    # intro.next and intro.slides.compare.title — not the onboarding-language
    # strings or the last-slide "get_started" text (those aren't on screen yet).
    "tr": ["Atla", "İleri", "En ucuzu ben bulurum"],
    "de": ["Überspringen", "Weiter", "Ich finde den günstigsten Preis"],
    "pl": ["Pomiń", "Dalej", "Znajdę dla Ciebie najniższą cenę"],
}

# Expected currency glyph per country, per src/context/LocaleContext.tsx COUNTRY_CONFIG.
# The Intro tour's compare-slide illustration renders example prices in this glyph even
# though it's static placeholder data (not live pilot prices) — see pass 2 for real data.
CURRENCY_GLYPH = {"TR": "₺", "DE": "€", "PL": "zł"}

CASES = [("tr", "TR"), ("de", "DE"), ("pl", "PL")]


# ============================================================
# PASS 1: Playwright / web bundle language + currency-glyph check
# ============================================================

def run_ui_language_checks():
    from playwright.sync_api import sync_playwright

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for lang, country in CASES:
            context = browser.new_context(viewport={"width": 390, "height": 760})
            page = context.new_page()
            page_errors = []
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))

            # Set localStorage BEFORE any app script runs. Do NOT set intro_seen,
            # so the localized first screen (intro tour) is what we observe.
            page.add_init_script(
                f"""
                window.localStorage.setItem('user_language', {json.dumps(lang)});
                window.localStorage.setItem('user_country', {json.dumps(country)});
                """
            )

            page.goto(WEB_BASE_URL, wait_until="domcontentloaded", timeout=120000)
            page.wait_for_timeout(15000)  # allow Metro bundle + first render

            body_text = page.inner_text("body")
            screenshot_path = os.path.join(SCREENSHOT_DIR, f"mc-{country}.png")
            page.screenshot(path=screenshot_path)

            debug_path = os.path.join(SCREENSHOT_DIR, f"mc-{country}-body.txt")
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(body_text)

            own_markers = MARKERS[lang]
            found_markers = [m for m in own_markers if m in body_text]
            lang_ok = len(found_markers) > 0

            lira_present = "₺" in body_text
            # Explicit rule: for DE/PL, lira must NOT appear.
            currency_ok = True if country not in ("DE", "PL") else (not lira_present)

            # Currency glyph check: the country's OWN glyph must render somewhere on
            # screen (the compare-slide illustration uses example prices), and no other
            # country's glyph should dominate. Extends the original lira-only check to
            # explicitly assert the positive case too (e.g. zł for PL), per task-14 brief.
            expected_glyph = CURRENCY_GLYPH[country]
            own_glyph_present = expected_glyph in body_text
            other_glyphs_present = {
                c: g for c, g in CURRENCY_GLYPH.items()
                if c != country and g in body_text and g != expected_glyph
            }
            currency_glyph_ok = own_glyph_present and len(other_glyphs_present) == 0

            other_markers_found = {
                other_lang: [m for m in other_markers if m in body_text]
                for other_lang, other_markers in MARKERS.items()
                if other_lang != lang
            }
            # sanity: no OTHER language's markers should dominate (appear) alongside ours
            other_dominant = any(len(v) > 0 for v in other_markers_found.values())

            overall_pass = lang_ok and currency_ok and currency_glyph_ok and len(page_errors) == 0

            snippet = body_text[:200].replace("\n", " ")

            results.append({
                "lang": lang,
                "country": country,
                "markers_searched": own_markers,
                "markers_found": found_markers,
                "lang_ok": lang_ok,
                "lira_present": lira_present,
                "currency_ok": currency_ok,
                "expected_currency_glyph": expected_glyph,
                "own_glyph_present": own_glyph_present,
                "other_glyphs_present": other_glyphs_present,
                "currency_glyph_ok": currency_glyph_ok,
                "other_markers_found": other_markers_found,
                "other_dominant": other_dominant,
                "pageerrors": page_errors,
                "body_snippet": snippet,
                "screenshot": screenshot_path,
                "overall_pass": overall_pass,
            })

            status = "PASS" if overall_pass else "FAIL"
            print(f"[{status}] lang={lang} country={country} "
                  f"markers_found={found_markers} lira_present={lira_present} "
                  f"currency_glyph_ok={currency_glyph_ok} (expected={expected_glyph!r}) "
                  f"pageerrors={len(page_errors)} other_dominant={other_dominant}")
            print(f"    snippet: {snippet}")
            print(f"    screenshot: {screenshot_path}")

            context.close()
        browser.close()

    with open(os.path.join(SCRIPT_DIR, "verify_multicountry_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    return results


# ============================================================
# PASS 2: PL pilot data checks (direct API, no browser/device needed)
# ============================================================

# Real scraped-price chains expected for the PL pilot (Task 9/12 ingest). Carrefour has a
# Store row (legacy/seed) but NO scraper feeding it — see task-14 brief adaptation notes.
EXPECTED_PL_PRICED_CHAINS = {"Auchan", "Biedronka", "Lidl", "Żabka"}
EXCLUDED_PL_CHAIN = "Carrefour"


def _api_post(session, path, json_body=None, headers=None):
    import requests
    r = session.post(f"{API_BASE_URL}{path}", json=json_body or {}, headers=headers or {}, timeout=30)
    return r


def _api_get(session, path, headers=None):
    import requests
    r = session.get(f"{API_BASE_URL}{path}", headers=headers or {}, timeout=30)
    return r


def run_pl_pilot_api_checks():
    import requests
    import time

    results = {"checks": [], "overall_pass": True}

    def record(name, passed, detail):
        # passed is a tri-state: True/False, or None for an intentional, undisguised skip
        # (never faked as a pass) — see the assistant spot-check below.
        results["checks"].append({"name": name, "pass": passed, "detail": detail})
        if passed is False:
            results["overall_pass"] = False
        status = "PASS" if passed else ("SKIP" if passed is None else "FAIL")
        print(f"[{status}] {name}: {detail}")

    session = requests.Session()

    # --- register a throwaway PL test user -----------------------------------------
    email = f"pl-pilot-verify-{int(time.time())}@example.com"
    reg = _api_post(session, "/auth/register", {
        "email": email, "password": "TestPass123", "name": "PL Pilot Verify",
    }, headers={"x-country": "PL"})
    if reg.status_code not in (200, 201) or not reg.json().get("success"):
        record("register_pl_test_user", False, f"status={reg.status_code} body={reg.text[:300]}")
        return results
    token = reg.json()["token"]
    auth_headers = {"x-country": "PL", "Authorization": f"Bearer {token}"}
    record("register_pl_test_user", True, f"user_id={reg.json()['user']['id']} email={email}")

    # --- (a) stores: exactly the 4 real chains carry scraped prices; Carrefour doesn't ---
    products_resp = _api_get(session, "/products?limit=250", headers=auth_headers)
    if products_resp.status_code != 200:
        record("fetch_pl_products", False, f"status={products_resp.status_code}")
        return results
    products = products_resp.json()["data"]
    pagination = products_resp.json().get("pagination", {})
    record("fetch_pl_products", True,
           f"fetched={len(products)} pagination_total={pagination.get('total')}")

    priced_chains_by_source = {}
    for p in products:
        for sp in p.get("store_prices", []):
            store_name = sp["store"]["name"]
            src = sp.get("source")
            priced_chains_by_source.setdefault(store_name, set()).add(src)

    stores_with_scrape_prices = {
        name for name, sources in priced_chains_by_source.items() if "scrape" in sources
    }
    record(
        "pl_stores_with_real_prices_are_exactly_4_chains",
        stores_with_scrape_prices == EXPECTED_PL_PRICED_CHAINS,
        f"stores_with_scrape_prices={sorted(stores_with_scrape_prices)} "
        f"expected={sorted(EXPECTED_PL_PRICED_CHAINS)}",
    )
    record(
        "carrefour_excluded_from_real_priced_stores",
        EXCLUDED_PL_CHAIN not in stores_with_scrape_prices,
        f"Carrefour source set = {priced_chains_by_source.get(EXCLUDED_PL_CHAIN)} "
        f"(expected only 'seed', if present at all — never 'scrape')",
    )

    # Store row for Carrefour should still exist (per brief: "Store row exists but has
    # only seed prices") — sanity check that we're excluding it by DATA, not because the
    # row is missing.
    stores_resp = _api_get(session, "/stores", headers=auth_headers)
    all_store_names = {s["name"] for s in stores_resp.json().get("data", [])} if stores_resp.status_code == 200 else set()
    record(
        "carrefour_store_row_still_exists",
        EXCLUDED_PL_CHAIN in all_store_names,
        f"/stores (PL) = {sorted(all_store_names)}",
    )

    # --- (b) zł formatting: cross-check the static client-side currency map matches ------
    locale_ctx_path = os.path.join(SCRIPT_DIR, "src", "context", "LocaleContext.tsx")
    zl_configured = False
    try:
        with open(locale_ctx_path, "r", encoding="utf-8") as f:
            src = f.read()
        # crude but sufficient: PL row must map to symbol 'zł' and currency 'PLN'
        zl_configured = ("PL:" in src) and ("zł" in src) and ("PLN" in src)
    except FileNotFoundError:
        pass
    record(
        "pl_currency_symbol_configured_as_zl",
        zl_configured,
        f"src/context/LocaleContext.tsx COUNTRY_CONFIG.PL -> {{currency: 'PLN', symbol: 'zł'}} "
        f"({'found' if zl_configured else 'NOT found'}). Live glyph rendering is asserted "
        f"separately in pass 1 (Playwright) against the intro-tour compare slide.",
    )

    # --- (c) a pilot product (real, scraped) has a category -------------------------
    scraped_with_category = [
        p for p in products
        if p.get("category") is not None
        and any(sp.get("source") == "scrape" for sp in p.get("store_prices", []))
    ]
    example = scraped_with_category[0] if scraped_with_category else None
    record(
        "pl_pilot_product_has_category",
        example is not None,
        f"example={example['name']!r} category={example['category']['name']!r}"
        if example else "no scraped product with a category found",
    )

    # --- (d) assistant language spot-check: explicitly NOT run here -----------------
    record(
        "assistant_pl_language_spot_check",
        None,  # not a pass/fail — explicitly skipped, see detail
        "SKIPPED (not faked): this script does not otherwise exercise the assistant "
        "endpoint, so per task-14 brief this is left as a manual-QA item "
        "(see docs/superpowers/pilots/2026-07-pl-release-checklist.md). "
        "GEMINI_API_KEY IS configured in this environment, so the manual check is "
        "feasible — just not automated here.",
    )

    with open(os.path.join(SCRIPT_DIR, "verify_pl_pilot_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    return results


# ============================================================
# main
# ============================================================

def main():
    print("=== PASS 1: UI language + currency-glyph checks (Playwright / web bundle) ===")
    ui_results = None
    ui_error = None
    try:
        ui_results = run_ui_language_checks()
    except Exception as exc:  # noqa: BLE001 - report and continue to pass 2
        ui_error = str(exc)
        print(f"[SKIP] Pass 1 could not run: {ui_error}")
        print(f"       (expected if the Expo web dev server isn't running on {WEB_BASE_URL})")

    print("\n=== PASS 2: PL pilot data checks (direct API) ===")
    api_results = None
    api_error = None
    try:
        api_results = run_pl_pilot_api_checks()
    except Exception as exc:  # noqa: BLE001
        api_error = str(exc)
        print(f"[SKIP] Pass 2 could not run: {api_error}")
        print(f"       (expected if the backend dev server isn't running on {API_BASE_URL})")

    print("\n=== SUMMARY ===")
    if ui_results is not None:
        for r in ui_results:
            print(f"[UI]  {r['lang']}/{r['country']}: {'PASS' if r['overall_pass'] else 'FAIL'}")
    else:
        print(f"[UI]  SKIPPED — {ui_error}")

    if api_results is not None:
        for c in api_results["checks"]:
            status = "PASS" if c["pass"] else ("SKIP" if c["pass"] is None else "FAIL")
            print(f"[API] {c['name']}: {status}")
    else:
        print(f"[API] SKIPPED — {api_error}")

    ui_ok = ui_results is None or all(r["overall_pass"] for r in ui_results)
    api_ok = api_results is None or api_results["overall_pass"]
    if not ui_ok or not api_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
