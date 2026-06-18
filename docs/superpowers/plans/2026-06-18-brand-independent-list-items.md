# Marka-Bağımsız Liste Öğeleri (Faz 5-0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liste öğelerini bir markaya sabitlemek yerine muadil gruba bağlayıp, compare motorunun her markette o gruptaki en ucuz markayı seçmesini sağlamak.

**Architecture:** `ListItem.brand_independent` bayrağı eklenir. Compare motoru, bayrak açık öğelerde temsilci ürünün fiyatları yerine muadil grubun tamamından her market için en ucuz seçeneği kullanır. Çekirdek seçim mantığı, DB'siz test edilebilmesi için saf bir fonksiyon olarak ayrı dosyada (`brand-independent-pricing.ts`) durur; compare-engine veriyi çekip bu fonksiyona enjekte eder.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), Vitest (backend); React Native / Expo (mobil), axios.

## Global Constraints

- Prisma model ID'leri: `Int @id @default(autoincrement())`, tablo adları snake_case `@@map`.
- Para alanları `Decimal @db.Decimal(10,2)`; kodda `Number(...)` ile sayıya çevrilir.
- Yeni alan geriye dönük uyumlu: `brand_independent Boolean @default(false)` — mevcut listeler aynen çalışır.
- Backend testleri DB gerektirmemeli (mevcut tek test saf-fonksiyon; test DB kurulumu yok). Yeni mantık saf fonksiyon olarak test edilir.
- Vitest komutu: `npm test` (= `vitest run`), tek dosya: `npx vitest run test/<dosya>.test.ts`.
- Mobil tip kontrolü: `npx tsc --noEmit` (Cheep-Mobile dizininde) temiz olmalı.
- Backend dizini: `cheep-backend-express/`. Mobil dizini: `Cheep-Mobile/`.

---

### Task 1: Prisma şemasına `brand_independent` ekle + migration

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma:207-225` (ListItem modeli)
- Create: `cheep-backend-express/prisma/migrations/<timestamp>_add_brand_independent/migration.sql` (Prisma üretir)

**Interfaces:**
- Produces: `ListItem.brand_independent: boolean` (Prisma Client tipi; varsayılan `false`).

- [ ] **Step 1: ListItem modeline alanı ekle**

`schema.prisma` içinde `model ListItem` bloğunda `unit` satırının altına ekle:

```prisma
  quantity   Float  @default(1) // Miktar (1.5 kg, 2 adet vb.)
  unit       String @default("adet") // kg, adet, lt, g, ml vb.
  brand_independent Boolean @default(false) // true → muadil grubundaki en ucuz markayı seç

  created_at DateTime @default(now())
```

- [ ] **Step 2: Migration üret ve uygula**

Run: `cd cheep-backend-express && npx prisma migrate dev --name add_brand_independent`
Expected: "Your database is now in sync with your schema." + yeni migration klasörü oluşur, `migration.sql` içinde `ALTER TABLE "list_items" ADD COLUMN "brand_independent" BOOLEAN NOT NULL DEFAULT false;` benzeri.

> Not: Migration için çalışan bir PostgreSQL ve `DATABASE_URL` gerekir. DB yoksa yalnızca `npx prisma migrate diff` ile SQL üretilebilir; bu durumu kullanıcıya bildir.

- [ ] **Step 3: Prisma Client'ı yeniden üret**

Run: `cd cheep-backend-express && npx prisma generate`
Expected: "Generated Prisma Client" — `brand_independent` artık tiplerde.

- [ ] **Step 4: Commit**

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations
git commit -m "feat(lists): add brand_independent flag to ListItem"
```

---

### Task 2: Saf fiyatlama fonksiyonu `resolveItemStoreOptions` (TDD, DB'siz)

