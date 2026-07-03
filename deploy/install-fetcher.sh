#!/usr/bin/env bash
# Cheep sürdürülebilir fetch daemon'ını kurar (systemd).
# Eski Pazar-sprint cron'unu kaldırır — daemon 7/24 nazik çalışır, onun yerine geçer.
# Çalıştır: droplet'te  bash /opt/cheep/deploy/install-fetcher.sh
set -euo pipefail
SCRAPER=/opt/cheep/Cheep-Scraper
UNIT=/etc/systemd/system/cheep-fetcher.service

mkdir -p "$SCRAPER/logs"

# category_map.json şart (daemon ingest için kullanır)
if [ ! -f "$SCRAPER/category_map.json" ]; then
  echo "HATA: $SCRAPER/category_map.json yok — önce ilk kurulum (seed) tamamlanmalı." >&2
  exit 1
fi

# Eski haftalık cron satırını kaldır (daemon devralıyor)
( crontab -l 2>/dev/null | grep -v 'run_weekly.sh' ) | crontab - || true
echo "eski weekly cron kaldırıldı (varsa)"

# systemd servisini kur
cp "/opt/cheep/deploy/cheep-fetcher.service" "$UNIT"
systemctl daemon-reload
systemctl enable cheep-fetcher.service
systemctl restart cheep-fetcher.service
sleep 2
systemctl --no-pager --full status cheep-fetcher.service | head -12
echo ""
echo "KURULDU. Log: tail -f $SCRAPER/logs/fetcher.log"
