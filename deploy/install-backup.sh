#!/usr/bin/env bash
# Günlük veritabanı yedeğini kurar (systemd timer).
# Çalıştır: droplet'te  bash /opt/cheep/deploy/install-backup.sh
set -euo pipefail

mkdir -p /opt/cheep/backups

cp /opt/cheep/deploy/cheep-backup.service /etc/systemd/system/cheep-backup.service
cp /opt/cheep/deploy/cheep-backup.timer /etc/systemd/system/cheep-backup.timer

systemctl daemon-reload
systemctl enable --now cheep-backup.timer

echo "--- timer ---"
systemctl list-timers cheep-backup.timer --no-pager || true
echo
echo "İlk yedeği hemen almak için:  systemctl start cheep-backup.service"
