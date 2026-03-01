# 🐦 Cheep Mobile App

React Native + Expo ile geliştirilmiş akıllı alışveriş asistanı mobil uygulaması.

## 🚀 Özellikler

### ✅ Authentication
- Login & Register
- JWT token yönetimi (Secure Storage)
- Auto token refresh

### 🏠 Home Screen
- Ürün listesi ve arama
- Market listesi
- Kategori görüntüleme
- Ürün detay sayfaları

### 📋 Lists Management
- Alışveriş listesi oluşturma/düzenleme
- Aktif/Tamamlanan/Şablon listeler
- Ürün ekleme/silme
- Liste istatistikleri

### 🔍 Compare Engine
- Çoklu market karşılaştırması
- En iyi rota önerisi
- Bütçe kontrolü
- Eksik ürün bildirimi
- Favori market önceliklendirme
- 7-factor scoring algoritması

### 🛍️ Product Features
- Ürün detayları
- Fiyat karşılaştırması
- Market fiyatları görüntüleme
- Listeye ekleme

### 👤 Profile
- Kullanıcı profili
- Favori marketler
- Ayarlar (gelecek)

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js (v18+)
- Expo CLI
- iOS: Xcode (Mac gerekli)
- Android: Android Studio

### Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. iOS için (sadece Mac)
cd ios && pod install && cd ..

# 3. Uygulamayı başlat
npm start
```

### Çalıştırma

**Seçenek 1: Tunnel Mode (ÖNERİLEN)**
```bash
npx expo start --tunnel
```
QR kodu Expo Go ile tara.

**Seçenek 2: Normal Mode**
```bash
npm start
```

**Seçenek 3: Cache Temizle**
```bash
npm start -- --clear
```

### Backend Bağlantısı

Backend'in çalıştığından emin olun:
```bash
cd ../cheep-backend-express
npm run dev
```

Backend URL'i `src/constants/api.ts` dosyasında ayarlanabilir.

## 📁 Proje Yapısı

```
Cheep-Mobile/
├── src/
│   ├── components/       # UI Components
│   │   ├── ui/          # Button, Card, Input, FAB
│   │   ├── product/     # ProductCard
│   │   ├── store/       # StoreChip
│   │   ├── list/        # ListCard
│   │   └── common/      # EmptyState, SearchBar
│   ├── context/         # AuthContext
│   ├── navigation/      # Navigation setup
│   ├── screens/         # All screens
│   │   ├── auth/       # Login, Register
│   │   ├── home/       # Home, ProductDetail
│   │   ├── lists/      # Lists, ListDetail, CompareResults
│   │   ├── product/    # Product screens
│   │   ├── store/      # Store screens
│   │   ├── deals/      # Deals screen
│   │   └── profile/    # Profile screen
│   ├── services/        # API services
│   │   ├── auth.service.ts
│   │   ├── list.service.ts
│   │   ├── product.service.ts
│   │   └── store.service.ts
│   ├── theme/           # Design system
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   └── spacing.ts
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities
│   └── constants/       # Constants (API URL, etc.)
├── App.tsx             # Main entry point
└── package.json
```

## 🎨 Design System

### Renkler
```typescript
Primary:    #52B669  // Yeşil
Secondary:  #C4B5F7  // Lavanta
Accent:     #FFD97D  // Sarı
Background: #F5F3E8  // Krem
Error:      #FF6B6B  // Kırmızı
```

### Typography
- 8pt grid system
- Responsive font sizes
- Consistent spacing (xs, sm, md, lg, xl)

### Components
- **Button** - 4 variants (primary, secondary, outline, text)
- **Card** - 3 variants (default, elevated, outlined)
- **Input** - Text input with validation
- **FAB** - Floating Action Button
- **ProductCard** - Ürün kartı
- **StoreChip** - Market chip
- **ListCard** - Liste kartı
- **EmptyState** - Boş durum gösterimi
- **SearchBar** - Arama çubuğu

## 🔌 API Integration

### Base URL
```typescript
// src/constants/api.ts
export const API_BASE_URL = 'http://localhost:3000/api/v1';
```

### Services

**Auth Service:**
```typescript
import { authService } from './services';

