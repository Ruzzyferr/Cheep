# Cheep web sitesi — içerik motoru ve anasayfa yenilemesi

**Tarih:** 2026-08-01
**Durum:** Tasarım — onay bekliyor

---

## 1. Amaç

Cheep'i "market fiyatları", "en ucuz market", "BİM süt fiyatı" gibi arama
sorgularında Google'ın üst sıralarına taşımak; siteye gelen kişiye ilk üç
saniyede "bu site fiyatları gerçekten biliyor" dedirtmek.

### Dürüst beklenti (spec'in en önemli maddesi)

**"Market fiyatları" tek başına bir zirve sorgusudur.** Cimri ve Akakçe gibi
yıllardır oturmuş, on binlerce sayfalı siteler orada. Hiçbir tasarım yenilemesi
o sorguda kısa vadede 1. sıra getirmez — kimse için getirmiyor.

Çalışan tek yol: **binlerce uzun kuyruklu sayfayla** toplam trafiği ve alan
otoritesini büyütmek. Zirve sorgusu o otoritenin *sonucudur*, sebebi değil.

Gerçekçi takvim:

| Süre | Beklenen |
|---|---|
| 0-2 hafta | Google taramaya başlar, indeks sayısı artar |
| 4-8 hafta | Uzun kuyruk trafiği gelmeye başlar ("ülker çikolata fiyat karşılaştırma") |
| 3-6 ay | Orta rekabetli sorgular ("a101 süt fiyatları") |
| 6 ay+ | Zirve sorgularında görünürlük |

Bu spec o yolun altyapısını kurar. Sabır gerektiren kısmı yazılım çözemez.

---

## 2. Sayfa envanteri

Sayılar prod veritabanından ölçüldü (2026-08-01), tahmin değil:

| Sayfa tipi | Adet | Örnek URL |
|---|---|---|
| Ürün karşılaştırma | 6.471 | `/urun/ulker-cikolatali-gofret-36g` |
| Kategori × market | 831 | `/market/bim/sut-ve-kahvaltilik` |
| Şehir | 286 | `/sehir/ankara` |
| Kategori | 202 | `/kategori/cikolata` |
| Market | 11 | `/market/bim` |
| Rapor & hub | ~20 | `/zam-raporu`, `/en-ucuz-market` |
| Mevcut (anasayfa + yasal) | 8 | `/`, `/privacy` … |
| **Toplam** | **~7.830** | |

### Neden 55.000 değil

Katalogda 55.362 ürün var ama sayfa **yalnızca 2+ markette fiyatı olan** ürüne
açılıyor (6.471). Tek markette bulunan üründe karşılaştırılacak bir şey yoktur;
sayfa boş kalır. Google bunu *thin content* sayar ve cezası sayfa bazında değil
**site geneline** işler. 7.800 dolu sayfa, 55.000 boş sayfadan kat kat iyi
sıralanır.

Bu eşik katalog büyüdükçe kendiliğinden daha çok sayfa üretir — kod
değişmeden.

---

## 3. URL yapısı

Sonradan değiştirmesi en pahalı karar; bir kez doğru kurulacak.

```
/                              anasayfa (TR)
/urun/<slug>                   ürün karşılaştırma
/kategori/<slug>               kategori listesi
/market/<slug>                 market profili
/market/<slug>/<kategori>      market × kategori
/sehir/<slug>                  şehir sayfası
/zam-raporu                    haftalık zam/indirim raporu
/en-ucuz-market                market karşılaştırma hub'ı

/pl/...                        aynı ağacın Lehçe karşılığı
```

Kurallar:

- **Slug'lar dile özel değil, ülkeye özel.** TR ürünleri Türkçe slug, PL
  ürünleri Lehçe slug alır. Aynı ürün iki ülkede varsa iki ayrı sayfadır —
  fiyatları, marketleri, para birimi farklı.
- Slug türetimi deterministik: `<marka>-<isim>-<gramaj>`, küçük harf, aksan
  sadeleştirilir (`ş→s`, `ł→l`), boşluk `-`. Çakışma olursa sonuna ürün id'si.
