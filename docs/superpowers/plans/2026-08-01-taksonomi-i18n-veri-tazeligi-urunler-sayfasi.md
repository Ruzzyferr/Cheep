# Taksonomi, kategori i18n'i, veri tazeliği ve ürünler sayfası — Uygulama Planı

> **Ajan çalışanlar için:** Bu plan görev görev uygulanır. Adımlar checkbox
> (`- [ ]`) ile takip edilir.

**Hedef:** Kategori taksonomisini ülke bazlı ve kaynaktan türetilmiş hale
getirmek, kategori adlarını dile çevirmek, mobilde veriyi kendiliğinden taze
tutmak ve website'ye gerçek bir ürünler sayfası eklemek.

**Mimari:** `Category` ülkeye bağlanır (`country_id` + `@@unique([country_id, slug])`),
böylece TR'nin devlet-türetimli ağacı ile PL'nin scraper ağacı çakışmadan yan
yana durur. Görüntülenen adlar `x-lang` ile sunucuda çevrilir. Mobil, elle
`loadData()` çağrılarını bırakıp TanStack Query'ye geçer. Website'nin ürünler
sayfası ilk ekranı prerender edip sonrasını canlı API'den besler.

**Teknoloji:** Prisma 6 / PostgreSQL 16, Express + TypeScript, vitest;
React Native (Expo 54) + TanStack Query v5; React 19 + Vite + react-router.

**Spec:** `docs/superpowers/specs/2026-08-01-taksonomi-i18n-veri-tazeligi-urunler-sayfasi-design.md`

## Global kısıtlar

- Hiçbir kategori/market/sayı listesi istemcide sabitlenmez; tamamı API'den gelir.
- Kod yorumları ve kullanıcıya görünen metinler Türkçe; kod tanımlayıcıları İngilizce.
- Desteklenen diller: `tr`, `en`, `de`, `pl`, `sv`. Ülkeler: `TR`, `PL` (canlı), `DE`, `CH`, `SE` (kapalı).
- Backend `pnpm typecheck` ve `pnpm test` temiz geçmeden hiçbir görev bitmiş sayılmaz.
- Mobil `npm run typecheck` temiz geçmeden hiçbir görev bitmiş sayılmaz.
- Website `npx tsc -b` temiz geçmeden hiçbir görev bitmiş sayılmaz.
- Migration scriptleri idempotent ve `--dry-run` destekli olmalı.
- Yerel geliştirme veritabanı: `postgresql://postgres:postgres@127.0.0.1:5544/cheep_db`
  (socat proxy `cheep-pg-proxy` → `cheep-postgres`). Prod ile aynı kategori yapısına sahip.

---

## Paket 1 — Ülke bazlı taksonomi

### Görev 1.1: Kategori ülke çözümleyicisi (saf fonksiyon + test)

**Dosyalar:**
- Oluştur: `cheep-backend-express/src/services/category-ownership.ts`
- Test: `cheep-backend-express/test/category-ownership.test.ts`

**Arayüz — sonraki görevler buna dayanır:**

```ts
export interface CategoryNode { id: number; slug: string; parent_id: number | null }
export interface CategoryProductCount { categoryId: number; countryId: number; n: number }

/** Kategori id → alt ağacındaki tüm kategori id'leri (kendisi dahil). */
export function subtreeIds(nodes: CategoryNode[], rootId: number): number[]

/**
 * Her kategori için hangi ülkelere ait olduğunu çözer.
 * Alt ağacındaki ürünlerin country_id'lerine bakar.
 * Birden çok ülke varsa hepsini döner → çağıran kategoriyi böler.
 */
export function resolveOwners(
  nodes: CategoryNode[],
  counts: CategoryProductCount[],
): Map<number, number[]>
```

- [ ] **Adım 1:** `test/category-ownership.test.ts` yaz — `subtreeIds` tek
  seviye, çok seviye ve döngü korumalı; `resolveOwners` tek ülke, çok ülke ve
  ürünsüz (boş dizi) durumları.
