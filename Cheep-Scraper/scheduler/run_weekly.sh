#!/usr/bin/env bash
# Weekly foreign scrape (Sun→Mon night). Invoked by cron on the droplet.
# Reads INGEST_API_KEY + CHEEP_API_URL from the environment (set in the cron line
# or /opt/cheep-scraper/.env). Logs to logs/weekly-<date>.log.
set -euo pipefail
APP_DIR="${CHEEP_SCRAPER_DIR:-/opt/cheep-scraper}"
cd "$APP_DIR"
mkdir -p logs
STAMP="$(date +%Y%m%d_%H%M%S)"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
exec python3 -m countries._common.run_all_countries >> "logs/weekly-${STAMP}.log" 2>&1
