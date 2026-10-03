#!/usr/bin/env bash
# ============================================
# Cheep — sunucu içi nöbetçi. systemd timer ile 5 dakikada bir çalışır.
#
# Amaç: sessiz arızaları yakalamak. Bir container çökse, disk dolsa, yedek
# alınamasa veya sertifika süresi dolmaya yaklaşsa kimsenin haberi olmuyordu.
#
# Uyarılar mevcut Resend anahtarıyla e-postayla gider (yeni servis gerekmez).
# Gürültü yapmaması için DURUM DEĞİŞİMİNDE haber verir: OK→ARIZA ve ARIZA→OK.
# Arıza sürerse REPEAT_HOURS'ta bir hatırlatır.
#
# NOT: Bu script sunucunun ÜSTÜNDE çalışıyor; sunucu tamamen ölürse haber
# veremez. Onun için dışarıdan bakan bir izleyici (UptimeRobot) var.
# ============================================
set -uo pipefail   # -e YOK: tek bir kontrolün başarısızlığı scripti bitirmemeli

ENV_FILE=/opt/cheep/deploy/.env
STATE_DIR=/var/lib/cheep-watchdog
BACKUP_DIR=/opt/cheep/backups
ALERT_TO=info@swiip.app
REPEAT_HOURS=6

CONTAINERS="deploy-backend-1 deploy-website-1 deploy-caddy-1 deploy-db-1"
DISK_MAX_PCT=85
BACKUP_MAX_AGE_H=36
CERT_MIN_DAYS=14

mkdir -p "$STATE_DIR"

