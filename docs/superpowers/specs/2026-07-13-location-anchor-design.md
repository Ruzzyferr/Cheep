# Alışveriş Çapası — konum ve ülke modeli

**Tarih:** 2026-07-13
**Durum:** Tasarım onaylandı
**Kapsam:** Cheep-Mobile (backend değişikliği yok)

## Problem

Konum bilgisi bugün üç ayrı yere dağılmış ve birbirlerinden habersizler:

- `user_country` (SecureStore) — `x-country` header'ını besler, katalog ve para birimini belirler
- `user_location` (SecureStore) — GPS koordinatı, mesafe/rota/yarıçap filtresi için
- `LocaleContext.country` — para birimi biçimlendirmesi

Üçü arasında hiçbir tutarlılık kuralı yok. Sonuçları:

1. **Ülke bir kez yazılır, bir daha kontrol edilmez.** `NewHomeScreen` yalnızca depoda hiçbir şey yoksa ülkeyi tespit eder. Türkiye'de kurup Polonya'ya taşınan kullanıcı süresiz olarak Türk marketlerinde takılı kalır.
2. **Konum yalnızca `CompareResultsScreen` mount'unda okunur.** Uygulama açılışında "şu an neredeyim" diye soran bir yer yok.
3. **Manuel ülke seçimi ile GPS arasında öncelik kuralı yok.** İkisi aynı anahtara yazar; son yazan kazanır.
4. **Çapraz-ülke durumu tanımsız.** Almanya'daki bir kullanıcının GPS koordinatı, Türk kataloğuna 3 km yarıçap filtresi olarak uygulanır → 0 sonuç → "yakında market yok".

(4), 2026-07-13'te düzeltilen "stale location ghost" hatasıyla (`972370d`) aynı sınıftan: **belirsiz bir konumun geçerli sayılması.**

## Kısıtlar (veriden gelen)

Tasarımı şekillendiren, değiştiremeyeceğimiz gerçekler:

- **Fiyatlar zincir bazında ulusal, şube bazında değil.** `StorePrice` bir `Store`'a (zincire) bağlı; `StoreBranch` yalnızca koordinat sağlar. Konumun fiyata **hiçbir etkisi yok** — sadece mesafe, rota ve yarıçap filtresini etkiler.
- **Şubelerde ilçe/adres verisi yok.** OSM importu `lat`, `lon`, seyrek `city` çeker; `address` her zaman NULL. `city` kapsamı: PL %47 (1.346 kirli değer), TR %17. Şehir listesini şube verisinden türetmek uygulanabilir değil.
- **Yarıçap filtresi `lat/lon` haversine ile çalışır**, `city` alanına hiç bakmaz. Çapa için tek gereken bir koordinattır.
- Backend `compare` uç noktası zaten `userLocation` + `radiusKm` kabul ediyor; `GET /stores/nearby` mevcut.

## Model

Üç dağınık durum tek bir kaynağa indirilir:

```ts
type LocationMode = 'auto' | 'pinned';

interface ShoppingAnchor {
  mode: LocationMode;
  coords: Coords | null;      // mesafe + rota + yarıçap filtresi çapası
  countryCode: 'TR' | 'PL';   // katalog + para birimi (x-country)
  label: string | null;       // "Warszawa, Śródmieście" — yalnızca pinned modda
  resolvedAt: number;
}
```

