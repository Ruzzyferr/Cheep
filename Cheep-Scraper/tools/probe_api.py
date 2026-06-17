"""
Generic Playwright API probe.

Loads a page in Chromium, captures all XHR/fetch responses that return JSON,
and prints the ones that look like product/category data (URL, status, top-level
keys, a short preview). Used to discover the live API a grocery site uses.

Usage:
    python tools/probe_api.py <url> [--headed] [--user-data-dir DIR] [--wait MS] [--scroll N]
"""
import sys
import json
import argparse
from playwright.sync_api import sync_playwright

INTERESTING = ("product", "search", "screen", "categor", "list", "items", "catalog", "plp")


def looks_interesting(url: str, body_preview: str) -> bool:
    u = url.lower()
    if any(k in u for k in INTERESTING):
        return True
    # body mentions price-ish fields
    bp = body_preview.lower()
    return any(k in bp for k in ('"price"', 'fiyat', '"products"', 'storeproduct', '"sku"'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--user-data-dir", default=None)
    ap.add_argument("--wait", type=int, default=8000, help="ms to wait after load")
    ap.add_argument("--scroll", type=int, default=3, help="scroll passes to trigger lazy loads")
    args = ap.parse_args()

    captured = []

    def on_response(resp):
        try:
            ct = resp.headers.get("content-type", "")
            if "json" not in ct:
                return
            url = resp.url
            body = resp.text()
            preview = body[:400]
            if not looks_interesting(url, preview):
                return
            keys = ""
            try:
                data = json.loads(body)
                if isinstance(data, dict):
                    keys = ",".join(list(data.keys())[:12])
                elif isinstance(data, list):
                    keys = f"[list len={len(data)}]"
            except Exception:
                pass
            captured.append({
                "method": resp.request.method,
                "status": resp.status,
                "url": url,
                "bytes": len(body),
                "keys": keys,
                "preview": preview,
            })
        except Exception:
            pass

    with sync_playwright() as p:
        ua = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        if args.user_data_dir:
            ctx = p.chromium.launch_persistent_context(
                args.user_data_dir, headless=not args.headed, user_agent=ua,
                viewport={"width": 1366, "height": 900})
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
        else:
            browser = p.chromium.launch(headless=not args.headed)
            ctx = browser.new_context(user_agent=ua, viewport={"width": 1366, "height": 900})
            page = ctx.new_page()

        page.on("response", on_response)
        try:
            page.goto(args.url, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            print(f"[goto warning] {e}")
        page.wait_for_timeout(args.wait)
        for _ in range(args.scroll):
            try:
                page.mouse.wheel(0, 4000)
                page.wait_for_timeout(1500)
            except Exception:
                break
        ctx.close()

    print(f"\n=== Captured {len(captured)} interesting JSON responses ===\n")
    # de-dup by (method, url path without query)
    seen = set()
    for c in captured:
        path = c["url"].split("?")[0]
        sig = (c["method"], path)
        if sig in seen:
            continue
        seen.add(sig)
        print(f"[{c['status']}] {c['method']} {c['url'][:160]}")
        print(f"   bytes={c['bytes']} keys={c['keys']}")
        print(f"   preview={c['preview'][:200]}")
        print()


if __name__ == "__main__":
    main()
