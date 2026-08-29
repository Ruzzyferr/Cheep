#!/usr/bin/env bash
# Günlük Hırvatistan koşusu — zincir rotasyonu.
#
# NEDEN ROTASYON GEREKMİYOR GİBİ GÖRÜNÜP YİNE DE VAR: kaynak tek bir günlük
# arşiv, yani ağ maliyeti zincir sayısından BAĞIMSIZ (arşiv gün başına bir kez
# iniyor, bkz. countries/_common/daily_artifact.py). Ama arşivi AÇIP ayrıştırmak
# ucuz değil: prices.csv tek zincirde 1,7 milyon satıra kadar çıkıyor ve altı
# zinciri aynı gecede işlemek 1 vCPU'luk droplet'te ingest'le birlikte uzun bir
# pencere demek. Rotasyon CPU'yu haftaya yayıyor; her zincir haftada ~2 kez
# tazeleniyor ve bu, günlük yayınlanan bir kaynak için fazlasıyla yeterli.
#
# Rotasyon (date +%u: 1=Pzt .. 7=Paz):
#   Pzt(1) Konzum          Sal(2) Plodine        Çar(3) Spar
#   Per(4) Konzum          Cum(5) Kaufland+Lidl  Cmt(6) Tommy+Lidl
#   Paz(7) dinlenme
# Konzum (en büyük zincir, 18,7k ürün) haftada iki kez; Lidl küçük (7k) olduğu
# için iki hafif geceye eşlik ediyor — indirimci fiyat çıpası olduğundan sık
# tazelenmesi değerli.
set -euo pipefail
cd "$(dirname "$0")/../.."          # -> Cheep-Scraper/
export PYTHONIOENCODING=utf-8

if [ -f venv/bin/activate ]; then source venv/bin/activate; fi
if [ -f venv/Scripts/activate ]; then source venv/Scripts/activate; fi

API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"

DOW="$(date +%u)"
case "$DOW" in
  1) MARKETS="Konzum" ;;
  2) MARKETS="Plodine" ;;
  3) MARKETS="Spar" ;;
  4) MARKETS="Konzum" ;;
  5) MARKETS="Kaufland,Lidl" ;;
  6) MARKETS="Tommy,Lidl" ;;
  *) MARKETS="" ;;
esac

if [ -z "$MARKETS" ]; then
  echo "=== HR daily run $(date -Iseconds): gün $DOW için rotasyonda market yok, çıkılıyor ==="
  exit 0
fi

echo "=== HR daily run $(date -Iseconds): gün $DOW -> $MARKETS ==="
python -m countries._common.pipeline countries/croatia/config.json --api-url "$API" --markets "$MARKETS"
# Temizlik yalnızca koşu BAŞARILIYSA (set -e yukarıda düşürür).
curl -fsS -X POST "$API/store-prices/prune-stale" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: HR" || echo "prune atlandı"
# EAN harvest: barkodsuz azınlık (Eurospin/Studenac gibi düşük kapsamlı zincirler
# açılırsa) barkod taşıyan zincirlerden devralsın. HR'de kapsam zaten %92-100
# olduğu için etkisi Polonya'dakinden küçük, ama bedava.
curl -fsS -X POST "$API/store-prices/harvest-ean" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: HR" || echo "harvest atlandı"
echo "=== done $(date -Iseconds) ==="
