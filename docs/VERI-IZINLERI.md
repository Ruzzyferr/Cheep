# Veri kaynağı izinleri

Bu dosya, Cheep'in kullandığı veri kaynakları için **hukuki durumun kaydıdır**.
Kod yorumları bir kaynağın "güvenli" olduğunu iddia ediyorsa, dayanağı burada
yazılı olmalı. Yazılı değilse, o iddia bir varsayımdır.

Son güncelleme: 2 Ekim 2026

---

## Türkiye — marketfiyati.org.tr

| | |
|---|---|
| İşletici | **TÜBİTAK BİLGEM** (T.C. Ticaret Bakanlığı desteğiyle) |
| Telif sahibi | TÜBİTAK (kullanım koşullarında açıkça yazılı) |
| Erişim yolu | Açık API (`api.marketfiyati.org.tr/api/v2`) + açık sitemap |
| **İzin durumu** | **YOK — 2 Eki 2026'da başvuruldu, yanıt bekleniyor** |
| Yetkili mahkeme | Gebze |
| Koşulların yürürlüğü | 1 Temmuz 2024 |
| İletişim | `marketfiyati.iletisim@tubitak.gov.tr` · `mavp@sanayi.gov.tr` |

### Koşullardaki bağlayıcı hükümler (birebir alıntı)

> "Sanal Ortamlar veya Sanal Ortamlar'da yer verilen herhangi bir unsur veya
> içerik **TÜBİTAK BİLGEM'İN yazılı izni olmaksızın** fiziki veya elektronik
> herhangi bir ortamda kopyalanmayacak, işlenmeyecek, yeniden üretilmeyecek,
> çoğaltılmayacak ya da **herhangi bir şekilde kullanılmayacaktır.**"

> "Kullanıcılar, ... Sanal Ortamlar'da **tüm kullanıcılar için erişilebilir olan
> bilgileri** ... **TÜBİTAK BİLGEM'in yazılı izni olmaksızın ticari amaçlarla
> veya herhangi başka bir sebeple kullanmayacağını** ... kabul beyan ve taahhüt
> eder."

> "...içeriğe erişimine olanak sağlanması, bunlar ile ilgili olarak **herhangi
> bir yetki, lisans ya da izin verildiği şeklinde yorumlanamaz.**"

### Bu neden önemli

Uzun süre koddaki gerekçe şuydu: *"veri kamuya açık ve açık API ile sunuluyor,
dolayısıyla ToS riski yok."* **Bu gerekçe yanlıştır.** Koşullar tam olarak bu
akıl yürütmeyi reddediyor: yasak özellikle *"tüm kullanıcılar için erişilebilir
olan bilgiler"* için konmuş ve *"erişime açık olması izin sayılmaz"* deniyor.

Yanlış gerekçe 2 Eki 2026'da `marketfiyati.py` başlığından kaldırıldı.

### Karşı argümanlar (bir uyuşmazlıkta ileri sürülebilir — ama güvenle
### çalışılacak varsayım DEĞİL)

1. 7 Aralık 2022 Yönetmelik değişikliği bu veriyi **"tüketicinin fiyat
   karşılaştırması yapabilmesi için"** kamuya açıyor; kamu kurumunun
   yönetmeliğin amacını sözleşmeyle yasaklaması tartışmaya açıktır.
2. Koşullar bir *browsewrap*tır — hiçbir noktada "kabul ediyorum" onayı
   verilmedi.
3. Ham fiyat verisi (sayı) FSEK anlamında eser sayılmayabilir; korunan şey
   veritabanının kendisidir (sui generis), ve biz veritabanının tamamını
   yayınlamıyoruz.

Bunlar hâkime anlatılacak argümanlardır. Şirket olarak dayanağımız
**başvurunun olumlu yanıtlanmasıdır.**

### Bilinen açık noktalar

- **Görsel:** ürün görselleri `cdn.marketfiyati.org.tr` üzerinden gösteriliyor
  (dosya indirilmiyor, URL saklanıyor). Dosya indirilmemesi ToS açısından
  korumuyor: görsel ticari uygulamada yayınlanıyor. İzin başvurusunda bu
  AÇIKÇA soruldu.
- **Toplu erişim:** portalın facet (`filters`) ucu WAF ile bloklu; biz
  bloklanmayan `searchByIdentity` ucunu kullanıyoruz. Niyet beyanı açısından
  zayıf bir nokta; başvuruda şeffaf şekilde anlatıldı.

---

## Diğer kaynaklar

| Ülke / kaynak | Durum |
|---|---|
| Polonya | Zincirlerin kendi sitelerinde herkese açık yayımladığı fiyatlar |
| Macaristan | GVH (Rekabet Kurumu) resmî fiyat izleme sistemi |
| Romanya | Monitorul Prețurilor (devlet) |
| Hırvatistan | Devletin açık fiyat yayını |
| Ürün bilgisi | Open Food Facts — **ODbL**, atıf zorunlu (yapılıyor) |

**Yapılacak:** HR/HU/RO/PL kaynakları için de koşullar aynı titizlikle
okunmalı. Türkiye'de yapılan hata (kod yorumunda doğrulanmamış hukuki iddia)
diğerlerinde tekrarlanmış olabilir.

---

## Türkiye verisi kesilirse — yedek plan

**Gerçek maruziyet (2 Eki 2026 ölçümü):**

| | TR | PL | HR | RO | HU |
|---|---|---|---|---|---|
| Ürün | 13.739 | 39.725 | 52.745 | 36.940 | 8.421 |
| Kullanıcı | **112** | 81 | 3 | 20 | 26 |

267 kullanıcının **%42'si Türkiye'de** — en büyük tek pazar, ama çoğunluk
değil. Veri katalogda ise dördüncü sırada. Yani TR erişimi kesilirse uygulama
ölmez; en büyük pazarında işlevsiz kalır. "Türkiye pazarı durur" doğru,
"uygulama durur" değil.

**Seçenekler, tercih sırasıyla:**

1. **İzin gelir** → konu kapanır, üstelik rakipler karşısında ayrıştırıcı olur.
2. **Zincir-doğrudan geçiş** — Migros, A101, BİM, ŞOK, CarrefourSA'nın kendi
   herkese açık fiyat sayfaları. PL/HR/RO'da zaten **tam olarak bu modeli**
   çalıştırıyoruz, yani altyapı hazır; yeni olan yalnızca TR adaptörleri.
   Tahmin: zincir başına 1–2 gün. ⚠️ Her zincirin kendi kullanım koşulu var;
   Türkiye'de yapılan hatayı tekrarlamamak için önce OKUNMALI.
3. **Kullanıcı katkısı** — `price_feedbacks` tablosu mevcut. Kapsama çok
   düşük kalır; tek başına yeterli değil, tamamlayıcı olur.
4. **Türkiye'yi kapatmak** — %42 kullanıcı kaybı. Son çare.

**Karar kuralı:** TÜBİTAK'tan 30 gün içinde yanıt gelmezse 2. seçeneğin
koşul okumasına başla. Erişim fiilen kesilirse (WAF/IP bloğu) aynı gün başla.
