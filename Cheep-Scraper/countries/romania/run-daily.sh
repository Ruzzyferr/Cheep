#!/usr/bin/env bash
# Günlük Romanya koşusu — zincir rotasyonu (haftaya yayılmış).
#
# NEDEN ROTASYON: kaynak bir KAMU KURUMU sunucusu (Consiliul Concurenței) ve
# zincir başına 85 kategori isteği atılıyor. Altı zinciri her gece koşturmak
# 510 istek/gece demek; ölçülen tavan bunun çok üstünde olsa da devlet
# altyapısına karşı gereksiz yük bindirmenin bir gerekçesi yok. Rotasyon
# geceyi ~170 isteğe indiriyor ve her zincir haftada 2-3 kez tazeleniyor —
# 21 günlük prune TTL'i düşünülürse fazlasıyla taze.
#
# İkinci fayda: kaynak bir gece cevap vermezse etki TÜM katalog yerine tek
# gecelik bir zincirle sınırlı kalıyor.
#
# Rotasyon (date +%u: 1=Pzt .. 7=Paz):
#   Pzt(1) Auchan + Lidl        Sal(2) Carrefour + Penny
#   Çar(3) Kaufland + Mega      Per(4) Auchan + Lidl
#   Cum(5) Carrefour + Penny    Cmt(6) Kaufland + Mega
#   Paz(7) dinlenme
# Auchan (16,7k ürün) ve Carrefour (11k) en büyük kataloglar; ikisi asla aynı
# gecede üst üste binmiyor. Lidl indirimci = fiyat çıpası, o yüzden en büyük
# zincirle eşleşip haftada iki kez tazeleniyor.
#
# EAN HARVEST YOK — bilerek. Bu ülkede barkod hiç yok; eşleştirme devletin
# kanonik `catprod.id` kimliğiyle yapılıyor (bkz. config.json merge_note).
# harvest-ean barkod TAŞIYAN zincirlerden taşımayanlara barkod ödünç verir;
# burada ödünç verecek kaynak yok, çağrı boşa iş olurdu.
set -euo pipefail
cd "$(dirname "$0")/../.."          # -> Cheep-Scraper/
export PYTHONIOENCODING=utf-8

if [ -f venv/bin/activate ]; then source venv/bin/activate; fi
if [ -f venv/Scripts/activate ]; then source venv/Scripts/activate; fi

API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"

DOW="$(date +%u)"
case "$DOW" in
  1) MARKETS="Auchan,Lidl" ;;
  2) MARKETS="Carrefour,Penny" ;;
  3) MARKETS="Kaufland,Mega Image" ;;
  4) MARKETS="Auchan,Lidl" ;;
  5) MARKETS="Carrefour,Penny" ;;
  6) MARKETS="Kaufland,Mega Image" ;;
  *) MARKETS="" ;;  # 7 (Pazar) ve tanımsız her durum: dinlenme günü
esac

if [ -z "$MARKETS" ]; then
  echo "=== RO daily run $(date -Iseconds): gün $DOW için rotasyonda market yok, çıkılıyor ==="
  exit 0
fi

echo "=== RO daily run $(date -Iseconds): gün $DOW -> $MARKETS ==="
python -m countries._common.pipeline countries/romania/config.json --api-url "$API" --markets "$MARKETS"
# Temizlik yalnızca koşu BAŞARILIYSA (set -e yukarıda düşürür).
curl -fsS -X POST "$API/store-prices/prune-stale" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: RO" || echo "prune atlandı"
echo "=== done $(date -Iseconds) ==="
