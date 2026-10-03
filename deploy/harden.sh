#!/usr/bin/env bash
# ============================================================================
# Cheep — sunucu sertleştirme. IDEMPOTENT: tekrar tekrar çalıştırılabilir.
#
# NEDEN DEPODA: sunucuda elle yapılan her ayar, bir sonraki yeniden kurulumda
# ya da birinin "temizlik" yapmasında sessizce kaybolur. Burada durursa
# `deploy.sh` ile birlikte her dağıtımda yeniden uygulanır.
#
# 3 Ekim 2026 denetiminde ölçülenler:
#   • 17.414 başarısız SSH denemesi (tek IP'den 2.233) — hiç yavaşlatılmıyordu
#   • 170 web sondası (/.env ×30, /.git/config ×7) — hepsi 404, ama loglanmıyordu
#   • PermitRootLogin yes, X11Forwarding yes, MaxAuthTries 6
#   • DOCKER-USER zinciri BOŞ — ileride biri port yayınlarsa hiçbir savunma yok
#
# ⚠️ KENDİNİ KİLİTLEME KORUMASI: SSH yapılandırması `sshd -t` ile DOĞRULANMADAN
# uygulanmaz ve `reload` kullanılır (`restart` değil) — açık oturumlar düşmez.
#
# Çalıştır: bash /opt/cheep/deploy/harden.sh
# ============================================================================
set -uo pipefail   # -e YOK: bir adımın patlaması diğerlerini engellememeli

LOG() { echo "[$(date -Is)] $*"; }
HATA=0

# `--sadece-firewall`: yalnizca acilista kaybolan seyleri uygular (iptables +
# sysctl). SSH ve fail2ban ZATEN DISKTE KALICI; acilista onlara dokunmanin
# hicbir faydasi yok, zarari ise 3 Eki 2026'da goruldu (asagiya bak).
SADECE_FIREWALL=0
[ "${1:-}" = "--sadece-firewall" ] && SADECE_FIREWALL=1

# ---------------------------------------------------------------- 1) fail2ban
# 17.414 başarısız denemenin tek bir engeli yoktu. Parola girişi kapalı olduğu
# için giremezler, ama her deneme sshd'yi meşgul eder ve logu şişirir.
if [ "$SADECE_FIREWALL" = "0" ]; then
LOG "1/4 fail2ban"
if ! dpkg -l fail2ban 2>/dev/null | grep -q '^ii'; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban >/dev/null 2>&1 \
        && LOG "   kuruldu" || { LOG "   KURULAMADI"; HATA=1; }
fi

# `ignoreip`: kendimizi ve özel ağları asla engelleme.
# BENİM ÇIKIŞ IP'M BURADA DEĞİL — bilerek: dinamik IP'yi dosyaya gömmek,
# IP değiştiğinde yanlış güvenlik hissi verir. Anahtarla giriş zaten
# fail2ban'i tetiklemez (başarılı kimlik doğrulama sayılmaz).
install -d -m 755 /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/cheep.conf <<'CONF'
[DEFAULT]
# Ubuntu 24.04'te auth.log yerine journald kullanılıyor; `backend = systemd`
# olmadan fail2ban hiçbir şey görmez ve SESSİZCE çalışır gibi görünür.
backend  = systemd
ignoreip = 127.0.0.1/8 ::1 172.16.0.0/12 10.0.0.0/8
bantime  = 1h
findtime = 10m
maxretry = 5
# Tekrar eden saldırgan için ceza katlanarak artar (1sa → 2sa → 4sa …).
bantime.increment = true
bantime.factor    = 2
bantime.maxtime   = 1w

[sshd]
enabled = true
port    = ssh
maxretry = 4

