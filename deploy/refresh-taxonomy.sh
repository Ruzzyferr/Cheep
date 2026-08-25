#!/usr/bin/env bash
#
# Haftalık taksonomi tazeleme.
#
# NEDEN VAR: fetch daemon'ı `category_map.json`'u DONMUŞ bir dosya olarak
# okuyordu (`main_to_id.get(main, other_id)`). Devlet yeni bir kategori
# açtığında o kategorinin ürünleri sonsuza kadar "Diğer"e düşüyordu ve
# kimse fark etmiyordu. Taksonomi ham veriden türetilebilir olduğu halde
# yalnızca bir kez, elle türetilmişti.
#
# Bu script döngüyü kapatır:
#   1. Biriken ham veriden devletin güncel taksonomisini yeniden türet
#   2. Yeni kategorileri API'ye bas (mevcutlar 409 → id'si yeniden kullanılır)
#   3. category_map.json'u yeniden üret → daemon bir sonraki turda kullanır
#   4. Deterministik onarımları uygula (güvenli mod)
#   5. Sağlık raporu: çevrilmemiş kategoriler, kategorisiz ürünler
#
# İkiz BİRLEŞTİRME otomatik yapılmaz: iki meşru kategoriyi birleştirmek geri
# alınamaz ve karar sezgisel bir benzerlik eşiğine dayanıyor. Bulunanlar
# rapora yazılır.
set -euo pipefail

APP_DIR=/opt/cheep
SCRAPER_DIR="$APP_DIR/Cheep-Scraper"
ENV_FILE="$APP_DIR/deploy/.env"
COMPOSE="$APP_DIR/deploy/docker-compose.prod.yml"
RAW_DIR="$SCRAPER_DIR/mf_raw"
API="http://localhost:3000/api/v1"

log() { echo "$(date -Is) $*"; }

KEY=$(grep '^INGEST_API_KEY=' "$ENV_FILE" | cut -d= -f2-)
[ -n "$KEY" ] || { log "INGEST_API_KEY bulunamadı"; exit 1; }

cd "$SCRAPER_DIR"
# shellcheck disable=SC1091
[ -f venv/bin/activate ] && source venv/bin/activate

# Ham veri yoksa taksonomi türetmek anlamsız — daemon henüz bir şey çekmemiş.
#
# ⚠️ `set -o pipefail` BU SATIRDA ALT KABUKTA KAPATILIYOR — sebebi gerçek bir
# arıza: `head -1000` bininci satırdan sonra boruyu kapatınca `find` SIGPIPE
# alıp 141 ile ölüyor. `pipefail` bu 141'i borunun sonucu yapıyor, `set -e` de
# betiği o anda öldürüyor. Ham dosya sayısı 1000'i aştığı günden itibaren
# (bugün 18.000+) taksonomi tazelemesi HER HAFTA, hiçbir çıktı üretmeden,
# 49 milisaniyede çöktü; `log` satırına bile varamadığı için log dosyası boş
# kaldı ve arıza bir ay boyunca fark edilmedi. Kategori ikizleri
# ("Et, Tavuk ve Balık" + "Et, Tavuk, Balık") bu yüzden birikti.
RAW_COUNT=$(set +o pipefail; find "$RAW_DIR" -name '*.json' 2>/dev/null | head -1000 | wc -l)
if [ "$RAW_COUNT" -lt 100 ]; then
  log "ham veri yetersiz ($RAW_COUNT dosya) — taksonomi tazeleme atlandı"
  exit 0
fi

log "1/5 devlet taksonomisi ham veriden türetiliyor"
# --max-age-days: kaynaktan DÜŞEN kategoriler taksonomiden çıksın. Daemon her
# ürünü ~5-6 günde bir yeniden çekip ham dosyayı üzerine yazıyor, yani mtime
# "en son ne zaman görüldü" demek. 45 gün ≈ 7 tam tur: geçici bir kesinti
# yüzünden kategori düşürmeyecek kadar geniş, gerçek kaldırmayı bir buçuk ayda
# yakalayacak kadar dar. Tüm dosyalar bayatsa (daemon durmuşsa) sınır kendini
# devre dışı bırakır — bkz. mf_taxonomy.build güvenlik freni.
python countries/turkey/mf_taxonomy.py --raw-dir "$RAW_DIR" --out taxonomy.json --max-age-days 45

