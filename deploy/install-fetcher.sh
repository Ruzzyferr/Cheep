#!/usr/bin/env bash
# Cheep sürdürülebilir fetch daemon'ını kurar (systemd): TR (7/24 daemon) + PL
# (günlük timer, chain-rotation — Turkey-style self-refresh).
# Eski Pazar-sprint cron'unu kaldırır — TR daemon 7/24 nazik çalışır, onun yerine geçer.
# Çalıştır: droplet'te  bash /opt/cheep/deploy/install-fetcher.sh
set -euo pipefail
SCRAPER=/opt/cheep/Cheep-Scraper
UNIT=/etc/systemd/system/cheep-fetcher.service
PL_SERVICE_UNIT=/etc/systemd/system/cheep-fetcher-pl.service
PL_TIMER_UNIT=/etc/systemd/system/cheep-fetcher-pl.timer

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

# PL: günlük oneshot servis + timer, chain-rotation (TR daemon deseninden
# farklı — TR gibi sürekli çalışan bir kaynak yok, marketfiyati.org.tr
# benzeri resmi API yok; bunun yerine run-daily.sh her gece rotasyondaki
# zinciri/zincirleri koşar — Auchan ve Biedronka gibi büyük katalogları
# haftaya yayar. Tam-katalog manuel yenileme için run-weekly.sh de kurulu
# kalır, sadece timer artık onu tetiklemiyor).
chmod +x "$SCRAPER/countries/poland/run-daily.sh"
chmod +x "$SCRAPER/countries/poland/run-weekly.sh"
cp "/opt/cheep/deploy/cheep-fetcher-pl.service" "$PL_SERVICE_UNIT"
cp "/opt/cheep/deploy/cheep-fetcher-pl.timer" "$PL_TIMER_UNIT"
systemctl daemon-reload
systemctl enable cheep-fetcher-pl.timer
systemctl restart cheep-fetcher-pl.timer
sleep 1
systemctl --no-pager --full status cheep-fetcher-pl.timer | head -12
echo ""
echo "KURULDU. PL günlük log: tail -f $SCRAPER/logs/fetcher-pl.log"
echo "Sıradaki PL koşusu: systemctl list-timers cheep-fetcher-pl.timer"
echo "Tam-katalog manuel yenileme: bash $SCRAPER/countries/poland/run-weekly.sh"
