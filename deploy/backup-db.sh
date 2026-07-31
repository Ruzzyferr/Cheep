#!/usr/bin/env bash
# ============================================
# Cheep — günlük Postgres yedeği.
#
# Neden: 2026-07-31'e kadar OTOMATİK yedek yoktu; elde yalnızca elle alınmış
# üç dump vardı ve en yenisi 16 günlüktü. Veritabanında kullanıcı hesapları,
# listeler ve 55 bin ürün duruyor.
#
# NOT: Bu yedekler AYNI sunucuda duruyor. Bozuk migration, yanlış DELETE veya
# veri bozulmasına karşı korur; droplet'in tamamen kaybına karşı KORUMAZ.
# Sunucu-dışı koruma için DigitalOcean'ın otomatik droplet yedeklerini açın
# veya bu dosyaları bir object storage'a (DO Spaces vb.) kopyalayın.
# ============================================
set -euo pipefail

BACKUP_DIR=/opt/cheep/backups
RETENTION_DAYS=14
CONTAINER=deploy-db-1
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/cheep-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

# -Fc: custom format — sıkıştırılmış ve pg_restore ile seçmeli geri yüklenebilir.
# Kimlik bilgileri container'ın kendi ortamından okunur (.env'i kopyalamaya gerek yok).
docker exec "$CONTAINER" sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$OUT"

# Boş/bozuk dump'ı sessizce saklama — diskte yer kaplayıp güven yanılsaması yaratır.
SIZE=$(stat -c %s "$OUT")
if [ "$SIZE" -lt 100000 ]; then
  echo "HATA: yedek şüpheli derecede küçük ($SIZE bayt), siliniyor: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

# Geri yüklenebilirliği doğrula: pg_restore -l arşivin içindekileri listeler,
# bozuk dosyada hata verir. Yedeğin var olması yetmez, açılabilmesi de gerekir.
if ! docker exec -i "$CONTAINER" pg_restore -l > /dev/null < "$OUT"; then
  echo "HATA: yedek pg_restore ile okunamadı, siliniyor: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

find "$BACKUP_DIR" -name 'cheep-*.dump' -mtime "+$RETENTION_DAYS" -delete

echo "yedek tamam: $OUT ($(numfmt --to=iec "$SIZE"))  |  saklanan: $(ls -1 "$BACKUP_DIR"/cheep-*.dump 2>/dev/null | wc -l) dosya"
