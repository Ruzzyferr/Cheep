#!/usr/bin/env bash
# Hırvatistan / Macaristan / Romanya günlük fetcher'larını + aylık şube
# tazelemesini systemd'ye kurar.
#
# TR ve PL `install-fetcher.sh` tarafından kuruluyor; bu betik ona DOKUNMAZ.
#
# CANLI KAPISI: bir ülkenin timer'ı, ancak `config.json`'ında
# `"live": true` yazıyorsa ETKİNLEŞTİRİLİR. Sebebi: pipeline canlı olmayan
# ülkede içe aktarımı reddedip 1 ile çıkıyor (bilerek), yani timer etkin
# olsaydı HER GECE başarısız olur, log'u ve nöbetçiyi (watchdog) gereksiz
# alarmla doldururdu. Ülke canlıya alındığında bu betiği tekrar çalıştırmak
# yeterli — idempotent.
#
# Çalıştır: droplet'te  bash /opt/cheep/deploy/install-fetcher-eu.sh
set -euo pipefail

SCRAPER=/opt/cheep/Cheep-Scraper
DEPLOY=/opt/cheep/deploy

mkdir -p "$SCRAPER/logs"

install_country() {
  local code="$1" folder="$2" label="$3"
  local config="$SCRAPER/countries/$folder/config.json"
  local svc="cheep-fetcher-${code}.service"
  local tmr="cheep-fetcher-${code}.timer"

  if [ ! -f "$config" ]; then
    echo "ATLANDI $label: $config yok"
    return
  fi

  chmod +x "$SCRAPER/countries/$folder/run-daily.sh" "$SCRAPER/countries/$folder/run-weekly.sh"
  cp "$DEPLOY/$svc" "/etc/systemd/system/$svc"
  cp "$DEPLOY/$tmr" "/etc/systemd/system/$tmr"

  # `"live": true` var mı? (jq yoksa grep'e düşer — droplet'te jq garanti değil)
  local live="false"
  if command -v jq >/dev/null 2>&1; then
    live="$(jq -r '.live // false' "$config")"
  elif grep -Eq '"live"[[:space:]]*:[[:space:]]*true' "$config"; then
    live="true"
  fi

  if [ "$live" = "true" ]; then
    systemctl enable "$tmr"
    systemctl restart "$tmr"
    echo "ETKİN  $label — $(systemctl show -p NextElapseUSecRealtime --value "$tmr")"
  else
    systemctl disable "$tmr" 2>/dev/null || true
    systemctl stop "$tmr" 2>/dev/null || true
    echo "KURULDU ama KAPALI  $label — config.json'da \"live\": true yok."
    echo "        Canlıya alınca: config'i güncelle + bu betiği tekrar çalıştır."
  fi
}

echo "=== EU fetcher kurulumu ==="
install_country hr croatia  "Hırvatistan"
install_country hu hungary  "Macaristan"
install_country ro romania  "Romanya"

# Şube tazeleme — ülkeden bağımsız, her zaman kurulur. Canlı olmayan ülkenin
# şubelerini yazmak zararsız (fiyat yok, yalnızca konum) ve ülke açıldığında
# şubeler hazır olur.
cp "$DEPLOY/cheep-branches.service" /etc/systemd/system/cheep-branches.service
cp "$DEPLOY/cheep-branches.timer"   /etc/systemd/system/cheep-branches.timer
chmod +x "$DEPLOY/run-branches.sh"

systemctl daemon-reload
systemctl enable cheep-branches.timer
systemctl restart cheep-branches.timer

echo ""
echo "=== Zamanlayıcı tablosu ==="
systemctl list-timers --no-pager 'cheep-*' || true
echo ""
echo "Loglar:  tail -f $SCRAPER/logs/fetcher-{hr,hu,ro}.log"
echo "Şubeler: tail -f $SCRAPER/logs/branches.log"
echo "Tek seferlik elle koşu: bash $SCRAPER/countries/croatia/run-weekly.sh"
