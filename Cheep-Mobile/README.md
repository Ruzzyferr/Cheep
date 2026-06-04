# 🐦 Cheep Mobile App

React Native + Expo ile geliştirilmiş akıllı alışveriş asistanı. Premium "fintech" görsel dil, konum-bazlı (ülkeye göre) içerik, fiyat geçmişi grafikleri ve çoklu-market karşılaştırması.

## 🚀 Özellikler

- **Auth** — Login/Register, JWT **access + refresh** (SecureStore), 401'de sessiz token yenileme
- **Home** — aktif liste, akıllı fırsatlar, kategoriler, **gerçek mesafeli** yakındaki marketler (expo-location)
- **Lists** — oluştur/düzenle, aktif/tamamlanan/şablon, istatistikler
- **Compare** — çoklu market karşılaştırması, en iyi rota, bütçe kontrolü, 7-faktör skorlama
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
├── components/   # ui/, product/ (PriceTrendCard), home/, list/, store/, common/
├── context/      # AuthContext (access+refresh)
├── navigation/   # RootNavigator, TabNavigator, *Navigator
├── screens/      # auth, home (NewHomeScreen), product, lists, store, deals, profile
├── services/     # api.client (token+country interceptor), auth/product/list/store services
├── theme/        # colors, typography, spacing, shadows
├── utils/        # storage (token/refresh/country/location), geo (haversine + reverseGeocode)
└── constants/    # api.ts (EXPO_PUBLIC_API_URL)
App.tsx           # giriş (index.js → App.tsx → RootNavigator)
```

## 🧭 Navigation

```
Root → Auth (Login/Register)  |  Tab (Home / Lists / Deals / Profile)
Home: HomeMain → ProductDetail → StoreDetail → CategoryProducts
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

## 📝 Notlar

- Test kullanıcısı: `test@cheep.com` / `test123456`
- Konum izni ilk Home açılışında istenir; reddedilirse mesafe gizlenir, ülke default'a (`TR`) düşer
- Bu sürümde eski Expo Router boilerplate'i kaldırıldı; uygulama `src/` altındaki React Navigation yapısını kullanır
