# AdMob kurulumu — banner reklamlar

Kod tarafı hazır ve **Google'ın TEST reklam birimleriyle** çalışıyor. Gerçek
gelir için aşağıdaki adımlar bir kez yapılmalı. Toplam ~15 dakika.

## Neden kod gerçek kimliklerle gelmiyor

Google'ın politikası gereği geliştirme ve test sırasında **gerçek reklam birimi
kullanılamaz**: kendi reklamlarını yükleyip tıklamak "geçersiz trafik" sayılıyor
ve AdMob hesabının askıya alınmasına yol açıyor. Bu yüzden varsayılan test
birimi; gerçek kimlikler dışarıdan veriliyor.

Yapılandırmayı unutmanın bedeli **gelir kaybı**, hesap kaybı değil — iki risk
arasında bilinçli olarak bu taraf seçildi.

## 1. AdMob'da uygulamaları oluştur

<https://apps.admob.com> → Apps → Add app. **İki ayrı uygulama** gerekiyor:

| Platform | Paket / Bundle |
|---|---|
| Android | `com.cheep.mobile` |
| iOS | (App Store'daki bundle identifier) |

Her biri için `ca-app-pub-XXXXX~YYYYY` biçiminde bir **App ID** alacaksın
(tilde `~` işaretli olan).

## 2. Üç banner reklam birimi oluştur

Her platformda **Ad units → Banner** ile üç birim:

| Birim adı | Nerede görünüyor |
|---|---|
| `cheep-banner-home` | Ana sayfa, fırsat rayı ile market listesi arasında |
| `cheep-banner-search` | Arama sonuçlarında ilk satırdan sonra |
| `cheep-banner-list` | Liste detayında ürünlerin altında |

Her biri `ca-app-pub-XXXXX/ZZZZZ` biçiminde (eğik çizgi `/` işaretli).

> **Üç ayrı birim şart.** AdMob raporları birim bazında kırılıyor; tek birim
> kullanılırsa hangi yerleşimin çalıştığı, hangisinin boşuna durduğu hiçbir
> zaman öğrenilemez.

## 3. App ID'leri koda yaz

`Cheep-Mobile/app.json` → `plugins` içindeki `react-native-google-mobile-ads`
bloğunda iki satır:

```json
"androidAppId": "ca-app-pub-XXXXX~YYYYY",
"iosAppId":     "ca-app-pub-XXXXX~ZZZZZ"
```

Bunlar `app.json`'da duruyor çünkü native yapılandırmaya (AndroidManifest /
Info.plist) prebuild sırasında gömülüyorlar — çalışma anında okunamazlar.

⚠️ **App ID yanlış ya da eksikse SDK native tarafta AÇILIŞTA ÇÖKER.** Test
kimlikleri bu yüzden yer tutucu olarak duruyor; boş bırakılmamalı.

## 4. Reklam birimi kimliklerini CI'a gir

GitHub → Settings → Secrets and variables → Actions → **Variables** sekmesi
(secret değil — bu kimlikler zaten istemcide görünür):

| Değişken | Değer |
|---|---|
| `EXPO_PUBLIC_ADMOB_BANNER_HOME` | `ca-app-pub-XXXXX/...` |
| `EXPO_PUBLIC_ADMOB_BANNER_SEARCH` | `ca-app-pub-XXXXX/...` |
| `EXPO_PUBLIC_ADMOB_BANNER_LIST` | `ca-app-pub-XXXXX/...` |

Yerel derleme için aynı adlarla `Cheep-Mobile/.env`.

Tanımsız bırakılırsa uygulama çalışır, test reklamı gösterir, gelir üretmez.

## 5. Mağaza gizlilik formlarını GÜNCELLE

Bu adım atlanırsa uygulama mağazadan kaldırılabilir.

- **Google Play → Data safety**: AdMob SDK'sı cihaz tanımlayıcısı ve yaklaşık
  konum topluyor; "Reklamcılık veya pazarlama" amacıyla beyan edilmeli.
