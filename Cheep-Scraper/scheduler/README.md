# Cheep scraper — droplet scheduler

## TÜRKİYE (birincil) — sürdürülebilir fetch daemon 🇹🇷

TR kataloğu resmi devlet API'sinden (marketfiyati.org.tr) **sürekli, nazik bir
systemd daemon** ile tazelenir — eski "Pazar sprint" cron'unun yerine geçer.

Neden daemon: WAF tek IP'yi burst'te banlıyor. Daemon **AIMD rate-shaping** ile
ban eşiğinin altında sabit hızda akıtır; durumu SQLite'ta **kalıcı** tutar
(`mf_state.db`, asla wipe); işi **artımlı** yapar:
- **yeni** ürünler (sitemap-diff) → hemen çekilir,
- **fiyatlı** ürünler → haftalık rotasyon (`--priced-ttl 604800`),
- **boş** ürünler (şu an fiyatsız gerçek ürünler) → aylık rotasyon
  (`--empty-ttl 2592000`) — ASLA kalıcı atlanmaz, restock yakalanır.

Çözülen ham JSON `mf_raw/`'a yazılır, küçük gruplar hâlinde backend'e ingest edilir.

### Kurulum (droplet, root)
```
bash /opt/cheep/deploy/install-fetcher.sh     # önce category_map.json olmalı (ilk seed)
tail -f /opt/cheep/Cheep-Scraper/logs/fetcher.log
systemctl status cheep-fetcher
```
Servis: `deploy/cheep-fetcher.service` (Restart=always, Nice=10, EnvironmentFile=deploy/.env).

### İlk (soğuk) kurulum akışı
```
# 1) TAM fetch (ham JSON) — mf_fetch.py, iki IP'ye bölünebilir (paralel)
python countries/turkey/mf_fetch.py --raw-dir mf_raw --empty-file mf_empty.txt
# 2) taksonomi + wipe + seed + ingest
python countries/turkey/mf_taxonomy.py --raw-dir mf_raw --out taxonomy.json
psql ... -f countries/turkey/rebuild_wipe.sql
python countries/turkey/mf_seed_categories.py   # → category_map.json
python countries/turkey/mf_ingest.py --raw-dir mf_raw
# 3) daemon'ı kur (steady-state devralır; mf_raw+empty'yi state'e bootstrap eder)
bash /opt/cheep/deploy/install-fetcher.sh
```

## Yabancı ülkeler (CH/SE/DE/PL) — legacy weekly (opsiyonel)
`run_weekly.sh` artık **manuel/legacy** bir araçtır; TR daemon birincil yoldur.
Yabancı ülke pipeline'ı gerekiyorsa ayrıca çalıştırılır.

## Notlar
- Backend `CHEEP_API_URL`'den erişilebilir olmalı (aynı host → localhost:3000).
- Sırlar yalnız `/opt/cheep/deploy/.env` içinde. `INGEST_API_KEY` sızarsa döndür.
- İdeal uzun-vade: TÜBİTAK/Ticaret Bakanlığı'ndan resmi toplu/allowlist erişim →
  bloklu facet endpoint açılır, tüm katalog ~dakikalar içinde çekilir.
