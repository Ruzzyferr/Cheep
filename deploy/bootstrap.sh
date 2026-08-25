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
# ufw allow 3000/tcp KALDIRILDI.
#
# `docker-compose.prod.yml` 19 satir boyunca 3000'in disariya ACILMAMASI
# gerektigini anlatiyor: Express `trust proxy=1` ile calisiyor ve Caddy
# atlanirsa sahte X-Forwarded-For ile hiz limiti kovasi degistirilebilir.
# Buradaki kural o gerekceyle DOGRUDAN CELISIYORDU.
#
# Ayrica yaniltici: Docker portlari kendi nat/DOCKER zincirleriyle yayinliyor
# ve ufw'yi ATLIYOR. 80/443 ufw'de hic izinli degil ama site calisiyor. Yani
# bu kural ne koruma sagliyordu ne de gerekliydi; yalnizca "ufw yigini
# koruyor" yanilsamasi uretiyordu. Gercek koruma compose'daki `127.0.0.1:`
# oneki.
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
# HAZIRLIK BEKLEMESI GERCEKTEN BASARISIZ OLABILMELI.
#
# Eskiden dongu `break` ediyor ama dongu SONRASI kontrol yoktu: 180 saniye
# boyunca saglik gelmese bile betik dumduz devam edip seed i calistiriyordu --
# yani yorumun onledigini soyledigi migration YARISININ ta kendisi. 1 vCPU luk
# kutuda Prisma migration lari 180 saniyeyi asabiliyor.
hazir=0
for i in $(seq 1 60); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then hazir=1; echo "backend hazir"; break; fi
  sleep 3
done
if [ "$hazir" -ne 1 ]; then
  echo "HATA: backend 180 saniyede saglikli olmadi; seed CALISTIRILMADI." >&2
  docker compose -f docker-compose.prod.yml logs --tail 40 backend >&2
  exit 1
fi

echo "==> Seed (tek sefer)"
# `|| echo` KALDIRILDI: her seed hatasini guven verici bir mesaja cevirip
# exit 0 donuyordu. "Seed zaten yapilmis" ile "tablolar hic yok" ayni
# muameleyi goruyor ve bootstrap BOS bir categories tablosunun uzerine
# "Tamamlandi" yaziyordu.
if ! docker compose -f docker-compose.prod.yml exec -T backend pnpm db:seed; then
  echo "HATA: seed basarisiz oldu. Tablolar olusmus mu, .env dogru mu bakin." >&2
  exit 1
fi

echo "==> Tamamlandı. API: http://$(curl -s ifconfig.me):3000/api/v1"
