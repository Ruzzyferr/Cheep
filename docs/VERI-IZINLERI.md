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
| **İzin durumu** | **YOK — başvuru 2 Eki 2026'da GÖNDERİLDİ** (Resend id `01a0fcf5-4f02-7b3a-b5f3-1c4b1057fcd4`; alıcı marketfiyati.iletisim@tubitak.gov.tr, bilgi mavp@sanayi.gov.tr). Yanıt bekleniyor. **30 günlük karar kuralı 1 Kas 2026'da dolar.** |
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

---

## ⏳ Bekleyen: atıf düzeltmesi henüz YAYINDA DEĞİL

TÜBİTAK BİLGEM atfı (2 Eki 2026) main'de ama **mağazadaki sürümde yok**.
Yayındaki 1.6.4 yalnızca Ticaret Bakanlığı'nı anıyor — eksik, ama yanlış
değil, dolayısıyla acil bir ihlal yok.

Tek satırlık metin için ayrı sürüm döngüsü açılmadı. **Bir sonraki sürümde
kendiliğinden gidecek.** `app.json` 1.6.4'te bırakıldı; 1.6.4 App Store'da
READY_FOR_SALE olduğu için aynı sürüm numarasıyla yeni iOS derlemesi
90186 ("closed pre-release train") ile reddedilir — sonraki sürümde önce
sürüm numarası yükseltilmeli.

---

## 🔴 TÜBİTAK YANITI GELDİ — 5 Ekim 2026: **RET**

Başvuru (2 Eki) yanıtlandı. Özet: **izin verilmedi ve verilemez.**

> "TÜBİTAK BİLGEM söz konusu projenin teknik yürütücüsü konumunda olup;
> üçüncü taraflara, bağımsız geliştiricilere veya akademik çalışmalara
> doğrudan ham veri aktarılması, CSV dosyası sunulması ya da API erişimi
> tanımlanması hususunda **yetkili değildir**."

> "Bu yasal kapsam dışında, herhangi bir üçüncü taraf uygulamaya veya ticari
> girişime düzenli veri akışı sağlanması veya geliştiricilere yönelik bir
> lisanslama/API servisinin açılması **mevcut mevzuat ve yetki sınırları
> gereği mümkün değildir**."

**Önemli ayrımlar:**
- Durmamız İSTENMEDİ. İhtar yok, mevcut kullanımımıza değinilmedi.
- Ama izin de YOK. Üstelik başvuruda mevcut kullanımı **kendimiz beyan ettik**
  (bkz. `basvuru-tubitak-bilgem-veri-izni.md` §1).
- Pozisyon değişimi: "sorduk, bekliyoruz" → **"sorduk, yazılı ret aldık"**.
  "Bilmiyorduk" savunması artık yok.

**1 Kasım karar kuralı GEÇERSİZ** — cevap geldi, beklemek anlamsız.

---

## 🔴 ZİNCİR-DOĞRUDAN PLANI DE TEMİZ DEĞİL — 5 Eki 2026 araştırması

Yedek planın 2. maddesi "zincirlerin kendi sayfalarından çek" diyordu.
**Koşullar okundu; aynı yasak orada da var.** Plan bu haliyle hedefi
(= hiçbir market ile hukuki sorun yaşamamak) KARŞILAMIYOR.

### robots.txt (tarama sinyali — izin DEĞİL)

| Zincir | Ürün sayfaları | Not |
|---|---|---|
| Migros | ✅ serbest | yalnız `/arama`, `/*espv` kapalı; sitemap var |
| A101 | ✅ serbest | yalnız arama uçları kapalı; sitemap var |
| ŞOK | ✅ serbest | yalnız `/arama` kapalı; sitemap var |
| CarrefourSA | ✅ serbest | `/tr/`,`/en/` kapalı ama ürünler KÖKTE (`/urun-adi-p-123`) |
| BİM | — | `robots.txt` YOK (404) |

### Kullanım koşulları (BAĞLAYICI olan bu)

**ŞOK** — `kurumsal.sokmarket.com.tr/kullanim-sartlari` (birebir):
> "Sitemizde yer alan içeriğin tamamı veya herhangi bir kısmı yalnızca
> sahipleri tarafından veya **sahiplerinin yazılı izni ile** kullanılabilir."
> "İçerik üzerinde İzinsiz değişiklik yapmak, **kopyalamak**, kiralamak,
> ödünç vermek, iletmek ve yayınlamak **yasaktır**."
> "Bu siteden alınan İçerik **herhangi bir ticari amaçla kullanılamaz**."

**CarrefourSA** — `yatirimciiliskileri.carrefoursa.com/tr/kullanim-kosullari` (birebir):
> "sadece **kişisel kullanımınız** için olup, hiçbir şekilde **ticari ve sair
> amaçlarla kullanılamaz**"
> "CarrefourSA'nın **önceden yazılı izni alınmaksızın**, kısmen veya tamamen
> **kopyalanamaz, dağıtılamaz, çoğaltılamaz**"

**Migros** — DPG (Dijital Platform Gıda) koşulları: içerik üzerinde şirket hak
sahibi; "önceden izin ve kaynak gösterilmeden değiştirilemez, kopyalanamaz,
çoğaltılamaz, yeniden yayınlanamaz". ⚠️ Sayfa SPA olduğu için birebir alıntı
tarayıcıyla teyit edilmeli.

**A101** — koşul sayfası otomatik isteklere **403** dönüyor (bot engeli).
⚠️ Tarayıcıyla okunmalı. 403'ün kendisi de bir sinyal.

**BİM** — tam katalog YAYINLAMIYOR; yalnızca haftalık aktüel ürün broşürü.
Zincir-doğrudan modeli BİM için zaten veri sağlamaz.

### Sonuç

Beş zincirin en az ikisinde **marketfiyati ile birebir aynı** yasak var:
yazılı izin olmadan kopyalama yok, ticari kullanım yok. Zincir-doğrudan
geçiş, tek taraf yerine **beş tarafa karşı** aynı ihlali üretir.

**Yasal olarak temiz olan yollar yalnızca şunlar:**
1. **Her zincirden yazılı izin / iş ortaklığı** — tek gerçekten temiz yol.
2. **Kullanıcı katkısı** (`price_feedbacks`) — veri BİZİM, hukuken temiz;
   kapsama düşük başlar.
3. **Türkiye'yi kapatmak** — %42 kullanıcı kaybı.
