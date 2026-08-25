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

# ONCE GECICI DOSYAYA, SONRA ADINI KOY (atomik yayinlama).
#
# Eskiden dogrudan "$OUT"a yaziliyordu ve kabuk yonlendirmesi dosyayi
# `docker exec` daha baslamadan ONCE olusturup sifirliyordu. Betik dump ile
# dogrulama arasinda olurse (2 GB kutuda OOM, yeniden baslatma, systemd stop)
# geriye TAZE ZAMAN DAMGALI ama YARIM bir dosya kaliyordu -- ve uc dogrulama
# katmaninin ucu de onu saglikli sayiyordu:
#   * watchdog yalnizca en yeni dosyanin mtime'ina bakiyor,
#   * pull-backups.ps1 ilk 5 baytta PGDMP ariyor (kesik dosyada da var),
#   * restore-drill yalnizca elle calisan bir betik.
# Sonuc: haftalarca "yedek saglikli" raporlanirken geri yuklenebilir en yeni
# dump sessizce 14 gunluk saklama penceresinden dusuyordu.
#
# Gecici dosya `.partial` uzantili: watchdog ve pull-backups `cheep-*.dump`
# ariyor, yarim dosyayi GORMUYORLAR. Ad degistirme ayni dosya sisteminde
# atomik -- ya tam dosya gorunur ya hicbiri.
TMP="$OUT.partial"
trap 'rm -f "$TMP"' EXIT

# -Fc: custom format -- sikistirilmis ve pg_restore ile secmeli geri yuklenebilir.
# Kimlik bilgileri container'in kendi ortamindan okunur.
#
# CIKIS KODU da sinaniyor: pg_dump yarida oldurulurse kabuk yonlendirmesi
# yine de bir dosya birakir ama komut sifirdan farkli doner.
if ! docker exec "$CONTAINER" sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TMP"; then
  echo "HATA: pg_dump basarisiz oldu, yarim dosya atiliyor." >&2
  exit 1
fi

# Boş/bozuk dump'ı sessizce saklama — diskte yer kaplayıp güven yanılsaması yaratır.
SIZE=$(stat -c %s "$TMP")
if [ "$SIZE" -lt 100000 ]; then
  echo "HATA: yedek supheli derecede kucuk ($SIZE bayt), atiliyor." >&2
  exit 1
fi

# Geri yüklenebilirliği doğrula: pg_restore -l arşivin içindekileri listeler,
# bozuk dosyada hata verir. Yedeğin var olması yetmez, açılabilmesi de gerekir.
#
# DİKKAT — bu kontrolün SINIRI var: arşivin OKUNABİLİR olduğunu gösterir,
# GERİ YÜKLENEBİLİR olduğunu değil. Gerçek geri yükleme tatbikatı ayrı bir
# betikte: `bash deploy/restore-drill.sh` — en yeni dump'ı ayrı bir
# veritabanına yükleyip satır sayılarını canlıyla karşılaştırır. Ayda bir
# elle çalıştırın; felaket anında ilk kez denemek için çok geç olur.
if ! docker exec -i "$CONTAINER" pg_restore -l > /dev/null < "$TMP"; then
  echo "HATA: yedek pg_restore ile okunamadi, atiliyor." >&2
  exit 1
fi

# Tum dogrulamalar gecti -- ancak SIMDI gorunur ada tasi.
mv "$TMP" "$OUT"
trap - EXIT

find "$BACKUP_DIR" -name 'cheep-*.dump' -mtime "+$RETENTION_DAYS" -delete

echo "yedek tamam: $OUT ($(numfmt --to=iec "$SIZE"))  |  saklanan: $(ls -1 "$BACKUP_DIR"/cheep-*.dump 2>/dev/null | wc -l) dosya"
