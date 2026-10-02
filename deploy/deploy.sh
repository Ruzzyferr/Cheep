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
# ---- DERLEME ONCESI ALAN GARANTISI ----------------------------------
# 2 Eki 2026: bu derleme diski %100'e dayadi (86/87 GB) ve nobetci alarm
# verdi. Postgres o pencerede yazamazdi; sansliydik.
#
# `--filter until=48h` BU ISI GORMUYOR: ayni gun ikinci bir derleme
# yapildiginda onceki derlemenin ~21 GB'lik onbellegi 48 saatten GENC
# oldugu icin dokunulmadan kaliyor ve ust uste biniyor. Canlida olculdu:
# zaman filtresiyle budama 0 BAYT bosaltti, filtresiz ayni komut 20,93 GB.
# ("Reclaimable" sutunu da yaniltici — 4,43 GB diyordu, hepsi gitti.)
#
# Bu yuzden alan darsa TUM kullanilmayan onbellek siliniyor. Bedeli bir
# derlemenin onbelleksiz, yani yavas kosmasi; karsiligi diskin dolmamasi.
bos_gb=$(df --output=avail -BG / 2>/dev/null | tail -1 | tr -dc '0-9')
if [ "${bos_gb:-0}" -lt 60 ]; then
    docker builder prune -f --all >/dev/null 2>&1 || true
else
    docker builder prune -f --all --filter 'until=48h' >/dev/null 2>&1 || true
fi

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
# `--all` ŞART: bayraksız `builder prune` yalnızca DANGLING katmanları siler.
# Bu satır aylardır her gece koşuyordu ve önbellek yine 64,8 GB'a çıktı
# (disk %85) — çünkü gecelik derlemenin bıraktığı katmanlar dangling
# DEĞİL, sadece kullanılmıyor. `--all` ile aynı filtre 49,6 GB boşalttı.
docker builder prune -f --all --filter 'until=48h' >/dev/null 2>&1 || true

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
