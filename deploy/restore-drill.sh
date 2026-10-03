#!/usr/bin/env bash
# ============================================
# Cheep — yedek geri yükleme tatbikatı.
#
# NEDEN VAR: `backup-db.sh` yedeği alıyor, boyutunu ölçüyor ve `pg_restore -l`
# ile içindekileri listeliyor. Bu, dosyanın OKUNABİLİR olduğunu gösterir —
# GERİ YÜKLENEBİLİR olduğunu değil. Aradaki fark, felaket anında öğrenilecek
# bir şey değil.
#
# Bu betik en yeni dump'ı AYRI bir veritabanına yükler, satır sayılarını
# canlıyla karşılaştırır ve sonra test veritabanını siler.
#
# CANLI VERİTABANINA DOKUNMAZ. Yalnızca okur.
#
# Kullanım:  bash /opt/cheep/deploy/restore-drill.sh
# ============================================
set -uo pipefail   # -e YOK: tek bir tablo hatası tatbikatı bitirmemeli

BACKUP_DIR=/opt/cheep/backups
DB_CONTAINER=deploy-db-1

# GERI YUKLEME YONETICI ROLUYLE YAPILIR, uygulama roluyle DEGIL.
#
# 3 Eki 2026'da `cheep` rolunden SUPERUSER dusuruldu (uygulama rolunun
# superuser olmasi gereksiz bir risk). Ama dump `CREATE EXTENSION pg_trgm`
# ve `unaccent` iceriyor ve bunlar superuser istiyor:
#   ERROR: permission denied for language c
# "trusted eklenti db sahibi tarafindan kurulabilir" kuralinin bu kurulumda
# GECERLI OLMADIGI tatbikatla olculdu — varsayimla degil.
#
# Dogru cozum superuser'i geri vermek degil, geri yuklemeyi (zaten bir
# YONETIM islemi) yonetici roluyle yapmak. Gercek bir felaket kurtarmasi da
# ayni rolu kullanir.
ENV_FILE=/opt/cheep/deploy/.env
ADMIN_USER=$(grep -m1 '^PG_ADMIN_USER=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
ADMIN_PW=$(grep -m1 '^PG_ADMIN_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
if [ -z "${ADMIN_USER:-}" ] || [ -z "${ADMIN_PW:-}" ]; then
    echo "HATA: PG_ADMIN_USER/PG_ADMIN_PASSWORD $ENV_FILE icinde yok." >&2
    echo "      Geri yukleme superuser ister; bkz. docs/GUVENLIK-UYARILARI.md" >&2
    exit 1
fi
# Yonetici roluyle konteyner icinde komut calistirir.
yonetici() { docker exec -e PGPASSWORD="$ADMIN_PW" "$DB_CONTAINER" "$@"; }
DB_USER=cheep
DB_LIVE=cheep_db

# Karşılaştırılacak tablolar. Ürün/fiyat tarafı ingest ile sürekli değişir;
# beklenen küçük farklar bu yüzden hata sayılmaz — bakılacak şey tabloların
# GELİP GELMEDİĞİ ve büyüklük mertebesinin tutup tutmadığı.
TABLES="users lists list_items products store_prices categories store_branches price_history subscriptions chat_messages"

log() { echo "$(date -Is) $*"; }

DUMP=$(ls -t "$BACKUP_DIR"/cheep-*.dump 2>/dev/null | head -1)
[ -n "$DUMP" ] || { log "HATA: $BACKUP_DIR içinde yedek yok"; exit 1; }

AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$DUMP") ) / 3600 ))
log "yedek: $(basename "$DUMP")  ($(du -h "$DUMP" | cut -f1), $AGE_H saatlik)"

TEST_DB="restore_drill_$(date +%s)"
log "test veritabanı: $TEST_DB"

cleanup() {
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null 2>&1
    docker exec "$DB_CONTAINER" rm -f /tmp/drill.dump >/dev/null 2>&1
}
trap cleanup EXIT

docker cp "$DUMP" "$DB_CONTAINER:/tmp/drill.dump" || { log "HATA: dump kopyalanamadı"; exit 1; }
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE $TEST_DB;" >/dev/null || { log "HATA: test veritabanı yaratılamadı"; exit 1; }

log "geri yükleniyor…"
# `--no-owner --no-privileges` KALDIRILDI, bilerek.
#
# Onlarla geri yukleme calisiyordu ama tablolar YONETICI rolune ait oluyordu
# ve uygulama rolu (`cheep`) okuyamiyordu: "permission denied for table
# products". Yani tatbikat pg_restore asamasini gecse bile gercek bir
# kurtarmada uygulama ayaga KALKMAZDI — tam da tatbikatin yakalamasi
# gereken sey. Bayraksiz geri yukleme dump'taki SAHIPLIGI de kuruyor.
yonetici pg_restore -U "$ADMIN_USER" -d "$TEST_DB" /tmp/drill.dump 2>&1 | tail -5
RC=${PIPESTATUS[0]}
log "pg_restore çıkış kodu: $RC"
[ "$RC" -eq 0 ] || { log "BAŞARISIZ: geri yükleme hata verdi"; exit 1; }

echo
printf '%-22s %12s %12s\n' TABLO CANLI YEDEK
FAIL=0
for t in $TABLES; do
    live=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_LIVE" -tAc "SELECT count(*) FROM $t" 2>/dev/null | tr -d '[:space:]')
    rest=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc "SELECT count(*) FROM $t" 2>/dev/null | tr -d '[:space:]')
    printf '%-22s %12s %12s\n' "$t" "${live:-?}" "${rest:-?}"
    # Tablo yedekte HİÇ yoksa gerçek arıza budur.
    if [ -z "$rest" ]; then
        log "BAŞARISIZ: '$t' tablosu yedekte okunamadı"
        FAIL=1
    fi
done

echo
log "yedekten örnek okuma:"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc \
    "SELECT '  ürün: ' || name FROM products LIMIT 1"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc \
    "SELECT '  üst kategori: ' || count(*) FROM categories WHERE parent_id IS NULL"

echo
if [ "$FAIL" -eq 0 ]; then
    log "✅ TATBİKAT BAŞARILI — yedek geri yüklenebilir durumda"
else
    log "❌ TATBİKAT BAŞARISIZ — yukarıdaki tabloya bakın"
fi
exit "$FAIL"
