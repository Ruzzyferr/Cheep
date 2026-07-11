# PL Pilot — Play Store Release Checklist

**Date drafted:** 2026-07-11 · **Scope:** Poland (PL) closed-testing rollout, 4 real chains
(Auchan, Biedronka, Lidl, Żabka) · **Precondition:** [2026-07-pl-pilot-audit.md](./2026-07-pl-pilot-audit.md)
data-quality gate is green (194 products, 0 bad merges).

This is a checklist, not a runbook — each item links to the exact file/command involved so
whoever executes it doesn't have to go spelunking. Check off items in order; the backend/data
items (bottom half) can happen in parallel with the Play Console prep (top half) since they
touch different systems.

## Verification already done (this task)

- `Cheep-Mobile/verify_multicountry.py` extended and run against the local stack (dev backend
  @ `localhost:3000`, Expo web @ `localhost:8081`, PL pilot data loaded). All automated checks
  **PASS** — see the task-14 report for full output. In scope:
  - UI renders in PL locale (Playwright, unauthenticated intro tour) with `zł`, no `₺`.
  - Exactly 4 chains (Auchan, Biedronka, Lidl, Żabka) carry real (`source: scrape`) prices;
    Carrefour's `Store` row exists but is correctly excluded (only the fake seed product has a
    Carrefour price — see "Neutralize fake seed product" below).
  - A real pilot product has a resolved `category`.
- Compare-engine smoke test (`POST /api/v1/lists/:id/compare`, Warsaw 52.2297/21.0122, 5 real
  pilot products from Auchan/Biedronka) returned branch-based coordinates near Warsaw (e.g.
  Auchan 52.2230/21.0145, Biedronka 52.2322/21.0118 — not the single chain-level fallback point
  in Kraków), sub-kilometer distances, and prices in PLN with zero `₺`/`TRY` occurrences. Full
  request/response saved in the task-14 report.
- **NOT automated — manual QA item:** assistant reply to a Polish message contains no Turkish.
  `GEMINI_API_KEY` **is** configured in the local dev backend, so this is testable, but
  `verify_multicountry.py` doesn't otherwise exercise the `/assistant` endpoints and this task
  intentionally didn't bolt on a fake/unverified check. Before closed testing opens: send a PL
  message through the app (or `POST /api/v1/assistant/threads` → `POST .../messages` with
  `x-country: PL`) and eyeball the reply for Turkish leakage.
- **NOT verifiable locally — no Android device in this environment:** anything requiring a real
  device build (native Play Store install, native location permission prompt, etc). Covered
  below as manual steps on the closed-testing track.

## 1. Play Console — country availability & listing

- [ ] Play Console → app → **Release → Setup → Advanced settings → Countries/regions** → add
      **Poland**.
- [ ] Play Console → **Store presence → Main store listing → Add language → Polish (polski)**.
      Fill in title/short/full description below (source tone: `Cheep-Mobile/src/i18n/locales/pl.json`
      — direct, benefit-first, informal "Ci/Twoim" address, no corporate voice).

  **Title** (30 char max): `Cheep — najtańsze zakupy`

  **Short description** (80 char max):
  `Porównuję ceny w Biedronce, Lidlu, Auchan i Żabce. Znajdę dla Ciebie najniższą.`

  **Full description** (draft — have a PL native speaker sanity-check before publishing):
  ```
  Cheep porównuje ceny tych samych produktów między sklepami i pokazuje Ci najtańszą
  opcję — zanim wyjdziesz z domu.

  Jak to działa:
  • Dodaj produkty do listy zakupów
  • Cheep sprawdza ceny w Biedronce, Lidlu, Auchan i Żabce
  • Zobacz, czy taniej zrobić zakupy w jednym sklepie, czy podzielić listę na kilka
  • Zaplanujemy dla Ciebie najtańszą trasę z realnymi odległościami do najbliższych sklepów

  Oszczędzaj przy każdych zakupach, bez przeklikiwania się przez cztery aplikacje i
  gazetki promocyjne.

  • Aktualne ceny z Biedronki, Lidla, Auchan i Żabki
  • Filtry diety i alergii (laktoza, gluten, orzechy i inne)
  • Historia cen — zobacz, czy to naprawdę okazja
  • Trasa zakupowa dopasowana do Twojej lokalizacji
  ```
  (Mirrors `intro.slides.compare.title` / `.desc` and `home.markets_title` phrasing from
  `pl.json` rather than inventing new marketing copy.)

- [ ] Privacy policy / data-safety form: confirm it already covers approximate location use
      (copy exists in-app at `consent.location_message` in `pl.json`) — Play Console's Data
      Safety section should already be accurate since it's country-agnostic, but re-check the
      "location" and "no third-party sharing" answers still match reality for PL.

