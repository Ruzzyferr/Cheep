# 🌍 Ülke bazlı scraper mimarisi

Her ülke kendi klasöründe, `config.json` ile yönetilir. Yeni market eklemek için
kod değişikliği gerekmez — scraper'ı yaz, config'e ekle, bitti.

```
countries/
├── _common/                  # ülkeden BAĞIMSIZ ortak altyapı
│   ├── pipeline.py           # scrape → filtre → zenginleştirme → import (+ canlı kapısı)
│   ├── runner.py             # config'ten scraper'ları dinamik yükler
│   ├── foreign_import.py     # backend'e bulk-upsert; EAN doğrulama, kategori eşleme
│   ├── daily_artifact.py     # gün başına TEK indirme (toplu dosya kaynakları için)
│   ├── osm_branches.py       # OpenStreetMap'ten şube konumları
│   └── off_bulk.py           # Open Food Facts EAN zenginleştirmesi
├── turkey/     (TR, canlı)   # devlet API'si (marketfiyati) + OSM şubeler
├── poland/     (PL, canlı)   # doğrudan site + Wolt consumer-api
├── croatia/    (HR)          # yasal zorunlu günlük fiyat listeleri (cijene.dev)
├── hungary/    (HU)          # GVH Árfigyelő zorunlu bildirim (XLSX + JSON API)
├── romania/    (RO)          # Consiliul Concurenței fiyat API'si
├── germany/    (DE)          # hazır ama pilot NO-GO — bkz. docs/GERMANY-STATUS.md
├── sweden/     (SE)          # taslak
└── switzerland/(CH)          # taslak
```

## ⚠️ CANLI KAPISI — varsayılan KAPALI

`config.json`'da **açıkça `"live": true` yazmayan** ülkenin verisi üretime
AKMAZ; `pipeline.py` içe aktarmayı reddeder ve **1 ile çıkar** (yani
`run-daily.sh` `set -e` ile durur, prune tetiklenmez).

```bash
# Yerel doğrulama — YALNIZCA elle, zamanlayıcı bu bayrağı geçmez:
python -m countries._common.pipeline countries/croatia/config.json --allow-unlive
```

Neden: bir ülke üzerinde çalışırken yarım kalmış bir katalog üretime basılırsa
kullanıcı eksik ve yanlış fiyat görür. Almanya bu yüzden kasten kapalı tutuldu.

## 🧭 Fiyat tabanı — ülke seçiminin BİRİNCİ kuralı

**Raf fiyatı çıpası olmayan ülke alınmaz.** Almanya'nın NO-GO gerekçesi buydu:
devlet kaynağı yok → yalnızca teslimat platformu fiyatı → raf fiyatının medyan
%12,5 üstü → indirimci yok → fiyat çıpası yok.

Kaynak tercih sırası:
1. **Devlet zorunluluğu / kamu kurumu yayını** (HR, HU, RO, TR) — tanımı gereği
   raf fiyatı, hukuken temiz, bot koruması yok.
2. **Perakendecinin kendi online mağazası** (PL) — raf fiyatına yakın.
3. **Teslimat platformu** (Wolt) — yalnızca başka yol yoksa ve markup
   ölçülüp belgelenerek.

`robots.txt`'de açıkça yasaklanmış ya da bot koruması aşmayı gerektiren
kaynaklar KULLANILMAZ (İspanya/Portekiz bu yüzden elendi).

## 🏪 Mağaza bazlı fiyat: referans mağaza modeli

Şemada `StorePrice` (mağaza, ürün) çiftine bağlı ve bir zincir TEK satırdır.
Ama bazı ülkelerde fiyat gerçekten mağazadan mağazaya değişiyor (HR Konzum:
ürünlerin yalnızca %26,5'i tüm mağazalarda aynı fiyatta).

Kural: **zincir başına GERÇEK bir referans mağaza seç, onun gerçek raf
fiyatlarını yayınla.** Ortalama/medyan almak, kullanıcının mağazaya gidip
göremeyeceği UYDURMA bir sayı üretir. Seçim DETERMİNİSTİK olmalı — koşudan
koşuya oynarsa fiyat geçmişi ve düşüş bildirimleri yalan söyler.

## 📦 Toplu dosya kaynakları: `daily_artifact`

HR ve HU'da tek bir günlük dosya TÜM zincirleri içeriyor. Zincir başına ayrı
scraper tutuyoruz (store_id market başına atandığı için çöküş kapısı, kategori
süzgeci ve rotasyon zincir bazında çalışsın), ama dosya gün başına **BİR KEZ**
iniyor. Yoksa beş zincir aynı 81 MB'ı beş kez indirir ve — daha kötüsü — arşiv
koşu ortasında güncellenirse zincirler FARKLI günlerin fiyatlarını karıştırır.

## 🔑 Barkodsuz ülkeler: `merge_key`

Marketler arası birleştirme normalde EAN ile yapılır. Romanya'da EAN yok ama
devletin kendi kanonik ürün kimliği (`catprod.id`) var. Scraper bunu
`merge_key` alanıyla iletir; `foreign_import` onu **önekli** olarak
(`"catprod:1016498"`) `ean_barcode`'a yazar — kimse GTIN sanmasın diye.
Benzersizlik kısıtı `(country_id, ean_barcode)` olduğu için başka ülkenin
gerçek EAN'iyla çarpışamaz. Aynı konvansiyon TR'de `mf-` önekiyle kullanılıyor.

**Scraper kendi ürettiği bir hash'i ASLA merge_key olarak yazmamalı** — o zaman
hiçbir şey birleşmez ama birleşmiş gibi görünür.

## ✅ Yeni ülke eklerken

1. `countries/<ülke>/config.json` — `country_code`, `default_unit`,
   `"live": false`, `markets[]` (her birine `store_id`).
2. `scrapers/` — dönen dict: `name, brand, price, quantity, unit, barcode,
   merge_key, image_url, raw_category, sku`.
3. `category_map.json` — ham kategori → kanonik slug.
   **`prefix:` anahtarı bir alt ağacın tamamını kapsar** ve en uzun eşleşen
   önek kazanır; kaynak yeni yaprak eklediğinde ürün kategorisiz kalmaz.
4. `fixtures/` — GERÇEK yakalanmış yanıtlar + `tests/test_<ülke>_*.py`.
5. Şube konumları — kaynak koordinat veriyorsa ondan (`hungary/branches.py`,
   `romania/branches.py`), yoksa OSM'den (`osm_branches.main_for`).
6. `run-daily.sh` / `run-weekly.sh` + systemd timer.
7. Backend: `prisma/seed.ts` (ülke + marketler + **kategori ağacı**),
   `src/config/units.ts` (paket birimi), `category-i18n.ts` (dil),
   `push-copy.ts` (bildirim metni).
8. Uygulama: mobil `utils/geo.ts` `SUPPORTED_COUNTRY_CODES` **en son**, ve
   ancak veri prod'da hazırsa (bkz. o dosyadaki sıra notu).

### Otomatik korumalar
- `tests/test_category_map_integrity.py` — her slug backend taksonomisinde var mı
- `tests/test_common_osm_branches.py` — koordinat/dedup kenar durumları
- `pipeline.should_import` — ürün sayısı çöküşünde import etmez (tavan değerle)
- `pipeline.summary_is_healthy` — beklenen market eksikse prune tetiklenmez
