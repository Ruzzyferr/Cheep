#!/usr/bin/env bash
# Günlük Polonya scrape rotasyonu (chain-rotation): Auchan (Wolt, ~361 leaf
# kategori) ve Biedronka (~1.5k ürün / 245 kategori) gibi büyük katalogları
# her gece hep birlikte taramak yerine haftaya yayar — hem sitelere karşı daha
# nazik hem de tek bir kötü gecenin (rate-limit/geçici blok) etkisini
# tüm katalog yerine tek bir zincirle sınırlar. Idempotent: safe to re-run.
# Invoked nightly by systemd timer (cheep-fetcher-pl.timer). Tam-katalog
# manuel yenileme (örn. bir olay sonrası tüm PL'yi hemen tazelemek) için
# run-weekly.sh hâlâ mevcut ve çalışır durumda.
#
# Rotasyon (date +%u: 1=Pzt .. 7=Paz):
#   Pzt(1) Auchan                     Sal(2) Biedronka
#   Çar(3) Lidl + Żabka + Carrefour   Per(4) Auchan
#   Cum(5) Biedronka                  Cmt(6) Lidl + Żabka + Carrefour
#   Paz(7) (dinlenme — scrape yok)
# Her zincir haftada ~2x tazelenir; iki "ağır" zincir (Auchan, Biedronka)
# asla aynı gecede üst üste binmez (her biri kendi gecesinde tek başına
# koşar). Lidl (küçük — domain filtresinden sonra ~60 ürün), Żabka (~1.9k,
# Wolt API) ve Carrefour (~9k, Wolt API — 2026-07-23'te eklendi: rotasyonda
# HİÇ yer almadığı fark edildi, fiyatları 11 Tem transferinden beri donuktu)
# hafif/hızlı oldukları için aynı gecede birlikte koşabilir; üçü de farklı
# hostlara gittiğinden (lidl.pl + consumer-api.wolt.com) üst üste binme derdi
# yok. Pazar tamamen boş bırakıldı: hem sitelere hem de sunucuya haftalık bir
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
  3) MARKETS="Lidl,Żabka,Carrefour" ;;
  4) MARKETS="Auchan" ;;
  5) MARKETS="Biedronka" ;;
  6) MARKETS="Lidl,Żabka,Carrefour" ;;
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
# Strict unsupervised EAN harvest: yeni taranan EAN-siz ürünler (Biedronka +
# Wolt feed'lerinin barcode_gtin'siz azınlığı) EAN-taşıyan zincirlerden
# (Carrefour/Żabka/Auchan — Auchan 2026-07-23'ten beri Wolt üzerinden kendi
# EAN'lerini taşıyor) otomatik barkod devralır. Sadece koşu BAŞARILIYSA
# çalışır (aynı set -e mantığı). Denetim yok; guard zaten strict:true
# (bkz. ean-harvest.service.ts strictNameMatch).
curl -fsS -X POST "$API/store-prices/harvest-ean" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: PL" || echo "harvest atlandı"
echo "=== done $(date -Iseconds) ==="