// Login
const token = await authService.login(email, password);

// Register
await authService.register(userData);

// Get Me
const user = await authService.getMe();
```

**List Service:**
```typescript
import { listService } from './services';

// Get Lists
const lists = await listService.getLists('active');

// Create List
const newList = await listService.createList({ name: 'Market Listesi' });

// Compare List
const result = await listService.compareList(listId, {
  maxStores: 3,
  includeMissingProducts: true,
});
```

## 🧭 Navigation

### Yapı
```
Root Navigator
├── Auth Stack
│   ├── Login
│   └── Register
└── Tab Navigator (Authenticated)
    ├── Home Stack
    │   ├── Home
    │   ├── ProductDetail
    │   └── StoreDetail
    ├── Lists Stack
    │   ├── Lists
    │   ├── ListDetail
    │   └── CompareResults
    ├── Deals Stack
    │   └── Deals
    └── Profile Stack
        └── Profile
```

### Kullanım
```typescript
import { useNavigation } from '@react-navigation/native';

const navigation = useNavigation();
navigation.navigate('ProductDetail', { productId: 123 });
```

## 🎯 Kullanım Örnekleri

### Theme Kullanımı
```typescript
import { colors, typography, spacing } from './theme';

<View style={{
  backgroundColor: colors.primary.main,
  ...typography.styles.h1,
  padding: spacing.md,
}}>
```

### Auth Context
```typescript
import { useAuth } from './context/AuthContext';

const { user, login, logout, isAuthenticated } = useAuth();
```

### API Call
```typescript
import { productService } from './services';

const products = await productService.searchProducts({
  query: 'süt',
  category_id: 1,
  limit: 20,
});
```

## 📱 Implemented Screens

- ✅ Login
- ✅ Register
- ✅ Home
- ✅ Product Detail
- ✅ Store Detail (placeholder)
- ✅ Lists
- ✅ List Detail
- ✅ Compare Results
- ✅ Deals (placeholder)
- ✅ Profile

## 🐛 Troubleshooting

### Metro Bundler Error
```bash
npm start -- --reset-cache
```

### iOS Build Error
```bash
cd ios && pod install && cd ..
```

### Android Build Error
```bash
cd android && ./gradlew clean && cd ..
```

### API Connection Error
1. Backend'in çalıştığından emin olun (`localhost:3000`)
2. `src/constants/api.ts` dosyasındaki `API_BASE_URL`'i kontrol edin
3. WiFi aynı ağdaysa normal mode kullanın
4. Farklı ağdaysa tunnel mode kullanın: `npx expo start --tunnel`

### Network Issues
- Tunnel mode kullanın: `npx expo start --tunnel`
- Veya backend URL'ini IP adresinizle değiştirin: `http://192.168.x.x:3000`

## 🛠️ Teknoloji Yığını

- **Framework:** React Native + Expo
- **Navigation:** React Navigation
- **HTTP Client:** Axios
- **Storage:** Expo SecureStore
- **State Management:** React Context
- **TypeScript:** Full type safety
- **Styling:** StyleSheet API

## 📦 Paketler

```json
{
  "expo": "^50.0.0",
  "react-native": "0.73.0",
  "@react-navigation/native": "^6.x",
  "@react-navigation/stack": "^6.x",
  "@react-navigation/bottom-tabs": "^6.x",
  "axios": "^1.x",
  "expo-secure-store": "~12.x"
}
```

## 🔜 Coming Soon

- [ ] Push notifications
- [ ] Location services
- [ ] Barcode scanner
- [ ] Dark mode
- [ ] Onboarding screens
- [ ] Settings screen
- [ ] Edit profile screen
- [ ] Favorite stores management
- [ ] Product reviews
- [ ] Share lists

## 📝 Notlar

- Test kullanıcısı: `test@cheep.com` / `test123456`
- Backend URL'i environment variable olarak ayarlanabilir
- Secure Storage JWT token'ları saklar
- Auto token injection tüm API isteklerinde çalışır

## 🤝 Development

```bash
# Development mode
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android

# Web (experimental)
npm run web
```

---

**Happy Shopping! 🛒**
