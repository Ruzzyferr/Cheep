# Cheep foreign scraper — droplet scheduler

Runs the CH/SE/DE/PL price pipeline weekly, the night between Sunday and Monday.

## One-time install (on droplet 129.212.193.203, as root)

1. Clone/copy the scraper repo to `/opt/cheep-scraper` (or set `CHEEP_SCRAPER_DIR`).
2. `cd /opt/cheep-scraper && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt`
   (or use system python3 if Playwright is not needed for the enabled anchors).
3. Create `/opt/cheep-scraper/.env` (gitignored, never committed):
   ```
   INGEST_API_KEY=<same value as backend .env>
   CHEEP_API_URL=http://localhost:3000/api/v1
   CHEEP_STAGGER_SECONDS=1800
   ```
4. `chmod +x scheduler/run_weekly.sh`
5. Install cron: `crontab -l 2>/dev/null | cat - scheduler/cheep-scrape.cron | crontab -`
   (edit the path in the cron line if not `/opt/cheep-scraper`).
6. Smoke test now (no wait): `scheduler/run_weekly.sh` then check `logs/weekly-*.log`.

## Notes
- The backend must be reachable at `CHEEP_API_URL` from the droplet (same host → localhost:3000).
- Each country is isolated: one country failing does not stop the others.
- Only anchors are `enabled` in each config; discounters are `enabled:false` until a
  scraper + a backend `Store` seed row exist for them.
- Secrets live only in `/opt/cheep-scraper/.env`. Rotate `INGEST_API_KEY` if ever exposed.
