# Ürün Arama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcılar kategori gezmeden, yazdıkça anında sonuç veren bir aramayla ürünü bulup tek dokunuşla aktif listelerine eklesin.

**Architecture:** Backend'de Postgres `pg_trgm` + `unaccent` ile yazım-hatası/Türkçe-karakter toleranslı, alaka-sıralı arama (yeni servis yok). Mobilde yazdıkça-arama ekranı + "+" ile listeye ekleme; kullanılmayan `SearchBar` bileşeni ve ölü home büyüteci devreye alınır.

**Tech Stack:** Express + Prisma 6.18 (ESM) + PostgreSQL 15 (pg_trgm, unaccent) + vitest; React Native/Expo + i18next.

**Spec:** `docs/superpowers/specs/2026-07-04-product-search-design.md`

## Global Constraints

- ESM: tüm göreli import'lar `.js` uzantılı (ör. `from './product-search.util.js'`).
- SQL parametreleri DAİMA `Prisma.sql` / `${}` ile bind edilir — string interpolation YOK (SQL injection).
- Backend testleri vitest; prisma mock'lanır veya saf fonksiyon test edilir. Raw SQL için saf yardımcılar unit-test edilir, SQL davranışı lokal prod-ayna DB'ye karşı doğrulama script'iyle test edilir.
- Mobilde test runner YOK — mobil görevler `npx tsc --noEmit` + gerçek veriyle manuel doğrulama ile biter.
- i18n anahtarları 5 dile eklenir: tr, en, de, pl, sv.
- Sırlar (keystore/DB şifreleri) asla commit edilmez.
- Lokal dev DB: docker `cheep-postgres:5434`, `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/cheep_db` (16k ürün prod aynası + 10.247 şube yüklü).

---

## Task 1: Backend — arama girdi yardımcıları (saf fonksiyonlar)

**Files:**
- Create: `cheep-backend-express/src/api/products/product-search.util.ts`
- Test: `cheep-backend-express/test/product-search.test.ts`

**Interfaces:**
- Produces:
  - `normalizeSearchInput(q: string): string` — trim + iç boşlukları tekle + 80 karakterle sınırla.
  - `tokenizeSearch(q: string): string[]` — boşluklara böl, boşları at, en fazla 6 token.
  - `isBarcodeQuery(q: string): boolean` — sorgu yalnızca rakamsa ve ≥6 hane ise true.

- [ ] **Step 1: Write the failing test**

```ts
// cheep-backend-express/test/product-search.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeSearchInput, tokenizeSearch, isBarcodeQuery } from '../src/api/products/product-search.util.js';

describe('normalizeSearchInput', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeSearchInput('  yağsız   süt ')).toBe('yağsız süt');
  });
  it('caps length at 80 chars', () => {
    expect(normalizeSearchInput('a'.repeat(200)).length).toBe(80);
  });
  it('empty stays empty', () => {
    expect(normalizeSearchInput('   ')).toBe('');
  });
});

describe('tokenizeSearch', () => {
  it('splits on whitespace and drops empties', () => {
    expect(tokenizeSearch('yağsız  süt')).toEqual(['yağsız', 'süt']);
  });
  it('caps at 6 tokens', () => {
    expect(tokenizeSearch('a b c d e f g h')).toHaveLength(6);
  });
  it('empty query → empty array', () => {
    expect(tokenizeSearch('')).toEqual([]);
  });
});

describe('isBarcodeQuery', () => {
  it('true for 6+ digit strings', () => {
    expect(isBarcodeQuery('8690504')).toBe(true);
  });
  it('false for short digits', () => {
    expect(isBarcodeQuery('123')).toBe(false);
  });
  it('false for text', () => {
    expect(isBarcodeQuery('süt')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cheep-backend-express && npx vitest run test/product-search.test.ts`
Expected: FAIL — "Cannot find module '../src/api/products/product-search.util.js'".

- [ ] **Step 3: Write minimal implementation**

