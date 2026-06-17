#!/usr/bin/env bash
# Weekly Türkiye scrape + match + ingest. Invoked by cron on the server.
# Idempotent: safe to re-run. Logs to output/weekly.log.
set -euo pipefail
cd "$(dirname "$0")/../.."          # -> Cheep-Scraper/
export PYTHONIOENCODING=utf-8

# activate venv if present
if [ -f venv/bin/activate ]; then source venv/bin/activate; fi
if [ -f venv/Scripts/activate ]; then source venv/Scripts/activate; fi

echo "=== weekly run $(date -Iseconds) ==="
python countries/turkey/pipeline.py --ingest
echo "=== done $(date -Iseconds) ==="
