#!/usr/bin/env bash
# Günlük fiyat düşüşü tespitini kurar (systemd timer).
# Çalıştır: droplet'te  bash /opt/cheep/deploy/install-price-drops.sh
set -euo pipefail

touch /var/log/cheep-price-drops.log

cp /opt/cheep/deploy/cheep-price-drops.service /etc/systemd/system/cheep-price-drops.service
cp /opt/cheep/deploy/cheep-price-drops.timer /etc/systemd/system/cheep-price-drops.timer

systemctl daemon-reload
systemctl enable --now cheep-price-drops.timer

echo "--- timer ---"
systemctl list-timers cheep-price-drops.timer --no-pager || true
echo
echo "Elle bir koşu:  systemctl start cheep-price-drops.service && tail -5 /var/log/cheep-price-drops.log"
