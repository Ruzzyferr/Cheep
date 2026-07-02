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
LOG="logs/weekly-${STAMP}.log"
API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"

# TÜRKİYE: resmi devlet API'si marketfiyati.org.tr (TÜBİTAK BİLGEM) — SCRAPING DEĞİL.
# Hukuki risk yok: kamuya açık, yönetmelikle paylaşıma açılmış veri.
echo "=== TR marketfiyati $(date) ===" >> "$LOG"
python3 countries/turkey/marketfiyati.py --api-url "$API" >> "$LOG" 2>&1 \
  || echo "UYARI: marketfiyati TR başarısız" >> "$LOG"

# Yabancı ülkeler (CH/SE/DE/PL)
echo "=== yabancı ülkeler $(date) ===" >> "$LOG"
python3 -m countries._common.run_all_countries >> "$LOG" 2>&1