**Files:**
- Create: `cheep-backend-express/src/services/brand-independent-pricing.ts`
- Test: `cheep-backend-express/test/brand-independent-pricing.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface StoreRef { id: number; name: string; lat: number | null; lon: number | null }
  export interface ProductRef { id: number; name: string; brand: string | null; image_url: string | null }
  export interface RawStorePrice { store_id: number; price: number; store: StoreRef }
  export interface PricedProduct extends ProductRef { store_prices: RawStorePrice[] }
  export interface StoreOption { store_id: number; store: StoreRef; price: number; product: ProductRef }

  // Bir liste öğesi için her market'te kullanılacak en iyi seçeneği döndürür (store_id → StoreOption).
  // brandIndependent=false ise sadece representative ürünün fiyatları kullanılır.
  // brandIndependent=true ise siblings (muadil grup) de değerlendirilir; her market'te en ucuz olan kazanır.
  export function resolveItemStoreOptions(
    representative: PricedProduct,
    brandIndependent: boolean,
    siblings: PricedProduct[]
  ): Map<number, StoreOption>
  ```

- [ ] **Step 1: Failing testleri yaz**

`test/brand-independent-pricing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveItemStoreOptions, PricedProduct } from '../src/services/brand-independent-pricing';

const store = (id: number, name: string): any => ({ id, name, lat: null, lon: null });

const A: PricedProduct = {
  id: 1, name: 'A Süt 1L', brand: 'A', image_url: null,
  store_prices: [{ store_id: 10, price: 30, store: store(10, 'Migros') }],
};
const B: PricedProduct = {
  id: 2, name: 'B Süt 1L', brand: 'B', image_url: null,
  store_prices: [{ store_id: 11, price: 25, store: store(11, 'A101') }],
};

describe('resolveItemStoreOptions', () => {
  it('brand-independent=false: sadece representative ürünü kullanır', () => {
    const opts = resolveItemStoreOptions(A, false, [B]);
    expect(opts.size).toBe(1);
    expect(opts.get(10)!.product.id).toBe(1);
    expect(opts.get(10)!.price).toBe(30);
    expect(opts.has(11)).toBe(false); // B markete bakılmaz
  });

  it('brand-independent=true: her markette en ucuz markayı seçer', () => {
    const opts = resolveItemStoreOptions(A, true, [B]);
    expect(opts.get(10)!.product.id).toBe(1); // Migros: sadece A var
    expect(opts.get(11)!.product.id).toBe(2); // A101: B var
    expect(opts.get(11)!.price).toBe(25);
  });

  it('aynı markette daha ucuz sibling representative\'i geçer', () => {
    const cheaperB: PricedProduct = {
      id: 2, name: 'B Süt 1L', brand: 'B', image_url: null,
      store_prices: [{ store_id: 10, price: 22, store: store(10, 'Migros') }],
    };
    const opts = resolveItemStoreOptions(A, true, [cheaperB]);
    expect(opts.get(10)!.product.id).toBe(2); // Migros'ta B daha ucuz
    expect(opts.get(10)!.price).toBe(22);
  });

  it('siblings boşsa (tekil ürün) brand-independent davranışı = marka sabit', () => {
    const opts = resolveItemStoreOptions(A, true, []);
    expect(opts.size).toBe(1);
    expect(opts.get(10)!.product.id).toBe(1);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd cheep-backend-express && npx vitest run test/brand-independent-pricing.test.ts`
Expected: FAIL — "Cannot find module '../src/services/brand-independent-pricing'".

- [ ] **Step 3: Minimal implementasyonu yaz**

`src/services/brand-independent-pricing.ts`:

```ts
export interface StoreRef { id: number; name: string; lat: number | null; lon: number | null }
export interface ProductRef { id: number; name: string; brand: string | null; image_url: string | null }
export interface RawStorePrice { store_id: number; price: number; store: StoreRef }
export interface PricedProduct extends ProductRef { store_prices: RawStorePrice[] }
export interface StoreOption { store_id: number; store: StoreRef; price: number; product: ProductRef }

function productRef(p: ProductRef): ProductRef {
  return { id: p.id, name: p.name, brand: p.brand, image_url: p.image_url };
}

function applyProduct(map: Map<number, StoreOption>, p: PricedProduct): void {
  for (const sp of p.store_prices) {
    const existing = map.get(sp.store_id);
    if (!existing || sp.price < existing.price) {
      map.set(sp.store_id, {
        store_id: sp.store_id,
        store: sp.store,
        price: sp.price,
        product: productRef(p),
      });
    }
  }
}

export function resolveItemStoreOptions(
  representative: PricedProduct,
  brandIndependent: boolean,
  siblings: PricedProduct[]
): Map<number, StoreOption> {
  const map = new Map<number, StoreOption>();
  applyProduct(map, representative);
  if (brandIndependent) {
    for (const sib of siblings) applyProduct(map, sib);
  }
  return map;
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd cheep-backend-express && npx vitest run test/brand-independent-pricing.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/services/brand-independent-pricing.ts cheep-backend-express/test/brand-independent-pricing.test.ts
git commit -m "feat(compare): pure resolveItemStoreOptions for brand-independent pricing"
```

