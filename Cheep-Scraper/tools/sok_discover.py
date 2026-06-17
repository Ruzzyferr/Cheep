"""Discover ŞOK's live product API: endpoint, required request headers, sample."""
import json
from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

prod_calls = []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=UA, viewport={"width": 1366, "height": 900})
        page = ctx.new_page()

        def on_resp(resp):
            u = resp.url
            if "/api/" not in u:
                return
            if not any(k in u.lower() for k in ("product", "search", "list", "categor")):
                return
            try:
                ct = resp.headers.get("content-type", "")
                if "json" not in ct:
                    return
                body = resp.text()
                prod_calls.append({
                    "url": u, "status": resp.status,
                    "req_headers": dict(resp.request.headers),
                    "bytes": len(body), "body": body[:1500],
                })
            except Exception:
                pass

        page.on("response", on_resp)
        page.goto("https://www.sokmarket.com.tr/", wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(4000)

        # Get categories via in-page fetch (authorized session)
        cats = page.evaluate("""async () => {
            const r = await fetch('/api/v1/cms/categories', {headers:{'accept':'application/json'}});
            return await r.json();
        }""")
        # find first category url/slug
        def find_slugs(node, out):
            if isinstance(node, dict):
                slug = node.get('slug') or node.get('seoUrl') or node.get('url')
                name = node.get('name') or node.get('title')
                if slug and (name or '-pgrp-' in str(slug)):
                    out.append((name or '?', slug))
                for v in node.values():
                    find_slugs(v, out)
            elif isinstance(node, list):
                for v in node:
                    find_slugs(v, out)
        slugs = []
        find_slugs(cats, slugs)
        print("=== SAMPLE CATEGORY SLUGS ===")
        for nm, sl in slugs[:15]:
            print(f"  {nm} -> {sl}")

        # navigate to first product-group url
        target = None
        for nm, sl in slugs:
            s = str(sl)
            if '-pgrp-' in s or '-klist-' in s or '/kategori' in s:
                target = s if s.startswith("http") else "https://www.sokmarket.com.tr" + (s if s.startswith("/") else "/" + s)
                break
        print(f"\n=== NAVIGATε CATEGORY: {target} ===")
        if target:
            try:
                page.goto(target, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(5000)
                for _ in range(3):
                    page.mouse.wheel(0, 4000); page.wait_for_timeout(1500)
            except Exception as e:
                print("nav warn:", e)
        ctx.close()

    print(f"\n=== PRODUCT/LIST API CALLS ({len(prod_calls)}) ===")
    seen = set()
    for c in prod_calls:
        path = c["url"].split("?")[0]
        if path in seen:
            continue
        seen.add(path)
        print(f"\n[{c['status']}] {c['url'][:170]}  bytes={c['bytes']}")
        interesting_h = {k: v for k, v in c["req_headers"].items()
                         if k.lower() in ("authorization", "x-api-key", "apikey", "x-platform",
                                          "x-channel", "x-store", "x-client", "accept",
                                          "x-correlation-id", "tenant", "x-tenant")}
        print("  req_headers:", json.dumps(interesting_h, ensure_ascii=False))
        print("  body:", c["body"][:500])


if __name__ == "__main__":
    main()
