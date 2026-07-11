# PL Katalog Genişletme — Faz 2 Raporu

**Tarih:** 2026-07-11 · **Dal:** main · **Commit aralığı:** b44f713..5d22630

## Sonuç

| Zincir | Pilot | Faz 2 | Nasıl |
|---|---|---|---|
| Auchan (41) | 99 | **22.105** | SPA'nın JS bundle'ından gerçek endpoint çıkarıldı (`/v6/product-pages` + `/v1/categories`); CSRF gerekmiyor. 11 departman → tüm alt ağaç. |
| Biedronka (44) | 36 | **1.481** | sitemap → 244 leaf kategori + sayfalama (`?page=N`, `data-has-next`). |
| Lidl (45) | 59 | **64** | `/q/api/search` JSON API'si bulundu (6.308 ürün) — ama Lidl PL online'da yalnızca haftalık broşür gıdasını fiyatlıyor; kalan ~6,1k dayanıklı tüketim (giyim/alet) → gıda filtresiyle elendi. |
| Żabka (47) | 8 | 8 | Site katalog yayınlamıyor (yalnızca ana sayfa karuseli). Yapısal sınır. |
| **Toplam** | **202** | **23.420** | |

**Karşılaştırılabilir (çok-mağazalı) ürün: 126 → 240.**

## Kalite (sıfır-hata korundu)

- Mükerrer fingerprint: **0** · Mojibake: **0** · Başarısız ingest: **0** (24.139 satır)
- Kategorilendirme: %87,8 (2.853 kategorisiz — ağırlıkla belirsiz kalması bilinçli tercih edilen ham kategoriler)
- Teklif kuyruğu: 4.212 teklif → 216'sı gerçek aday (mağazalar-arası + aynı gramaj) olarak süzüldü, iki bağımsız hakem tarafından tek tek değerlendirildi → **114 onay, geri kalan red**. Hakemin kendi "şüpheli" dediği 4 onay da zorla reddedildi. Kuyrukta bekleyen: 0.
- Reddedilenlerin tipik gerekçesi: farklı gramaj (500g↔700g), farklı varyant (Sensitive↔Normal, gazlı↔gazsız), farklı aroma (biri "mango"lu diğeri değil), farklı alt-marka hattı (Skyr ↔ Skyr *pitny*).

## Gıda-dışı filtre

Auchan'dan 1.449 ürün (LEGO/oyuncak, kırtasiye, oto bakım, ev tekstili), Lidl'den ~6,25k dayanıklı ürün ingest'ten önce elendi — `config.json`'daki `category_allow_prefixes`/`category_deny_prefixes` ile, breadcrumb önekleri üzerinden. Kategori haritalaması da 2.663 ayrı girdi yerine **önek kuralları** ile yapıldı.

## EAN denemesi — dürüst sonuç

Open Food Facts'in **tam veri seti** (4,5M satır) indirilip Polonya alt kümesi yerel SQLite indeksine çıkarıldı (34.629 PL etiketli satır → 10.873 tekil anahtar; 265 belirsiz anahtar sıfır-hata kuralıyla dışlandı). Gerçek katalog üzerinde çalıştırıldı:

- Auchan: 16 / 22.585 (%0,07) · Biedronka: 8 / 1.500 (%0,53) · Lidl: 0 / 54

**Sonuç: OFF'un Polonya kapsamı gerçekten zayıf; EAN Polonya için işe yarar bir kaldıraç değil.** Kod kalıcı (indeks 30 günde bir tazeleniyor, OFF kapsamı büyürse otomatik faydalanırız) ama mağazalar-arası eşleştirme pratikte isim+marka+gramaj fingerprint'ine ve inceleme kuyruğuna dayanacak.

## Kendini tazeleme (Türkiye tarzı hafta yayılımı)

Tek gecede her şeyi taramak yerine günlük rotasyon (`run-daily.sh`, systemd timer her gün 03:00):

| Pzt | Sal | Çar | Per | Cum | Cmt | Paz |
|---|---|---|---|---|---|---|
| Auchan | Biedronka | Lidl+Żabka | Auchan | Biedronka | Lidl+Żabka | (dinlenme) |

Her zincir haftada ~2 kez tazelenir, hiçbir siteye tek gecede yığılma olmaz. Korumalar aynen devrede: zincir-başına ürün-sayısı çöküşü koruması, başarısız koşuda temizliğin atlanması, nezaket gecikmeleri. `run-weekly.sh` elle tam tarama için duruyor.

## Bilinen sınırlar

- **Żabka 8 ürün:** sitesi katalog yayınlamıyor. Jush teslimat uygulamasının API'si tek yol — ayrı bir iş.
- **Lidl 64 ürün:** online'da sadece broşür gıdası fiyatlanıyor; haftalık dönüyor (ürünler her hafta değişir, bu normal).
- **Karşılaştırılabilir 240 ürün:** Auchan hipermarket kataloğu (22k) ile discounter'ların özel-markalı katalogları arasında doğal örtüşme sınırlı. Örtüşme, discounter kapsamı büyüdükçe artar.
- Alkol kategorisi `diger`'e düşüyor (taksonomide karşılığı yok) — ürün kararı bekliyor.
