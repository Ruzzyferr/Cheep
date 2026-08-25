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

# CADDY'Yİ ZORLA YENİDEN OLUŞTUR.
#
# Caddyfile bind mount ile bağlı (`./Caddyfile:/etc/caddy/Caddyfile:ro`) ve
# bind mount İNODE'a bağlanıyor. Yukarıdaki `git reset --hard` dosyayı
# değiştirdiğinde YENİ bir inode üretiyor; caddy container'ı yeniden
# oluşturulmadığı için ESKİ inode'u tutmaya devam ediyor ve içeride hâlâ eski
# Caddyfile duruyor. `up -d --build` caddy'ye dokunmuyor (imajı değişmedi),
# `caddy reload` da container'ın kendi gördüğü bayat dosyayı okuyor.
#
# Sonuç: Caddyfile'daki her değişiklik — güvenlik başlıkları, rota, proxy
# ayarı — deploy "başarılı" derken sessizce UYGULANMIYORDU. Tam olarak bu
# yaşandı: apex güvenlik başlıkları eklendi, deploy geçti, başlıklar gelmedi.
docker compose -f docker-compose.prod.yml up -d --force-recreate caddy

echo "==> Kullanılmayan imajlar ve build önbelleği temizleniyor"
docker image prune -f >/dev/null 2>&1 || true
# `image prune` BuildKit önbelleğine DOKUNMAZ; bkz. build-site.sh'teki
# gerekçe (birikip diski %80'e çıkarmıştı).
docker builder prune -f --filter 'until=48h' >/dev/null 2>&1 || true

# FETCH DAEMON'INI YENİDEN BAŞLAT.
#
# `git reset --hard` Cheep-Scraper/ dizinini de güncelliyor ama
# `cheep-fetcher.service` `Type=simple` ve haftalardır ayakta — Python kodu
# süreç başlarken belleğe alındığı için daemon ESKİ kodu çalıştırmaya devam
# ediyor. Yani scraper'a yapılan bir düzeltme deploy edilmiş görünüp fiilen
# hiç devreye girmiyordu (yalnızca elle restart ya da sunucu yeniden
# başlatmasıyla). Birim yoksa deploy'u düşürme.
if systemctl list-unit-files cheep-fetcher.service >/dev/null 2>&1; then
    echo "==> Fetch daemon yeniden başlatılıyor (yeni scraper kodu için)"
    systemctl restart cheep-fetcher.service || echo "   (fetcher yeniden başlatılamadı — elle bak)"
fi

# DEPLOY'U DOĞRULA.
#
# Eskiden bu betik hiçbir şey doğrulamadan "Deploy tamam" yazıp 0 dönüyordu:
# açılışta çöken bir backend imajı bile başarılı görünüyordu ve arıza ancak
# nöbetçinin 5 dakikalık turunda ortaya çıkıyordu. Sağlık yanıt verene kadar
# bekle; vermezse GÜRÜLTÜLÜ biçimde başarısız ol.
echo "==> Sağlık kontrolü"
for i in $(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T backend \
        node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        echo "==> Backend sağlıklı."
        echo "==> Deploy tamam."
        exit 0
    fi
    sleep 3
done

echo "!! DEPLOY BAŞARISIZ: backend 90 saniyede sağlıklı olmadı." >&2
docker compose -f docker-compose.prod.yml logs --tail 40 backend >&2
exit 1