- **Slug bir kez üretilir ve DB'de saklanır.** Ürün adı sonradan düzelirse slug
  değişmez — yoksa her düzeltme indekslenmiş bir URL'i öldürür.
- Trailing slash yok (anasayfa hariç), mevcut siteyle tutarlı.

---

## 4. Mimari: gecelik statik üretim

```
03:00  scrape biter (mevcut cheep-fetcher timer'ları)
04:00  cheep-site-build.timer
       ├─ backend'den toplu SEO verisi çekilir (tek istek)
       ├─ prerender 7.830 sayfa üretir
       ├─ sitemap + robots yazılır
       └─ dist/ atomik olarak devreye alınır
```

**Neden statik:** Site şu an Caddy arkasında düz dosya. Çalışma anında sıfır
maliyet, düşecek bir servis yok, TTFB minimum. Fiyat verisi zaten günlük
geliyor; daha taze render anlamsız.

**Değerlendirilip elenen alternatifler:**

- *Anlık sunucu render (SSR):* 1 vCPU / 2 GB kutuya bir Node servisi daha
  bindirir, TTFB düşer, arıza yüzeyi büyür. Kazancı yok.
- *Statik kabuk + tarayıcıda fiyat çekme:* Fiyatlar HTML'de olmazsa Google
  onları güvenilir göremez — tam da sıralanmak istediğimiz içerik görünmez
  olur. Amacın tersi.

### Veri akışı

Yeni uç: `GET /api/v1/seo/export` (ingest anahtarıyla korunur, tek çağrı).
Build'in ihtiyacı olan her şeyi tek seferde döner:

```jsonc
{
  "generatedAt": "2026-08-01T04:00:00Z",
  "countries": [{
    "code": "TR", "currency": "TRY",
    "products": [{ "slug", "name", "brand", "image", "categorySlug",
                   "offers": [{ "storeSlug", "price", "updatedAt" }],
                   "history": [{ "date", "min", "max" }],   // 28 gün
                   "branchCount" }],
    "categories": [...], "stores": [...], "cities": [...]
  }]
}
```

Website konteyneri backend ile aynı docker ağında — istek dışarı çıkmaz.
Yanıt büyük (~40 MB); gzip'li stream olarak alınır, belleğe tek parça
yüklenmez (kutuda 1.2 GB boş RAM var).

**Build başarısızsa mevcut `dist/` olduğu gibi kalır.** Yayındaki site asla
yarım üretimle değişmez — üretim geçici dizine yapılır, bittiğinde atomik
`mv` ile devreye alınır.

---

## 5. Sayfalama — sade, çünkü veri sade

Ölçüm sonucu:

- **120 kategori tek sayfaya sığıyor** (≤60 ürün) — sayfalama yok
- 41 kategoride gerekiyor; en kalabalık kategori 199 ürün → **en fazla 4 sayfa**
- Kategori ortalaması 40 ürün

Kararlar:

- Sayfa başına **60 ürün**. `/kategori/cikolata`, `/kategori/cikolata/2`
- **Sonsuz kaydırma yok.** İçerik HTML'de olmazsa Google göremez; ayrıca geri
  tuşunu bozar.
- "Daha fazla göster" düğmesi de yok — 60 ürün zaten uzun bir sayfa, bölmek
  daha dürüst.
- Her sayfa **kendine canonical** verir. 2. sayfayı 1'e canonical etmek yaygın
  bir hatadır; oradaki ürünler indeksten düşer.
- Sayfalama bağlantıları gerçek `<a href>` — JS'siz de gezilebilir.
- 4 sayfadan derin bir şey oluşmayacağı için "…" kısaltmalı karmaşık sayfalama
  bileşenine gerek yok: düz `1 2 3 4` yeter.

---

## 6. Sayfa anatomileri

Her sayfa tipi, "bu sayfa neden var olmayı hak ediyor" sorusuna cevap verir.

### Ürün sayfası (en kritik — 6.471 adet)

