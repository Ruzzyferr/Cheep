# Cheep Premium — abonelik tasarımı

**Tarih:** 23 Ağustos 2026
**Durum:** Kod tamam ve üretimde; mağaza tarafında elle yapılacak adımlar açık (aşağıda).

## Neden

Cheep bugüne kadar tamamen ücretsizdi ve tek gerçek değişken maliyeti AI asistanı.
Gelir olmadan asistan her kullanıcıda zarar yazıyor. Amaç kâr etmek değil, **tek
gider kalemini karşılamak.**

## Kapsam kararı

Premium **yalnızca AI asistanını** kapsıyor. Fiyat karşılaştırma, listeler, en ucuz
rota, fiyat düşüş bildirimleri ücretsiz kalıyor ve kalacak. Bugün ücretsiz olan
hiçbir özellik ücretliye taşınmadı — mevcut kullanıcının elinden bir şey almak,
kazanılacak gelirden pahalıya patlar.

| | Ücretsiz | Premium |
|---|---|---|
| Asistan mesajı | 5 / gün | 300 / ay (+ 50/gün emniyet) |
| Diğer her şey | sınırsız | sınırsız |

### Kota neden aylık?

Karşıladığımız LLM maliyeti aylık tahakkuk ediyor, gelir de aylık geliyor. Günlük
tavan aylık maliyeti sınırlamaz: eski `PREMIUM_DAILY_LIMIT = 500`, mesaj başına
~$0.005 ile ayda ~$75 açık bırakıyordu — hiçbir abonelik fiyatının karşılayamayacağı
bir tavan. 300 mesaj/ay ≈ **$1.50/ay** tavan maliyet; net kazancın belirgin altında.
Günlük 50'lik emniyet supabı yalnızca tek günde patlamayı keser.

## Fiyatlandırma

Taban bölge Türkiye; diğer 174 bölge Apple'ın `equalizations` uçları ile türetildi.

| | TRY | USD | PLN | EUR | SEK |
|---|---|---|---|---|---|
| Aylık | 149,99 | 2,99 | 14,99 | 2,99 | 39 |
| Yıllık | 1.499,99 | 29,99 | 129,99 | 34,99 | 399 |

Yıllık, aylığın 12 katına göre ~%17 ucuz. Hesap Small Business Program'da olduğu
için komisyon %15: USD 2,99 → **kazanç 2,54**. En kötü senaryoda ($1.50) marj
kalıyor, gerçekçi kullanımda (~30 mesaj/ay ≈ $0.15) rahat.

TRY 99,99 basamağı bilerek elendi: kazancı $1.34, yani en kötü senaryonun altında.

Ücretsiz deneme **yok**. Ücretsiz katman zaten fiili deneme; deneme süresi
karşılıksız AI maliyeti demek olurdu.

## Mimari

```
App Store / Play  ──►  RevenueCat  ──webhook──►  Cheep backend  ──►  subscriptions
                            ▲                          │                   │
                            └──── /billing/sync ───────┘                   ▼
                                  (yedek yol)                      user.is_premium
```

**Doğruluk kaynağı bizim veritabanımız.** RevenueCat besliyor, karar vermiyor.
İstemcinin "ben premium'um" demesi hiçbir şey ifade etmiyor: kotayı uygulayan
backend, o da kendi tablosuna bakıyor.

### Neden webhook (istemci bildirimi değil)

Üç seçenek değerlendirildi:

- **İstemci söyler** — en az iş, ama taklit edilebilir. Para söz konusuyken elendi.
- **Her istekte RevenueCat'e sor** — kurulumu kolay, ama her asistan mesajını dış
  servise bağımlı kılar; RevenueCat düşerse ödemiş kullanıcı limite takılır.
- **Webhook + girişte uzlaştırma** ✅ — uygulama kapalıyken bile iptal/iade doğru
  işlenir; kaçan bir olayı `sync` toparlar.

### Veri modeli

`subscriptions`, kullanıcı başına tek satır (güncel durum). Tam geçmişi RevenueCat
tutuyor, ikinci bir olay tablosu açılmadı.

`user.is_premium` **türetilmiş önbellek**: yalnızca `applyEntitlement()` yazar.
Böylece kotayı okuyan mevcut kod hiç değişmeden çalıştı ve premium kontrolü tek
yerde kaldı.

### Durum alfabesi

