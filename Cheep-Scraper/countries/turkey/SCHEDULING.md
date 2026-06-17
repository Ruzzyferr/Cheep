# Haftalık Otomatik Scraping (Türkiye)

Marketler **her pazar gecesi** otomatik scrape edilip eşleştirilir. Tek komut:

```bash
python countries/turkey/pipeline.py            # scrape + sınıflandır + eşleştir
python countries/turkey/pipeline.py --ingest   # + backend'e yükle (Faz 3)
```

Bu; Migros, ŞOK, A101'i çeker → kanonik taksonomiye sınıflar → aynı isim+gramaj
ürünleri tek kanonik ürüne gruplar (market market fiyatlarla) → `output/matched_*.json`.

## Sunucuda cron (Linux) — Pazar 03:00 (Europe/Istanbul)

`run-weekly.sh` çalıştırılabilir yapın ve crontab'a ekleyin:

```bash
chmod +x countries/turkey/run-weekly.sh
crontab -e
```

```cron
# Pazar gecesi 03:00 (TZ satırı cron'un saat dilimini sabitler)
CRON_TZ=Europe/Istanbul
0 3 * * 0  /opt/cheep/Cheep-Scraper/countries/turkey/run-weekly.sh >> /opt/cheep/Cheep-Scraper/countries/turkey/output/weekly.log 2>&1
```

`0 3 * * 0` = her **Pazar** saat **03:00**. Yolu sunucudaki gerçek konuma göre düzeltin.

## Alternatif: systemd timer

```ini
# /etc/systemd/system/cheep-scrape.timer
[Unit]
Description=Cheep weekly scrape
[Timer]
OnCalendar=Sun *-*-* 03:00:00 Europe/Istanbul
Persistent=true
[Install]
WantedBy=timers.target
```
```ini
# /etc/systemd/system/cheep-scrape.service
[Unit]
Description=Cheep weekly scrape
[Service]
Type=oneshot
ExecStart=/opt/cheep/Cheep-Scraper/countries/turkey/run-weekly.sh
```
```bash
systemctl enable --now cheep-scrape.timer
```

## Alternatif: backend node-cron

Backend zaten Node. `node-cron` ile `cheep-backend-express` içinden tetiklenebilir:

```ts
import cron from "node-cron";
import { execFile } from "node:child_process";
// Pazar 03:00 Istanbul
cron.schedule("0 3 * * 0", () => {
  execFile("bash", ["../Cheep-Scraper/countries/turkey/run-weekly.sh"]);
}, { timezone: "Europe/Istanbul" });
```

## Notlar
- A101 Playwright (Cloudflare) ister → sunucuda `playwright install chromium` + (headless) bağımlılıkları kurulu olmalı.
- İnsan-temposu gecikmeler korunur; tüm hasat ~10-20 dk sürer.
- Eşleştirme deterministik ve gramaj-güvenli (farklı boyut asla birleşmez).
