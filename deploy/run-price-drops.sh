#!/usr/bin/env bash
# ============================================================
# Fiyat düşüşü tespitini tetikler (systemd timer'dan çağrılır).
#
# Backend portu host'a AÇIK DEĞİL — compose'da yalnızca `expose: 3000` var,
# host'ta sadece Caddy 80/443 dinliyor. Bu yüzden istek konteynerin İÇİNDEN
# atılıyor; hem ingest anahtarı hiç dışarı çıkmıyor hem de Caddy/TLS/rate-limit
# katmanına gereksiz bir tur atılmıyor.
#
# İmajda curl/wget yok (slim node tabanı) — Node 20'nin yerleşik fetch'i
# kullanılıyor.
# ============================================================
set -euo pipefail

ENV_FILE=/opt/cheep/deploy/.env
COMPOSE=/opt/cheep/deploy/docker-compose.prod.yml

KEY=$(grep '^INGEST_API_KEY=' "$ENV_FILE" | cut -d= -f2-)
[ -n "$KEY" ] || { echo "$(date -Is) INGEST_API_KEY bulunamadı"; exit 1; }

# Konteyner adını compose'dan çöz; ad şeması değişirse de çalışsın.
CID=$(docker compose -f "$COMPOSE" ps -q backend 2>/dev/null || true)
[ -n "$CID" ] || CID=deploy-backend-1

docker exec -e KEY="$KEY" "$CID" node -e '
fetch("http://127.0.0.1:3000/api/v1/notifications/detect", {
  method: "POST",
  headers: { "x-api-key": process.env.KEY },
})
  .then((r) =>
    r.text().then((t) => {
      console.log(new Date().toISOString(), "HTTP", r.status, t.slice(0, 400));
      if (!r.ok) process.exit(1);
    }),
  )
  .catch((e) => {
    console.log(new Date().toISOString(), "hata:", e.message);
    process.exit(1);
  });
'
