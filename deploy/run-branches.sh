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