if python3 -c "
import json, sys
sys.exit(0 if json.load(open('taxonomy.json',encoding='utf-8')).get('age_filter_skipped') else 1)
"; then
  log "     ⚠️  tüm ham dosyalar bayat — yaş sınırı devre dışı bırakıldı (daemon duruyor olabilir)"
fi

# Güvenlik freni: türetilen ağaç beklenenden küçükse ham veri bozuk demektir.
# Bu dosyayla seed etmek kategori yapısını daraltırdı.
N_TOP=$(python3 -c "import json;print(json.load(open('taxonomy.json',encoding='utf-8'))['n_top'])")
if [ "$N_TOP" -lt 8 ]; then
  log "türetilen üst kategori sayısı çok düşük ($N_TOP) — seed ATLANDI, ham veriyi inceleyin"
  exit 1
fi
log "     üst kategori: $N_TOP"

log "2/5 kategoriler API'ye basılıyor (mevcutlar yeniden kullanılır)"
CHEEP_API_URL="$API" INGEST_API_KEY="$KEY" \
  python countries/turkey/mf_seed_categories.py \
    --api-url "$API" --api-key "$KEY" \
    --taxonomy taxonomy.json --out category_map.json

log "3/5 category_map.json yenilendi — daemon bir sonraki turda kullanacak"
python3 -c "
import json
m = json.load(open('category_map.json', encoding='utf-8'))
print('     eşleme:', len(m.get('main_to_id', {})), 'alt kategori')
"

log "4/5 deterministik onarımlar (güvenli mod)"
CID=$(docker compose -f "$COMPOSE" ps -q backend 2>/dev/null || true)
[ -n "$CID" ] || CID=deploy-backend-1

# Devletin ağacını container'a taşı. KANONİK OTORİTE BU DOSYA: ikiz kararında
# ürün sayısı DEĞİL devletin taksonomisi kazanır. Dosya verilmezse veri konuşur
# ve elle tutulan PL listesinden gelen bir slug, devletinkini yenebilir —
# tam olarak temizlemeye çalıştığımız durum.
# KOPYALAMA BASARISIZSA RECONCILE HIC CALISMAZ.
#
# Eskiden `docker cp` dusunce "kanonik otorite olmadan devam" yazilip
# `--taxonomy /tmp/taxonomy.json` YINE DE geciliyordu. Container da onceki
# haftanin dosyasi duruyorsa `--apply` BAYAT bir kanonik agaca gore kategori
# birlestirmeleri uyguluyordu -- yorumun onlemeye calistigi durumun ta kendisi.
if ! docker cp taxonomy.json "$CID:/tmp/taxonomy.json" 2>/dev/null; then
  log "     HATA: taxonomy.json kopyalanamadi -- reconcile ATLANDI (bayat agacla --apply yapilmaz)."
  RECONCILE_ATLANDI=1
else
  RECONCILE_ATLANDI=0
fi

# HATA YUTULMUYOR: `|| log ...` her basarisizligi bir kayit satirina cevirip
# exit 0 donduruyordu; birim `failed` olmuyor, nobetci de OK diyordu. Dort
# hafta sessizce basarisiz olan tam olarak buydu.
RECONCILE_HATA=0
if [ "$RECONCILE_ATLANDI" -eq 0 ]; then
  if ! docker exec "$CID" npx tsx scripts/reconcile-taxonomy.ts \
      --safe-only --apply --taxonomy /tmp/taxonomy.json 2>&1 | sed 's/^/     /'; then
    log "     HATA: reconcile basarisiz oldu."
    RECONCILE_HATA=1
  fi
fi

log "5/5 sağlık raporu"
docker exec "$CID" npx tsx scripts/data-health.ts --taxonomy /tmp/taxonomy.json 2>&1 | sed 's/^/     /' || true

if [ "${RECONCILE_ATLANDI:-0}" -ne 0 ] || [ "${RECONCILE_HATA:-0}" -ne 0 ]; then
  log "taksonomi tazeleme BASARISIZ (reconcile atlandi=${RECONCILE_ATLANDI:-0}, hata=${RECONCILE_HATA:-0})"
  exit 1
fi

log "taksonomi tazeleme bitti"