- [ ] **Adım 2:** `npx vitest run test/category-ownership.test.ts` → FAIL (modül yok).
- [ ] **Adım 3:** `src/services/category-ownership.ts` implement et.
- [ ] **Adım 4:** `npx vitest run test/category-ownership.test.ts` → PASS.
- [ ] **Adım 5:** Commit.

### Görev 1.2: Şema migration'ı — `Category.country_id`

**Dosyalar:**
- Değiştir: `cheep-backend-express/prisma/schema.prisma` (`model Category`, `model Country`)
- Oluştur: `cheep-backend-express/prisma/migrations/20260801200000_category_country_scope/migration.sql`

Şema değişikliği:

```prisma
model Category {
  id            Int     @id @default(autoincrement())
  name          String
  slug          String
  country_id    Int
  parent_id     Int?
  display_order Int     @default(0)
  icon_url      String?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
  country  Country    @relation(fields: [country_id], references: [id], onDelete: Cascade)
  parent   Category?  @relation("CategoryHierarchy", fields: [parent_id], references: [id], onDelete: Cascade)
  children Category[] @relation("CategoryHierarchy")
  products Product[]
  @@unique([country_id, slug])
  @@index([parent_id])
  @@index([country_id, parent_id])
  @@map("categories")
}
```

`Country` modeline `categories Category[]` eklenir.

migration.sql sırası (tek transaction):
1. `ALTER TABLE categories ADD COLUMN country_id INTEGER;`
2. Mevcut satırları doldur: alt ağaçtaki ürün çoğunluğuna göre; hiç ürünü
   olmayan kategori TR'ye (id 1) atanır — Görev 1.3 zaten silecek.
3. `ALTER TABLE categories ALTER COLUMN country_id SET NOT NULL;`
4. FK + `DROP INDEX categories_slug_key;` + `CREATE UNIQUE INDEX categories_country_id_slug_key ON categories(country_id, slug);`
5. `CREATE INDEX categories_country_id_parent_id_idx ON categories(country_id, parent_id);`

Not: 2. adım yalnızca kolonun NOT NULL olabilmesi için kaba bir doldurmadır;
gerçek ülke ayrıştırma ve bölme işi Görev 1.3'ün scriptidir.

- [ ] **Adım 1:** schema.prisma'yı güncelle.
- [ ] **Adım 2:** migration.sql'i elle yaz (veri koruyan, `prisma migrate dev` üretimi DEĞİL).
- [ ] **Adım 3:** `DATABASE_URL=... npx prisma migrate deploy` yerel DB'de çalıştır.
- [ ] **Adım 4:** `npx prisma generate` + `pnpm typecheck` → derleme hatalarını gider.
- [ ] **Adım 5:** Doğrula: `SELECT count(*) FROM categories WHERE country_id IS NULL;` → 0.
- [ ] **Adım 6:** Commit.

### Görev 1.3: Taksonomi birleştirme scripti

**Dosyalar:**
- Oluştur: `cheep-backend-express/scripts/reconcile-taxonomy.ts`
- Oluştur: `cheep-backend-express/prisma/migrations/20260801210000_category_redirects/migration.sql`
- Test: `cheep-backend-express/test/reconcile-taxonomy.test.ts`

`category_redirects` tablosu:

```sql
CREATE TABLE category_redirects (
  id         SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  old_slug   TEXT NOT NULL,
  new_slug   TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (country_id, old_slug)
);
```

Script davranışı (`--dry-run` varsayılan; yazmak için `--apply`):
1. Ülke başına ürünü olan kategori kümesini çıkarır.
2. Birden çok ülkeye hizmet eden kategoriyi ülke başına kopyaya böler
   (kopya aynı slug, farklı `country_id`); ürünleri kendi ülkesinin kopyasına bağlar;
   çocukları da aynı şekilde böler (özyinelemeli, kökten yaprağa).
3. TR tarafında yaprakları devlet ağacındaki yerine geri koyar. Girdi:
   `--taxonomy <taxonomy.json>` (`mf_taxonomy.py` çıktısı). Dosya verilmezse
   bu adım atlanır ve raporda "TR yeniden bağlama atlandı" yazar.