Mağaza olayları yedi duruma indirgeniyor; uygulamanın geri kalanı RevenueCat'in
olay tiplerini bilmiyor.

| Durum | Hak var mı | Ne zaman |
|---|---|---|
| `ACTIVE` | ✅ | satın alma, yenileme, iptalin geri alınması |
| `CANCELLED` | ✅ dönem sonuna kadar | kullanıcı iptal etti — **parasını ödedi** |
| `BILLING_ISSUE` | ✅ grace süresince | ödeme alınamadı |
| `PAUSED` | ❌ | (Play) kullanıcı duraklattı |
| `EXPIRED` | ❌ | dönem bitti, yenilenmedi |
| `REFUNDED` | ❌ **derhal** | iade edildi |

### Dayanıklılık kararları

- **Webhook doğrulama sonrası her zaman 200.** 5xx dönmek RevenueCat'e saatlerce
  yeniden denetir; işleyemediğimiz olayı sonsuza dek tekrar almanın faydası yok.
- **Idempotans.** Aynı `event_id` yeniden gelirse ya da eski bir olay geç gelirse
  mevcut satır korunur. RevenueCat ne teslimi ne sırayı garanti eder.
- **Sır yoksa uç KAPALI (503).** Yapılandırma eksikliği, doğrulamasız abonelik
  yazma iznine dönüşmemeli.
- **RevenueCat erişilemezse hak KESİLMEZ.** `sync` hata yutar, kayıtlı durumu döner.
  Dış servis çöktü diye ödemiş kullanıcının hakkını kesmek kabul edilemez.
- **Webhook ucu IP rate limit kovasından muaf.** Güvenliği paylaşılan sır sağlıyor;
  limit yalnızca abonelik olaylarını geciktirirdi.

### Kimlik

`Purchases.logIn(String(user.id))` — RevenueCat `app_user_id` = backend `user.id`.
Anonim kimlikler (`$RCAnonymousID:...`) webhook'ta reddedilir: bir hesaba
bağlanamazlar, kullanıcı giriş yapınca zaten yeni olay gelir.

## Uygulama tarafı

Paywall'da App Store 3.1.2'nin zorunlu tuttuğu her öğe var: süre, yerelleştirilmiş
fiyat (mağazadan geldiği gibi), otomatik yenileme bilgilendirmesi, "satın alımları
geri yükle", Koşullar ve Gizlilik bağlantıları. **Biri eksikse inceleme reddedilir.**

İki giriş noktası: asistan limit bandı (yalnızca ücretsiz kullanıcıya) ve
Profil › Uygulama › Cheep Premium. Zaten aboneyse satın alma değil durum ekranı çıkar.

Hesap silme akışına abonelik uyarısı eklendi: abonelik mağazaya bağlıdır, hesabı
silmek onu iptal etmez.

SDK anahtarı yoksa uygulama **çalışmaya devam eder**, paywall "şu anda
kullanılamıyor" der. Satın alma bir eklenti; yapılandırma eksikliği fiyat
karşılaştırmayı çökertmemeli.

## Test edilenler

- 57 birim testi: kota pencereleri, olay eşlemesi, idempotans, hak kuralları,
  webhook kimlik doğrulaması (toplam 453 backend testi geçiyor).
- Üretimde uçtan uca sahte webhook akışı: satın alma → idempotans → sırasız eski
  olay → iptal → iade. Yedi kontrolün tamamı geçti, test verisi sonra silindi.

## Elle yapılacaklar (mağaza tarafı)

| Adım | Neden bende değil |
|---|---|
| RevenueCat projesi, uygulamalar, `premium` hakkı, offering | Panel girişi gerekiyor |
| Play Console abonelik ürünleri | Panel girişi + upload anahtarı sorunu |
| Paywall inceleme ekran görüntüsü | Gerçek derleme gerekiyor (ürünler `MISSING_METADATA`) |
| App Store 1.4.1 sürümüne aboneliklerin eklenmesi | Sürüm oluşturulduktan sonra |

## Bilinçli olarak yapılmayanlar

- **Ömür boyu satın alma.** AI her ay para yakmaya devam eder; ömür boyu alıcı bir
  noktadan sonra kalıcı zarar yazar.
- **Ayrı olay/audit tablosu.** RevenueCat zaten tutuyor.
- **Ücretsiz özelliklerin kısıtlanması.** Gelirden çok itibar kaybettirir.
