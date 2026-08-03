# 🐦 Cheep Mobile App

React Native + Expo ile geliştirilmiş akıllı alışveriş asistanı. Premium "fintech" görsel dil, konum-bazlı (ülkeye göre) içerik, fiyat geçmişi grafikleri ve çoklu-market karşılaştırması.

## 🚀 Özellikler

- **Auth** — Login/Register, JWT **access + refresh** (SecureStore), 401'de sessiz token yenileme
- **Onboarding** — maskotlu sihirbaz (5 alışveriş-odaklı soru: hane, diyet, alerji, bütçe); ilk girişte profil oluşturur
- **AI Asistan** — Gemini sohbet ekranı: doğal dille liste yönetimi, optimistic gönderim, tool-call sonuçlarında `ListActionCard`, yazıyor göstergesi, sohbet geçmişi (thread) + silme, **günlük limit göstergesi/kilidi**
- **Home** — aktif liste, akıllı fırsatlar, kategoriler, **gerçek mesafeli** yakındaki marketler (expo-location)
- **Lists** — oluştur/düzenle, aktif/tamamlanan/şablon, istatistikler; öğelerde **marka-bağımsız** toggle (muadil-grup en ucuz)
- **Compare** — çoklu market karşılaştırması, en iyi rota, bütçe kontrolü, 7-faktör skorlama; kazanan marka rozeti
- **Profile** — diyet/alerjen/bütçe tercihlerini düzenleme; ürün kartlarında profile-bazlı uyarı/diyet-uyumu rozetleri
- **Product Detail** — market fiyatları + **fiyat geçmişi grafiği** (sparkline)
- **Deals** — marketler arası en yüksek tasarruflu ürünler
- **Country scoping** — cihaz konumundan ISO ülke kodu çözülür, `x-country` header'ı ile API ülkeye göre yanıt verir

## 🚀 Kurulum

```bash
npm install
cp .env.example .env          # EXPO_PUBLIC_API_URL ayarla
npx expo start
```

**API adresi** `EXPO_PUBLIC_API_URL` ile yapılandırılır (hardcoded IP yok):
- iOS simülatör: `http://localhost:3000/api/v1`
- Android emülatör: `http://10.0.2.2:3000/api/v1`
- Fiziksel cihaz: `http://<bilgisayar-LAN-IP>:3000/api/v1`

Backend'in çalıştığından emin olun (`cd ../cheep-backend-express && pnpm dev`).

## 🎨 Design System (Modern Fintech / Clean)

Tüm ekranlar `src/theme` token'larından okur; tema değişimi otomatik yayılır.

```
Primary (accent): #0D9488  // Canlı teal (buton, FAB, fiyat, aktif sekme)
Surface:          #FFFFFF  // Beyaz kartlar
Background:        #F6F8FA  // Nötr açık gri
Text:             #0F172A / #64748B
```
- Yuvarlak kartlar (radius lg = 16), yumuşak "floating" gölgeler, ferah boşluk (8pt grid)
- Bileşenler: Button (4 varyant, erişilebilir), Card, Input, FAB, ProductCard, StoreChip, **PriceTrendCard**, NearbyStoreCard, EmptyState, SearchBar

## 📁 Proje Yapısı

```
src/
├── components/   # ui/, product/ (PriceTrendCard), home/, list/, store/, common/,
│                 #   assistant/ (MessageBubble, ChatInputBar, ToolActivityChip, ListActionCard, ThreadListSheet)
├── context/      # AuthContext (access+refresh, onboardingDone)
├── navigation/   # RootNavigator (onboarding gate), TabNavigator (merkez FAB → Asistan), Assistant/Onboarding/*Navigator
├── screens/      # auth, onboarding, home (NewHomeScreen), product, lists, store, deals, profile, assistant
├── services/     # api.client (token+country interceptor), auth/product/list/store/profile/assistant services
├── theme/        # colors, typography, spacing, shadows
├── utils/        # storage (token/refresh/country/location), geo (haversine + reverseGeocode)
└── constants/    # api.ts (EXPO_PUBLIC_API_URL)
App.tsx           # giriş (index.js → App.tsx → RootNavigator)
```

## 🧭 Navigation

```
Root → Auth (Login/Register)  |  Onboarding (ilk giriş)  |  Tab (Home / Lists / Asistan-FAB / Deals / Profile)
Home: HomeMain → ProductDetail → StoreDetail → CategoryProducts
Assistant: ChatScreen (thread geçmişi sheet'i)
Deals: DealsMain → (Home stack'e cross-tab) ProductDetail
```

## 🛠️ Teknoloji

- React Native 0.81 · Expo 54 · React Navigation · Axios
- expo-secure-store (token), expo-location (konum/ülke)
- TypeScript (strict), tek ESLint flat config (eslint-config-expo)

## 🚦 Scripts

```bash
npm start          # expo start
npm run android / ios / web
npm run lint       # expo lint
npm run typecheck  # tsc --noEmit
```

## 📦 Sürüm çıkarma

Derleme **yerel** yapılır (`gradlew`), EAS Build kullanılmaz. `android/` ve
`ios/` klasörleri git'te yok — `expo prebuild` üretir.

```bash
npm run release:android        # prebuild + bundleRelease + imza denetimi + masaüstüne kopyala
npm run release:android:apk    # Play'e değil, telefona kurmak için APK
```

Prebuild ve gradlew'i **elle çalıştırma**: adımlardan birini atlamak sessizce
debug anahtarıyla imzalanmış, Play Console'un reddedeceği bir AAB üretiyor.
Script imzayı üretimden sonra denetler.

İmza anahtarı **proje dışında** yaşar (`~/CheepKeys`, ya da `$CHEEP_KEYSTORE_DIR`)
ve `android/key.properties`'i her prebuild'de `plugins/withReleaseSigning.js`
oradan üretir. Bunun sebebi acı: anahtar bir kez `android/app/` altındaydı ve
`prebuild --clean` onu sildi.

```bash
npm run keys:new               # yeni upload anahtarı üret (mevcudun üzerine yazmaz)
```

Tam rehber (imza kasası, sürüm numarası, Play Console, iOS, push mimarisi):
**[../docs/BUILD-RELEASE.md](../docs/BUILD-RELEASE.md)**

## 🔔 Bildirimler

Doğrudan **FCM** kullanılıyor, Expo push servisi değil. `google-services.json`
proje KÖKÜNDE durur ve `app.json` üzerinden referanslanır — `android/app/` içine
konursa bir sonraki prebuild'de silinir.

İzin akışı `src/utils/notificationGate.ts`: açılışta, konum kapısından SONRA
ardışık çalışır ve sistem modalından önce kendi gerekçesini gösterir (Android'de
iki reddedilen izin kalıcı olarak kapanıyor).

## 📝 Notlar

- Test kullanıcısı: `test@cheep.com` / `test123456`
- Konum izni ilk Home açılışında istenir; reddedilirse mesafe gizlenir, ülke default'a (`TR`) düşer
- Bu sürümde eski Expo Router boilerplate'i kaldırıldı; uygulama `src/` altındaki React Navigation yapısını kullanır
