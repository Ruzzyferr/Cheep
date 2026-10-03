#!/usr/bin/env bash
# Haftalik geri yukleme tatbikatini kurar.
#
# NEDEN VAR: `backup-db.sh` dosyayi uretiyor ve `pg_restore -l` ile
# OKUNABILIR oldugunu dogruluyor. Bu, GERI YUKLENEBILIR oldugunu gostermez.
# 3 Eki 2026 denetiminde tatbikatin ZAMANLAYICISI HIC YOKTU ve elle
# calistirildiginda BASARISIZ oldu — yani 15 yedek aylardir sinanmamisti.
set -euo pipefail
cp /opt/cheep/deploy/cheep-restore-drill.service /etc/systemd/system/
cp /opt/cheep/deploy/cheep-restore-drill.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cheep-restore-drill.timer
systemctl list-timers cheep-restore-drill.timer --no-pager