## 2. Screenshots

- [ ] Capture fresh phone screenshots **with real PL pilot data loaded** (not the static
      intro-tour placeholder data used by `verify_multicountry.py`'s Playwright pass — that
      illustration hardcodes "Migros/A101/ŞOK" regardless of country and must not ship as a PL
      screenshot). Minimum set: Home (PL market list), a List with 3+ real Biedronka/Lidl/Auchan
      products, the Compare/route screen (shows `zł` prices + distance), Deals screen.
  - [ ] No Android device is available in this dev environment — this step needs either a
        physical/emulated Android device or Expo Go against the droplet once deployed
        (`Cheep-Mobile/.env` → `EXPO_PUBLIC_API_URL=http://<DROPLET_IP>:3000/api/v1`, per
        `deploy/README.md`).
- [ ] Upload to Play Console Polish listing (phone screenshots minimum; tablet optional).

## 3. Testing track

- [ ] Do **not** go straight to production. Create/reuse a **closed testing** track, add a
      short list of PL testers (email list or Google Group) before opening to production.
- [ ] Confirm testers can register with `x-country: PL` reaching Poland-priced data (the app's
      country picker — `onboarding.country_title` in `pl.json` — should surface PL once added
      to `COUNTRY_CONFIG` in `Cheep-Mobile/src/context/LocaleContext.tsx`; already present:
      `PL: { currency: 'PLN', symbol: 'zł', locale: 'pl-PL' }`).
- [ ] Roll out closed testing, gather feedback for at least one release cycle before considering
      production/wider rollout.

## 4. Mobile version bump

- [ ] `Cheep-Mobile/app.json`: bump `expo.version` and `expo.android.versionCode` following this
      repo's convention (see `git log -- Cheep-Mobile/app.json`, e.g.
      `chore(mobile): bump to 1.0.8 (versionCode 9) — <what changed>`). Current values at time
      of writing: `version: "1.0.9"`, `android.versionCode: 10` → bump to **`1.1.0` /
      `versionCode 11`** (minor bump, not patch — this ships a new country, not just a fix) with
      a commit message like:
      `chore(mobile): bump to 1.1.0 (versionCode 11) — Poland launch`.
- [ ] Build & submit the Android release bundle through your normal EAS/Play pipeline (not
      covered here — this repo's mobile CI/build steps are out of scope for this checklist).

## 5. Backend deploy (DigitalOcean droplet, per `deploy/README.md`)

- [ ] **`INGEST_API_KEY` — do not carry the local pilot key to prod.** The value used during
      this pilot (`INGEST_API_KEY=<lokal .env'deki geçici anahtar>` in the *local dev*
      `cheep-backend-express/.env`) is a throwaway placeholder and lives only on this machine —
      the real value is intentionally not written down here. Production uses **`deploy/.env`** on the
      droplet (created once from `deploy/.env.production.example`, which ships with a
      `DEGISTIR_scraper_paylasilan_anahtar` placeholder — "DEGISTIR" = "CHANGE THIS"). Generate a
      real random key, set it in `deploy/.env` on the droplet, and use the **same** value in
      the scraper's environment (`Cheep-Scraper/.env` on the droplet, and
      `deploy/cheep-fetcher-pl.service`'s `EnvironmentFile=/opt/cheep/deploy/.env` — the fetcher
      service already reads from `deploy/.env`, so one key covers both as long as it's set
      there before the timer first fires).
  - [ ] Also confirm `GEMINI_API_KEY` in `deploy/.env` is non-empty before launch —
        `deploy/.env.production.example` ships it **blank**, which would silently disable the
        assistant for PL (and every other country) in prod. Not caused by this pilot, but this
        is the moment to catch it.
- [ ] Deploy the backend: `bash deploy/deploy.sh` (or `deploy.bat` from Windows — commit, push,
      then pull/rebuild on the droplet) per `deploy/README.md`.
- [ ] **`prisma migrate deploy`** — 2 new migrations ship with this branch vs `main`:
      `20260710212213_add_match_proposal` and `20260711000000_store_price_raw_name`. The
      backend container already runs `migrate deploy` automatically on startup (see
      `deploy/bootstrap.sh`: *"Container açılışta `migrate deploy` çalıştırır"*), so this
      should apply itself on redeploy — but verify after deploy:
      ```bash
      docker compose -f deploy/docker-compose.prod.yml exec backend \
        npx prisma migrate status
      ```
      should report both migrations as applied, with no pending/failed migrations.
