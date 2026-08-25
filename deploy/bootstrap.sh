#!/usr/bin/env bash
# ============================================
# Cheep — Droplet ilk kurulum (Ubuntu 24.04). Bir kez çalıştırılır (root).
# Docker'ı kurar, firewall'u ayarlar, repoyu klonlar ve servisleri ayağa kaldırır.
# .env dosyası /opt/cheep/deploy/.env içine ÖNCEDEN konmuş olmalı.
# ============================================
set -euo pipefail

# SSH, HTTPS değil: repo PRIVATE. Anonim HTTPS klonu artık 404 döner.
# Sunucunun kimliği salt-okunur bir deploy anahtarı (~/.ssh/cheep_repo_deploy);
# tek bir repoya erişir, yazamaz, ve tek başına iptal edilebilir — hesap
# genelinde geçerli bir token'ın aksine.
REPO_URL="git@github.com:Ruzzyferr/Cheep.git"
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

echo "==> Repo erişimi (deploy anahtarı)"
# Anahtar yoksa klon adımı parolasız SSH ile asılı kalırdı; burada net bir
# hatayla durup ne yapılacağını söylüyoruz.
DEPLOY_KEY="$HOME/.ssh/cheep_repo_deploy"
if [ ! -f "$DEPLOY_KEY" ]; then
  echo "HATA: $DEPLOY_KEY yok." >&2
  echo "  1) ssh-keygen -t ed25519 -N '' -C 'cheep-droplet-readonly' -f $DEPLOY_KEY" >&2
  echo "  2) $DEPLOY_KEY.pub içeriğini GitHub → Settings → Deploy keys'e" >&2
  echo "     SALT OKUNUR olarak ekleyin." >&2
  exit 1
fi
if ! grep -q '^Host github.com' "$HOME/.ssh/config" 2>/dev/null; then
  cat >> "$HOME/.ssh/config" <<SSHCFG
Host github.com
  User git
  IdentityFile $DEPLOY_KEY
  IdentitiesOnly yes
SSHCFG
  chmod 600 "$HOME/.ssh/config"
fi
ssh-keyscan -t ed25519 github.com 2>/dev/null >> "$HOME/.ssh/known_hosts"
sort -u -o "$HOME/.ssh/known_hosts" "$HOME/.ssh/known_hosts"

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

echo "==> Backend hazır olana (migration'lar bitene) kadar bekle"
# Container açılışta `migrate deploy` çalıştırır; seed bundan ÖNCE koşarsa tablolar
# henüz yoktur (yarış durumu). Health endpoint'i hazır olunca migration'lar bitmiştir.
for i in $(seq 1 60); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then echo "backend hazır"; break; fi
  sleep 3
done

echo "==> Seed (tek sefer)"
docker compose -f docker-compose.prod.yml exec -T backend pnpm db:seed || \
  echo "(seed atlandı/zaten yapılmış olabilir)"

echo "==> Tamamlandı. API: http://$(curl -s ifconfig.me):3000/api/v1"