```ts
// cheep-backend-express/src/api/products/product-search.util.ts

/** Arama girdisini temizler: baş/son boşluk, iç boşlukları tekle, 80 karakterle sınırla. */
export function normalizeSearchInput(q: string): string {
    return (q ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

/** Sorguyu kelime token'larına böler (boşları atar, en fazla 6 token). */
export function tokenizeSearch(q: string): string[] {
    return normalizeSearchInput(q)
        .split(' ')
        .filter(t => t.length > 0)
        .slice(0, 6);
}

/** Sorgu yalnızca rakam ve ≥6 hane ise barkod kabul edilir. */
export function isBarcodeQuery(q: string): boolean {
    return /^\d{6,}$/.test((q ?? '').trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cheep-backend-express && npx vitest run test/product-search.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/api/products/product-search.util.ts cheep-backend-express/test/product-search.test.ts
git commit -m "feat(search): pure query helpers (normalize, tokenize, barcode-detect)"
```

---

## Task 2: Backend — DB migration (pg_trgm + unaccent + normalize fn + GIN indeksler)

**Files:**
- Create: `cheep-backend-express/prisma/migrations/20260704120000_product_search_trgm/migration.sql`

**Interfaces:**
- Produces (DB'de): `cheep_normalize(text) → text` (IMMUTABLE), `products_name_trgm` ve `products_brand_trgm` GIN indeksleri, `pg_trgm` + `unaccent` eklentileri.

- [ ] **Step 1: Write the migration SQL**

```sql
-- cheep-backend-express/prisma/migrations/20260704120000_product_search_trgm/migration.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent(text) STABLE'dır; indeks için IMMUTABLE sarmalayıcı gerekir.
-- Türkçe İ/I/ı → i eşlemesi (noktalı/noktasız i) + aksan sadeleştirme + küçük harf.
CREATE OR REPLACE FUNCTION cheep_normalize(txt text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(
    public.unaccent('public.unaccent',
      translate(coalesce(txt, ''), 'İIı', 'iii')
    )
  )
$$;

CREATE INDEX IF NOT EXISTS products_name_trgm
  ON products USING gin (cheep_normalize(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_brand_trgm
  ON products USING gin (cheep_normalize(coalesce(brand, '')) gin_trgm_ops);
```

- [ ] **Step 2: Apply the migration locally**

Run:
```bash
cd cheep-backend-express
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/cheep_db" npx prisma migrate deploy
```
Expected: "1 migration applied" (20260704120000_product_search_trgm).

- [ ] **Step 3: Verify function + indexes + fuzzy behavior in psql**

Run:
```bash
docker exec cheep-postgres psql -U postgres -d cheep_db -c "SELECT cheep_normalize('Süt Yağsız İçim');"
docker exec cheep-postgres psql -U postgres -d cheep_db -c "\di products_name_trgm"
docker exec cheep-postgres psql -U postgres -d cheep_db -c "SELECT name, similarity(cheep_normalize(name), cheep_normalize('yogrut')) s FROM products WHERE cheep_normalize(name) % cheep_normalize('yogrut') ORDER BY s DESC LIMIT 5;"
```
Expected: `cheep_normalize` returns `sut yagsiz icim`; index listed; "yogrut" query returns yoğurt products with similarity > 0.
Note: `%` uses `pg_trgm.similarity_threshold` (default 0.3).

- [ ] **Step 4: Commit**

```bash
git add cheep-backend-express/prisma/migrations/20260704120000_product_search_trgm/migration.sql
git commit -m "feat(search): pg_trgm + unaccent + cheep_normalize + GIN indexes migration"
```

---

## Task 3: Backend — arama sorgusunu trigram+normalize ile yükselt

**Files:**
- Modify: `cheep-backend-express/src/api/products/products.service.ts` (search dalı: `where.OR` bloğu ~satır 61-67 ve `whereClause` search bloğu ~satır 87-93, ORDER BY ~satır 108-113)

**Interfaces:**
- Consumes: `normalizeSearchInput`, `tokenizeSearch`, `isBarcodeQuery` (Task 1).
- Produces: `getAllProducts` — `search` verildiğinde alaka-sıralı (prefix > similarity > store_count > min_price) sonuç; dönüş şekli değişmez.

- [ ] **Step 1: Add the import at top of products.service.ts**

`cheep-backend-express/src/api/products/products.service.ts` en üstteki import'lara ekle:
```ts
import { normalizeSearchInput, tokenizeSearch, isBarcodeQuery } from './product-search.util.js';
```

- [ ] **Step 2: Replace the Prisma `where.OR` search branch**

Şunu (satır ~61-67):
```ts
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
            { ean_barcode: { contains: search } },
        ];
    }
```
ile değiştir:
```ts
    // NOT: asıl arama aşağıdaki raw SQL'de trigram ile yapılır (bu Prisma `where`
    // yalnızca kategori/marka/ülke listeleme filtreleri için kullanılır; search'i
    // buradan çıkarıyoruz ki iki farklı arama mantığı çakışmasın).
```

- [ ] **Step 3: Replace the raw-SQL search whereClause block**

Şunu (satır ~87-93):
```ts
    if (search) {
        whereClause = Prisma.sql`${whereClause} AND (
            p.name ILIKE ${'%' + search + '%'} OR
            p.brand ILIKE ${'%' + search + '%'} OR
            p.ean_barcode LIKE ${'%' + search + '%'}
        )`;
    }
```
ile değiştir:
```ts
    // 🔎 Akıllı arama: cheep_normalize (unaccent + Türkçe İ/ı) üzerinden trigram.
    // - Çok kelime: her token normalize edilmiş isimde substring olmalı (AND) → sıra bağımsız değil.
    // - Yazım hatası: word_similarity(sorgu, ad) — kısa sorguyu uzun ad İÇİNDEKİ en iyi
    //   kelime/parçaya karşı ölçer. NOT: whole-string similarity() burada ÇALIŞMAZ; kısa
    //   typo uzun çok-kelimeli ürün adına karşı ~0.09 verir (Task 2 bulgusu). word_similarity
    //   yönü ÖNEMLİ: ilk argüman sorgu, ikinci hedef.
    // - Barkod: yalnızca sayısal sorguda prefix eşleşmesi.
    let searchOrder: Prisma.Sql = Prisma.empty;
    if (search) {
        const nq = normalizeSearchInput(search);
        const tokens = tokenizeSearch(search);

        // Token-AND: her token cheep_normalize(p.name) içinde geçmeli (substring, tam parça).
        const tokenAnd = tokens.length > 0
            ? Prisma.join(
                tokens.map(tok => Prisma.sql`cheep_normalize(p.name) LIKE '%' || cheep_normalize(${tok}) || '%'`),
                ' AND '
              )
            : Prisma.sql`TRUE`;

        const barcodeClause = isBarcodeQuery(search)
            ? Prisma.sql`OR p.ean_barcode LIKE ${nq + '%'}`
            : Prisma.empty;

        whereClause = Prisma.sql`${whereClause} AND (
            (${tokenAnd})
            OR word_similarity(cheep_normalize(${nq}), cheep_normalize(p.name)) > 0.35
            OR cheep_normalize(coalesce(p.brand, '')) LIKE '%' || cheep_normalize(${nq}) || '%'
            ${barcodeClause}
        )`;

        // Alaka sıralaması: önce prefix eşleşmesi, sonra word_similarity.
        searchOrder = Prisma.sql`
            (cheep_normalize(p.name) LIKE cheep_normalize(${nq}) || '%')::int DESC,
            word_similarity(cheep_normalize(${nq}), cheep_normalize(p.name)) DESC,
        `;
    }
```

- [ ] **Step 4: Inject searchOrder into the products ORDER BY**

`$queryRaw` içindeki ORDER BY'ı (satır ~108-113):
```ts
        ORDER BY 
            store_count DESC,  -- Önce market sayısına göre (çoktan aza)
            min_price ASC,     -- Sonra en ucuz fiyata göre (azdan çoka)
            p.created_at DESC  -- Son olarak yeni ürünler
```
şununla değiştir:
```ts
        ORDER BY 
            ${searchOrder}
            store_count DESC,
            min_price ASC,
            p.created_at DESC
```
(`searchOrder` arama yokken `Prisma.empty` olduğu için mevcut davranış korunur; ararken prefix+similarity öne eklenir.)

- [ ] **Step 5: Typecheck**

Run: `cd cheep-backend-express && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 6: Integration verify script against local DB**

Create `C:/Users/ruzzy/.claude/jobs/ba13a190/tmp/verify-search.ts`:
```ts
import { getAllProducts } from '../../../../IdeaProjects/Cheep/cheep-backend-express/src/api/products/products.service.js';
import { prisma } from '../../../../IdeaProjects/Cheep/cheep-backend-express/src/utils/prisma.client.js';

async function main() {
  const tr = await prisma.country.findFirst({ where: { code: 'TR' } });
  const cid = tr!.id;
  const cases = ['süt', 'sut', 'yogrut', 'yağsız süt', 'kıyma', 'peynr'];
  for (const q of cases) {
    const { products } = await getAllProducts({ search: q, limit: 5, countryId: cid });
    console.log(`\nQ="${q}" → ${products.length} sonuç:`);
    products.forEach((p: any) => console.log(`   ${p.name}${p.brand ? ' ['+p.brand+']' : ''}`));
  }
  await prisma.$disconnect();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```
Run:
```bash
cd cheep-backend-express
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/cheep_db" npx tsx "C:/Users/ruzzy/.claude/jobs/ba13a190/tmp/verify-search.ts"
```
Expected: "süt" ve "sut" benzer süt ürünleri getirir; "yogrut"→yoğurt; "yağsız süt"→yağsız süt ürünleri; "peynr"→peynir. Boş/alakasız sonuç gelmez.

- [ ] **Step 7: Run full backend test suite (regresyon)**

Run: `cd cheep-backend-express && npx vitest run`
Expected: tüm testler PASS (mevcut 115 + Task 1'in 9'u).

- [ ] **Step 8: Commit**

```bash
git add cheep-backend-express/src/api/products/products.service.ts
git commit -m "feat(search): trigram+unaccent relevance-ranked product search query"
```

---

## Task 4: Mobil — son aramalar yardımcısı (AsyncStorage)

**Files:**
- Create: `Cheep-Mobile/src/utils/recentSearches.ts`

**Interfaces:**
- Produces:
  - `getRecentSearches(): Promise<string[]>` — en yeni ilk, en fazla 5.
  - `addRecentSearch(q: string): Promise<void>` — başa ekler, tekilleştirir, 5 ile sınırlar.

- [ ] **Step 1: Write the implementation**

```ts
// Cheep-Mobile/src/utils/recentSearches.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recent_searches';
const MAX = 5;

/** Son aramalar, en yeni ilk (en fazla 5). */
export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as string[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Sorguyu başa ekler; boşsa atlar, tekilleştirir (case-insensitive), 5 ile sınırlar. */
export async function addRecentSearch(q: string): Promise<void> {
  const term = q.trim();
  if (!term) return;
  try {
    const prev = await getRecentSearches();
    const deduped = prev.filter(p => p.toLowerCase() !== term.toLowerCase());
    const next = [term, ...deduped].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sessizce geç — son aramalar kritik değil
  }
}
```

- [ ] **Step 2: Verify AsyncStorage is a dependency**

Run: `cd Cheep-Mobile && node -e "console.log(require('./package.json').dependencies['@react-native-async-storage/async-storage'] || 'MISSING')"`
Expected: bir sürüm yazdırır (MISSING değil). MISSING ise: `npx expo install @react-native-async-storage/async-storage`.

- [ ] **Step 3: Typecheck**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add Cheep-Mobile/src/utils/recentSearches.ts
git commit -m "feat(search): recent searches helper (AsyncStorage, last 5)"
```

---

## Task 5: Mobil — arama sonuç satırı bileşeni (+ ile listeye ekle)

**Files:**
- Create: `Cheep-Mobile/src/components/search/SearchResultRow.tsx`

**Interfaces:**
- Consumes: `Product` tipi (store_prices dahil), `formatMoney` (useLocale).
- Produces: `SearchResultRow({ product, onAdd, added, onPress })` — ad/marka/en-ucuz-fiyat/market-sayısı + sağda "+" (veya eklendiyse ✓).
  - `product: Product`, `onAdd: () => void`, `added: boolean`, `onPress: () => void`.

- [ ] **Step 1: Write the component**

```tsx
// Cheep-Mobile/src/components/search/SearchResultRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProductThumb } from '../product/ProductThumb';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, borderRadius } from '../../theme';
import type { Product } from '../../types';

interface SearchResultRowProps {
  product: Product;
  onAdd: () => void;
  added: boolean;
  onPress: () => void;
}

export function SearchResultRow({ product, onAdd, added, onPress }: SearchResultRowProps) {
  const { formatMoney } = useLocale();
  const prices = (product.store_prices ?? [])
    .map((sp) => parseFloat(sp.price))
    .filter((p) => Number.isFinite(p));
  const lowest = prices.length ? Math.min(...prices) : null;
  const storeCount = product.store_prices?.length ?? 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <ProductThumb imageUrl={product.image_url} categoryName={product.category?.name} iconSize={26} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.meta}>
          {lowest != null && <Text style={styles.price}>{formatMoney(lowest)}</Text>}
          {storeCount > 0 && <Text style={styles.stores}>· {storeCount} market</Text>}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.addBtn, added && styles.addBtnDone]}
        onPress={onAdd}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons name={added ? 'check' : 'add'} size={22} color={added ? colors.background.paper : colors.primary.main} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  info: { flex: 1 },
  name: { ...typography.styles.body2, color: colors.text.primary, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  price: { ...typography.styles.caption, color: colors.primary.main, fontWeight: '700' },
  stores: { ...typography.styles.caption, color: colors.text.secondary },
  addBtn: {
    width: 36, height: 36, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary.main,
    backgroundColor: colors.background.paper,
  },
  addBtnDone: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: EXIT 0. (Hata çıkarsa: `typography.styles.caption`/`colors.background.input` gibi token adlarını `src/theme` içindeki gerçek adlarla eşle.)

- [ ] **Step 3: Commit**

```bash
git add Cheep-Mobile/src/components/search/SearchResultRow.tsx
git commit -m "feat(search): SearchResultRow component with add-to-list button"
```

---

## Task 6: Mobil — SearchScreen + navigasyon + home büyüteci + i18n

**Files:**
- Create: `Cheep-Mobile/src/screens/search/SearchScreen.tsx`
- Modify: `Cheep-Mobile/src/navigation/types.ts` (HomeStackParamList: `SearchResults` → `Search`)
- Modify: `Cheep-Mobile/src/navigation/HomeNavigator.tsx` (SearchScreen'i kaydet)
- Modify: `Cheep-Mobile/src/screens/home/NewHomeScreen.tsx` (`goSearch` → `navigate('Search')`)
- Modify: `Cheep-Mobile/src/i18n/locales/{tr,en,de,pl,sv}.json` (search anahtarları)

**Interfaces:**
- Consumes: `productService.getProducts({ search, limit })`, `useCart()` (activeList, refresh), `listService.addItem`/`createList`, `SearchResultRow` (Task 5), `getRecentSearches`/`addRecentSearch` (Task 4), `SearchBar`.

- [ ] **Step 1: Add the `search` i18n keys to all 5 locales**

`Cheep-Mobile/src/i18n/locales/tr.json` — `"compare"` bloğunun HEMEN ÖNCESINE (veya `"product"` bloğuna komşu) ekle:
```json
    "search": {
      "placeholder": "Ürün ara…",
      "recent": "Son aramalar",
      "no_results": "\"{{q}}\" için ürün bulunamadı",
      "added": "Listene eklendi",
      "hint": "Aradığın ürünü yazmaya başla"
    },
```
`en.json`:
```json
    "search": {
      "placeholder": "Search products…",
      "recent": "Recent searches",
      "no_results": "No products found for \"{{q}}\"",
      "added": "Added to your list",
      "hint": "Start typing the product you want"
    },
```
`de.json`:
```json
    "search": {
      "placeholder": "Produkte suchen…",
      "recent": "Letzte Suchen",
      "no_results": "Keine Produkte für \"{{q}}\" gefunden",
      "added": "Zur Liste hinzugefügt",
      "hint": "Tippe das gesuchte Produkt ein"
    },
```
`pl.json`:
```json
    "search": {
      "placeholder": "Szukaj produktów…",
      "recent": "Ostatnie wyszukiwania",
      "no_results": "Nie znaleziono produktów dla \"{{q}}\"",
      "added": "Dodano do listy",
      "hint": "Zacznij wpisywać szukany produkt"
    },
```
`sv.json`:
```json
    "search": {
      "placeholder": "Sök produkter…",
      "recent": "Senaste sökningar",
      "no_results": "Inga produkter hittades för \"{{q}}\"",
      "added": "Tillagd i din lista",
      "hint": "Börja skriva produkten du söker"
    },
```

- [ ] **Step 2: Validate JSON**

Run:
```bash
cd Cheep-Mobile
for f in tr en de pl sv; do node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/$f.json','utf8')); console.log('$f OK')"; done
```
Expected: 5× OK.

- [ ] **Step 3: Update navigation types**

`Cheep-Mobile/src/navigation/types.ts` — `HomeStackParamList` içinde `SearchResults: { query: string };` satırını şununla değiştir:
```ts
  Search: undefined;
```

- [ ] **Step 4: Create the SearchScreen**

```tsx
// Cheep-Mobile/src/screens/search/SearchScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { SearchBar } from '../../components/common/SearchBar';
import { SearchResultRow } from '../../components/search/SearchResultRow';
import { productService, listService } from '../../services';
import { useCart } from '../../context/CartContext';
import { getRecentSearches, addRecentSearch } from '../../utils/recentSearches';
import { colors, typography, spacing } from '../../theme';
import type { Product } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';

export function SearchScreen({ navigation }: HomeStackScreenProps<'Search'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { activeList, refresh } = useCart();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const reqId = useRef(0);

  useEffect(() => { getRecentSearches().then(setRecent); }, []);

  // Yazdıkça arama — 250ms debounce + stale istek koruması.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const myId = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const data = await productService.getProducts({ search: q, limit: 30 });
        if (myId === reqId.current) setResults(data);
      } catch {
        if (myId === reqId.current) setResults([]);
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = useCallback(async (product: Product) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      let listId = activeList?.id;
      if (!listId) {
        const created = await listService.createList({ name: 'Alışveriş Listem' });
        listId = created.id;
      }
      await listService.addItem(listId, { product_id: product.id });
      setAddedIds(prev => new Set(prev).add(product.id));
      await refresh();
    } catch {
      // sessizce geç — kullanıcı tekrar deneyebilir
    }
  }, [activeList, refresh]);

  const runRecent = (term: string) => setQuery(term);

  const onSubmit = () => { if (query.trim()) addRecentSearch(query).then(() => getRecentSearches().then(setRecent)); };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.searchRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.searchBarWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            onSubmit={onSubmit}
            onClear={() => setQuery('')}
          />
        </View>
      </View>

      {query.trim().length === 0 ? (
        <View style={styles.empty}>
          {recent.length > 0 ? (
            <>
              <Text style={styles.emptyLabel}>{t('search.recent')}</Text>
              <View style={styles.chips}>
                {recent.map((r) => (
                  <TouchableOpacity key={r} style={styles.chip} onPress={() => runRecent(r)}>
                    <Text style={styles.chipText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.hint}>{t('search.hint')}</Text>
          )}
        </View>
      ) : loading && results.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary.main} />
      ) : results.length === 0 ? (
        <Text style={styles.hint}>{t('search.no_results', { q: query.trim() })}</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <SearchResultRow
              product={item}
              added={addedIds.has(item.id)}
              onAdd={() => handleAdd(item)}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  back: { paddingHorizontal: spacing.xs },
  backText: { fontSize: 34, lineHeight: 34, color: colors.text.primary },
  searchBarWrap: { flex: 1 },
  list: { flex: 1 },
  empty: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  emptyLabel: { ...typography.styles.body2, color: colors.text.secondary, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, backgroundColor: colors.background.paper, borderWidth: 1, borderColor: colors.border.light },
  chipText: { ...typography.styles.body2, color: colors.text.primary },
  hint: { ...typography.styles.body2, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
```

- [ ] **Step 5: Register SearchScreen in HomeNavigator**

`Cheep-Mobile/src/navigation/HomeNavigator.tsx`:
- import ekle (diğer screen import'larının yanına):
```ts
import { SearchScreen } from '../screens/search/SearchScreen';
```
- `<Stack.Screen name="CategoryProducts" .../>` satırının yanına ekle:
```tsx
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
```
(Diğer screen'ler `options` deseni neyse ona uydur; header zaten SearchScreen içinde yönetiliyor → `headerShown: false`.)

- [ ] **Step 6: Wire the home search icon**

`Cheep-Mobile/src/screens/home/NewHomeScreen.tsx` — `goSearch` tanımını:
```ts
  const goSearch = () =>
    navigation.navigate('CategoryProducts', { categoryId: 0, categoryName: t('product.all_categories') });
```
şununla değiştir:
```ts
  const goSearch = () => navigation.navigate('Search');
```

- [ ] **Step 7: Verify expo-haptics is a dependency**

Run: `cd Cheep-Mobile && node -e "console.log(require('./package.json').dependencies['expo-haptics'] || 'MISSING')"`
Expected: bir sürüm (MISSING değil). MISSING ise `npx expo install expo-haptics`. (Not: memory'ye göre haptik zaten kullanılıyor, mevcut olmalı.)

- [ ] **Step 8: Typecheck**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: EXIT 0. (theme token adlarında hata çıkarsa `src/theme`'deki gerçek adlarla eşle.)

- [ ] **Step 9: Manual verification (running app)**

Uygulamayı başlat (`npx expo start`), home'da büyütece bas → SearchScreen açılır. "süt" yaz → anında süt ürünleri; "sut"/"yogrut" → aynı/benzer sonuçlar (yazım hatası toleransı). Bir sonuçta "+" → ✓ olur, Lists sekmesindeki rozet artar. Geri gel, tekrar aç → son aramalar chip olarak görünür.

- [ ] **Step 10: Commit**

```bash
git add Cheep-Mobile/src/screens/search/SearchScreen.tsx Cheep-Mobile/src/navigation/types.ts Cheep-Mobile/src/navigation/HomeNavigator.tsx Cheep-Mobile/src/screens/home/NewHomeScreen.tsx Cheep-Mobile/src/i18n/locales/*.json
git commit -m "feat(search): as-you-type SearchScreen with add-to-list, recents, i18n"
```

---

## Task 7: Yayınlama — migration deploy + APK/AAB v1.0.4

**Files:**
- Modify: `Cheep-Mobile/app.json` (version 1.0.3→1.0.4, versionCode 4→5)
- Modify: `Cheep-Mobile/android/app/build.gradle` (versionCode 4→5, versionName "1.0.3"→"1.0.4")

**Interfaces:** —

- [ ] **Step 1: Push + backend deploy (migration prod'da uygulanır)**

Run:
```bash
cd C:/Users/ruzzy/IdeaProjects/Cheep
git push origin main
ssh -i ~/.ssh/cheep_deploy -o StrictHostKeyChecking=no root@129.212.193.203 "bash /opt/cheep/deploy/deploy.sh"
```
Expected: deploy "BİTTİ". Backend başlarken `prisma migrate deploy` migration'ı uygular (deploy akışı prisma migrate'i çalıştırıyorsa; çalıştırmıyorsa Step 2).

- [ ] **Step 2: Ensure migration applied on prod**

Run:
```bash
ssh -i ~/.ssh/cheep_deploy -o StrictHostKeyChecking=no root@129.212.193.203 "docker exec deploy-db-1 psql -U cheep -d cheep_db -c \"SELECT cheep_normalize('Süt İçim'); \\di products_name_trgm\""
```
Expected: `sut icim` + `products_name_trgm` indeksi listelenir. Yoksa: backend container'da `npx prisma migrate deploy` çalıştır.

- [ ] **Step 3: Smoke-test prod search endpoint**

Run:
```bash
curl -s "https://api.cheep.live/api/v1/products?search=yogrut&limit=3" -H "x-country: TR" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log((j.data||[]).map(p=>p.name).join('\n'))})"
```
Expected: yoğurt ürünleri döner (yazım hatası toleransı canlıda çalışıyor).

- [ ] **Step 4: Bump mobile version**

`Cheep-Mobile/app.json`: `"version": "1.0.3"` → `"1.0.4"`, `"versionCode": 4` → `5`.
`Cheep-Mobile/android/app/build.gradle`: `versionCode 4` → `5`, `versionName "1.0.3"` → `"1.0.4"`.

- [ ] **Step 5: Build signed APK + AAB**

Run:
```bash
cd Cheep-Mobile/android
ANDROID_HOME="C:/Users/ruzzy/AppData/Local/Android/Sdk" ANDROID_SDK_ROOT="C:/Users/ruzzy/AppData/Local/Android/Sdk" ./gradlew bundleRelease assembleRelease --no-daemon
```
Expected: BUILD SUCCESSFUL; `app/build/outputs/apk/release/app-release.apk` + `bundle/release/app-release.aab`.

- [ ] **Step 6: Verify version + copy to Desktop**

Run:
```bash
"$ANDROID_HOME/build-tools/36.0.0/aapt" dump badging Cheep-Mobile/android/app/build/outputs/apk/release/app-release.apk | grep -E "versionName|versionCode"
cp Cheep-Mobile/android/app/build/outputs/apk/release/app-release.apk ~/Desktop/Cheep-v1.0.4.apk
cp Cheep-Mobile/android/app/build/outputs/bundle/release/app-release.aab ~/Desktop/Cheep-v1.0.4.aab
```
Expected: versionCode='5' versionName='1.0.4'; iki dosya Desktop'ta.

- [ ] **Step 7: Commit version bump**

```bash
cd C:/Users/ruzzy/IdeaProjects/Cheep
git add Cheep-Mobile/app.json
git commit -m "chore(mobile): bump to 1.0.4 (versionCode 5) — product search"
git push origin main
```

---

## Self-Review Notları

- **Spec kapsamı:** motor (Task 2-3), çok-kelime+Türkçe+yazım-hatası (Task 1 tokenize + Task 3 SQL), yazdıkça UX (Task 6), listeye ekle (Task 5-6), son aramalar (Task 4+6), boş/sonuç-yok durumları (Task 6), 5 dil (Task 6), deploy (Task 7) — hepsi karşılandı.
- **Aktif liste yoksa:** Task 6 Step 4 `handleAdd` sessizce `createList({ name: 'Alışveriş Listem' })` yapar (spec ile uyumlu).
- **Barkod:** Task 3 yalnızca `isBarcodeQuery` true ise prefix eşleşmesi ekler.
- **Perf:** Task 2 Step 3 GIN indeks + Task 3 Step 6 doğrulama; 16k satırda beklenen <50ms (gerekirse `EXPLAIN ANALYZE` ile teyit).
