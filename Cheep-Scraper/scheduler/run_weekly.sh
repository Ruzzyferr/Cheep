#!/usr/bin/env bash
# Haftalık TÜRKİYE katalog yenileme (Pazar, gün boyu).
# Kaynak: resmi devlet API'si marketfiyati.org.tr (TÜBİTAK BİLGEM) — SCRAPING DEĞİL.
# Hukuki risk yok: kamuya açık, yönetmelikle paylaşıma açılmış veri.
#
# İki fazlı: (1) TAM fetch — her ürün ID'si kesin duruma ulaşana kadar ham JSON'a
# kaydedilir (WAF rate-limit yüzünden saatler sürer, sağlık-kapısı bekler),
# (2) ingest — ham veriden fiyat/ürün güncellenir. flock ile tek örnek.
set -euo pipefail
APP_DIR="${CHEEP_SCRAPER_DIR:-/opt/cheep/Cheep-Scraper}"
cd "$APP_DIR"
mkdir -p logs
STAMP="$(date +%Y%m%d_%H%M%S)"
# Sırlar deploy .env'inden (repoya ASLA girmez)
if [ -f /opt/cheep/deploy/.env ]; then set -a; . /opt/cheep/deploy/.env; set +a; fi
if [ -f .env ]; then set -a; . ./.env; set +a; fi
LOG="logs/weekly-${STAMP}.log"
API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"
PY="${APP_DIR}/venv/bin/python"
RAW="mf_raw_weekly"

# Aynı anda ikinci çalıştırmayı engelle (fetch bir günü aşabilir)
exec 9>/tmp/cheep_weekly.lock
if ! flock -n 9; then echo "$(date) zaten çalışıyor — çıkılıyor" >> "$LOG"; exit 0; fi

echo "=== TR yenileme BAŞLADI $(date) ===" >> "$LOG"
# Taze çekim için önceki haftanın ham verisini temizle
rm -rf "$RAW" mf_empty_weekly.txt

# (1) TAM fetch — ham JSON diske (API'ye SADECE burada dokunulur)
echo "--- fetch $(date) ---" >> "$LOG"
"$PY" countries/turkey/mf_fetch.py --raw-dir "$RAW" --empty-file mf_empty_weekly.txt >> "$LOG" 2>&1 \
  || echo "UYARI: fetch kısmi tamamlandı" >> "$LOG"

# (2) taksonomiyi tazele (yeni alt-kategoriler görünür olsun; category_map değişmez)
echo "--- taxonomy $(date) ---" >> "$LOG"
"$PY" countries/turkey/mf_taxonomy.py --raw-dir "$RAW" --out taxonomy.json >> "$LOG" 2>&1 || true

# (3) ingest — fiyat + yeni ürün (mevcut category_map ile; yeni main_category → Diğer)
echo "--- ingest $(date) ---" >> "$LOG"
"$PY" countries/turkey/mf_ingest.py --raw-dir "$RAW" --api-url "$API" \
  --category-map category_map.json >> "$LOG" 2>&1 \
  || echo "UYARI: ingest başarısız" >> "$LOG"

echo "=== TR yenileme BİTTİ $(date) ===" >> "$LOG"