- [ ] **Neutralize the fake seed product before/after any prod seed run.** `prisma/seed.ts`
      unconditionally upserts a placeholder product per country for demo purposes — for PL
      that's `Łaciate Mleko 1L` (`ean_barcode: '5900000000001'`) with `source: 'seed'` prices at
      Carrefour (3.49) and Auchan (3.29). `deploy/bootstrap.sh` runs this seed **once** on first
      setup (`pnpm db:seed`); if it's ever re-run against the PL-enabled prod DB it will
      (re)insert this fake product into the real catalog, which is exactly the row that made
      Carrefour show up with a price in local testing. Either:
      1. Skip seeding this product for prod entirely (guard it behind an env flag in
         `seed.ts`), **or**
      2. Run a one-time cleanup after any seed execution:
         ```sql
         DELETE FROM store_prices WHERE product_id IN (
           SELECT id FROM products WHERE ean_barcode = '5900000000001'
             AND country_id = (SELECT id FROM countries WHERE code = 'PL')
         );
         DELETE FROM products WHERE ean_barcode = '5900000000001'
           AND country_id = (SELECT id FROM countries WHERE code = 'PL');
         ```
      Either way, confirm post-deploy that `GET /api/v1/products?limit=250` with `x-country: PL`
      shows no product with a Carrefour `store_prices` entry (this task's extended
      `verify_multicountry.py` `pl_stores_with_real_prices_are_exactly_4_chains` /
      `carrefour_excluded_from_real_priced_stores` checks can be re-pointed at the prod API via
      `MC_API_BASE_URL=https://<prod-host>/api/v1 python verify_multicountry.py` to confirm —
      note this also re-registers a throwaway user against prod, so use a prod-safe/disposable
      email).
- [ ] **PL scraper timer:** `systemctl enable --now cheep-fetcher-pl.timer` on the droplet
      (unit files already in `deploy/cheep-fetcher-pl.{service,timer}`; fires weekly Sundays
      03:00 + up to 30 min randomized delay). Confirm with `systemctl list-timers | grep pl` and
      check `Cheep-Scraper/logs/fetcher-pl.log` after the first run (or trigger manually once
      with `systemctl start cheep-fetcher-pl.service` to avoid waiting a week for first data).
- [ ] **One-time OSM branch import against prod** — populates `store_branches` (real
      lat/lon per physical store, used by the compare engine for real distances instead of the
      single chain-level fallback point):
      ```bash
      cd /opt/cheep/Cheep-Scraper
      INGEST_API_KEY=<same prod key as above> CHEEP_API_URL=https://<prod-host>/api/v1 \
        python countries/poland/osm_branches.py
      ```
      This is a **manual, one-time** run per `osm_branches.py`'s own docstring ("Ucretsiz, tek
      kosu... Aylik tekrar calistirilabilir" — free, one-off run, can be re-run monthly). It is
      **not** wired into the weekly `cheep-fetcher-pl.timer` — schedule a separate monthly cron
      (or systemd timer) if branch freshness matters, otherwise re-run it by hand occasionally.
      Local dev already has PL `store_branches` populated (13,422 rows, mostly Żabka/Biedronka
      OSM points) — prod starts from zero until this is run.
- [ ] Post-deploy smoke: repeat the compare-engine check from this task's local verification
      (create a list with a few real PL products, `POST /lists/:id/compare` with a Warsaw
      location) against prod and confirm distances resolve from real branches, not `null`.
- [ ] **One-time cleanup — old TR demo rows seeded with `source: 'scrape'`.** `prisma/seed.ts`'s
      TR demo `StorePrice` rows now use `source: 'seed'` (this branch), matching CH/SE/DE/PL, so
      they're never swept by the 21-day scrape-prune. But any **existing prod DB** seeded before
      this fix still has TR demo rows with `source: 'scrape'`, which the prune expansion will
      delete after 21d and leave the TR demo products priceless. Run once, post-deploy, against
      prod: review then delete any TR demo products left with no prices (non-`mf-` EAN, i.e. not
      a marketfiyati-imported row):
      ```sql
      SELECT p.id, p.name, p.ean_barcode FROM products p
        JOIN countries c ON c.id = p.country_id
        WHERE c.code = 'TR' AND p.ean_barcode NOT LIKE 'mf-%'
          AND NOT EXISTS (SELECT 1 FROM store_prices sp WHERE sp.product_id = p.id);
      -- after reviewing the list above:
      DELETE FROM products p USING countries c
        WHERE c.id = p.country_id AND c.code = 'TR' AND p.ean_barcode NOT LIKE 'mf-%'
          AND NOT EXISTS (SELECT 1 FROM store_prices sp WHERE sp.product_id = p.id);
      ```

## 6. Rollback / kill-switch

- [ ] If something goes wrong post-launch: removing Poland from Play Console country
      availability stops new installs but does not affect existing PL users' data — the backend
      change is entirely additive (new `country_id`, no shared-country schema changes beyond the
      2 migrations above). No PL-specific backend rollback is expected to be needed independent
      of a normal `git revert` + redeploy.
