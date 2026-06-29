# 🚀 Cheep — Deploy (DigitalOcean)

Test sunucusu kurulumu: **tek droplet'te Docker Compose** (Postgres + backend API). Kafka yok (HTTP import), scraper sunucuda cron ile, domain yok (Expo Go dev → `http://<IP>:3000`).

## Mimari

```
DigitalOcean Droplet (Ubuntu 24.04)
├── Docker
│   ├── db        (postgres:15.8-alpine, named volume → kalıcı veri)
│   └── backend   (Express API, :3000)  ← migration açılışta otomatik
├── ufw           (yalnızca 22 + 3000 açık; Postgres dışarı kapalı)
└── scraper       (venv + Playwright, cron — opsiyonel)
```

## İlk kurulum (bir kez)

1. Droplet oluştur (öneri: **s-2vcpu-4gb**, FRA1, Ubuntu 24.04 — scraper/chromium aynı kutuda).
2. SSH anahtarını ekle, sunucuya gir.
3. `.env` hazırla:
   ```bash
   mkdir -p /opt/cheep && cd /opt/cheep
   git clone https://github.com/Ruzzyferr/Cheep.git .
   cp deploy/.env.production.example deploy/.env
   nano deploy/.env   # güçlü JWT_SECRET / JWT_REFRESH_SECRET / DB parolası / SMTP / INGEST_API_KEY
   ```
4. Bootstrap:
   ```bash
   bash deploy/bootstrap.sh
   ```
   → Docker + swap + ufw kurar, servisleri build eder, seed atar. Sonunda API adresini yazar.

## Yeniden deploy (geliştirme sonrası)

**Windows'tan tek tık:** repo kökündeki `deploy.bat` → commit + push + sunucuda pull/rebuild.
Gereksinim: `deploy/.droplet-ip` (IP) ve `%USERPROFILE%\.ssh\cheep_deploy` (özel anahtar).

**Sunucuda elle:**
```bash
bash /opt/cheep/deploy/deploy.sh
```

## Scraper (katalog doldurma)

Seed yalnızca demo veri ekler; gerçek katalog scraper ile dolar:
```bash
cd /opt/cheep/Cheep-Scraper
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps chromium
# .env → INGEST_API_KEY (backend ile aynı), BACKEND_URL=http://localhost:3000
PYTHONUTF8=1 python countries/turkey/pipeline.py --ingest
```
Haftalık otomasyon için cron (Pazar 03:00):
```
0 3 * * 0 cd /opt/cheep/Cheep-Scraper && PYTHONUTF8=1 ./venv/bin/python countries/turkey/pipeline.py --ingest >> /var/log/cheep-scrape.log 2>&1
```

## Mobil (Expo Go)

`Cheep-Mobile/.env` → `EXPO_PUBLIC_API_URL=http://<DROPLET_IP>:3000/api/v1`, sonra `npx expo start`.

## 🔐 Güvenlik

- `deploy/.env`, `deploy/.droplet-ip`, SSH anahtarları **asla commit edilmez** (`.gitignore`).
- Postgres dışarı kapalı (yalnızca container ağı). ufw sadece 22 + 3000.
- Domain alınınca: Caddy/Let's Encrypt ile 443 TLS + `ALLOWED_ORIGINS`'e https origin ekle; mobil prod build cleartext http'yi reddeder.
- JWT_SECRET ve JWT_REFRESH_SECRET birbirinden farklı, ≥32 karakter, güçlü rastgele olmalı.
