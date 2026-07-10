# PL Pilot — Sıfır-Hata Kapısı Denetimi

**Tarih:** 2026-07-11 · **Ortam:** lokal (docker cheep-postgres + dev backend) · **Kapsam:** 4 zincir tam canlı koşu

## Sonuç: KAPI GEÇİLDİ ✅ (0 yanlış birleşme)

Son koşu (iterasyon 4): **202 ürün scrape → 202 import, 0 hata.**
Auchan 99 · Biedronka 36 · Lidl 59 · Żabka 8. Ürün sayısı birleşmeler sonrası: 194.

## Birleşen grupların tam denetimi (4/4 doğrulandı)

| Ürün | Mağazalar | Fiyatlar | Kanıt | Karar |
|---|---|---|---|---|
| Łaciate Mleko 1L | Carrefour + Auchan | 3.49 / 3.29 | Seed (EAN) | ✅ seed verisi |
| Masło ekstra Polskie 82% Mlekovita 200g | Biedronka + Auchan | 5.99 / **2.98 (promo, orij. 5.98)** | fingerprint + elle onay #54 | ✅ aynı ürün |
| Mleko zagęszczone niesłodzone 7,5% Gostyńskie 500g | Biedronka + Auchan | 5.75 / 4.95 | fingerprint + elle onay #51 | ✅ aynı ürün |
| Wypasione mleko UHT 2% Mlekovita 1l | Biedronka + Auchan | 4.29 / 4.28 | fingerprint + elle onay #49 | ✅ aynı ürün |

Teklif kuyruğu: 25 teklif elle incelendi → 3 onay (yukarıda), 22 red (farklı yağ oranı / gramaj / varyant: gazlı-gazsız su, füme-sade peynir, 10-24 rulo vb.). Bekleyen: 0.

## Kalite metrikleri

- Yanlış birleşme: **0** (tüm çok-mağazalı gruplar elle doğrulandı)
- Mükerrer fingerprint ürün seti: **0**
- Mojibake isim: **0**
- Kategorisiz: **8/194** — tamamı Żabka (site kategorisi yapısal olarak yok; bilinen boşluk, ayrı iş)
- OFF EAN zenginleştirme: ~3 ürün (OFF arama API'si hız sınırlıyor; hatalar cache'lenmiyor, sonraki koşularda tekrar denenir — eşleştirme fingerprint kademesiyle çalışıyor)

## Pilot sırasında bulunan ve düzeltilen hatalar

1. **Żabka UTF-8** (`c5a661d`) — sunucu charset bildirmiyor, ISO-8859-1 mojibake parse'ı sıfırlıyordu.
2. **Yağ-yüzdesi fingerprint'te yoktu** (`08cbb05`) — %3,2 ve %1,5 süt aynı fingerprint'e çakışıyordu (yanlış birleşme riski; kaza eseri unique constraint engellemişti). Artık `%<n>` fingerprint'in parçası.
3. **Kategori haritası fixture-dar** (`01135fe`) — canlı veriden 74+26 kategorisiz → 0 (Żabka hariç).
4. **Birim semantiği** (`6fd4bb7`) — 200g tereyağına `kg` yazılıp "zł/kg" gibi gösterilme riski; paketli ürünler `szt` gönderir.
5. **Eşzamanlı ingest yarışı** (`9714e71`) — aynı ürün bir chunk'ta iki kez gelince mükerrer ürün oluşuyordu; bulk upsert artık sıralı.

## Operatör runbook notları

- Pipeline çağrısı: `PYTHONIOENCODING=utf-8 python -m countries._common.pipeline countries/poland/config.json` (dosya yoluyla değil `-m` ile; UTF-8 şart).
- `match-review.ts approve` merge sonrası status güncellemesi ayrı yazımdır; çökme penceresinde teklif "stuck pending" kalırsa tekrar çalıştırma GÜRÜLTÜLÜ hata verir (sessiz çift birleşme olmaz) — elle status düzeltin.
- Onaylanan teklifin kardeş teklifleri otomatik reddedilir; toplu redde "pending değil" hatası normaldir.
- Seed ürünü `Łaciate Mleko 1L` (EAN 5900000000001) sahte veridir; prod'da seed edilmemeli veya temizlenmelidir.

## Bilinen boşluklar (lansman engeli değil, takip işi)

- Żabka: kategori yok (8 ürün) + katalog ~8 ürünle sınırlı (curated ana sayfa karuseli).
- OFF zenginleştirme verimi düşük — hız sınırı stratejisi (gecelik yavaş koşu) ayrı iş.
- EAN'li ürün ile aynı ürünün EAN'siz kaydı ayrı kalır (kör nokta güvenli yönde: birleşmezler).
