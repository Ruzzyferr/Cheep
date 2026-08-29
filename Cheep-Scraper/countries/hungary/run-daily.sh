#!/usr/bin/env bash
# Günlük Macaristan koşusu.
#
# ROTASYON YOK — bilerek. Kaynak TEK bir XLSX dökümü (~1,8 MB) ve beş zincirin
# tamamı toplamda ~10.700 satır; bu, Hırvatistan'ın tek zincirinin bile altında.
# Bölmek koşuyu hızlandırmaz, yalnızca her zincirin tazelenme sıklığını
# düşürürdü. Döküm gün başına bir kez iniliyor (daily_artifact), dolayısıyla
# beş zincir aynı dosyayı paylaşıyor.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8
if [ -f venv/bin/activate ]; then source venv/bin/activate; fi
if [ -f venv/Scripts/activate ]; then source venv/Scripts/activate; fi
API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"
echo "=== HU daily run $(date -Iseconds) ==="
python -m countries._common.pipeline countries/hungary/config.json --api-url "$API"
curl -fsS -X POST "$API/store-prices/prune-stale" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: HU" || echo "prune atlandı"
curl -fsS -X POST "$API/store-prices/harvest-ean" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: HU" || echo "harvest atlandı"
echo "=== done $(date -Iseconds) ==="
