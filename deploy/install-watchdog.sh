#!/usr/bin/env bash
# Sunucu içi nöbetçiyi kurar (systemd timer, 5 dakikada bir).
# Çalıştır: droplet'te  bash /opt/cheep/deploy/install-watchdog.sh
set -euo pipefail

# python3 e-posta gövdesini JSON'a çevirmek için gerekli (tırnak/satır kaçışı)
command -v python3 >/dev/null || { echo "python3 gerekli"; exit 1; }
command -v openssl >/dev/null || { echo "openssl gerekli"; exit 1; }

mkdir -p /var/lib/cheep-watchdog
touch /var/log/cheep-watchdog.log

cp /opt/cheep/deploy/cheep-watchdog.service /etc/systemd/system/cheep-watchdog.service
cp /opt/cheep/deploy/cheep-watchdog.timer /etc/systemd/system/cheep-watchdog.timer

systemctl daemon-reload
systemctl enable --now cheep-watchdog.timer

echo "--- timer ---"
systemctl list-timers cheep-watchdog.timer --no-pager || true
echo
echo "Elle bir tur:  systemctl start cheep-watchdog.service && tail -20 /var/log/cheep-watchdog.log"