Bir `LocationProvider` bunu tutar; uygulama açılışında ve arka plandan öne dönüşte tazeler (`useLocationGate`'in `AppState` mantığı yeniden kullanılır). `CompareResultsScreen` artık kendi başına GPS çağırmaz — çapayı buradan okur.

`user_country` yazılmaya devam eder (api.client'ın `x-country` kaynağı), ama artık **türetilmiş** bir değerdir: kaynağı çapadır.

### Merkezî invaryant

> **Mesafe filtresi yalnızca çapa hem koordinatlı hem de katalogla aynı ülkedeyse uygulanır.**

`userLocation` + `radiusKm` yalnızca `anchor.coords != null && anchor.countryCode === catalogCountry` olduğunda gönderilir; aksi halde ikisi de gönderilmez ve backend hiç filtre uygulamaz (tüm marketler listelenir). Bu tek kural (4) numaralı hatayı yapısal olarak imkânsız kılar: yanlış ülkedeki ya da doğrulanmamış bir koordinatla asla filtreleme yapılmaz.

## Otomatik mod (varsayılan)

Her açılışta ve arka plandan dönüşte: GPS → koordinat → reverse-geocode → ISO ülke.

- **ISO değişti ve destekleniyor** → ülke otomatik güncellenir (`user_country`, `LocaleContext`, sunucudaki tercih). Engellemeyen bir şerit gösterilir: *"Polonya'dasın — Polonya marketlerine geçildi."* Onay sorulmaz.
- **ISO desteklenmiyor** (ör. Almanya) → son ülke korunur, **mesafe filtresi kapanır**. Sessizce TR'ye düşülmez.
- **Reverse-geocode başarısız** (çevrimdışı) → son ülke korunur. Asla varsayılana sıfırlanmaz.

## Sabitlenmiş mod (manuel)

Kullanıcı adres yazar → `Location.geocodeAsync` (cihaz geocoder'ı, API anahtarı gerektirmez) → sonuçlar listelenir → **kullanıcı hangisini kastettiğini onaylar.** Sessiz kabul yok.

Üç doğrulama kapısı:

1. **Ülke kapısı** — çözülen nokta TR/PL dışındaysa reddedilir: *"Cheep henüz bu ülkede yok."*
2. **Şube kapısı** — mevcut `GET /stores/nearby` ile o noktanın çevresinde şube var mı sorulur. Yoksa uyarılır: *"Bu adresin yakınında market bulamadık."* Kullanıcı yine de devam edebilir, ama pin **koordinatsız** kaydedilir (`coords: null`) — yalnızca ülke sabitlenir. Aksi halde çevresinde şube olmayan bir noktaya yarıçap filtresi uygulanır ve kullanıcı boş ekran görür; bu, düzelttiğimiz hatanın aynısı olurdu.
3. **Geocoder yokluğu** — bazı Android cihazlarda `geocodeAsync` çalışmaz veya boş döner. O durumda adres girişi devre dışı kalır; kullanıcı yalnızca ülke seçer, pin koordinatsız kaydedilir. Bozuk mesafe göstermektense hiç göstermemek.

Yani bir pin iki biçimde olabilir: **koordinatlı** (adres doğrulandı → gerçek mesafeler ve rotalar) veya **koordinatsız** (yalnızca ülke → mesafe filtresi kapalı, tüm marketler listelenir).

Onaylanınca mod `pinned` olur; GPS artık ne ülkeyi ne mesafeyi ezer. Ana ekranda çip: **📍 Warszawa · sabit** → dokunma → *"Otomatiğe dön"*.

Bu, "Türkiye'den Polonya fiyatlarını merak eden kullanıcı" senaryosunu karşılar. Fiyatlar ulusal olduğu için çapanın tek işlevi mesafe/rota üretmektir; kullanıcı gerçek bir Varşova adresi girdiğinde gerçek rotalar görür.

## Hata durumları

| Durum | Davranış |
|---|---|
| GPS anlık hata (kapalı mekân, soğuk fix) | 30 dk'dan taze cache; yoksa çapa yok → filtre kapalı |
| Rıza veya OS izni yok | Çapa yok, saklanan koordinat silinir → filtre kapalı |
| Reverse-geocode başarısız | Son bilinen ülke korunur |
| Desteklenmeyen ülke | Son ülke korunur, mesafe filtresi kapanır |
| `geocodeAsync` yok / boş | Adres girişi kapalı; koordinatsız pin (yalnızca ülke) |
| Pin çevresinde şube yok | Uyarı; kabul ederse koordinatsız pin (yalnızca ülke) |

Ortak kural: **belirsizlik varsa mesafe filtresi kapanır.** Yanlış bir noktayla filtrelemek boş ekran üretir; filtrelememek en fazla fazladan market gösterir. Asimetrik maliyet, asimetrik varsayılan.

## Backend

**Değişiklik yok.** `POST /lists/:id/compare` zaten `userLocation` + `radiusKm` alıyor; `GET /stores/nearby` doğrulama için hazır; ülke `x-country` ile akıyor. Sabitlenmiş modda pin'in ülkesi `user_country`'ye yazıldığı için header kendiliğinden doğru gider.

## Test

Çapa çözümleme mantığı saf TypeScript (React'ten bağımsız) olacak; mevcut vitest kurulumuyla test edilir.

- Otomatik modda ülke değişimi (TR→PL) ve şeridin tetiklenmesi
- Sabitlenmiş mod GPS'i ezmiyor; otomatiğe dönüş çalışıyor
- **Çapraz-ülke invaryantı:** çapa ülkesi ≠ katalog ülkesi → `radiusKm` gönderilmiyor
- Desteklenmeyen ülke → son ülke korunuyor, TR'ye düşmüyor
- Geocode kapıları: ülke dışı reddi, şubesiz nokta uyarısı, geocoder yokluğu
- Mevcut 16 konum testi bozulmadan geçmeli

## Kapsam dışı

- Şube bazlı fiyatlandırma (veri yok)
- İlçe/mahalle seçimi (şubelerde ilçe verisi yok)
- Arka plan konum takibi (yalnızca ön plan izni; Play politikası ve pil maliyeti)
- TR/PL dışında ülke desteği