# WEB SONDALARI. 48 saatte 170 istek: /.env x30, /.git/config x7, wp-admin,
# phpmyadmin... Hepsi 404 aliyor ama deneyen taramaya devam ediyor. Caddy
# GERCEK istemci IP'sini logluyor (dogrulandi: Googlebot ve kullanici IP'leri
# goruluyor, Docker ag adresi degil), dolayisiyla engelleme ise yarar.
[cheep-web-sonda]
enabled  = true
backend  = polling
port     = http,https
logpath  = /var/lib/docker/volumes/deploy_caddy_logs/_data/*.log
filter   = cheep-web-sonda
maxretry = 3
findtime = 10m
bantime  = 24h
CONF

# Caddy JSON log bicimi: "client_ip" alani "uri"den ONCE geliyor.
cat > /etc/fail2ban/filter.d/cheep-web-sonda.conf <<'FILTRE'
[Definition]
failregex = ^.*"client_ip":"<HOST>".*"uri":"/(\.env|\.git|\.aws|\.ssh|wp-admin|wp-login|phpmyadmin|xmlrpc|vendor/|cgi-bin|boaform|\.well-known/.*\.php)
ignoreregex =
FILTRE
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl reload fail2ban >/dev/null 2>&1 || systemctl restart fail2ban >/dev/null 2>&1
LOG "   durum: $(systemctl is-active fail2ban)"

# ---------------------------------------------------------------- 2) SSH
LOG "2/4 SSH sertleştirme"
# DROP-IN dosya: ana sshd_config'e dokunmuyoruz, geri almak tek `rm`.
cat > /etc/ssh/sshd_config.d/99-cheep-hardening.conf <<'CONF'
# Cheep sertleştirme — geri almak için bu dosyayı silip `systemctl reload ssh`.

# Parola girişi zaten kapalıydı; root yalnızca ANAHTARLA girebilsin.
# `yes` ile aradaki fark pratikte küçük ama saldırı yüzeyini daraltıyor.
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no

# 6 deneme, kaba kuvvet için fazla cömert.
MaxAuthTries 3
MaxSessions 5
LoginGraceTime 30

# Kullanılmıyor; açık bırakmanın tek etkisi saldırı yüzeyi.
X11Forwarding no
AllowAgentForwarding no

# Ölü oturumlar temizlensin (kaynak ve oturum çalma penceresi).
ClientAliveInterval 300
ClientAliveCountMax 2
CONF

# ⚠️ ASLA DOĞRULAMADAN RELOAD ETME — ama BASARISIZLIKTA DA SILME.
#
# Ilk surumde `sshd -t` basarisiz olunca dosya SILINIYORDU. 3 Eki 2026
# reboot'unda tam bu oldu: acilista `sshd -t` GECICI olarak dustu, betik
# sertlestirmeyi sildi ve sunucu `PermitRootLogin yes` ile acildi. Ayni komut
# 30 saniye sonra sorunsuz geciyordu. Yani "guvenli" sanilan davranis,
# guvenlik ayarini sessizce KALDIRIYORDU.
#
# Artik: bir kez bekleyip TEKRAR dene; yine olmazsa dosyayi silme, KENARA AL
# (.devredisi) ki ne oldugu gorulebilsin ve elle geri konabilsin.
SSH_DROPIN=/etc/ssh/sshd_config.d/99-cheep-hardening.conf
if ! sshd -t 2>/dev/null; then
    sleep 3
fi
if sshd -t 2>/dev/null; then
    systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null
    LOG "   uygulandı (reload — açık oturumlar korundu)"
else
    mv -f "$SSH_DROPIN" "$SSH_DROPIN.devredisi" 2>/dev/null
    LOG "   SÖZDİZİMİ DOĞRULANAMADI — ayar KENARA ALINDI ($SSH_DROPIN.devredisi), silinmedi"
    LOG "   sebep: $(sshd -t 2>&1 | head -1)"
    HATA=1
fi

fi   # SADECE_FIREWALL

# ------------------------------------------------- 3) DOCKER-USER (derinlik)
# Docker, ufw'yi ATLAYARAK iptables'a kendi zincirini ekler. Bugün yalnızca
# 80/443 yayında, ama biri yarın `ports: 5432:5432` yazarsa ufw "deny" derken
# port tüm internete açılır. Bu kural o hatayı ağ katmanında yakalar.
#
# YALNIZCA public arayüzden gelen YENİ bağlantılar kısıtlanıyor:
# konteynerler arası trafik ve giden bağlantılar (Resend, AI Gateway, mağaza
# API'leri) ETKİLENMEZ — blanket DROP koysaydık uygulama dışarı çıkamazdı.
LOG "3/4 DOCKER-USER"
IFACE=$(ip -4 route show default | awk '{print $5; exit}')
if [ -n "${IFACE:-}" ]; then
    iptables -F DOCKER-USER 2>/dev/null
    iptables -A DOCKER-USER -i "$IFACE" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
    iptables -A DOCKER-USER -i "$IFACE" -p tcp -m multiport --dports 80,443 -j RETURN
    iptables -A DOCKER-USER -i "$IFACE" -p udp --dport 443 -j RETURN
    iptables -A DOCKER-USER -i "$IFACE" -m conntrack --ctstate NEW -j DROP
    iptables -A DOCKER-USER -j RETURN
    LOG "   arayüz $IFACE — 80/443 dışı yeni gelen bağlantılar DROP"
    # KALICILIK: `iptables-persistent` BU IS ICIN YANLIS ARAC. O, kurallari
    # acilista erkenden geri yukluyor — ama DOCKER-USER zincirini DOCKER
    # olusturuyor ve o an henuz yok; geri yukleme sessizce basarisiz oluyor.
    # Dogru cozum: docker'dan SONRA calisan bir systemd birimi.
    cat > /etc/systemd/system/cheep-docker-firewall.service <<'UNIT'
[Unit]
Description=Cheep - DOCKER-USER guvenlik duvari kurallari
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash /opt/cheep/deploy/harden.sh --sadece-firewall

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload >/dev/null 2>&1
    if systemctl enable cheep-docker-firewall.service >/dev/null 2>&1; then
        LOG "   acilista yeniden uygulanacak (cheep-docker-firewall.service)"
    else
        LOG "   KALICILASTIRILAMADI"; HATA=1
    fi
else
    LOG "   public arayüz bulunamadı, atlandı"; HATA=1
fi

# ------------------------------------------------------ 4) çekirdek sıkılaştırma
LOG "4/4 sysctl"
cat > /etc/sysctl.d/99-cheep-hardening.conf <<'CONF'
# Sahte kaynak adresli paketleri reddet.
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
# ICMP yönlendirme kabul etme (MITM yolu).
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
# Kaynak yönlendirmeli paketler.
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
# SYN flood.
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
# Garip paketleri logla.
net.ipv4.conf.all.log_martians = 1
# Çekirdek işaretçilerini sızdırma.
kernel.kptr_restrict = 2
# Diğer kullanıcıların süreçlerini görme (konteyner kaçışı keşfini zorlaştırır).
kernel.dmesg_restrict = 1
CONF
sysctl -p /etc/sysctl.d/99-cheep-hardening.conf >/dev/null 2>&1 \
    && LOG "   uygulandı" || { LOG "   BAZI DEĞERLER UYGULANAMADI"; HATA=1; }

echo
LOG "bitti (hata kodu: $HATA)"
exit $HATA
