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
| **İmza anahtarı** | `~/CheepKeys/` — **proje dışında** (bkz. "İmza kasası") |
| **Sürüm komutu** | `npm run release:android` (elle prebuild + gradlew yerine) |
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
4. **İmza kasası** (`~/CheepKeys/`) yerinde olmalı (aşağıya bak). `key.properties`
   elle konmaz — plugin her prebuild'de kasadan üretir.

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

```bash
cd C:/dev/Cheep/Cheep-Mobile
npm run release:android
```

Hepsi bu. Script sırayla: kasayı doğrular → `expo prebuild --clean` çalıştırır →
`gradlew bundleRelease` → **imzayı denetler** → çıktıyı masaüstüne
`cheep-<sürüm>-vc<kod>.aab` adıyla kopyalar.

Elle prebuild/gradlew çalıştırmaya gerek yok ve **çalıştırılmamalı** — adımlardan
birini atlamak sessizce debug imzalı bir AAB üretebiliyor.

```bash
npm run release:android:apk        # Play'e değil, telefona kurmak için APK
npm run release:android -- --skip-prebuild   # yalnızca yeniden derle
```

Ara çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

### İmza doğrulaması otomatik

En sinsi hata AAB'nin **debug anahtarıyla** imzalanmış olmasıdır: derleme
başarılı görünür, dosya üretilir, Play Console yüklemeyi reddeder. Script bunu
üretimden sonra sertifika parmak izini kasadakiyle karşılaştırarak yakalar ve
eşleşmezse hata koduyla çıkar. Elle kontrol gerekirse:

```bash
"/c/Program Files/Java/jdk-17/bin/keytool.exe" -printcert \
  -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

`Owner: CN=Android Debug` görüyorsan yükleme — kasa bulunamamış demektir.

---

## İmza kasası

Anahtar **proje klasörünün dışında** yaşar:

```
~/CheepKeys/                     (veya $CHEEP_KEYSTORE_DIR)
  cheep-upload.keystore          ← gerçek sır
  signing.properties             ← parolalar + alias
  upload_certificate.pem         ← Play Console upload key reset formu için
  backups/<tarih>/               ← ikinci kopya
```

`signing.properties`:

```properties
storeFile=cheep-upload.keystore
storePassword=***
keyAlias=cheep-upload
keyPassword=***
```

`android/key.properties` **elle konmaz** — `plugins/withReleaseSigning.js` her
prebuild'de bunu kasadan, keystore'a **mutlak yol** vererek üretir. Kasa yoksa
dosya yazılmaz, derleme debug imzasına düşer ve prebuild yüksek sesle uyarır.

### Neden proje dışında

Keystore önce `android/app/` altındaydı — yani sürüm çıkarmanın tek geri
alınamaz sırrı, sürüm çıkarma adımının kendisi tarafından silinen klasörün
içindeydi. Belgede "önce yedekle" uyarısı vardı ama koruma, o satırı okumayı
hatırlamaya bağlıydı. Bir `prebuild --clean` anahtarı götürdü ve geri gelmedi.

Şimdi üç katman var:

| Katman | Ne yapar |
|---|---|
| Kasa proje dışında | `--clean` anahtarı göremiyor bile |
| `npm run release:android` | Elle `--clean` yazma ihtiyacını kaldırır, imzayı denetler |
| `.claude/hooks/guard-destructive.mjs` | `prebuild --clean` ve `rm -rf android/` komutlarını reddeder |

### Yeni anahtar üretmek

```bash
cd Cheep-Mobile
npm run keys:new
```

Kasayı oluşturur, güçlü bir parola üretip yazar, tarihli yedek bırakır ve
Play Console'a yüklenecek `.pem` sertifikasını dışa aktarır. **Mevcut kasanın
üzerine yazmaz.**

⚠️ Yeni bir upload anahtarı yayındaki uygulamada kendiliğinden geçerli olmaz:
Play Console → **App integrity** → **upload key reset** ile `.pem` gönderilip
Google'ın onaylaması gerekir (1–2 iş günü).

⚠️ **Kasayı harici bir diske veya şifreli buluta da kopyala.** Keystore
kaybolursa mevcut uygulamaya güncelleme yükleyemezsin; Play App Signing açık
olduğu için sıfırlama mümkün ama günlerce süren bir destek sürecidir.

### Neden bir config plugin var

Expo'nun ürettiği `build.gradle` şablonunda release bloğu **debug anahtarıyla**
imzalıyor ("Caution! In production, you need to generate your own keystore
file"). `build.gradle`'ı elle düzeltirsen ilk `prebuild --clean`'de kaybolur ve
fark etmeden debug imzalı bir AAB üretirsin.

`plugins/withReleaseSigning.js` bu bloğu her prebuild'de yeniden enjekte eder,
yani tuzak kapalı. Expo şablonu ileride değişirse plugin sessizce atlamaz —
anlaşılır bir hata fırlatıp derlemeyi durdurur.

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