1. Ürün adı, marka, görsel
2. **Fiyat tablosu**: market × fiyat, en ucuz vurgulu, güncelleme tarihi
3. **Fark rozeti**: "En pahalıdan %38 ucuz — sepette ₺14 fark"
4. **28 günlük fiyat grafiği** (küçük, sade çizgi — süs değil, kanıt)
5. Kaç şubede bulunduğu
6. Aynı kategoriden alternatifler (6 adet, iç bağlantı ağı için)
7. Sayfaya özel SSS (2-3 soru, veriden üretilir)
8. Uygulama indirme çağrısı

**JSON-LD: `Product` + `AggregateOffer`.** Bu satır teknik detay gibi görünür
ama işin en kârlı parçası: Google arama sonucunda doğrudan fiyat aralığını
gösterir ("₺32–₺47 · 5 markette"). Tıklanma oranını belirgin artırır ve
rakiplerin çoğunda yok.

### Kategori sayfası

Ürün kartları ızgarası (fiyat aralığı + en ucuz market rozetiyle), kategori
özeti ("Çikolata kategorisinde 336 ürün, en ucuz market ŞOK"), market
kırılımı bağlantıları.

### Market sayfası

Market profili, kategori kırılımı, o markette **bu hafta en çok ucuzlayanlar**,
şube sayısı ve şehir dağılımı.

### Şehir sayfası