4. Alt ağacında ürün kalmayan kategorileri siler.
5. Silinen/değişen slug'lar için `category_redirects` yazar.
6. Rapor basar: bölünen, taşınan, silinen sayıları.

- [ ] **Adım 1:** `category_redirects` migration'ını yaz ve uygula.
- [ ] **Adım 2:** `test/reconcile-taxonomy.test.ts` — bölme mantığının saf
  kısmı (`planReconciliation(nodes, counts, taxonomy)` → işlem listesi) için
  test yaz; DB'ye dokunmayan saf fonksiyon.
- [ ] **Adım 3:** Test FAIL doğrula.
- [ ] **Adım 4:** `scripts/reconcile-taxonomy.ts` implement et (saf `planReconciliation` + DB uygulayıcı).
- [ ] **Adım 5:** Test PASS doğrula.
- [ ] **Adım 6:** Yerel DB'de `--dry-run` çalıştır, raporu incele.
- [ ] **Adım 7:** Yerel DB'de `--apply` çalıştır; sonra doğrula:
  her kategori tek ülkeye ait, ürünsüz kategori yok, kategorisiz ürün yok.
- [ ] **Adım 8:** Commit.

### Görev 1.4: Kategori API'sini ülkeye göre filtrele

**Dosyalar:**
- Değiştir: `cheep-backend-express/src/api/categories/categories.service.ts`
- Değiştir: `cheep-backend-express/src/api/categories/categories.controller.ts`
- Test: `cheep-backend-express/test/categories-country-scope.test.ts`

Servis imzaları `countryId` alır ve alt ağaç ürün sayısı döndürür:

```ts
export interface CategoryWithCount {
  id: number; name: string; slug: string; parent_id: number | null;
  display_order: number; icon_url: string | null; product_count: number;
}
export const getParentCategories = (countryId: number) => Promise<CategoryWithCount[]>
export const getSubcategories = (parentId: number, countryId: number) => Promise<CategoryWithCount[]>
export const getCategoryTree = (countryId: number) => Promise<(CategoryWithCount & { children: CategoryWithCount[] })[]>
```

Ürün sayısı tek özyinelemeli CTE ile hesaplanır ve `country_id` ile filtrelenir.
`product_count = 0` olan kategori döndürülmez.

- [ ] **Adım 1:** Test yaz — TR isteği PL-only kategoriyi görmez; ürünsüz
  kategori dönmez; alt kategori sayısı çocuklarını toplar.
- [ ] **Adım 2:** FAIL doğrula.
- [ ] **Adım 3:** Servis + controller'ı implement et.
- [ ] **Adım 4:** PASS doğrula.
- [ ] **Adım 5:** Commit.

### Görev 1.5: Eskimiş kategori otoritelerini kaldır

