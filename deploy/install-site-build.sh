#!/usr/bin/env bash
# Gecelik site üretimini kurar (systemd timer).
# Çalıştır: droplet'te  bash /opt/cheep/deploy/install-site-build.sh
set -euo pipefail

touch /var/log/cheep-site-build.log

cp /opt/cheep/deploy/cheep-site-build.service /etc/systemd/system/cheep-site-build.service
cp /opt/cheep/deploy/cheep-site-build.timer   /etc/systemd/system/cheep-site-build.timer

systemctl daemon-reload
systemctl enable --now cheep-site-build.timer

echo "--- timer ---"
systemctl list-timers cheep-site-build.timer --no-pager || true
echo
echo "Elle bir koşu:  systemctl start cheep-site-build.service && tail -20 /var/log/cheep-site-build.log"
