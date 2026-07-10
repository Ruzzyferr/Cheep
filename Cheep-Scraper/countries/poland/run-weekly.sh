#!/usr/bin/env bash
# Haftalık Polonya scrape + OFF enrichment + ingest + bayat fiyat temizliği.
# Idempotent: safe to re-run. Invoked by systemd timer (cheep-fetcher-pl.timer)
# on the server, mirrors the Türkiye weekly pattern.
set -euo pipefail
cd "$(dirname "$0")/../.."          # -> Cheep-Scraper/
export PYTHONIOENCODING=utf-8

# activate venv if present
if [ -f venv/bin/activate ]; then source venv/bin/activate; fi
if [ -f venv/Scripts/activate ]; then source venv/Scripts/activate; fi

API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"
echo "=== PL weekly run $(date -Iseconds) ==="
python -m countries._common.pipeline countries/poland/config.json --api-url "$API"
# Temizlik: yalnızca koşu BAŞARILIYSA (set -e yukarıda düşürür)
curl -fsS -X POST "$API/store-prices/prune-stale" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: PL" || echo "prune atlandı"
echo "=== done $(date -Iseconds) ==="