---

### Task 3: Compare-engine'i muadil-grup seçimine bağla

**Files:**
- Modify: `cheep-backend-express/src/services/compare-engine.service.ts` (ProductInList tipi:18-43, compareShoppingList:115-193, calculateSingleStoreStrategies:199-310, calculateOptimalAllocation:380-523)

**Interfaces:**
- Consumes: `resolveItemStoreOptions`, `StoreOption`, `PricedProduct` (Task 2).
- Produces: `compareShoppingList` artık brand-independent öğelerde kazanan markanın gerçek ürün kimliğini (`brand`, `name`) allocation'da gösterir.

- [ ] **Step 1: ProductInList'e `brand_independent` ekle**

`compare-engine.service.ts` içinde `interface ProductInList` (satır 18) `unit: string;` altına:

```ts
    quantity: number;
    unit: string;
    brand_independent: boolean;
    product: {
```

- [ ] **Step 2: compareShoppingList'te öğe başına seçenek haritası kur**

`import` bloğunun altına ekle (satır 2'den sonra):

```ts
import { resolveItemStoreOptions, PricedProduct, StoreOption } from './brand-independent-pricing.js';
```

`const listItems = list.list_items as unknown as ProductInList[];` (satır 151) sonrasına, strateji hesabından **önce** ekle:

```ts
    // Marka-bağımsız öğeler için muadil grup ürünlerini çek (tek sorgu)
    const muadilIds = Array.from(new Set(
        listItems
            .filter(i => i.brand_independent && i.product.muadil_grup_id)
            .map(i => i.product.muadil_grup_id as string)
    ));
    const siblingsByGroup = new Map<string, PricedProduct[]>();
    if (muadilIds.length > 0) {
        const siblings = await prisma.product.findMany({
            where: { muadil_grup_id: { in: muadilIds } },
            include: { store_prices: { include: { store: true } } },
        });
        for (const s of siblings) {
            const gid = s.muadil_grup_id as string;
            const arr = siblingsByGroup.get(gid) || [];
            arr.push({
                id: s.id, name: s.name, brand: s.brand, image_url: s.image_url,
                store_prices: (s as any).store_prices.map((sp: any) => ({
                    store_id: sp.store_id, price: Number(sp.price), store: sp.store,
                })),
            });
            siblingsByGroup.set(gid, arr);
        }
    }

    // Her liste öğesi için market→seçenek haritası
    const itemOptions = new Map<number, Map<number, StoreOption>>();
    for (const item of listItems) {
        const representative: PricedProduct = {
            id: item.product.id, name: item.product.name, brand: item.product.brand,
            image_url: item.product.image_url,
            store_prices: item.product.store_prices.map(sp => ({
                store_id: sp.store_id, price: Number(sp.price), store: sp.store,
            })),
        };
        const siblings = item.brand_independent && item.product.muadil_grup_id
            ? (siblingsByGroup.get(item.product.muadil_grup_id) || []).filter(s => s.id !== item.product.id)
            : [];
        itemOptions.set(item.id, resolveItemStoreOptions(representative, item.brand_independent, siblings));
    }
```

`calculateSingleStoreStrategies` ve `calculateMultiStoreStrategies` çağrılarına `itemOptions` parametresini ekle:

```ts
    const singleStoreStrategies = await calculateSingleStoreStrategies(
        listItems, list.budget, options, itemOptions
    );
    ...
        const multiStoreStrategies = await calculateMultiStoreStrategies(
            listItems, list.budget, maxStores, options, itemOptions
        );
```

- [ ] **Step 3: Single-store fiyatlamayı seçenek haritasından oku**

`calculateSingleStoreStrategies` imzasına parametre ekle (satır 199):

```ts
async function calculateSingleStoreStrategies(
    listItems: ProductInList[],
    budget: any,
    options: CompareOptions,
    itemOptions: Map<number, Map<number, StoreOption>>
): Promise<RouteStrategy[]> {
```

storeMap kurulumunu (satır 207-213) seçenek haritasından türet:

```ts
    listItems.forEach(item => {
        itemOptions.get(item.id)!.forEach(opt => {
            if (!storeMap.has(opt.store_id)) storeMap.set(opt.store_id, opt.store);
        });
    });
```

Ürün fiyatı bulma kısmını (satır 233-270) şununla değiştir:

```ts
        listItems.forEach(item => {
            const opt = itemOptions.get(item.id)!.get(storeId);
            if (opt) {
                const pricePerUnit = opt.price;
                const totalPrice = pricePerUnit * item.quantity;
                allocation.products.push({
                    listItemId: item.id,
                    product: {
                        id: opt.product.id, name: opt.product.name,
                        brand: opt.product.brand, image_url: opt.product.image_url,
                    },
                    quantity: item.quantity, unit: item.unit, pricePerUnit, totalPrice,
                });
                allocation.subtotal += totalPrice;
            } else {
                missingProducts.push({
                    listItemId: item.id,
                    product: { id: item.product.id, name: item.product.name, brand: item.product.brand },
                    quantity: item.quantity, unit: item.unit,
                });
            }
        });
```

- [ ] **Step 4: Multi-store fiyatlamayı seçenek haritasından oku**

`calculateMultiStoreStrategies` imzasına `itemOptions` ekle (satır 316) ve storeMap kurulumunu (satır 326-332) single-store'daki gibi `itemOptions`'tan türet. `calculateOptimalAllocation` çağrısına (satır 360) `itemOptions` geçir.

`calculateOptimalAllocation` imzasına ekle (satır 380):

```ts
function calculateOptimalAllocation(
    listItems: ProductInList[],
    stores: any[],
    budget: any,
    options: CompareOptions,
    itemOptions: Map<number, Map<number, StoreOption>>
): RouteStrategy | null {
```

En ucuz market bulma bloğunu (satır 406-454) şununla değiştir:

```ts
    listItems.forEach(item => {
        let best: StoreOption | null = null;
        const opts = itemOptions.get(item.id)!;
        for (const storeId of storeIds) {
            const opt = opts.get(storeId);
            if (opt && (!best || opt.price < best.price)) best = opt;
        }
        if (best) {
            const allocation = allocations.get(best.store_id)!;
            const totalPrice = best.price * item.quantity;
            allocation.products.push({
                listItemId: item.id,
                product: {
                    id: best.product.id, name: best.product.name,
                    brand: best.product.brand, image_url: best.product.image_url,
                },
                quantity: item.quantity, unit: item.unit,
                pricePerUnit: best.price, totalPrice,
            });
            allocation.subtotal += totalPrice;
        } else {
            missingProducts.push({
                listItemId: item.id,
                product: { id: item.product.id, name: item.product.name, brand: item.product.brand },
                quantity: item.quantity, unit: item.unit,
            });
        }
    });
```

- [ ] **Step 5: Tip kontrolü ve mevcut testler**

Run: `cd cheep-backend-express && npx tsc --noEmit && npm test`
Expected: tsc hatasız; mevcut testler (similarity + Task 2) PASS.

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/src/services/compare-engine.service.ts
git commit -m "feat(compare): use muadil-group cheapest brand for brand_independent items"
```

---

### Task 4: lists.service + schema + controller — `brand_independent` kabul et

**Files:**
- Modify: `cheep-backend-express/src/api/lists/lists.service.ts:491-573` (addItemToList), `:578-616` (updateListItem)
- Modify: `cheep-backend-express/src/api/lists/lists.schema.ts` (item ekleme/güncelleme zod şeması)

**Interfaces:**
- Consumes: `ListItem.brand_independent` (Task 1).
- Produces: `addItemToList(listId, userId, { product_id, quantity?, unit?, brand_independent? })`, `updateListItem(itemId, userId, { quantity?, unit?, brand_independent? })`.

- [ ] **Step 1: Zod şemasına alan ekle**

`lists.schema.ts` içinde ürün ekleme/güncelleme şemalarına ekle (mevcut `quantity`/`unit` alanlarının yanına):

```ts
  brand_independent: z.boolean().optional(),
```

- [ ] **Step 2: addItemToList — alanı yaz**

`addItemToList` `data` tipine ekle (satır 494):

```ts
    data: {
        product_id: number;
        quantity?: number;
        unit?: string;
        brand_independent?: boolean;
    }
```

`prisma.listItem.create` `data`'sına (satır 555) ve `update` `data`'sına (satır 536) ekle:

```ts
            brand_independent: data.brand_independent ?? false,
```

(update'te mevcut değeri koru: `brand_independent: data.brand_independent ?? existingItem.brand_independent`)

- [ ] **Step 3: updateListItem — alanı yaz**

`updateListItem` `data` tipine `brand_independent?: boolean;` ekle (satır 581) ve `prisma.listItem.update` `data`'sına (satır 600) ekle:

```ts
            brand_independent: data.brand_independent,
```

- [ ] **Step 4: Tip kontrolü**

Run: `cd cheep-backend-express && npx tsc --noEmit`
Expected: hatasız.

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/api/lists
git commit -m "feat(lists): accept brand_independent on add/update item"
```

---

### Task 5: Mobil — `addItem` tipi + SelectListModal "Marka farketmez" toggle

**Files:**
- Modify: `Cheep-Mobile/src/services/list.service.ts:72` (addItem + AddListItemRequest)
- Modify: `Cheep-Mobile/src/components/list/SelectListModal.tsx`

**Interfaces:**
- Consumes: backend `brand_independent` (Task 4).
- Produces: `SelectListModal` artık seçilen markete `brand_independent` gönderir.

- [ ] **Step 1: AddListItemRequest tipine alan ekle**

`list.service.ts` içinde `AddListItemRequest` tipine ekle:

```ts
  brand_independent?: boolean;
```

- [ ] **Step 2: SelectListModal'a toggle state + Switch ekle**

`SelectListModal.tsx` bileşeninin başında state ekle:

```tsx
  const [brandIndependent, setBrandIndependent] = useState(false);
```

Modal içeriğine (liste listesinin üstüne) bir satır ekle:

```tsx
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>Marka farketmez (en ucuzu)</Text>
    <Switch value={brandIndependent} onValueChange={setBrandIndependent} />
  </View>
```

`handleSelectList` ve `handleCreateNew` içindeki `addItem` çağrılarına alanı ekle:

```tsx
      await listService.addItem(listId, { product_id: productId, quantity, unit, brand_independent: brandIndependent });
```

(`handleCreateNew`'deki çağrıya da aynısı.)

`Switch` import edildiğinden emin ol: `import { ..., Switch } from 'react-native';`. `styles`'a `toggleRow`/`toggleLabel` ekle (mevcut tema: `flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm`).

- [ ] **Step 3: Tip kontrolü**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: hatasız.

- [ ] **Step 4: Commit**

```bash
git add Cheep-Mobile/src/services/list.service.ts Cheep-Mobile/src/components/list/SelectListModal.tsx
git commit -m "feat(mobile): brand-independent toggle in SelectListModal"
```

---

### Task 6: Mobil — ListDetail'de mevcut öğeyi marka-bağımsıza çevir

**Files:**
- Modify: `Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx:200-210` (öğe satırı render)
- Modify: `Cheep-Mobile/src/services/list.service.ts` (updateItem metodu — yoksa ekle)

**Interfaces:**
- Consumes: backend `updateListItem` `brand_independent` (Task 4).
- Produces: öğe satırında "marka farketmez" rozeti + dokununca toggle.

- [ ] **Step 1: list.service'e updateItem ekle (yoksa)**

`list.service.ts`'de mevcut bir `updateItem(itemId, data)` yoksa ekle:

```ts
  async updateItem(itemId: number, data: { quantity?: number; unit?: string; brand_independent?: boolean }): Promise<any> {
    const res = await apiClient.put(`/lists/items/${itemId}`, data);
    return res.data;
  },
```

(Mevcut update rotasının yolunu `lists.routes.ts`'ten doğrula; farklıysa ona göre düzelt.)

- [ ] **Step 2: Öğe satırına rozet + toggle ekle**

`ListDetailScreen.tsx` öğe render'ında (satır ~205, `product.brand` gösterimi yanında) marka-bağımsız öğeler için rozet ekle:

```tsx
  {item.brand_independent && (
    <Text style={styles.brandFreeBadge}>🏷️ marka farketmez</Text>
  )}
```

Satıra bir `onLongPress` (veya küçük bir ikon) bağla → `listService.updateItem(item.id, { brand_independent: !item.brand_independent })` çağırıp listeyi yenile.

- [ ] **Step 3: Tip kontrolü**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: hatasız.

- [ ] **Step 4: Commit**

```bash
git add Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx Cheep-Mobile/src/services/list.service.ts
git commit -m "feat(mobile): toggle brand-independent on existing list item"
```

---

### Task 7: Mobil — Compare sonucunda kazanan markayı göster

**Files:**
- Modify: `Cheep-Mobile/src/screens/lists/CompareResultsScreen.tsx` ve/veya `StrategyDetailScreen.tsx` (allocation ürün satırı render)

**Interfaces:**
- Consumes: backend allocation `product.brand`/`product.name` artık kazanan ürünün (Task 3).

- [ ] **Step 1: Allocation satırında marka göster**

Strateji/allocation ürün satırında (markette gösterilen ürün) `product.brand` zaten kazanan markadır (Task 3 sayesinde). Eğer satırda marka gösterilmiyorsa ekle:

```tsx
  <Text style={styles.allocBrand}>{p.product.brand ?? '—'} · {p.product.name}</Text>
```

Marka-bağımsız öğelerde (liste öğesi `brand_independent`) küçük bir "en ucuz marka" etiketi göster (öğe verisi compare yanıtında yoksa, sadece kazanan markayı göstermek yeterli — ekstra çağrı yapma).

- [ ] **Step 2: Tip kontrolü**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: hatasız.

- [ ] **Step 3: Commit**

```bash
git add Cheep-Mobile/src/screens/lists
git commit -m "feat(mobile): show winning brand in compare results"
```

---

### Task 8: Uçtan uca doğrulama (Playwright)

**Files:**
- Test: manuel/Playwright (mevcut `Cheep-Mobile/fitflow.py` deseni)

- [ ] **Step 1: Backend + Expo web ayakta mı kontrol et**

Run: `netstat -ano | grep -E ':8081|:3000' | grep LISTEN`
Expected: ikisi de LISTENING. Değilse: backend `cd cheep-backend-express && npm run dev`, mobil `cd Cheep-Mobile && npm run web`.

- [ ] **Step 2: Akışı doğrula**

Login → bir ürünü listeye eklerken "Marka farketmez" toggle'ını aç → listeyi compare et → sonuç ekranında o öğe için en ucuz markayı barındıran marketin seçildiğini ve kazanan markanın gösterildiğini ekran görüntüsüyle doğrula (`python fitflow.py` benzeri bir akış yaz).

- [ ] **Step 3: Sonucu raporla**

Ekran görüntüsünü incele; marka-bağımsız öğenin doğru markette/markayla çıktığını teyit et. Sorun varsa systematic-debugging ile kök neden bul.

---

## Self-Review Notları

- **Spec kapsamı:** 5-0'ın tüm gereksinimleri karşılandı — `brand_independent` alanı (Task 1), muadil-grup en-ucuz seçimi (Task 2-3), elle ekleme toggle (Task 5), mevcut öğe toggle (Task 6), sonuçta kazanan marka (Task 3+7), tekil-ürün güvenli geri düşüş (Task 2 test 4), geriye uyumluluk (`@default(false)`).
- **Test edilebilirlik:** Çekirdek mantık saf fonksiyon (Task 2) → DB'siz birim test. Compare entegrasyonu tsc + e2e ile doğrulanır (test DB kurulumu repoda yok).
- **Tip tutarlılığı:** `StoreOption`/`PricedProduct` Task 2'de tanımlanır, Task 3'te tüketilir; `resolveItemStoreOptions` imzası her iki yerde aynı.
