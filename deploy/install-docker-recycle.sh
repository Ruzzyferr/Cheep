#!/usr/bin/env bash
# Docker'in bellek/disk sinirlarini kurar + dockerd'yi haftalik geri donusturur.
#
# NEDEN VAR: Docker'in KENDISI her `docker exec`/`inspect` cagrisinda heap
# sizdiriyor (29.6.1'de canlida olculdu: ~134 kB/exec, ~23 kB/inspect).
# Nobetcinin cagri sayisi 13 kat azaltildi ama SIFIRLANAMAZ -- container'larin
# ayakta olup olmadigini sormanin baska yolu yok. Kalan ~13 MB/gun aylar icinde
# yine birikir; bu timer o birikimi haftada bir sifirliyor.
#
# 30 Eylul 2026'da 2 GB'lik sunucuda dockerd TEK BASINA 969 MB'a (RAM'in %48'i)
# cikmisti; sistem swap'e dusmus ve DigitalOcean "bellek dolu" uyarilari
# gondermeye baslamisti. Ayrica `log-opts` YOKTU: container loglari sinirsiz
# buyuyordu.
#
# Calistir: droplet'te  bash /opt/cheep/deploy/install-docker-recycle.sh
set -euo pipefail

# 1) daemon.json -- log rotasyonu + live-restore
if [ -f /etc/docker/daemon.json ] && ! diff -q /opt/cheep/deploy/docker-daemon.json /etc/docker/daemon.json >/dev/null 2>&1; then
    cp /etc/docker/daemon.json "/etc/docker/daemon.json.bak-$(date +%Y%m%d-%H%M%S)"
    echo "mevcut daemon.json yedeklendi"
fi
mkdir -p /etc/docker
cp /opt/cheep/deploy/docker-daemon.json /etc/docker/daemon.json

# live-restore ancak yeniden baslatmadan SONRA gecerli olur.
systemctl restart docker
sleep 15

# 2) live-restore GERCEKTEN acik mi -- acik degilse timer haftalik KESINTI demek
if ! docker info 2>/dev/null | grep -q 'Live Restore Enabled: true'; then
    echo "HATA: live-restore acilmadi. Timer KURULMADI (yoksa haftalik kesinti olurdu)."
    exit 1
fi
echo "live-restore acik -- haftalik yeniden baslatma kesintisiz"

# 3) timer
cp /opt/cheep/deploy/cheep-docker-recycle.service /etc/systemd/system/
cp /opt/cheep/deploy/cheep-docker-recycle.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cheep-docker-recycle.timer
systemctl list-timers cheep-docker-recycle.timer --no-pager || true
