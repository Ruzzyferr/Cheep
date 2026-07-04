# Liste Detayı Ekranı — Yoğunluk Yeniden Tasarımı

**Tarih:** 2026-07-05
**Dosya:** `Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx`
**Kapsam:** Yalnızca bu ekranın layout/stil'i. Backend, i18n anahtarları, ⋮ menüsü, import akışı, navigasyon davranışı DEĞİŞMEZ.

## Problem

Mevcut ekran çok düşük yoğunluklu. Ekrana yalnızca ~2.5 ürün sığıyor, kullanıcı 8 ürünü görmek için çok kaydırıyor:

- **Başlık:** `shadows.md` + `padding: xl` + `margin` olan dev gölgeli kart aşırı dikey alan tüketiyor.
- **Ürün satırları:** Her ürün `Card padding="md"` içinde; 44px thumb + 2 satırlık isim + marka + adet → satır başına ~110px.
- **"Sil" butonu:** `variant="text"` ile tema yeşili → yıkıcı aksiyon pozitif renkte, yanıltıcı.
- **Alt aksiyon çubuğu:** Kullanıcının cihazında tab-bar arkasında kesik görünüyor (muhtemelen eski APK; kod `useBottomTabBarHeight()` ile bunu zaten hedefliyor — build'de doğrulanacak).

## Hedef

- Ekrana **~12–14 ürün** sığsın (mevcut ~2.5 yerine).
- "Sil" **kırmızı/yıkıcı** görünsün.
- Alt çubuk tab-bar'ın üstünde, kesilmeden dursun.
- Uygulamanın mevcut tasarım dili (theme token'ları: `colors`, `typography`, `spacing`, `borderRadius`) korunur.

## Tasarım

### 1. Başlık: dev gölgeli kart → ince şerit

- `styles.header` kartından `shadows.md`, `borderWidth`, `borderRadius.lg`, `margin`, `paddingTop: xl` kaldırılır.
- Yerine iki-satırlık kompakt bir bölüm:
  - **1. satır:** `Haftalık` (typography `h4`, eski `h3` değil, `fontWeight 700`) · `✓Aktif` çipi (mevcut `activeChip` stili korunur) · sağda `⋮` (40×40 dokunma alanı korunur).
  - **2. satır:** küçük gri `8 ürün` (`typography.styles.body2`, `text.secondary`); bütçe varsa sağda `budget` aynı kalır.
- Bölümün altında ince ayraç: `borderBottomWidth: 1, borderBottomColor: colors.border.light`.
- Yatay padding `layout.screenPadding`, dikey padding küçük (`spacing.sm`–`md`).

### 2. "Bu liste aktif değil" şeridi

- Korunur ama aynı ince dile uyacak şekilde dikey padding küçültülür (`spacing.sm`). İşlev (`Aktif Yap` butonu → `handleSetActive`) aynı.

### 3. Ürün satırları: kart → ultra-kompakt satır

`ListItemCard` yeniden yazılır:

- `Card` sarmalayıcı **kaldırılır**; satır düz `View` olur.
- Yapı: `[36px thumb]  İsim (numberOfLines={1}, ellipsis)  ·  🗑` üst satır; altında küçük gri alt satır `Marka · {quantity} {unit}`.
  - `productName`: `typography.styles.body2` civarı, `fontWeight 500`, `numberOfLines={1}`.
  - Alt satır: `typography.styles.caption`, `text.secondary`. Marka yoksa yalnızca adet gösterilir.
- `itemThumb` 44 → **36px**.
- Satırlar arası **ince ayraç** (`borderBottomWidth: 1, borderBottomColor: colors.border.light`) — dolu kart yerine. FlatList `ItemSeparatorComponent` veya satır `borderBottom`'u ile.
- Hedef satır yüksekliği ~56–60px.
- **`brand_independent` durumu:** ayrı satır (`🏷️ marka farketmez`) yerine isim yanına küçük 🏷️ işareti/çipi — dikey alan tüketmez.
- **Uzun-basma davranışı korunur:** `onLongPress={() => onToggleBrandIndependent(item)}` (marka tercihi toggle).

### 4. "Sil" → kırmızı çöp kutusu ikonu

- `Button title="Sil" variant="text"` kaldırılır.
- Yerine `TouchableOpacity` + `MaterialIcons name="delete-outline"` (veya `delete`), renk **`colors.error.main`** (`#E5484D`, temada mevcut).
- `hitSlop` ile dokunma alanı korunur.
- Basınca mevcut `handleDeleteItem` onay Alert'i aynen çalışır (`style: 'destructive'`).

### 5. Alt aksiyon çubuğu (sağlamlaştırma)

- Mevcut yapı korunur: `[Ürün Ekle (outline)] [Rotaları Göster (primary)]`, `position: absolute`, `bottom: tabBarHeight`.
- Liste `contentContainerStyle.paddingBottom = tabBarHeight + <çubuk yüksekliği>` olacak şekilde doğrulanır (çubuğun altında kalan son ürün erişilebilir olmalı).
- Build'de gerçek cihaz/emülatörde alt çubuğun tab-bar'ın üstünde, kesilmeden durduğu doğrulanır.

## Dokunulmayanlar

- ⋮ menüsü (`ListActionsSheet`): Aktif yap / Klonla / Başka listeden aktar / Sil.
- Import akışı (`SelectSourceListModal`, `ImportModeModal`, iOS modal sıralama `openAfterDismiss`).
- `NameInputModal` (klonla/yeniden adlandır).
- Tüm i18n anahtarları, `listService` çağrıları, navigasyon, backend.

## Doğrulama Kriterleri

1. Emülatör/cihazda 8+ ürünlü listede aynı anda ≥10 ürün görünür (kaydırmasız).
2. "Sil" ikonu kırmızı; basınca onay diyaloğu çıkar; onaylayınca ürün silinir.
3. Alt çubuk tab-bar'ın üstünde tam görünür, hiçbir buton kesilmez.
4. Uzun-basma marka-tercihi toggle'ı hâlâ çalışır.
5. Aktif olmayan liste şeridi ve ⋮ menüsü/işlevleri regresyonsuz çalışır.
