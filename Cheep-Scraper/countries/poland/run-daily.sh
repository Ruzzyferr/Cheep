#!/usr/bin/env bash
# Günlük Polonya scrape rotasyonu (chain-rotation): Auchan (~22.5k ürün / 58
# istek) ve Biedronka (~1.5k ürün / 244 kategori) gibi büyük katalogları her
# gece hep birlikte taramak yerine haftaya yayar — hem sitelere karşı daha
# nazik hem de tek bir kötü gecenin (rate-limit/geçici blok) etkisini
# tüm katalog yerine tek bir zincirle sınırlar. Idempotent: safe to re-run.
# Invoked nightly by systemd timer (cheep-fetcher-pl.timer). Tam-katalog
# manuel yenileme (örn. bir olay sonrası tüm PL'yi hemen tazelemek) için
# run-weekly.sh hâlâ mevcut ve çalışır durumda.
#
# Rotasyon (date +%u: 1=Pzt .. 7=Paz):
#   Pzt(1) Auchan          Sal(2) Biedronka
#   Çar(3) Lidl + Żabka    Per(4) Auchan
#   Cum(5) Biedronka       Cmt(6) Lidl + Żabka
#   Paz(7) (dinlenme — scrape yok)
# Her zincir haftada ~2x tazelenir; iki "ağır" zincir (Auchan, Biedronka)
# asla aynı gecede üst üste binmez (her biri kendi gecesinde tek başına
# koşar). Lidl (küçük — domain filtresinden sonra ~54 ürün) ve Żabka (8
# ürün, en küçük zincir) hafif oldukları için aynı gecede birlikte koşabilir.
# Pazar tamamen boş bırakıldı: hem sitelere hem de sunucuya haftalık bir
# dinlenme penceresi, önceki haftalık koşunun da geleneksel günüydü.
set -euo pipefail
cd "$(dirname "$0")/../.."          # -> Cheep-Scraper/
export PYTHONIOENCODING=utf-8

# activate venv if present
if [ -f venv/bin/activate ]; then source venv/bin/activate; fi
if [ -f venv/Scripts/activate ]; then source venv/Scripts/activate; fi

API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"

DOW="$(date +%u)"
case "$DOW" in
  1) MARKETS="Auchan" ;;
  2) MARKETS="Biedronka" ;;
  3) MARKETS="Lidl,Żabka" ;;
  4) MARKETS="Auchan" ;;
  5) MARKETS="Biedronka" ;;
  6) MARKETS="Lidl,Żabka" ;;
  *) MARKETS="" ;;  # 7 (Pazar) ve tanımsız her durum: dinlenme günü
esac

if [ -z "$MARKETS" ]; then
  echo "=== PL daily run $(date -Iseconds): gün $DOW için rotasyonda market yok, çıkılıyor ==="
  exit 0
fi

echo "=== PL daily run $(date -Iseconds): gün $DOW -> $MARKETS ==="
python -m countries._common.pipeline countries/poland/config.json --api-url "$API" --markets "$MARKETS"
# Temizlik: yalnızca koşu BAŞARILIYSA (set -e yukarıda düşürür)
curl -fsS -X POST "$API/store-prices/prune-stale" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: PL" || echo "prune atlandı"
echo "=== done $(date -Iseconds) ==="
