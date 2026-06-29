#!/usr/bin/env bash
# ============================================
# Cheep — Droplet ilk kurulum (Ubuntu 24.04). Bir kez çalıştırılır (root).
# Docker'ı kurar, firewall'u ayarlar, repoyu klonlar ve servisleri ayağa kaldırır.
# .env dosyası /opt/cheep/deploy/.env içine ÖNCEDEN konmuş olmalı.
# ============================================
set -euo pipefail

REPO_URL="https://github.com/Ruzzyferr/Cheep.git"
APP_DIR="/opt/cheep"

echo "==> Sistem güncelleniyor"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> Docker kuruluyor"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Swap (2G) — küçük droplet'lerde build/chromium için"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Firewall (ufw): 22 (SSH) + 3000 (API)"
ufw allow OpenSSH || ufw allow 22/tcp
ufw allow 3000/tcp
ufw --force enable

echo "==> Repo klonlanıyor/güncelleniyor"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all && git -C "$APP_DIR" reset --hard origin/main
else
  git clone "$REPO_URL" "$APP_DIR"
fi

if [ ! -f "$APP_DIR/deploy/.env" ]; then
  echo "HATA: $APP_DIR/deploy/.env yok. Önce .env.production.example'dan oluşturun." >&2
  exit 1
fi

echo "==> Servisler ayağa kaldırılıyor (build)"
cd "$APP_DIR/deploy"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Migration'lar (container açılışında da koşar) + seed (tek sefer)"
docker compose -f docker-compose.prod.yml exec -T backend pnpm db:seed || \
  echo "(seed atlandı/zaten yapılmış olabilir)"

echo "==> Tamamlandı. API: http://$(curl -s ifconfig.me):3000/api/v1"