- **App Store Connect → App Privacy**: "Identifiers → Device ID" ve "Usage
  Data" kalemleri, "Third-Party Advertising" kullanımıyla işaretlenmeli.
- **iOS ATT**: izleme izni metni `app.json`'da tanımlı
  (`userTrackingUsageDescription`). Kullanıcı reddederse SDK
  kişiselleştirilmemiş reklama düşer — gelir azalır ama uygulama çalışır.

## 6. GDPR rıza mesajını AdMob'da tanımla

AdMob → Privacy & messaging → **GDPR** → mesaj oluştur ve yayınla.

Bu **zorunlu**: Cheep'in Polonya, Hırvatistan, Macaristan ve Romanya
pazarlarının tamamı AB. Uygulama açılışta `AdsConsent.gatherConsent()`
çağırıyor; AdMob'da tanımlı mesaj yoksa rıza alınamaz, `canRequestAds` false
kalır ve **hiçbir reklam gösterilmez** (sessizce, hatasız).

## ⚠️ Paket sürümü SABİT — yükseltmeyin

`react-native-google-mobile-ads` **16.0.0**'a tam sürümle sabitlendi (caret
YOK) ve Dependabot'tan hariç tutuldu.

Sebep: 16.1+ sürümleri `play-services-ads` 25.x'i çekiyor ve o SDK **Kotlin
2.3.0** ile derlenmiş. Expo SDK 54'ün Kotlin derleyicisi **2.1.0** ve daha yeni
metadata'yı okuyamıyor — AAB derlemesi şu hatayla düşüyor:

```
Module was compiled with an incompatible version of Kotlin.
The binary version of its metadata is 2.3.0, expected version is 2.1.0.
```

Bu üretimde yaşandı: 1.6.0'ın ilk Android derlemesi tam olarak bu yüzden
kırıldı. 16.0.0 → `play-services-ads` 24.6.0 ile geliyor ve uyumlu.

Expo SDK yükseltilip Kotlin 2.3+'a geçildiğinde paket güncellenebilir; o zaman
`package.json`'daki sabit sürüm ve `dependabot.yml`'deki hariç tutma satırı
BİRLİKTE kaldırılmalı.

## Uygulamada nerede ne var

| Dosya | İş |
|---|---|
| `src/config/ads.ts` | Birim kimlikleri + `shouldShowBanner` gösterim kararı (saf, test edilebilir) |
| `src/context/AdsContext.tsx` | UMP rıza akışı + SDK başlatma; **premium kullanıcıda SDK hiç başlatılmaz** |
| `src/components/ads/CheepBanner.tsx` | Banner bileşeni; yüklenene kadar yer kaplamaz, yüklenemezse kaybolur |
| `src/utils/adRows.ts` | Arama ızgarasına reklam satırı yerleştirme kuralı (saf) |
| `src/utils/__tests__/ads.test.ts` | Yukarıdaki iki saf modülün testleri |

## Bilinçli kararlar

- **Tam ekran (interstitial) reklam YOK.** Uygulamada henüz doğal bir "iş
  bitti" anı yok ("alışverişi tamamladım" akışı mevcut değil) ve değer teslim
  edilmeden gösterilen tam ekran reklam, uygulama kaldırma sebeplerinin
  başında geliyor.
- **Premium'da reklam yok** — hem sözleşme gereği hem de Premium'un en güçlü
  satış argümanı.
- **Karşılaştırma sonucu ekranında reklam yok** — uygulamanın değerini
  kanıtladığı an; oraya reklam koymak tam güven kazanılan anda vergi almak.
- **Ürün fiyat tablosunda reklam yok** — reklam fiyat sanılabilir; fiyat
  karşılaştırma uygulamasında bu tüketiciyi yanıltma riski.
- **Boş liste / boş arama ekranında reklam yok** — kullanıcı daha hiçbir değer
  almamışken reklam göstermek.