**Dosyalar:**
- Sil: `cheep-backend-express/scripts/migrate-to-standard-categories.ts`
- Sil: `cheep-backend-express/scripts/fix-category-hierarchy.ts`
- Değiştir: `cheep-backend-express/src/config/standard-categories.ts` (başlık yorumu: yalnızca PL seed'i)
- Değiştir: `cheep-backend-express/prisma/seed.ts`, `scripts/sync-pl-categories.ts` (PL `country_id` ile upsert)

- [ ] **Adım 1:** İki scripti sil, `grep -rn` ile referans kalmadığını doğrula.
- [ ] **Adım 2:** `standard-categories.ts` başlığına kapsamı yaz (PL seed'i; TR devletten türer).
- [ ] **Adım 3:** seed.ts ve sync-pl-categories.ts'i `country_id` verecek şekilde güncelle.
- [ ] **Adım 4:** `pnpm typecheck` + `pnpm test` temiz.
- [ ] **Adım 5:** Commit.

---

## Paket 2 — Kategori i18n'i

### Görev 2.1: Çeviri sözlüğü ve çözümleyici

**Dosyalar:**
- Oluştur: `cheep-backend-express/src/config/category-i18n.ts`
- Sil: `cheep-backend-express/src/config/category-locale.ts` (içeriği taşınır)
- Değiştir: `cheep-backend-express/test/category-locale.test.ts` → `test/category-i18n.test.ts`

```ts
export type Lang = 'tr' | 'en' | 'de' | 'pl' | 'sv';
export const SUPPORTED_LANGS: readonly Lang[];
export interface LocalizedCategory { name: string; slug: string }

/** countryCode → kanonik slug → dil → çeviri. */
export const CATEGORY_I18N: Record<string, Record<string, Partial<Record<Lang, LocalizedCategory>>>>;

/** Eşleşme yoksa kaynak ad/slug olduğu gibi döner. */
export function localizeCategory(
  countryCode: string, lang: Lang, name: string, slug: string,
): LocalizedCategory;
```

- [ ] **Adım 1:** Testi yaz (mevcut `category-locale.test.ts` iddialarını koru,
  dil boyutu ekle; slug'lar URL-güvenli ve dil içinde benzersiz olmalı).
- [ ] **Adım 2:** FAIL doğrula.
- [ ] **Adım 3:** Sözlüğü ve fonksiyonu yaz; mevcut PL eşlemesini taşı, TR/EN/DE/SV ekle.
- [ ] **Adım 4:** PASS doğrula.
- [ ] **Adım 5:** Commit.

### Görev 2.2: `x-lang` middleware'i

**Dosyalar:**
- Oluştur: `cheep-backend-express/src/middleware/lang.middleware.ts`
- Değiştir: `cheep-backend-express/src/types/express.d.ts` (`req.lang: Lang`)
- Değiştir: `cheep-backend-express/src/index.ts` (country middleware'inden hemen sonra)
- Test: `cheep-backend-express/test/lang-middleware.test.ts`

Çözümleme sırası: `x-lang` → `Accept-Language` → ülkenin varsayılan dili → `tr`.

- [ ] **Adım 1..5:** Test yaz → FAIL → implement → PASS → commit.

### Görev 2.3: Çeviriyi yanıt yollarına bağla

**Dosyalar:**
- Değiştir: `categories.service.ts` / `categories.controller.ts`
- Değiştir: `products.service.ts` (ürün yanıtındaki `category`)
- Değiştir: `seo.service.ts` (`localizeCategory` yeni imzaya geçer)
- Test: `cheep-backend-express/test/category-i18n-routes.test.ts`

- [ ] **Adım 1..5:** Test yaz → FAIL → implement → PASS → commit.

### Görev 2.4: Mobil `x-lang` başlığı

**Dosyalar:**
- Değiştir: `Cheep-Mobile/src/services/api.client.ts` (request interceptor)
- Test: `Cheep-Mobile/src/services/__tests__/api-lang-header.test.ts`

- [ ] **Adım 1..5:** Test yaz → FAIL → implement → PASS → commit.

---

## Paket 3 — Ürün listeleme ucu

### Görev 3.1: Yeni filtreler ve sıralama

**Dosyalar:**
- Değiştir: `cheep-backend-express/src/api/products/product.schema.ts`
- Değiştir: `cheep-backend-express/src/api/products/products.service.ts`
- Test: `cheep-backend-express/test/products-filters.test.ts`

Yeni query parametreleri: `category_slug`, `store_slug` (virgüllü çoklu),
`sort` (`relevance|price_asc|price_desc|savings|name`), `min_stores`,
`min_price`, `max_price`. Mevcut `category_id`, `brand`, `search`, `limit`,
`offset` korunur.

- [ ] **Adım 1..5:** Test yaz → FAIL → implement → PASS → commit.

### Görev 3.2: Facet sayıları

**Dosyalar:**
- Değiştir: `products.service.ts`, `products.controller.ts`
- Test: `cheep-backend-express/test/products-facets.test.ts`

Yanıt: `{ data, pagination, facets: { categories: {slug,name,n}[], stores: {slug,name,n}[] } }`.
Facet'ler, kendi boyutları hariç tutularak hesaplanır (bir markete filtrelemek
diğer marketlerin sayısını sıfırlamaz).

- [ ] **Adım 1..5:** Test yaz → FAIL → implement → PASS → commit.

---

## Paket 4 — Mobil veri katmanı

### Görev 4.1: TanStack Query kurulumu ve key fabrikası

**Dosyalar:**
- Değiştir: `Cheep-Mobile/package.json` (`@tanstack/react-query` ^5)
- Oluştur: `Cheep-Mobile/src/queries/client.ts`, `Cheep-Mobile/src/queries/keys.ts`
- Değiştir: `Cheep-Mobile/App.tsx` (`QueryClientProvider`)
- Test: `Cheep-Mobile/src/queries/__tests__/keys.test.ts`

Key fabrikası ülke ve dili her key'e dahil eder.

- [ ] **Adım 1..5:** Test yaz → FAIL → implement → PASS → commit.

### Görev 4.2: Odak/ağ köprüsü

**Dosyalar:**
- Oluştur: `Cheep-Mobile/src/queries/focus.ts` (`AppState` → `focusManager`)
- Değiştir: `App.tsx`

- [ ] **Adım 1..4:** Implement → `npm run typecheck` → uygulamayı aç → commit.

### Görev 4.3: Sorgu hook'ları

**Dosyalar:**
- Oluştur: `src/queries/useCategories.ts`, `useProducts.ts`, `useLists.ts`,
  `useStores.ts`, `useDeals.ts`, `useNotifications.ts`, `useProfile.ts`

- [ ] **Adım 1..4:** Implement → typecheck → commit.

### Görev 4.4: Mutasyonlar ve invalidation

**Dosyalar:**
- Oluştur: `src/queries/useListMutations.ts`
- Değiştir: `src/context/CartContext.tsx` (query'den beslenir)

Liste ekleme/çıkarma/oluşturma/tamamlama; başarıda `lists`, `activeList`,
`compare` key'leri geçersizleşir; hızlı eklemede iyimser güncelleme.

- [ ] **Adım 1..4:** Implement → typecheck → commit.

### Görev 4.5: Ekranları hook'lara geçir

**Dosyalar (sırayla, her biri ayrı commit):**
- `screens/home/NewHomeScreen.tsx`
- `screens/product/CategoryProductsScreen.tsx`
- `screens/lists/ListsScreen.tsx`, `ListDetailScreen.tsx`, `CompareResultsScreen.tsx`
- `screens/product/ProductDetailScreen.tsx`, `PriceDifferenceScreen.tsx`
- `screens/deals/DealsScreen.tsx`, `screens/search/SearchScreen.tsx`
- `screens/store/StoreDetailScreen.tsx`, `screens/notifications/NotificationsScreen.tsx`
- `screens/profile/ProfileScreen.tsx`

Her ekranda: elle `useState`+`useEffect` yükleme kodu silinir, hook kullanılır.
`NewHomeScreen`'de `categoryHomeRank` / `HOME_PRIORITY` kullanımı kaldırılır
(sıra API'den gelir) ve `.slice(0, 7)` kalkar.

- [ ] Her ekran için: değiştir → typecheck → commit.

### Görev 4.6: `HOME_PRIORITY`'yi sil

**Dosyalar:**
- Değiştir: `Cheep-Mobile/src/utils/categoryIcon.ts` (`HOME_PRIORITY`, `categoryHomeRank` silinir)

`getCategoryIcon` kalır (ikon eşlemesi meşru bir sunum kararı).

- [ ] **Adım 1:** Sil, `grep -rn categoryHomeRank src` boş dönmeli.
- [ ] **Adım 2:** typecheck → commit.

---

## Paket 5 — Yükleme göstergeleri

### Görev 5.1: Ortak bileşenler

**Dosyalar:**
- Oluştur: `Cheep-Mobile/src/components/ui/Loading.tsx`
  (`ScreenLoader`, `RefreshBar`, `GridSkeleton`, `ListSkeleton`, `CardSkeleton`, `DetailSkeleton`)
- Değiştir: `src/components/ui/index.ts`

Mevcut `GridSkeleton` (halihazırda `ui`'den export ediliyor) buraya taşınır.

- [ ] **Adım 1..3:** Implement → typecheck → commit.

### Görev 5.2: Ekranlara uygula

Kural: `isPending` → iskelet, `isFetching && !isPending` → `RefreshBar`,
`isError` → tekrar dene, boş → `EmptyState`.

Öncelik (şu an hiç göstergesi olmayanlar): `NewHomeScreen`,
`PriceDifferenceScreen`, `StoreDetailScreen`, `StrategyDetailScreen`,
`AssistantChatScreen`. Sonra kalan tüm ekranlar.

- [ ] Her ekran için: değiştir → typecheck → commit.

---

## Paket 6 — Website ürünler sayfası

### Görev 6.1: Rota ve veri tipleri

**Dosyalar:**
- Değiştir: `cheep-website/src/data/routes.ts` (`ContentKind`'e `products`; tr `urunler`, pl `produkty`)
- Değiştir: `cheep-website/src/data/context.tsx` (`PagePayload`'a `kind: 'products'`)
- Değiştir: `cheep-website/src/AppRoutes.tsx`
- Değiştir: `cheep-website/src/i18n/tr.ts`, `pl.ts`, `content.ts` (nav + sayfa metinleri)

- [ ] **Adım 1..3:** Implement → `npx tsc -b` → commit.

### Görev 6.2: API istemcisi

**Dosyalar:**
- Oluştur: `cheep-website/src/lib/api.ts`

`fetchProducts(params)` → `{ items, total, facets }`; `AbortController` ile
istek iptali; hata durumunda tipli sonuç.

- [ ] **Adım 1..3:** Implement → tsc → commit.

### Görev 6.3: URL durum yönetimi

**Dosyalar:**
- Oluştur: `cheep-website/src/pages/content/products/useProductQueryState.ts`

`?kategori=&market=&sirala=&min=&max=&ara=&sayfa=` ile çift yönlü senkron.

- [ ] **Adım 1..3:** Implement → tsc → commit.

### Görev 6.4: Sayfa bileşenleri

**Dosyalar:**
- Oluştur: `cheep-website/src/pages/content/ProductsPage.tsx`
- Oluştur: `cheep-website/src/components/products/CategorySidebar.tsx`
- Oluştur: `cheep-website/src/components/products/FilterBar.tsx`
- Oluştur: `cheep-website/src/components/products/ProductsSkeleton.tsx`
- Yeniden kullan: `components/price/ProductGrid.tsx`, `Pagination.tsx`

- [ ] **Adım 1..3:** Implement → tsc → commit.

### Görev 6.5: Prerender entegrasyonu

**Dosyalar:**
- Değiştir: `cheep-website/scripts/` altındaki üretim scripti
- Değiştir: `cheep-website/src/entry-server.tsx`
- Değiştir: `cheep-backend-express/src/api/seo/seo.service.ts` (ilk ekran + kategori ağacı payload'ı)

- [ ] **Adım 1..3:** Implement → yerel build → commit.

### Görev 6.6: `/fiyatlar` sadeleştirmesi ve yönlendirmeler

**Dosyalar:**
- Değiştir: `cheep-website/src/pages/content/BrowsePage.tsx`
- Değiştir: `cheep-website/Caddyfile` veya üretim scripti (`category_redirects` → 301)

- [ ] **Adım 1..3:** Implement → tsc → commit.

---

## Bitirme

- [ ] `cheep-backend-express`: `pnpm typecheck && pnpm test`
- [ ] `Cheep-Mobile`: `npm run typecheck && npm test`
- [ ] `cheep-website`: `npx tsc -b && npm run build`
- [ ] Prod migration öncesi veritabanı yedeği (`deploy/backup-db.sh`)
- [ ] `reconcile-taxonomy.ts --dry-run` prod kopyasında çalıştırılıp raporlanır
