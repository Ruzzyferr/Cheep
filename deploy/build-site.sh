#!/usr/bin/env bash
# ============================================================
# Gecelik site üretimi — 7.800 SEO sayfasını taze fiyatlarla yeniden üretir.
#
# Sıra önemli:
#   1) Slug üretimi — scrape her gün yeni ürün getiriyor, slug'sız ürünün
#      sayfası olamaz.
#   2) Veri dışa aktarımı — build bağlamına yazılır.
#   3) İmaj yeniden derlenir ve website konteyneri değiştirilir.
#
# Neden imaj yeniden derleniyor: site statik ve Caddy imajın içindeki /srv'yi
# sunuyor. Ayrı bir "builder konteyneri + paylaşılan volume" kurgusu da
# mümkündü ama compose'a yeni servis, yeni volume ve yeni hata modu ekliyordu.
# İmaj derlemesi zaten deploy.sh'ın yaptığı iş; gece 04:00'te trafik yok.
#
# GÜVENLİK AĞI: build düşerse yayındaki site OLDUĞU GİBİ kalır. Konteyner
# yalnızca yeni imaj başarıyla derlendiğinde değiştiriliyor.
#
# Çalıştır:  bash /opt/cheep/deploy/build-site.sh
# ============================================================
set -euo pipefail

APP_DIR=/opt/cheep
ENV_FILE="$APP_DIR/deploy/.env"
SITE_DIR="$APP_DIR/cheep-website"
DATA_FILE="$SITE_DIR/.seo-data.json"
COMPOSE="$APP_DIR/deploy/docker-compose.prod.yml"

log() { echo "$(date -Is) $*"; }

KEY=$(grep '^INGEST_API_KEY=' "$ENV_FILE" | cut -d= -f2-)
[ -n "$KEY" ] || { log "INGEST_API_KEY bulunamadı"; exit 1; }

CID=$(docker compose -f "$COMPOSE" ps -q backend 2>/dev/null || true)
[ -n "$CID" ] || CID=deploy-backend-1

# --- 1) yeni ürünlere slug ---------------------------------------------
log "slug üretimi"
docker exec -e KEY="$KEY" "$CID" node -e '
fetch("http://127.0.0.1:3000/api/v1/seo/slugs", { method: "POST", headers: { "x-api-key": process.env.KEY } })
  .then((r) => r.text().then((t) => { console.log("  ", r.status, t.slice(0, 200)); if (!r.ok) process.exit(1); }))
  .catch((e) => { console.log("   hata:", e.message); process.exit(1); });
'

# --- 2) veri dışa aktarımı ---------------------------------------------
# Konteynerin içinden çekip stdout'a döküyoruz: backend portu host'a açık değil.
log "seo verisi çekiliyor"
TMP=$(mktemp)
docker exec -e KEY="$KEY" "$CID" node -e '
fetch("http://127.0.0.1:3000/api/v1/seo/export", { headers: { "x-api-key": process.env.KEY } })
  .then((r) => { if (!r.ok) { console.error("HTTP " + r.status); process.exit(1); } return r.text(); })
  .then((t) => { const j = JSON.parse(t); process.stdout.write(JSON.stringify(j.data)); })
  .catch((e) => { console.error(e.message); process.exit(1); });
' > "$TMP"

# Doğrulama: bozuk/boş veriyle 7.800 sayfa üretip yayına almak, burada
# durmaktan çok daha pahalı.
#
# Host'ta node YOK (yalnızca konteynerlerin içinde) — python3 kullanıyoruz.
COUNT=$(python3 -c "
import json, sys
with open('$TMP', encoding='utf-8') as f:
    d = json.load(f)
n = sum(len(c.get('products') or []) for c in d.get('countries') or [])
if not n:
    sys.stderr.write('ürün yok\n')
    sys.exit(1)
print(n)
")
log "  $COUNT ürün, $(du -h "$TMP" | cut -f1)"
mv "$TMP" "$DATA_FILE"

# --- 3) imajı derle ve değiştir ----------------------------------------
log "site derleniyor"
if docker compose -f "$COMPOSE" build website; then
    docker compose -f "$COMPOSE" up -d website
    log "yayına alındı"
else
    log "DERLEME BAŞARISIZ — yayındaki site değişmedi"
    exit 1
fi

docker image prune -f >/dev/null 2>&1 || true
# BuildKit ÖNBELLEĞİ `image prune` ile TEMİZLENMEZ — ayrı bir depodur.
# Bu betik her gece 04:00'te site imajını yeniden derliyor ve önbellek
# katmanları hiç toplanmadığı için sessizce birikti: 48 GB'lık diskte
# 31,17 GB build cache (19,26 GB geri alınabilir), disk %80 — nöbetçinin
# %85 eşiğinin hemen altında. Dolduğunda Postgres yazamaz hale gelirdi.
# 48 saatten eski katmanlar atılıyor: ardışık iki gecelik derleme hâlâ
# önbellekten faydalanır, ötesi zaten çöp.
docker builder prune -f --filter 'until=48h' >/dev/null 2>&1 || true

# --- 3b) IndexNow: Bing/Yandex'e değişenleri bildir --------------------
# Google'ın karşılığı yok (sitemap + Search Console ile ilerliyoruz) ama
# Bing ve Yandex saatler içinde tarıyor. Yalnızca fiyatı değişen ürünler
# gönderiliyor — her gece 6.800 URL bildirmek protokolün kötüye kullanımı.
INDEXNOW_KEY=$(grep '^INDEXNOW_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
if [ -n "${INDEXNOW_KEY:-}" ]; then
    docker run --rm         -v "$SITE_DIR:/app" -w /app         -e INDEXNOW_KEY="$INDEXNOW_KEY"         node:22-alpine node scripts/indexnow.mjs 2>&1 | sed 's/^/  /' || log "  indexnow atlandı (hata)"
else
    log "  INDEXNOW_KEY yok — IndexNow atlandı"
fi

# --- 4) duman testi ------------------------------------------------------
sleep 5
CODE=$(curl -s -o /dev/null -w '%{http_code}' https://cheep.live/ || echo 000)
SITEMAP=$(curl -s https://cheep.live/sitemap.xml | grep -c '<loc>' || echo 0)
log "duman testi: anasayfa $CODE, sitemap $SITEMAP URL"
[ "$CODE" = "200" ] || { log "UYARI: anasayfa $CODE döndü"; exit 1; }
