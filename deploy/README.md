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

## Otomatik çalışan işler

| Ne | Ne zaman | Ne yapar |
|---|---|---|
| `cheep-fetcher` | sürekli (daemon) | TR kataloğunu devlet API'sinden çeker; ~5-6 günde tam tur |
| `cheep-fetcher-pl` | her gece 03:00 | PL zincir rotasyonu (Pazar dinlenme), bayat fiyat temizliği |
| `cheep-taxonomy` | **Pazar 01:30** | Devlet taksonomisini ham veriden yeniden türetir, yeni kategorileri açar, `category_map.json`'u yeniler, deterministik onarımları uygular, sağlık raporu basar |
| `cheep-site-build` | her gece 04:00 | Siteyi taze fiyatlarla yeniden üretir |
| `cheep-price-drops` | (kendi timer'ı) | Fiyat düşüşü bildirimleri |
| `cheep-backup` | (kendi timer'ı) | Veritabanı yedeği |

Kurulum: `sudo bash deploy/install-taxonomy.sh` (diğerleri için `install-*.sh`).

### Taksonomi tazeleme neden gerekli

Fetch daemon'ı `category_map.json`'u DONMUŞ bir dosya olarak okuyor. Devlet
yeni bir kategori açtığında o kategorinin ürünleri sonsuza kadar "Diğer"e
düşüyordu — taksonomi ham veriden türetilebilir olduğu hâlde yalnızca bir kez,
elle türetilmişti. Haftalık iş bu döngüyü kapatır.

Zamanlama tesadüf değil: Pazar, PL rotasyonunun dinlenme günü (çakışma yok) ve
01:30, PL pipeline'ından (03:00) ve site üretiminden (04:00) önce — yeni
kategoriler o gecenin ingest'ine ve site build'ine yetişir.

**İkiz birleştirme otomatik YAPILMAZ.** Haftalık iş `--safe-only` ile çalışır:
ülke ayrıştırma, kırık parent bağı, ASCII slug ve ürünsüz kategori silme gibi
deterministik onarımları uygular. İki meşru kategoriyi birleştirmek geri
alınamaz ve karar sezgisel bir benzerlik eşiğine dayanıyor; bulunan ikizler
loga yazılır, onaylarsanız elle çalıştırırsınız:

```bash
docker exec deploy-backend-1 npx tsx scripts/reconcile-taxonomy.ts            # kuru çalışma
docker exec deploy-backend-1 npx tsx scripts/reconcile-taxonomy.ts --apply
```

### Sağlık raporu

```bash
docker exec deploy-backend-1 npx tsx scripts/taxonomy-health.ts
tail -60 /var/log/cheep-taxonomy.log     # haftalık işin çıktısı
```

Şunları görünür kılar — hiçbiri hata vermiyor, aylar sonra fark ediliyordu:

- **Kategorisiz ürün**: PL scraper'ı eşlenmemiş bir kategori getirdiğinde ürün
  kategorisiz kaydediliyor ve hiçbir listede görünmüyor. Eşlenmeyen ham
  kategori adları PL günlük koşusunun logunda da listelenir
  (`logs/fetcher-pl.log`), `countries/poland/category_map.json`'a eklenir.
- **"Diğer" payı**: %15'i aşarsa kaynak yeni bir kategori açmış olabilir.
- **Çevrilmemiş kategori**: `src/config/category-i18n.ts`'e eklenmemiş kategori
  beş dilde birden Türkçe adıyla çıkar. Kırılma değil ama kalıcılaşır; rapor
  eklenecek satırı hazır verir.

## Zorunlu güncelleme kapısı

Mobil uygulama açılırken `GET /api/v1/app/version` çağırır ve iki eşiğe bakar.
Değerler `deploy/.env` içinde; **kod değişikliği gerekmez, container restart
yeter**:

```bash
ANDROID_MIN_SUPPORTED_VERSION=1.2.0   # bunun ALTINDAKİ sürüm KİLİTLENİR
ANDROID_LATEST_VERSION=1.4.0          # mağazadaki güncel sürüm (yumuşak uyarı)
IOS_MIN_SUPPORTED_VERSION=            # iOS henüz yayında değil
IOS_LATEST_VERSION=
```

**Nasıl kullanılır**

- Normal sürüm çıkışı: yalnızca `*_LATEST_VERSION`'ı yükselt. Kullanıcı
  kapatılabilir bir "yeni sürüm var" bildirimi görür, uygulamayı kullanmaya
  devam eder.
- Kritik hata / kırıcı API değişikliği: `*_MIN_SUPPORTED_VERSION`'ı da
  yükselt. Eski sürümdeki herkes kilitlenir ve yalnızca Play'e gidebilir.

**Neden iki ayrı eşik:** Play kademeli yayında güncellemeyi önce %20'ye açar.
Tek eşik olsaydı kalan %80 uygulamayı kullanamaz ama güncelleyemezdi de —
mağazada henüz yeni sürüm görünmüyor. Kademeli yayın %100'e ulaştıktan sonra
`MIN_SUPPORTED`'ı yükseltmek güvenli.

**Değişkenler boşsa kimse kilitlenmez.** Kapı bilerek hata affedici: sunucuya
ulaşılamazsa, eşik boşsa ya da sürüm okunamazsa uygulama açılır. Yanlış bir
env değeriyle tüm kullanıcı tabanını dışarıda bırakmak, güncel olmayan bir
istemcinin bir gün daha çalışmasından çok daha kötü.

## Mobil (Expo Go)

`Cheep-Mobile/.env` → `EXPO_PUBLIC_API_URL=http://<DROPLET_IP>:3000/api/v1`, sonra `npx expo start`.

## 🔐 Güvenlik

- `deploy/.env`, `deploy/.droplet-ip`, SSH anahtarları **asla commit edilmez** (`.gitignore`).
- Postgres dışarı kapalı (yalnızca container ağı). ufw sadece 22 + 3000.
- Domain alınınca: Caddy/Let's Encrypt ile 443 TLS + `ALLOWED_ORIGINS`'e https origin ekle; mobil prod build cleartext http'yi reddeder.
- JWT_SECRET ve JWT_REFRESH_SECRET birbirinden farklı, ≥32 karakter, güçlü rastgele olmalı.
