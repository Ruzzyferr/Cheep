#!/usr/bin/env bash
# Haftalık TAM HU yenilemesi (tüm etkin zincirler).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8
if [ -f venv/bin/activate ]; then source venv/bin/activate; fi
if [ -f venv/Scripts/activate ]; then source venv/Scripts/activate; fi
API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"
echo "=== HU weekly run $(date -Iseconds) ==="
python -m countries._common.pipeline countries/hungary/config.json --api-url "$API"
curl -fsS -X POST "$API/store-prices/prune-stale" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: HU" || echo "prune atlandı"
echo "=== done $(date -Iseconds) ==="
