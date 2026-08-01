#!/usr/bin/env bash
# Haftalık taksonomi tazelemeyi kurar.
set -euo pipefail

touch /var/log/cheep-taxonomy.log
chmod +x /opt/cheep/deploy/refresh-taxonomy.sh
cp /opt/cheep/deploy/cheep-taxonomy.service /etc/systemd/system/cheep-taxonomy.service
cp /opt/cheep/deploy/cheep-taxonomy.timer   /etc/systemd/system/cheep-taxonomy.timer
systemctl daemon-reload
systemctl enable --now cheep-taxonomy.timer

echo "--- timer ---"
systemctl list-timers cheep-taxonomy.timer --no-pager || true
echo
echo "Elle bir koşu:  systemctl start cheep-taxonomy.service && tail -40 /var/log/cheep-taxonomy.log"
echo "Sağlık raporu:  docker exec deploy-backend-1 npx tsx scripts/data-health.ts"
