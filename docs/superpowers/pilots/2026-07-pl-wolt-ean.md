# PL — Wolt Kaynakları + EAN Harvest (Faz 3)

**Tarih:** 2026-07-11 · **Dal:** main · **Commit aralığı:** f129221..4c66b5a

## Özet

Faz 2'de katalog 202 → 23.420 ürüne çıkmıştı ama **karşılaştırılabilir ürün yalnızca 240**'tı — çünkü discounter'lar barkod yayınlamıyor, eşleştirme zayıf. Faz 3 bu darboğazı çözdü.

## 1. Kaynak değişimi — Wolt (Żabka + Carrefour)

Derin araştırma + teknik keşifle Wolt'un tüketici API'si (`consumer-api.wolt.com`, kimlik doğrulaması yok) tam katalog + **barkod** taşıdığı bulundu.

| Zincir | Önce | Sonra | Barkod |
|---|---|---|---|
| Carrefour (40) | 0 (Cloudflare engelli) | **9.183** (filtreli) | %99,6 |
| Żabka (47) | 8 (ana sayfa karuseli) | **1.995** (filtreli) | %98,6 |

- **Carrefour:** doğrudan sitesi Cloudflare'e takılıydı, hiç veri yoktu; Wolt tam hipermarketi açtı (11.622 ham → 9.183 gıda, gıda-dışı departmanlar `category_deny_prefixes` ile elendi).
- **Żabka:** sitesi katalog yayınlamıyordu; Wolt'taki Jush dark-store'u gerçek katalogu veriyor.
- **Karar:** Auchan + Biedronka doğrudan scraping'de kaldı — Wolt fiyatı *teslimat* fiyatı (raf değil) ve teslimat kataloğu daha dar; bizde bu iki zincir zaten doğrudan gerçek raf fiyatıyla var.

## 2. EAN Harvest — barkodu barkodsuz zincirlere taşıma

Wolt zincirleri ~10.5k barkod getirdi ama Auchan (22k) ve Biedronka (1.5k) barkodsuzdu. Çözüm: barkodlu bir üründen, aynı ürün olduğu kanıtlanan barkodsuz ürüne **barkod ödünç ver** (marka+isim+**tam gramaj** tek bir barkodlu ürünle eşleşirse).

- Dry-run: 1.279 aday atama (Auchan 1.100, Biedronka 304).
- **İki bağımsız hakem ajanı 1.279 atamayı tek tek denetledi: 1.271 doğru, 8 yanlış.** Yakalanan 8 tam beklenen tuzaklar: promosyon paketi (330g↔"330g+30g 360g"), çöp poşeti adet farkı (10↔12), bebek maması ay farkı (9↔11), 2w1↔3w1, un tipi (480↔00), catering paketi.
- 8 yanlış `--exclude-file` ile hariç tutuldu; kalan **1.271 barkod atandı ve 1.271 birleşme yapıldı**, 0 kısıt ihlali.

## Sonuç

| Metrik | Faz 2 | Faz 3 |
|---|---|---|
| Toplam PL ürün | 23.420 | **32.695** |
| Gerçek barkodlu | ~0 | **~10.5k** |
| **Karşılaştırılabilir (≥2 mağaza)** | **240** | **1.861** |
| ≥3 mağaza | ~0 | 257 |
| ≥4 mağaza | 0 | 24 |
| Mükerrer EAN / mojibake | 0 | **0** |

Gerçek karşılaştırma örnekleri (uygulamanın varlık sebebi):
- Jacobs Krönung 250g: **Carrefour 19,99** · Auchan 25,58 · Biedronka 25,99
- Dr.Oetker Śmietan-fix 9g: **Biedronka 0,75** · Auchan 0,89 · Carrefour 1,55
- Heinz Ketchup łagodny 450g: **Auchan 9,38** · Biedronka 9,49 · Carrefour 10,89

## Bilinen sınırlar / takip işleri

- **EAN harvest henüz pipeline'a bağlı değil** — tek seferlik script (`scripts/harvest-ean.ts`). Haftalık tazeleme sonrası yeni ürünlerin de barkod kazanması için ingest döngüsüne eklenmeli (release checklist'e not eklendi). Dry-run + audit deseni her koşuda tekrarlanmalı ya da güven eşiği yükseltilmeli.
- Wolt API'si undocumented — şema değişirse scraper güncellenmeli (slug churn'e karşı yeniden-keşif fallback'i var, şema churn'e yok).
- Wolt tek Varşova venue'suna sabit (fiyat kapsamı tek mağaza) — Żabka/Carrefour fiyatları bölgesel değişebilir.
- Lidl 64 ürün (yapısal: online sadece broşür gıdası) — delivery platformlarında Lidl yok. Broşür scraping ayrı iş.
- Alkol kategorisi `diger`'e düşüyor — ürün kararı bekliyor.