O şehirdeki market ve şube sayısı, hangi zincirlerin bulunduğu, şehirdeki
en ucuz market karşılaştırması. **Yerel arama niyetini yakalar** ("Ankara en
ucuz market").

### Zam raporu (`/zam-raporu`)

Haftalık otomatik rapor: en çok zamlanan 20 ürün, en çok ucuzlayan 20 ürün,
kategori bazında ortalama değişim. **Bu sayfa haber değeri taşır** — paylaşılma
ve doğal bağlantı alma ihtimali en yüksek sayfa. Fiyat geçmişi derinleştikçe
(bugün 28 gün) daha da güçlenecek.

---

## 7. Görsel tasarım ilkeleri

Hedef: **premium ama sade.** Bu ikisi çelişmez; premium olan zaten sade olandır.
Ucuz görünen tasarım, güven vermeye çalışırken efekt yığar.

Mevcut tasarım sistemi korunur (`src/index.css` tokenları): Space Grotesk /
Hanken Grotesk / Space Mono, cream-forest-clementine paleti.

Kurallar:

1. **Sayı süslemeden önemlidir.** Her ekranda gerçek veri görünür. Boş
   illüstrasyon, stok görsel, "lorem" yok.
2. **Tek vurgu rengi.** Clementine yalnızca eylem ve "en ucuz" için. Yeşil
   düşüş, kırmızı artış — başka renk yok. Renk anlam taşımıyorsa kullanılmaz.
3. **Fiyat tipografisi hizalı.** `font-variant-numeric: tabular-nums`; alt alta
   fiyatların basamakları hizalanır. Hizasız fiyat tablosu amatör görünür.
4. **Cömert boşluk.** Sıkışık veri tablosu ucuz görünür; nefes alan tablo
   pahalı görünür.
5. **Hareket az ve amaçlı.** Mevcut `Reveal` bileşeni korunur; yeni animasyon
   eklenmez. `prefers-reduced-motion` desteklenir.
6. **Grafikler minimal.** 28 günlük çizgi: eksen yok, ızgara yok, sadece çizgi
   + uç noktalar + hover. Kütüphane eklemeden satır içi SVG.
7. **Mobil önce.** Fiyat tablosu dar ekranda kart yığınına dönüşür; yatay
   kaydırma **hiçbir yerde** olmaz.

---

## 8. Görsel doğrulama döngüsü (zorunlu)

Tasarım "yapıldı" sayılmaz — **görülerek** doğrulanır. Her sayfa tipi için:

- Ekran görüntüsü **3 genişlikte**: 390px (telefon), 768px (tablet), 1440px (masaüstü)
- Kontrol listesi: yatay taşma, kesilen metin, hizasız fiyat, 44px altı dokunma
  hedefi, kontrast oranı, kırık görsel, boş durum
- Depoda hazır araç var: `scripts/mobileaudit.py` (taşma + dokunma hedefi
  teşhisi yapıyor) — sayfa tiplerini kapsayacak şekilde genişletilir
- Bulunan her sorun düzeltilir ve **yeniden ekran görüntüsü alınır**

Ayrıca sayfa tipi başına **boş/uç durum** görsel olarak kontrol edilir: tek
teklifi olan ürün, görseli olmayan ürün, çok uzun ürün adı, tek ürünlü kategori.

---

## 9. Kalite kapıları

Site büyürken çürümemesi için, üretim sırasında uygulanır:

| Kapı | Kural |
|---|---|
| Thin content | Ürün 2+ markette değilse sayfa üretilmez |
| Bayat veri | En taze fiyat 7 günden eskiyse sayfa `noindex` |
| Kırık görsel | Görsel yoksa kategori ikonu; kırık `<img>` kalmaz |
| Yinelenen içerik | Her sayfa kendine canonical; hreflang TR↔PL çiftleri |
| Sitemap | 50.000 URL / 50 MB sınırı — aşılırsa sitemap index'e bölünür |
| Performans | Lighthouse mobil ≥95 (bugün 100) — düşerse build uyarır |

---

## 10. Performans bütçesi

Bugünkü 100/100/100 skoru korunacak. Sayfa başına:

- HTML ≤ 60 KB (gzip öncesi), CSS satır içi (mevcut desen)
- JS ≤ 90 KB — **yeni kütüphane eklenmez** (grafik satır içi SVG)
- Görseller `loading="lazy"`, `width`/`height` verilir (CLS = 0)
- Fontlar mevcut self-host kurulumundan, yeni font yok

---

## 11. Erişilebilirlik

Bugünkü 100 skoru korunacak: fiyat tablosu gerçek `<table>` + `<caption>` +
`scope`; renk tek başına anlam taşımaz ("en ucuz" metinle de yazılır);
odak halkaları görünür; sayfalama `<nav aria-label>` içinde.

---

## 12. Ölçüm

- **Caddy erişim logu açılır** (şu an kapalı — bu yüzden Googlebot'un gelip
  gelmediğini göremiyoruz). Log döngüsü ile disk sınırlanır.
- Search Console'a yeni sitemap gönderilir; indekslenen sayfa sayısı haftalık
  izlenir.
- Build sonunda özet: üretilen sayfa sayısı, atlanan sayfa ve sebebi.

---

## 13. Kapsam dışı (bilinçli)

- Kullanıcı yorumu / puanlama — moderasyon yükü, SEO katkısı belirsiz
- Fiyat alarmı e-postası (web) — uygulamada zaten var
- Blog / elle yazılan içerik — otomatik içerik önce kanıtlansın
- Almanya, İsviçre, İsveç — veri yok (0 ürün); ülke eklendiğinde motor
  kendiliğinden kapsar
- A/B testi altyapısı — trafik yokken anlamsız

---

## 14. Riskler

| Risk | Karşılık |
|---|---|
| Google 7.800 sayfayı "otomatik üretilmiş" sayar | Her sayfada gerçek, benzersiz veri var; şablon metin minimumda. Thin content kapısı zaten en zayıf sayfaları eliyor. |
| Build 1 vCPU'da uzun sürer | Gece 04:00, trafik yok. Süre 10 dakikayı aşarsa üretim paralelleştirilir. |
| Slug çakışması / değişimi | Slug DB'de saklanır, bir kez üretilir; çakışmada id eklenir. |
| Ürün adları kirli (scrape kaynaklı) | Sayfa başlığında ham ad değil, normalize edilmiş ad kullanılır; çok kirli olanlar thin content kapısına takılır. |
| 40 MB export belleği doldurur | Stream olarak işlenir, ülke ülke üretilir. |

---

## 15. Başarı ölçütü

- 7.800 sayfa üretiliyor, build 10 dakikanın altında, hata durumunda yayın bozulmuyor
- 3 genişlikte görsel denetim temiz
- Lighthouse mobil: SEO 100, erişilebilirlik 100, best practices 100, performans ≥95
- 8 hafta içinde Search Console'da indekslenen sayfa sayısı > 5.000
