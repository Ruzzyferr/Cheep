# Sürüm çıkarma rehberi (Android AAB / iOS IPA)

Bu belge, Cheep'in mağaza sürümünü nasıl derleyeceğini adım adım anlatır.
Amaç: aylar sonra geri dönüldüğünde hatırlamaya gerek kalmaması.

---

## Özet

| | |
|---|---|
| **Paket adı** | `com.cheep.mobile` (Android ve iOS aynı) |
| **Derleme yöntemi** | Yerel `gradlew` (EAS Build **kullanılmıyor**) |
| **Native klasörler** | `android/` ve `ios/` **git'te DEĞİL** — `expo prebuild` üretir |
| **İmza anahtarı** | `android/app/cheep-upload.keystore` (yedeği olmadan sürüm çıkamazsın) |
| **Java** | JDK 17 — `C:\Program Files\Java\jdk-17` |
| **Kabuk** | Git Bash (cmd değil — `./gradlew` cmd'de çalışmaz) |

---

## Ön koşullar (tek seferlik)

1. **JDK 17** kurulu olmalı. Kontrol: `java -version` → `17.x`
2. **Node PATH'te** olmalı — Gradle, Metro bundler'ı Node ile çağırıyor; PATH'te
   yoksa derleme "node: command not found" ile düşer.
3. **`google-services.json`** proje kökünde (`Cheep-Mobile/google-services.json`).
   `app.json` içindeki `android.googleServicesFile` bunu işaret eder ve
   `prebuild` sırasında `android/app/` altına kopyalanır.
   ⚠️ Doğrudan `android/app/` içine koyma — o klasör her prebuild'de siliniyor.
4. **Keystore** ve `android/key.properties` yerinde olmalı (aşağıya bak).

---

## Sürüm numarasını yükselt

İki yerde birden değişmeli, yoksa Play Console reddeder:

```jsonc
// Cheep-Mobile/app.json
{
  "expo": {
    "version": "1.3.0",            // kullanıcıya görünen
    "android": { "versionCode": 15 } // Play için ARTAN tamsayı, asla tekrarlanamaz
  }
}
```

`versionCode` her yüklemede **mutlaka artmalı**. Aynı numarayla ikinci kez
yükleme yapılamaz — düşürmek de mümkün değil.

---

## Android AAB

⚠️ `--clean` `android/` klasörünü **tamamen siler**. `key.properties` ve
keystore git'te olmadığı için önce yedekle, sonra geri koy:

```bash
cd C:/dev/Cheep/Cheep-Mobile

# 0) İmza dosyalarını kenara al (android/ birazdan silinecek)
mkdir -p /tmp/sign
cp android/key.properties android/app/cheep-upload.keystore /tmp/sign/

# 1) Native projeyi üret (app.json / plugin değişikliklerini uygular)
npx expo prebuild --platform android --clean

# 2) İmza dosyalarını geri koy
cp /tmp/sign/key.properties android/
cp /tmp/sign/cheep-upload.keystore android/app/

# 3) İmzalı release paketi
cd android
./gradlew bundleRelease
```

`build.gradle`'daki imza **yapılandırmasını** geri koymana gerek yok — onu
`plugins/withReleaseSigning.js` her prebuild'de yeniden enjekte ediyor
(aşağıya bak). Geri konması gereken tek şey anahtarın kendisi.

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

Anlamlı bir adla kopyala:

```bash
cp app/build/outputs/bundle/release/app-release.aab \
   ../../cheep-1.3.0-vc15.aab
```

### Test için APK (Play'e değil, doğrudan telefona kurmak için)

```bash
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

### İmzayı doğrula — BUNU HER SÜRÜMDE YAP

En sinsi hata: AAB'nin **debug anahtarıyla** imzalanmış olması. Derleme
başarılı görünür, dosya üretilir, ama Play Console yüklemeyi reddeder.
Parmak izini yayındaki sürümle karşılaştır — eşleşmeliler:

```bash
export PATH="/c/Program Files/Java/jdk-17/bin:$PATH"

# AAB'yi imzalayan sertifika
unzip -p app/build/outputs/bundle/release/app-release.aab META-INF/*.RSA \
  | keytool -printcert | grep -E "Owner:|SHA1:"
```

Beklenen (1.3.0 itibarıyla yayındaki anahtar):

```
Owner: CN=Cheep, OU=Mobile, O=Cheep, L=Istanbul, C=TR
SHA1:  9D:E5:2F:06:13:A2:F7:CF:02:D4:10:93:41:E7:B8:71:73:87:AF:73
```

`Owner: CN=Android Debug` görüyorsan **yükleme**: imza yapılandırması
uygulanmamış demektir (`key.properties` eksik olabilir).

---

## İmzalama

`android/key.properties` (git'te **değil**, elle konur):

```properties
storeFile=cheep-upload.keystore
storePassword=***
keyAlias=cheep-upload
keyPassword=***
```

Keystore dosyası: `android/app/cheep-upload.keystore`

### Neden bir config plugin var

Expo'nun ürettiği `build.gradle` şablonunda release bloğu **debug anahtarıyla**
imzalıyor ("Caution! In production, you need to generate your own keystore
file"). `build.gradle`'ı elle düzeltirsen ilk `prebuild --clean`'de kaybolur ve
fark etmeden debug imzalı bir AAB üretirsin.

`plugins/withReleaseSigning.js` bu bloğu her prebuild'de yeniden enjekte eder,
yani tuzak kapalı. Expo şablonu ileride değişirse plugin sessizce atlamaz —
anlaşılır bir hata fırlatıp derlemeyi durdurur.

⚠️ **Keystore ve key.properties'in yedeğini güvenli bir yerde tut.** Keystore
kaybolursa mevcut uygulamaya bir daha güncelleme yükleyemezsin — Play Store
yeni bir uygulama olarak yayınlamanı ister ve mevcut kullanıcılar güncelleme
alamaz. (Play App Signing açıksa Google upload anahtarını sıfırlayabilir, ama
bu yine de günlerce süren bir destek sürecidir.)

---

## Play Console'a yükleme

1. [Play Console](https://play.google.com/console) → Cheep → **Production**
   (veya önce **Closed testing**)
2. **Create new release** → AAB'yi yükle
3. Sürüm notlarını **TR ve PL** için yaz (ikisi de yayında)
4. **Review release** → **Start rollout**

İnceleme genelde birkaç saat–birkaç gün sürer.

---

## iOS IPA

⚠️ **iOS sürümü henüz çıkarılmadı.** Aşağısı hazır olunduğunda izlenecek yol.

Gerekenler: **macOS** (Xcode yalnızca macOS'ta çalışır) ve **Apple Developer
Program** üyeliği (yıllık 99 $).

```bash
cd Cheep-Mobile
npx expo prebuild --platform ios --clean
cd ios
pod install
```

Sonra `ios/Cheep.xcworkspace` dosyasını Xcode'da aç:

1. **Signing & Capabilities** → Team seç, bundle id `com.cheep.mobile`
2. **Push Notifications** capability'sini ekle (bildirimler için şart)
3. Şema: **Any iOS Device (arm64)**
4. **Product → Archive** → **Distribute App** → **App Store Connect**

Ek olarak push için: Apple Developer portalından **APNs anahtarı** (.p8)
üretilip Firebase Console → Project Settings → Cloud Messaging → iOS
bölümüne yüklenmeli. Firebase, Android'de FCM ile ne yapıyorsa iOS'ta
APNs üzerinden aynısını yapar.

---

## Push bildirimleri — mimari notu

Uygulama **doğrudan FCM** kullanıyor; Expo'nun push servisi **kullanılmıyor**.

- Mobil: `getDevicePushTokenAsync()` ham FCM token'ı verir
  (`src/utils/notificationGate.ts`)
- Backend: servis hesabı anahtarıyla OAuth2 token alıp FCM HTTP v1'e gönderir
  (`src/services/push.service.ts`)
- Sunucuda `FCM_SERVICE_ACCOUNT` env'i gerekir (servis hesabı JSON'u).
  Bu **gerçek bir sırdır**, git'e konmaz.

Bu tercih bilinçli: Expo'nun servisi de sonunda FCM'e gidiyor ama araya ayrı
bir hesap, bir `projectId` ve Expo'ya kimlik bilgisi yükleme adımı sokuyordu.

**Push yalnızca gerçek cihazda test edilebilir.** Emülatörde token alınamaz;
uygulama içi bildirim listesi ve zil rozeti ise her yerde çalışır (tespit
backend'de yapılıyor, push izninden bağımsız).

---

## Sürüm öncesi kontrol listesi

```bash
# Backend
cd cheep-backend-express
pnpm db:generate        # ← ÖNCE bu; yoksa tsc onlarca sahte hata verir
pnpm exec tsc --noEmit  # 0 hata
pnpm exec vitest run    # hepsi yeşil

# Mobil
cd ../Cheep-Mobile
npx tsc --noEmit        # 0 hata
npx vitest run          # hepsi yeşil
```

- [ ] `version` ve `versionCode` ikisi de yükseltildi
- [ ] `google-services.json` kökte duruyor
- [ ] Backend değişiklikleri prod'a deploy edildi (mobil onlara bağlıysa)
- [ ] Gerçek cihazda duman testi: giriş, liste, karşılaştırma, bildirim, iletişim formu
