#!/usr/bin/env bash
# Market ŞUBE konumlarını tazeler (aylık).
#
# NEDEN AYRI VE SEYREK: şube konumları fiyat gibi her gece değişmiyor —
# mağaza açılışı/kapanışı ayda birkaç tane. Buna karşılık maliyeti YÜKSEK:
# OSM Overpass zincir başına yavaş ve hız-sınırlı, Romanya'nın ızgara taraması
# ~1 saat sürüyor. Gecelik fiyat koşusuna bağlamak her gece boşuna saatler
# harcardı ve fiyat hattını da geciktirirdi.
#
# ÜLKE BAŞINA KAYNAK FARKLI:
#   HR — OSM Overpass (arşiv koordinat vermiyor)
#   HU — Árfigyelő /api/shops (1.823 mağaza, resmî zincir eşlemesiyle; OSM'den iyi)
#   RO — Monitorul ızgara taraması (kaynak koordinat + adres + zincir veriyor)
#
# Her ülke KENDİ İÇİNDE hata toleranslı çalışır: biri düşerse diğerleri yine
# koşar (`|| echo`). Şube ithalatı upsert olduğu için tekrar çalıştırmak
# güvenlidir; yarım kalan bir koşu bir sonraki ay tamamlanır.
set -uo pipefail
cd "$(dirname "$0")/../Cheep-Scraper"
export PYTHONIOENCODING=utf-8

if [ -f venv/bin/activate ]; then source venv/bin/activate; fi

API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"

# INGEST_API_KEY normalde systemd'nin `EnvironmentFile` yönergesiyle geliyor.
# ELLE çalıştırıldığında (ilk kurulum, bir aksaklıktan sonra yeniden koşum)
# ortam boş oluyor ve her istek HTTP 401 alıyor — üstelik betik "yüklendi=512"
# yazmaya devam ettiği için başarılı görünüyor. Anahtar yoksa .env'den okunuyor.
#
# `.env` KABUKLA SOURCE EDİLMİYOR: içinde tırnaksız, özel karakterli değerler
# var ve `. .env` onları KOMUT olarak çalıştırmaya kalkıyor. Yalnızca ihtiyaç
# duyulan satır çekiliyor.
if [ -z "${INGEST_API_KEY:-}" ] && [ -f "$(dirname "$0")/.env" ]; then
  INGEST_API_KEY="$(grep -E '^INGEST_API_KEY=' "$(dirname "$0")/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
  export INGEST_API_KEY
fi
if [ -z "${INGEST_API_KEY:-}" ]; then
  echo "HATA: INGEST_API_KEY yok — her istek 401 alır, koşum anlamsız." >&2
  exit 1
fi

echo "=== şube tazeleme $(date -Iseconds) ==="

# MODÜL OLARAK çağrılıyor (`python -m ...`), dosya yolu olarak DEĞİL.
#
# Doğrudan `python countries/romania/branches.py` çalıştırmak dosyanın kendi
# klasörünü sys.path'e koyuyor, proje kökünü değil — ve modül `countries.` ile
# başlayan kardeş modülleri import ettiği için "ModuleNotFoundError: No module
# named 'countries'" ile düşüyor. Betik ilk kez AYLIK TIMER'da koşacaktı; hata
# orada, kimse bakmazken ortaya çıkacak ve üç ülke de şubesiz kalacaktı
# (uygulamada "yakında market yok" boş ekranı).
for entry in "HR:countries.croatia.osm_branches"              "HU:countries.hungary.branches"              "RO:countries.romania.branches"; do
  code="${entry%%:*}"
  module="${entry##*:}"
  echo "--- $code ($module) ---"
  python -m "$module" --api-url "$API" --api-key "${INGEST_API_KEY:-}"     || echo "UYARI: $code şube ithalatı başarısız — diğer ülkeler etkilenmedi"
done

echo "=== done $(date -Iseconds) ==="
