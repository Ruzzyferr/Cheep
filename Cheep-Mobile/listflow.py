"""Real login -> Listelerim -> list -> Rotaları Göster -> Compare."""
from playwright.sync_api import sync_playwright

URL = "http://localhost:8081"
errs = []


def tap_center(pg, text, exact=False, t=6000):
    try:
        loc = pg.get_by_text(text, exact=exact).first
        box = loc.bounding_box(timeout=t)
        if not box:
            print("no box:", text); return False
        pg.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        return True
    except Exception as e:
        print(f"tap '{text}' warn:", str(e)[:50]); return False


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                        locale="tr-TR", geolocation={"latitude": 41.0, "longitude": 29.0},
                        permissions=["geolocation"])
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_timeout(5000)
    inputs = pg.locator("input")
    if inputs.count() >= 2:
        inputs.nth(0).fill("test@cheep.com")
        inputs.nth(1).fill("test123456")
        pg.wait_for_timeout(400)
        tap_center(pg, "Giriş Yap", exact=True)
        pg.wait_for_timeout(7000)

    tap_center(pg, "Listelerim", exact=True)
    pg.wait_for_timeout(3000)
    tap_center(pg, "Haftalık Market")
    pg.wait_for_timeout(3500)
    # scroll to bottom so the CTA is in view, then tap
    pg.mouse.wheel(0, 1200)
    pg.wait_for_timeout(1200)
    tap_center(pg, "Rotaları Göster")
    pg.wait_for_timeout(7000)
    pg.screenshot(path="screenshots/lf-compare.png", full_page=True)
    print("compare:", repr(pg.inner_text("body")[:260]))
    if errs:
        print("err:", errs[:5])
    ctx.close()
