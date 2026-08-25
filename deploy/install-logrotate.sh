#!/usr/bin/env bash
# Cheep log rotasyonunu kurar ve DOĞRULAR.
#
# Kurulum betikleri "kopyaladım, bitti" demekle yetinmemeli: logrotate
# yapılandırması sessizce yok sayılabilir (dosya izinleri, sözdizimi hatası,
# `su` direktifi eksikliği). Bu yüzden kurulumun ardından `--debug` ile bir
# deneme koşusu yapılıp çıktıda beklenen dosyaların göründüğü sınanıyor.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)/cheep-logrotate.conf"
DST="/etc/logrotate.d/cheep"

if [ ! -f "$SRC" ]; then
  echo "HATA: $SRC bulunamadı." >&2
  exit 1
fi

if ! command -v logrotate >/dev/null 2>&1; then
  echo "HATA: logrotate kurulu değil (apt-get install -y logrotate)." >&2
  exit 1
fi

install -m 0644 "$SRC" "$DST"
echo "==> $DST yazıldı"

# Sözdizimi + eşleşme doğrulaması. `--debug` hiçbir şeyi döndürmez, yalnızca
# ne YAPACAĞINI anlatır; yapılandırma bozuksa burada patlar.
echo "==> logrotate deneme koşusu"
if ! logrotate --debug "$DST" 2>&1 | tee /tmp/cheep-logrotate-debug.txt; then
  echo "HATA: logrotate yapılandırması reddedildi." >&2
  exit 1
fi

# En az bir günlük dosyasının GERÇEKTEN eşleştiğini doğrula. Yol yanlışsa
# logrotate sessizce hiçbir şey yapmaz ve kurulum "başarılı" görünürdü.
if ! grep -q "considering log" /tmp/cheep-logrotate-debug.txt; then
  echo "UYARI: hiçbir log dosyası eşleşmedi — yollar doğru mu?" >&2
  echo "       (henüz hiç log üretilmemişse bu normal olabilir.)" >&2
fi

echo "==> tamam. Rotasyon sistemin günlük logrotate.timer'ı ile çalışır:"
systemctl list-timers logrotate.timer --no-pager 2>/dev/null | head -3 || true