# .env'den yalnızca ihtiyacımız olan anahtarları al (tamamını source etmek
# içindeki çok satırlı/özel karakterli değerlerde patlayabilir).
RESEND_API_KEY=$(grep -m1 '^RESEND_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"'')
EMAIL_FROM=$(grep -m1 '^EMAIL_FROM=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"'')
: "${EMAIL_FROM:=onboarding@resend.dev}"

send_mail() {
    local subject="$1" body="$2"
    if [ -z "$RESEND_API_KEY" ]; then
        echo "UYARI: RESEND_API_KEY yok, e-posta gönderilemedi: $subject" >&2
        return 1
    fi
    local payload
    payload=$(SUBJ="$subject" BODY="$body" FROM="$EMAIL_FROM" TO="$ALERT_TO" python3 -c '
import json, os
print(json.dumps({
    "from": os.environ["FROM"],
    "to": [os.environ["TO"]],
    "subject": os.environ["SUBJ"],
    "text": os.environ["BODY"],
}))')
    # Resend'in yanıtını YUTMA: anahtar iptal olsa veya gönderen alan adı
    # doğrulaması düşse nöbetçi sessizce uyaramaz hâle gelirdi. Başarısızlık
    # loga yazılır ki "nöbetçiyi kim gözetliyor" boşluğu en azından görünür olsun.
    local code
    code=$(curl -sS -m 20 -X POST https://api.resend.com/emails \
        -H "Authorization: Bearer $RESEND_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" -o /tmp/cheep-watchdog-mail.out -w '%{http_code}' 2>/dev/null)
    if [ "$code" != "200" ]; then
        echo "UYARI: e-posta gönderilemedi (HTTP $code): $subject — $(head -c 200 /tmp/cheep-watchdog-mail.out 2>/dev/null)" >&2
        return 1
    fi
}

# report <kontrol-adı> <ok|fail> <mesaj>
report() {
    local name="$1" status="$2" msg="$3"
    local state_file="$STATE_DIR/$name"
    local prev="ok" prev_ts=0
    if [ -f "$state_file" ]; then
        prev=$(cut -d' ' -f1 "$state_file")
        prev_ts=$(cut -d' ' -f2 "$state_file")
    fi
    local now
    now=$(date +%s)

    if [ "$status" = "fail" ]; then
        local age=$(( (now - prev_ts) / 3600 ))
        if [ "$prev" != "fail" ]; then
            echo "[$(date -Is)] ARIZA $name: $msg"
            send_mail "🔴 Cheep: $name arızalı" "$msg

Sunucu: $(hostname) · $(date -Is)
Bu uyarı sunucu üzerindeki nöbetçiden geldi."
            echo "fail $now" > "$state_file"
        elif [ "$age" -ge "$REPEAT_HOURS" ]; then
            echo "[$(date -Is)] ARIZA SÜRÜYOR $name: $msg"
            send_mail "🔴 Cheep: $name hâlâ arızalı ($age saattir)" "$msg

Sunucu: $(hostname) · $(date -Is)"
            echo "fail $now" > "$state_file"
        fi
    else
        if [ "$prev" = "fail" ]; then
            echo "[$(date -Is)] DÜZELDİ $name"
            send_mail "🟢 Cheep: $name düzeldi" "$name yeniden normal.

Sunucu: $(hostname) · $(date -Is)"
        fi
        echo "ok $now" > "$state_file"
    fi
}

# nadiren <ad> <saniye> — bu kontrol son <saniye> içinde koştuysa 1 döner.
#
# NEDEN VAR: `docker exec` ve `docker inspect` çağrılarının HER BİRİ dockerd'nin
# heap'inde kalıcı iz bırakıyor. Canlıda ölçüldü (Docker 29.6.1): 200 exec
# +26,9 MB (~134 kB/çağrı), 200 inspect +4,5 MB (~23 kB/çağrı). Nöbetçi 5
# dakikada bir 4 inspect + 4 exec yapıyordu: günde ~177 MB. 16 günde dockerd
# 969 MB'a (2 GB RAM'in %48'i) çıkmış, sunucu swap'e düşmüş ve DigitalOcean
# "bellek dolu" uyarıları göndermeye başlamıştı. Yani sessiz arızaları yakalasın
# diye kurulan nöbetçi, sunucunun kendisini boğan şeydi.
#
# Ucuz kontroller (curl, /proc, df) her turda koşmaya devam ediyor. PAHALI
# olanlar — psql gerektirenler — saatte bire indirildi. Bu bir taviz değil:
# veri tazeliği eşiği 3 GÜN, onu 5 dakikada bir sormanın hiçbir karşılığı yoktu.
nadiren() {
    local ad="$1" aralik="$2" f="$STATE_DIR/son-$1" son=0 now
    [ -f "$f" ] && son=$(cat "$f" 2>/dev/null || echo 0)
    now=$(date +%s)
    if [ $(( now - son )) -ge "$aralik" ]; then
        echo "$now" > "$f"
        return 0
    fi
    return 1
}

# Atlanan kontrol `report` ÇAĞIRMAZ — durumu olduğu gibi kalır. Atlamayı "ok"
# saymak, arızalı bir durumu sessizce temizlerdi.
SAATLIK=3600

# ---------------------------------------------------------------- kontroller

# 1) Container'lar ayakta mı — TEK `docker ps` ile.
#
# Eskiden container başına bir `docker inspect` vardı (4 çağrı/tur). `docker ps`
# hepsini tek çağrıda veriyor; dockerd'ye binen yük dörtte bire iniyor ve
# karşılığında hiçbir bilgi kaybedilmiyor.
calisanlar=$(docker ps --format '{{.Names}}' 2>/dev/null)
for c in $CONTAINERS; do
    if printf '%s
' "$calisanlar" | grep -qx "$c"; then
        report "container-$c" ok ""
    else
        report "container-$c" fail "Container '$c' çalışmıyor."
    fi
done

# 2) API sağlığı — yayınlanmış loopback portundan, `docker exec` OLMADAN.
#
# Backend `127.0.0.1:3000` adresini yayınlıyor, yani host'tan doğrudan
# sorulabiliyor. Kontrolün amacı korunuyor: bu istek DNS, TLS ve Caddy'ye
# UĞRAMIYOR, dolayısıyla "uygulama mı bozuk, ağ mı" ayrımı aynen duruyor —
# ama tur başına bir `docker exec` (≈134 kB kalıcı dockerd heap'i) gitti.
code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health 2>/dev/null)
if [ "$code" = "200" ]; then
    report "api-internal" ok ""
else
    report "api-internal" fail "Backend /health loopback'ten '$code' döndü (uygulama seviyesinde sorun)."
fi

# 3) Dışarıdan HTTPS (Caddy + TLS + yönlendirme zinciri)
for url in https://api.cheep.live/health https://cheep.live/; do
    code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)
    name="https-$(echo "$url" | sed 's|https://||; s|/.*||')"
    if [ "$code" = "200" ]; then
        report "$name" ok ""
    else
        report "$name" fail "$url beklenen 200 yerine '$code' döndü."
    fi
done

# 4) Veritabanı — SAATTE BİR (psql gerektiriyor, yani `docker exec`).
#
# Beş dakikada bir sormak gerekmiyordu: veritabanı gerçekten ölürse bunu
# `api-internal` ZATEN bir turda yakalar (backend /health DB'ye dokunuyor).
# Bu kontrol onun teyidi, ilk savunma hattı değil.
if nadiren postgres "$SAATLIK"; then
    if docker exec deploy-db-1 sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
        report "postgres" ok ""
    else
        report "postgres" fail "Postgres pg_isready yanıt vermiyor."
    fi
fi

# 5) Disk
disk_pct=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [ "${disk_pct:-0}" -lt "$DISK_MAX_PCT" ]; then
    report "disk" ok ""
else
    report "disk" fail "Kök disk %$disk_pct dolu (eşik %$DISK_MAX_PCT). Yedekler ve docker imajları yer kaplıyor olabilir."
fi

# 6) Son yedeğin yaşı — yedek sessizce durursa fark edilmeli
newest=$(ls -t "$BACKUP_DIR"/cheep-*.dump 2>/dev/null | head -1)
if [ -z "$newest" ]; then
    report "backup" fail "Hiç veritabanı yedeği bulunamadı ($BACKUP_DIR)."
else
    age_h=$(( ( $(date +%s) - $(stat -c %Y "$newest") ) / 3600 ))
    if [ "$age_h" -le "$BACKUP_MAX_AGE_H" ]; then
        report "backup" ok ""
    else
        report "backup" fail "En yeni yedek $age_h saatlik (eşik $BACKUP_MAX_AGE_H sa): $(basename "$newest")"
    fi
fi

# 7) TLS sertifikası — Caddy otomatik yeniliyor ama yenileme bozulursa site ölür
end=$(echo | openssl s_client -connect api.cheep.live:443 -servername api.cheep.live 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ]; then
    days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
    if [ "$days" -ge "$CERT_MIN_DAYS" ]; then
        report "tls" ok ""
    else
        report "tls" fail "api.cheep.live sertifikasının bitmesine $days gün kaldı (Caddy yenilemesi takılmış olabilir)."
    fi
else
    report "tls" fail "api.cheep.live TLS sertifikası okunamadı."
fi

# 8) Zamanlanmış işler ÇÖKMÜŞ mü
#
# Bu kontrol, kaçırdığı bir arıza yüzünden eklendi: `cheep-taxonomy.service`
# dört hafta boyunca her pazar çöktü, tek satır log üretmedi ve kimse fark
# etmedi — kategori ikizleri o sürede birikti. Nöbetçi container'lara,
# HTTPS'e, diske ve yedeğe bakıyordu ama systemd'nin KENDİ arıza kaydına
# bakmıyordu; oysa arızalı birimi sormak tek komut.
#
# Birimler tek tek sorulur (topluca "systemctl --failed" yerine): böylece
# hangi işin bozuk olduğu `report` durumunda ayrı ayrı izlenir ve biri
# düzelirken diğeri bozuksa uyarı susmaz.
for unit in cheep-fetcher cheep-fetcher-pl cheep-price-drops cheep-site-build \
            cheep-taxonomy cheep-backup; do
    # Oneshot birimler tetiklenmediği sürece "inactive" durur — bu normaldir.
    # Sadece açıkça "failed" olan durumu arızadır.
    state=$(systemctl is-failed "$unit.service" 2>/dev/null)
    active=$(systemctl is-active "$unit.service" 2>/dev/null)
    nrestarts=$(systemctl show "$unit.service" -p NRestarts --value 2>/dev/null)

    if [ "$state" = "failed" ]; then
        when=$(systemctl show "$unit.service" -p ExecMainExitTimestamp --value 2>/dev/null)
        why=$(journalctl -u "$unit.service" -n 5 --no-pager 2>/dev/null | tail -5)
        report "unit-$unit" fail "Zamanlanmis is '$unit.service' COKTU (son: ${when:-bilinmiyor}).

Son log satirlari:
$why"
    elif [ "${nrestarts:-0}" -gt 5 ] 2>/dev/null; then
        # COKME DONGUSU -- "failed" DEGIL ama saglikli da degil.
        #
        # cheep-fetcher.service Restart=always + RestartSec=30 ve
        # StartLimitBurst override'i yok; surekli cokup yeniden baslayan bir
        # birim activating/auto-restart durumunda TAKILI kaliyor ve is-failed
        # ASLA "failed" demiyordu. Nobetci bu yuzden 7/24 coken bir daemon'a
        # "ok" diyordu. NRestarts sayaci bunu gorunur kiliyor.
        why=$(journalctl -u "$unit.service" -n 8 --no-pager 2>/dev/null | tail -8)
        report "unit-$unit" fail "Zamanlanmis is '$unit.service' COKME DONGUSUNDE olabilir (yeniden baslatma: $nrestarts, durum: ${active:-bilinmiyor}).

Son log satirlari:
$why"
    else
        report "unit-$unit" ok ""
    fi
done

# 8b) Zamanlayicilar GERCEKTEN kurulu mu
#
# Yukaridaki dongu yalnizca SERVIS durumuna bakiyor. Oneshot bir servisin
# timer'i devre disi birakilir ya da maskelenirse servis sonsuza dek
# "inactive" kalir -- dongu bunu OK sayar. Yani "is hic calismiyor" durumu
# nobetcinin tamamen kor oldugu bir yerdeydi.
for timer in cheep-fetcher-pl cheep-price-drops cheep-site-build              cheep-taxonomy cheep-backup cheep-watchdog cheep-docker-recycle; do
    if ! systemctl is-enabled "$timer.timer" >/dev/null 2>&1; then
        report "timer-$timer" fail "Zamanlayici '$timer.timer' ETKIN DEGIL -- bu is hic calismiyor."
    else
        report "timer-$timer" ok ""
    fi
done

# 9) Fiyat verisi bayatladı mı
#
# Uygulama, veri donmuş olsa da SAĞLIKLI görünür: /health 200 döner, container
# ayaktadır, sayfalar açılır — sadece fiyatlar yanlıştır. Kullanıcının gördüğü
# tek şey budur, o yüzden izlenmesi gereken de budur.
#
# Eşik zincir rotasyonuna göre seçildi: TR daemon'ı her ürünü ~7 günde bir
# tazeliyor, PL zincirleri haftada iki gün dönüyor. 3 gün hiçbir markette TEK
# bir fiyat güncellenmemişse ingest hattı gerçekten durmuş demektir.
# ULKE BAZINDA. Eskiden sorgu ulke filtresiz TEK bir toplam donduruyordu:
# TR daemon'i tamamen olse bile PL'nin gecelik rotasyonu satir guncelledigi
# icin toplam > 0 kaliyor ve nobetci "veri taze" diyordu. Turk fiyatlari
# donmusken uyari HIC CIKMIYORDU. Her ulke ayri sinaniyor.
# SAATTE BİR: eşik 3 GÜN, beş dakikada bir sormanın hiçbir karşılığı yoktu ve
# tur başına İKİ `docker exec` demekti (günde 576 çağrı, ~77 MB dockerd heap'i).
if nadiren veri-tazeligi "$SAATLIK"; then
for ulke in TR PL; do
    taze=$(docker exec deploy-db-1 psql -U cheep -d cheep_db -tAc \
        "SELECT count(*) FROM store_prices sp
           JOIN stores s ON s.id = sp.store_id
           JOIN countries co ON co.id = s.country_id
          WHERE co.code = '$ulke'
            AND sp.last_updated_at > now() - interval '3 days'" 2>/dev/null | tr -d '[:space:]')
    if [ -z "$taze" ]; then
        report "veri-tazeligi-$ulke" fail "$ulke fiyat tazeligi sorgulanamadi (veritabanina erisilemedi)."
    elif [ "$taze" -gt 0 ] 2>/dev/null; then
        report "veri-tazeligi-$ulke" ok ""
    else
        report "veri-tazeligi-$ulke" fail "$ulke: son 3 GUNDE hicbir fiyat guncellenmedi. Ingest hatti (fetch daemon / PL zamanlayici) durmus olabilir — uygulama saglikli gorunurken bayat fiyat gosteriyor."
    fi
done
fi

# 10) BELLEK — bu kontrol, kaçırdığı bir arıza yüzünden eklendi.
#
# 30 Eylül'de sunucu haftalardır bellek baskısı altındaydı (dockerd 969 MB,
# swap 873 MB, boşta 99 MB) ve nöbetçinin bundan HABERİ YOKTU: container'lara,
# HTTPS'e, diske ve yedeğe bakıyordu ama RAM'e bakmıyordu. Haberi veren
# DigitalOcean'ın kendi izlemesi oldu — yani bizim izleme katmanımızın kör
# noktasını dışarıdaki bir servis kapatıyordu. Üstelik baskının KAYNAĞI
# nöbetçinin kendi docker çağrılarıydı (bkz. `nadiren`).
#
# Eşik "kullanılan" değil KULLANILABİLİR bellek üzerinden: Linux boştaki RAM'i
# önbellek olarak kullanır, o yüzden "used" yüksek görünmesi tek başına arıza
# değildir. MemAvailable çekirdeğin "baskı olursa gerçekten verebileceğim"
# tahminidir ve doğru sinyal odur.
MEM_MIN_PCT=15
read -r mem_avail_pct mem_avail_mb <<EOF_MEM
$(awk '/^MemAvailable:/{a=$2} /^MemTotal:/{t=$2} END{printf "%d %d", a*100/t, a/1024}' /proc/meminfo)
EOF_MEM
swap_used_mb=$(awk '/^SwapTotal:/{t=$2} /^SwapFree:/{f=$2} END{printf "%d", (t-f)/1024}' /proc/meminfo)

if [ "${mem_avail_pct:-100}" -ge "$MEM_MIN_PCT" ]; then
    report "bellek" ok ""
else
    report "bellek" fail "Kullanılabilir bellek %$mem_avail_pct (${mem_avail_mb} MB), eşik %$MEM_MIN_PCT. Swap kullanımı: ${swap_used_mb} MB.

En çok bellek kullanan 5 süreç:
$(ps -eo rss,comm --sort=-rss 2>/dev/null | head -6 | awk 'NR>1{printf \"  %6.0f MB  %s\n\", $1/1024, $2}')"
fi

# 11) SERTLESTIRME YERINDE Mİ
#
# Bu kontrol, 3 Eki 2026 denetiminde bulunan boslugu bir daha sessiz
# birakmamak icin eklendi: fail2ban kurulu DEGILDI ve DOCKER-USER zinciri
# BOSTU, ama hicbir sey bunu haber vermiyordu. Sertlestirme "bir kez yapilip
# unutulan" bir is degil — paket guncellemesi sshd drop-in'ini ezebilir,
# biri fail2ban'i durdurabilir.
sertlestirme_sorun=""
[ "$(systemctl is-active fail2ban 2>/dev/null)" = "active" ] || sertlestirme_sorun="$sertlestirme_sorun fail2ban-kapali"
[ -f /etc/ssh/sshd_config.d/99-cheep-hardening.conf ] || sertlestirme_sorun="$sertlestirme_sorun ssh-ayari-yok"
iptables -S DOCKER-USER 2>/dev/null | grep -q "ctstate NEW -j DROP" || sertlestirme_sorun="$sertlestirme_sorun docker-firewall-yok"
# OpenSSH `prohibit-password` degerini ciktida ES ANLAMLISI
# `without-password` olarak yaziyor. Yalnizca birini aramak YANLIS ALARM
# uretiyordu (3 Eki 2026'da uretti). Gevsek olan tek deger `yes`.
sshd -T 2>/dev/null | grep -qiE "^permitrootlogin (prohibit-password|without-password|no)" || sertlestirme_sorun="$sertlestirme_sorun root-login-gevsek"

if [ -z "$sertlestirme_sorun" ]; then
    report "sertlestirme" ok ""
else
    report "sertlestirme" fail "Sunucu sertlestirmesi BOZULMUS:$sertlestirme_sorun

Duzeltmek icin: bash /opt/cheep/deploy/harden.sh"
fi

echo "[$(date -Is)] nöbetçi turu tamam"
