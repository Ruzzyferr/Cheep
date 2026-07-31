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

# ---------------------------------------------------------------- kontroller

# 1) Container'lar ayakta mı
for c in $CONTAINERS; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ]; then
        report "container-$c" ok ""
    else
        report "container-$c" fail "Container '$c' çalışmıyor."
    fi
done

# 2) API sağlığı — önce iç ağdan (uygulama mı bozuk, ağ mı belli olsun)
if docker exec deploy-backend-1 sh -lc 'node -e "fetch(\"http://127.0.0.1:3000/health\").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"' >/dev/null 2>&1; then
    report "api-internal" ok ""
else
    report "api-internal" fail "Backend /health iç ağdan yanıt vermiyor (uygulama seviyesinde sorun)."
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

# 4) Veritabanı
if docker exec deploy-db-1 sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    report "postgres" ok ""
else
    report "postgres" fail "Postgres pg_isready yanıt vermiyor."
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

echo "[$(date -Is)] nöbetçi turu tamam"
