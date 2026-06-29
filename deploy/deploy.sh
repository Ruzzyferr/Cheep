#!/usr/bin/env bash
# ============================================
# Cheep — Yeniden deploy (sunucuda çalışır). origin/main'i çeker ve yeniden build eder.
# deploy.bat bunu SSH ile tetikler. Stateful veri named volume'da kalır.
# ============================================
set -euo pipefail

APP_DIR="/opt/cheep"

echo "==> Kod güncelleniyor (origin/main)"
git -C "$APP_DIR" fetch --all
git -C "$APP_DIR" reset --hard origin/main

echo "==> Servisler yeniden build + restart"
cd "$APP_DIR/deploy"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Kullanılmayan imajlar temizleniyor"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Deploy tamam. API: http://$(curl -s ifconfig.me):3000/api/v1"
