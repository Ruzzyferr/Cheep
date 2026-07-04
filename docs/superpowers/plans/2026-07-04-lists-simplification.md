# Liste Sistemi Sadeleştirme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Aktif/tamamlanan/şablon yaşam döngüsünü kaldırıp tek tip liste modeline geçmek; kullanıcı-seçmeli aktif liste, her listeye ekleme, klonla, başka listeden aktar (2 mod).

**Architecture:** Backend (Express+Prisma) `List.status`'ı `active|inactive` "aktif işareti"ne indirger; yeni endpoint'ler `activate/clone/import`. Mobil (RN/Expo) Listeler ekranını sekmesiz tek listeye çevirir, detay ekranını ⋮ menü + alt 2-buton çubuğuna yeniden tasarlar.

**Tech Stack:** Express (ESM, `.js` import uzantıları), Prisma 6, PostgreSQL, Joi, vitest (Prisma `vi.mock`'lanır). React Native 0.81/Expo 54, i18next (tr/en/de/pl/sv), react-navigation.

## Global Constraints

- **Sır yok:** hiçbir sır commit edilmez. Prod DB'ye yalnızca sanctioned deploy yolundan (container `prisma migrate deploy`) yazılır; doğrudan prod yazımı yok.
- **status ∈ `{'active','inactive'}`**, kullanıcı başına **tam bir** aktif liste (create/activate tx içinde diğerlerini `inactive` yapar).
- **`is_template` kolonu DURUR ama okunmaz/yazılmaz** (yıkıcı migration yok).
- **`brand_independent` TÜM kopyalama yollarında korunur** (clone, import).
- **Backend testleri Prisma'yı mock'lar:** `vi.mock('../src/utils/prisma.client.js', ...)`; `$transaction`'ı `async (fn) => fn(txMock)` ile mock'la. Gerçek DB'ye bağlanma.
- **Backend ESM:** tüm iç importlar `.js` uzantılı. Servis prisma'yı `../../utils/prisma.client.js`'den alır.
- **Mobil:** tema token'ları (`spacing`/`borderRadius`/`colors`/`Button` varyantları) kullanılır; dokunma hedefi **≥44px**; her yeni metin **5 dilde** (`tr/en/de/pl/sv`) i18n anahtarıyla. `android/` gitignore'da — versiyon `app.json`'dan.
- **UX (onaylı):** Detay ekranı = başlık(+⋮ menü) + (aktif değilse) aktif şeridi + kalemler + alt 2 buton (**Ürün Ekle** + **Rotaları Göster**). ⋮ menü: Aktif liste yap · Klonla · Başka listeden aktar · Sil.
- **Aktif liste yoksa:** ekleme akışı güvenli davranır (yeni liste oluşturup aktif yapar).

---

## Dosya Yapısı

**Backend** (`cheep-backend-express/`)
- `prisma/migrations/20260705090000_lists_simplify/migration.sql` — veri normalleştirme (Create)
- `src/api/lists/lists.service.ts` — getUserLists/createList düzeltme + activate/clone/importFromList (Modify)
- `src/api/lists/lists.controller.ts` — activate/clone/importFromList controller'ları (Modify)
- `src/api/lists/lists.routes.ts` — yeni route'lar (Modify)
- `src/schema/list.schema.ts` — importSchema (Modify)
- `test/lists-simplify.test.ts` — servis testleri (Create)

**Mobil** (`Cheep-Mobile/`)
- `src/types/index.ts` — `status: 'active'|'inactive'` (Modify)
- `src/services/list.service.ts` — activate/clone/importFromList; ölü metotları sil (Modify)
- `src/constants/api.ts` — yeni endpoint'ler (Modify)
- `src/context/CartContext.tsx` — aktif=status (Modify)
- `src/screens/lists/ListsScreen.tsx` — sekmesiz tek liste (Modify)
- `src/screens/lists/ListDetailScreen.tsx` — yeniden tasarım (Modify)
- `src/components/list/ListActionsSheet.tsx` — ⋮ menü alt-sheet (Create)
- `src/components/list/SelectSourceListModal.tsx` — kaynak liste seçici (Create)
- `src/components/list/ImportModeModal.tsx` — 2 mod modalı (Create)
- `src/components/list/ListCard.tsx` — "Aktif" rozeti (Modify)
- `src/screens/search/SearchScreen.tsx` — hedef-liste param + şerit (Modify)
- `src/navigation/types.ts` + Lists/Home navigator — Search param + Lists stack'e Search (Modify)
- `src/screens/lists/StrategyDetailScreen.tsx` — "Bu Rotayı Kullan" kaldır (Modify)
- `src/locales/{tr,en,de,pl,sv}.json` — yeni anahtarlar (Modify)

---

## Task 1: Backend — veri migration'ı (status normalleştirme)

**Files:**
- Create: `cheep-backend-express/prisma/migrations/20260705090000_lists_simplify/migration.sql`

**Interfaces:**
- Produces: normalleştirilmiş `lists` verisi — kullanıcı başına tam bir `status='active'`, kalan hepsi `'inactive'`. `is_template` değeri artık anlamsız.

- [ ] **Step 1: Migration SQL yaz**

`migration.sql`:
```sql
-- Liste sadeleştirme: status'u 'active'/'inactive' aktif-işaretine indirge.
-- Kullanıcı başına EN SON güncellenen liste aktif, kalan hepsi pasif.
-- Eski 'completed' ve is_template listeler normal (inactive) listeye döner; veri silinmez.

-- 1) Hepsini pasife çek
UPDATE "lists" SET "status" = 'inactive';

-- 2) Her kullanıcının en son güncellenen listesini aktif yap
UPDATE "lists" l
SET "status" = 'active'
FROM (
  SELECT DISTINCT ON ("user_id") "id"
  FROM "lists"
  ORDER BY "user_id", "updated_at" DESC, "id" DESC
) pick
WHERE l."id" = pick."id";
```

- [ ] **Step 2: Uygula ve doğrula (LOKAL DB)**

Lokal container'da (prod'a DOKUNMA):
Run: `npx prisma migrate deploy` (lokal `DATABASE_URL` ile)
Beklenen: hata yok. Doğrulama sorgusu:
`SELECT user_id, count(*) FILTER (WHERE status='active') AS actives FROM lists GROUP BY user_id;`
Beklenen: her `user_id` için `actives = 1` (kullanıcının en az 1 listesi varsa).

- [ ] **Step 3: Commit**
```bash
git add cheep-backend-express/prisma/migrations/20260705090000_lists_simplify/
git commit -m "feat(lists): status normalize migration (single active per user)"
```

---

## Task 2: Backend — getUserLists / createList / activate

**Files:**
- Modify: `cheep-backend-express/src/api/lists/lists.service.ts`
- Modify: `cheep-backend-express/src/api/lists/lists.controller.ts`
- Modify: `cheep-backend-express/src/api/lists/lists.routes.ts`
- Test: `cheep-backend-express/test/lists-simplify.test.ts`

**Interfaces:**
- Consumes: `prisma` (`../../utils/prisma.client.js`), `prisma.$transaction`.
- Produces:
  - `getUserLists(userId)` → tüm listeler, **aktif önce** sonra `updated_at desc`. (status parametresi yok sayılır.)
  - `createList(userId, { name, budget })` → yeni liste `status:'active'`; tx içinde kullanıcının diğerleri `inactive`. (is_template yok.)
  - `activateList(listId, userId)` → bu liste `active`, diğerleri `inactive` (tx). Sahiplik doğrulanır; yoksa `null`.
  - Route: `POST /lists/:id/activate` → `activateList`.

- [ ] **Step 1: Test yaz** (`test/lists-simplify.test.ts`)
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMany = vi.fn();
const create = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const $transaction = vi.fn(async (fn: any) => fn({
  list: { updateMany, create, update, findFirst },
  listItem: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: { list: { findMany, findFirst, updateMany, create, update }, listItem: {}, $transaction },
}));

import { createList, activateList } from '../src/api/lists/lists.service.js';

beforeEach(() => { updateMany.mockReset(); create.mockReset(); findFirst.mockReset(); update.mockReset(); $transaction.mockClear(); });

describe('createList', () => {
  it('yeni listeyi aktif yapar ve diğerlerini pasife çeker', async () => {
    create.mockResolvedValue({ id: 5, status: 'active' });
    await createList(1, { name: 'Test' } as any);
    // diğerleri inactive
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 1, status: 'active' },
      data: { status: 'inactive' },
    }));
    // yeni liste active
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ user_id: 1, status: 'active' }),
    }));
  });
});

describe('activateList', () => {
  it('sahip listeyi aktif yapar, diğerlerini pasife', async () => {
    findFirst.mockResolvedValue({ id: 9, user_id: 1 });
    update.mockResolvedValue({ id: 9, status: 'active' });
    const res = await activateList(9, 1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 1, status: 'active' }, data: { status: 'inactive' },
    }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9 }, data: { status: 'active' },
    }));
    expect(res).toBeTruthy();
  });
  it('sahip değilse null döner', async () => {
    findFirst.mockResolvedValue(null);
    const res = await activateList(9, 2);
    expect(res).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**
Run: `npx vitest run test/lists-simplify.test.ts`
Beklenen: FAIL (`activateList` yok / createList eski davranış).

- [ ] **Step 3: `getUserLists` düzelt** (`lists.service.ts` ~satır 12)

Mevcut status-filtreli where'i kaldır; tüm listeleri döndür, aktif önce:
```ts
export const getUserLists = async (userId: number) => {
  const lists = await prisma.list.findMany({
    where: { user_id: userId },
    include: { list_items: { include: { product: { include: { category: true } } } } },
    orderBy: [{ status: 'asc' }, { updated_at: 'desc' }],
    // status: 'active' < 'inactive' alfabetik → 'active' önce gelir
  });
  return lists;
};
```
> Controller `getMyLists` artık `status` query paramını `getUserLists`'e GEÇİRMEZ (imza tek argüman). Controller'da status okuma satırını kaldır.

- [ ] **Step 4: `createList` düzelt** (~satır 140)

is_template ve otomatik-tamamlama mantığını kaldır; yeni liste aktif, diğerleri pasif:
```ts
export const createList = async (
  userId: number,
  data: { name: string; budget?: number | string | null },
) => {
  return await prisma.$transaction(async (tx) => {
    await tx.list.updateMany({
      where: { user_id: userId, status: 'active' },
      data: { status: 'inactive' },
    });
    return await tx.list.create({
      data: {
        user_id: userId,
        name: data.name,
        budget: data.budget != null ? new Decimal(data.budget) : null,
        status: 'active',
      },
    });
  });
};
```

- [ ] **Step 5: `activateList` ekle** (yeni export)
```ts
export const activateList = async (listId: number, userId: number) => {
  const owned = await prisma.list.findFirst({ where: { id: listId, user_id: userId } });
  if (!owned) return null;
  return await prisma.$transaction(async (tx) => {
    await tx.list.updateMany({
      where: { user_id: userId, status: 'active' },
      data: { status: 'inactive' },
    });
    return await tx.list.update({ where: { id: listId }, data: { status: 'active' } });
  });
};
```

- [ ] **Step 6: Controller + route ekle**

`lists.controller.ts` — yeni handler:
```ts
export const activateList = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const listId = Number(req.params.id);
  const result = await listsService.activateList(listId, userId);
  if (!result) return res.status(404).json({ success: false, message: 'Liste bulunamadı' });
  return res.json({ success: true, data: result });
};
```
`lists.routes.ts` — mevcut `getMyLists`/`createList` route'ları dururken ekle:
```ts
router.post('/:id/activate', authenticate, validateIdParam('id'), listsController.activateList);
```
> Controller'da `getMyLists`'in status paramını `getUserLists`'e geçiren satırı kaldır (imza değişti).

- [ ] **Step 7: Testi çalıştır, yeşil gör**
Run: `npx vitest run test/lists-simplify.test.ts`
Beklenen: PASS.

- [ ] **Step 8: typecheck + commit**
Run: `npx tsc --noEmit`
```bash
git add cheep-backend-express/src/api/lists/ cheep-backend-express/test/lists-simplify.test.ts
git commit -m "feat(lists): unified getUserLists + create-activates + activate endpoint"
```

---

## Task 3: Backend — clone

**Files:**
- Modify: `lists.service.ts`, `lists.controller.ts`, `lists.routes.ts`
- Test: `test/lists-simplify.test.ts` (ekle)

**Interfaces:**
- Produces: `cloneList(listId, userId)` → kaynağın kalemlerini (**`brand_independent` dahil**) kopyalayan yeni **pasif** liste; ad `"{name} (Kopya)"`. Sahiplik yoksa `null`.
- Route: `POST /lists/:id/clone` → `cloneList`.

- [ ] **Step 1: Test ekle**
```ts
import { cloneList } from '../src/api/lists/lists.service.js';

describe('cloneList', () => {
  it('kalemleri brand_independent ile kopyalar, klon pasif', async () => {
    findFirst.mockResolvedValue({
      id: 3, user_id: 1, name: 'Haftalık', budget: null,
      list_items: [{ product_id: 10, quantity: 2, unit: 'adet', brand_independent: true }],
    });
    const created = { id: 99 };
    const txCreate = vi.fn().mockResolvedValue(created);
    const txCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    $transaction.mockImplementationOnce(async (fn: any) =>
      fn({ list: { create: txCreate }, listItem: { createMany: txCreateMany } }));
    const res = await cloneList(3, 1);
    expect(txCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ user_id: 1, name: 'Haftalık (Kopya)', status: 'inactive' }),
    }));
    expect(txCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ list_id: 99, product_id: 10, quantity: 2, unit: 'adet', brand_independent: true })],
    }));
    expect(res).toBeTruthy();
  });
});
```

- [ ] **Step 2: Kırmızı gör** — Run: `npx vitest run test/lists-simplify.test.ts`

- [ ] **Step 3: `cloneList` yaz**
```ts
export const cloneList = async (listId: number, userId: number) => {
  const src = await prisma.list.findFirst({
    where: { id: listId, user_id: userId },
    include: { list_items: true },
  });
  if (!src) return null;
  return await prisma.$transaction(async (tx) => {
    const clone = await tx.list.create({
      data: { user_id: userId, name: `${src.name} (Kopya)`, budget: src.budget, status: 'inactive' },
    });
    if (src.list_items.length > 0) {
      await tx.listItem.createMany({
        data: src.list_items.map((it) => ({
          list_id: clone.id, product_id: it.product_id,
          quantity: it.quantity, unit: it.unit, brand_independent: it.brand_independent,
        })),
      });
    }
    return clone;
  });
};
```

- [ ] **Step 4: Controller + route**
```ts
export const cloneList = async (req, res) => {
  const userId = (req as any).user.id;
  const result = await listsService.cloneList(Number(req.params.id), userId);
  if (!result) return res.status(404).json({ success: false, message: 'Liste bulunamadı' });
  return res.status(201).json({ success: true, data: result });
};
```
```ts
router.post('/:id/clone', authenticate, validateIdParam('id'), listsController.cloneList);
```

- [ ] **Step 5: Yeşil gör + typecheck + commit**
Run: `npx vitest run test/lists-simplify.test.ts && npx tsc --noEmit`
```bash
git add cheep-backend-express/src/api/lists/ cheep-backend-express/test/lists-simplify.test.ts
git commit -m "feat(lists): clone endpoint (preserves brand_independent)"
```

---

## Task 4: Backend — import (merge/replace)

**Files:**
- Modify: `lists.service.ts`, `lists.controller.ts`, `lists.routes.ts`, `src/schema/list.schema.ts`
- Test: `test/lists-simplify.test.ts` (ekle)

**Interfaces:**
- Produces: `importFromList(targetId, sourceId, mode, userId)`:
  - `mode='merge'`: hedefte olmayan kalemleri ekle (`createMany` + `skipDuplicates`), `brand_independent` korunur.
  - `mode='replace'`: hedefin kalemlerini sil, kaynağınkileri kopyala.
  - Guard: `sourceId !== targetId`, ikisi de kullanıcıya ait; değilse `null`.
- Route: `POST /lists/:id/import` body `{ sourceId, mode }`.
- Joi `importSchema`: `sourceId` required positive int, `mode` required `'merge'|'replace'`.

- [ ] **Step 1: Test ekle**
```ts
import { importFromList } from '../src/api/lists/lists.service.js';

describe('importFromList', () => {
  const srcItems = [{ product_id: 10, quantity: 1, unit: 'adet', brand_independent: false },
                    { product_id: 11, quantity: 3, unit: 'kg', brand_independent: true }];
  it('merge: skipDuplicates ile ekler, brand_independent korunur', async () => {
    findFirst
      .mockResolvedValueOnce({ id: 2, user_id: 1 })                       // target
      .mockResolvedValueOnce({ id: 5, user_id: 1, list_items: srcItems }); // source
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const deleteMany = vi.fn();
    $transaction.mockImplementationOnce(async (fn: any) => fn({ listItem: { createMany, deleteMany } }));
    const res = await importFromList(2, 5, 'merge', 1);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([expect.objectContaining({ list_id: 2, product_id: 11, brand_independent: true })]),
    }));
    expect(res).toBeTruthy();
  });
  it('replace: önce siler sonra kopyalar', async () => {
    findFirst
      .mockResolvedValueOnce({ id: 2, user_id: 1 })
      .mockResolvedValueOnce({ id: 5, user_id: 1, list_items: srcItems });
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 4 });
    $transaction.mockImplementationOnce(async (fn: any) => fn({ listItem: { createMany, deleteMany } }));
    await importFromList(2, 5, 'replace', 1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { list_id: 2 } });
    expect(createMany).toHaveBeenCalled();
  });
  it('kaynak=hedef ise null', async () => {
    expect(await importFromList(2, 2, 'merge', 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Kırmızı gör** — Run: `npx vitest run test/lists-simplify.test.ts`

- [ ] **Step 3: `importFromList` yaz**
```ts
export const importFromList = async (
  targetId: number, sourceId: number, mode: 'merge' | 'replace', userId: number,
) => {
  if (targetId === sourceId) return null;
  const target = await prisma.list.findFirst({ where: { id: targetId, user_id: userId } });
  if (!target) return null;
  const source = await prisma.list.findFirst({
    where: { id: sourceId, user_id: userId }, include: { list_items: true },
  });
  if (!source) return null;
  return await prisma.$transaction(async (tx) => {
    if (mode === 'replace') {
      await tx.listItem.deleteMany({ where: { list_id: targetId } });
    }
    if (source.list_items.length > 0) {
      await tx.listItem.createMany({
        data: source.list_items.map((it) => ({
          list_id: targetId, product_id: it.product_id,
          quantity: it.quantity, unit: it.unit, brand_independent: it.brand_independent,
        })),
        skipDuplicates: mode === 'merge',
      });
    }
    return await tx.list.findFirst({ where: { id: targetId }, include: { list_items: true } });
  });
};
```

- [ ] **Step 4: Joi schema + controller + route**

`src/schema/list.schema.ts`:
```ts
export const importSchema = Joi.object({
  sourceId: Joi.number().integer().positive().required(),
  mode: Joi.string().valid('merge', 'replace').required(),
});
```
`lists.controller.ts`:
```ts
export const importFromList = async (req, res) => {
  const userId = (req as any).user.id;
  const { sourceId, mode } = req.body;
  const result = await listsService.importFromList(Number(req.params.id), sourceId, mode, userId);
  if (!result) return res.status(404).json({ success: false, message: 'Liste bulunamadı veya geçersiz kaynak' });
  return res.json({ success: true, data: result });
};
```
`lists.routes.ts`:
```ts
router.post('/:id/import', authenticate, validateIdParam('id'), validate(importSchema), listsController.importFromList);
```

- [ ] **Step 5: Yeşil + typecheck + commit**
Run: `npx vitest run test/lists-simplify.test.ts && npx tsc --noEmit`
```bash
git add cheep-backend-express/src/ cheep-backend-express/test/lists-simplify.test.ts
git commit -m "feat(lists): import endpoint (merge/replace, preserves brand_independent)"
```

---

## Task 5: Mobil — types + service + CartContext + api sabitleri

**Files:**
- Modify: `Cheep-Mobile/src/types/index.ts`, `src/constants/api.ts`, `src/services/list.service.ts`, `src/context/CartContext.tsx`

**Interfaces:**
- Produces:
  - `ShoppingList.status: 'active' | 'inactive'`.
  - `listService.activate(id)`, `listService.clone(id)`, `listService.importFromList(id, sourceId, mode)`.
  - `getLists()` (parametresiz) tüm listeleri döner.
  - `CartContext.activeList` = `status==='active'` olan liste.

- [ ] **Step 1: types** — `ShoppingList.status` tipini `'active' | 'inactive'` yap; `is_template` alanını `types`'da opsiyonel bırak (kaldırma; kullanılmıyor).

- [ ] **Step 2: api.ts** — ekle:
```ts
ACTIVATE: (id: number) => `/lists/${id}/activate`,
CLONE: (id: number) => `/lists/${id}/clone`,
IMPORT: (id: number) => `/lists/${id}/import`,
```

- [ ] **Step 3: list.service.ts** — ekle, ölüleri sil:
```ts
async getLists(): Promise<ShoppingList[]> {
  const res = await apiClient.get<ApiResponse<ShoppingList[]>>(API_ENDPOINTS.LISTS.ALL);
  return res.data.data || [];
},
async activate(id: number): Promise<ShoppingList> {
  const res = await apiClient.post<ApiResponse<ShoppingList>>(API_ENDPOINTS.LISTS.ACTIVATE(id));
  return res.data.data!;
},
async clone(id: number): Promise<ShoppingList> {
  const res = await apiClient.post<ApiResponse<ShoppingList>>(API_ENDPOINTS.LISTS.CLONE(id));
  return res.data.data!;
},
async importFromList(id: number, sourceId: number, mode: 'merge' | 'replace'): Promise<ShoppingList> {
  const res = await apiClient.post<ApiResponse<ShoppingList>>(API_ENDPOINTS.LISTS.IMPORT(id), { sourceId, mode });
  return res.data.data!;
},
```
Sil: `getTemplates`, `createFromTemplate`, `importToExisting`, `createNewFromCompleted`, `useRoute`. (Kullanan yer kalmayacak — Task 6-11'de temizlenir; bu adımda metotları kaldır, `getLists(status)` imzasını parametresiz yap. `SelectListModal`/`ProfileScreen`/`CartContext` çağrılarını `getLists()`'e güncelle.)

- [ ] **Step 4: CartContext.tsx** — `refresh`:
```ts
const lists = await listService.getLists();
setActiveList(lists.find((l) => l.status === 'active') ?? null);
```

- [ ] **Step 5: typecheck + commit**
Run (Cheep-Mobile): `npx tsc --noEmit -p tsconfig.json`
Beklenen: `getTemplates`/`useRoute` vb. kaldırılınca kullanan yerlerde hata çıkarsa Task 6-11 kapsamında; bu commit'te en az servis+context+types+api temiz derlensin (kalan ekran hataları sonraki task'larda). Derleme hatası kalan ekranlar bu task'ta geçici bırakılMAZ — bu task yalnızca servis/types/api/context'i değiştirir; `SelectListModal` ve `ProfileScreen`'deki `getLists('active')` çağrılarını da `getLists()`'e çevir (küçük, aynı task).
```bash
git add Cheep-Mobile/src/types/index.ts Cheep-Mobile/src/constants/api.ts Cheep-Mobile/src/services/list.service.ts Cheep-Mobile/src/context/CartContext.tsx Cheep-Mobile/src/components/list/SelectListModal.tsx Cheep-Mobile/src/screens/profile/ProfileScreen.tsx
git commit -m "feat(lists-mobile): service activate/clone/import + active-by-status"
```

---

## Task 6: Mobil — i18n anahtarları (5 dil)

**Files:**
- Modify: `Cheep-Mobile/src/locales/{tr,en,de,pl,sv}.json`

**Interfaces:**
- Produces: `list.set_active`, `list.active_badge`, `list.not_active_hint`, `list.add_products`, `list.clone`, `list.clone_done`, `list.import_from_list`, `list.import_source_title`, `list.import_mode.title`, `list.import_mode.merge_title`, `list.import_mode.merge_desc`, `list.import_mode.replace_title`, `list.import_mode.replace_desc`, `list.import_done`, `list.menu_title`, `search.adding_to_list`.

- [ ] **Step 1: tr.json'a ekle** (`list` ve `search` blokları içine)
```json
"set_active": "Aktif liste yap",
"active_badge": "Aktif",
"not_active_hint": "Bu liste aktif değil",
"add_products": "Ürün Ekle",
"clone": "Klonla",
"clone_done": "Liste kopyalandı",
"import_from_list": "Başka listeden aktar",
"import_source_title": "Hangi listeden aktarılsın?",
"import_done": "Ürünler aktarıldı",
"menu_title": "Liste işlemleri",
"import_mode": {
  "title": "Nasıl aktaralım?",
  "merge_title": "Sadece eksik ürünleri ekle",
  "merge_desc": "Bu listede olmayan ürünler eklenir; mevcutlar değişmez.",
  "replace_title": "Tüm listeyi bununla değiştir",
  "replace_desc": "Bu listenin ürünleri silinip seçtiğin listenin ürünleri konur."
}
```
`search`: `"adding_to_list": "'{{name}}' listesine ekleniyor"`

- [ ] **Step 2: en/de/pl/sv.json'a eşdeğer çeviriler** (aynı anahtar ağacı). İngilizce örnek: `"set_active": "Set as active"`, `"add_products": "Add products"`, `"clone": "Duplicate"`, `"import_from_list": "Import from another list"`, `"import_mode.merge_title": "Add only missing items"`, `"replace_title": "Replace with this list"`, `"adding_to_list": "Adding to '{{name}}'"`. (de/pl/sv için doğru yerel çeviriler.)

- [ ] **Step 3: JSON geçerliliği + commit**
Run: `node -e "['tr','en','de','pl','sv'].forEach(l=>require('./src/locales/'+l+'.json'))"` (Cheep-Mobile'da)
```bash
git add Cheep-Mobile/src/locales/
git commit -m "feat(lists-mobile): i18n keys for activate/clone/import (5 langs)"
```

---

## Task 7: Mobil — ListsScreen (sekmesiz tek liste + aktif rozeti)

**Files:**
- Modify: `Cheep-Mobile/src/screens/lists/ListsScreen.tsx`, `src/components/list/ListCard.tsx`

**Interfaces:**
- Consumes: `listService.getLists()`, `ShoppingList.status`.
- Produces: sekmesiz, tek `FlatList`; aktif kart "Aktif" rozetli.

- [ ] **Step 1: ListCard** — `is_template`/`completed` rozet mantığını kaldır; yerine:
```tsx
{list.status === 'active' && (
  <View style={styles.badge}><Text style={styles.badgeText}>{t('list.active_badge')}</Text></View>
)}
```
(mevcut `badge` stili; `completedBadge` stili kaldırılabilir.)

- [ ] **Step 2: ListsScreen** — `activeTab` state + 3 tab bloğu + `templates` dalını kaldır. `loadLists`:
```ts
const data = await listService.getLists();
setLists(data);
```
`handleCreateList`'teki "aktif liste var" Alert'i kaldır (artık yeni liste sorunsuz aktif olur). `hasActiveList` prop'u kaldır. `CreateListModal`'a `hasActiveList` verme. Boş durum tek: `active` empty state metni.

- [ ] **Step 3: typecheck + görsel kontrol (harness/cihaz)** — Run: `npx tsc --noEmit -p tsconfig.json`. Uzun liste kaydırması çalışmalı (mevcut `list:{flex:1}`).

- [ ] **Step 4: commit**
```bash
git add Cheep-Mobile/src/screens/lists/ListsScreen.tsx Cheep-Mobile/src/components/list/ListCard.tsx
git commit -m "feat(lists-mobile): single flat list, active badge, no tabs"
```

---

## Task 8: Mobil — ListDetailScreen yeniden tasarım (⋮ menü + aktif şeridi + alt 2 buton + kaydırma)

**Files:**
- Modify: `Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx`
- Create: `Cheep-Mobile/src/components/list/ListActionsSheet.tsx`

**Interfaces:**
- Consumes: `listService.activate/clone/deleteList`, `useCart().refresh`, i18n (Task 6).
- Produces: ⋮ menü alt-sheet; aktif değilse aktif şeridi; alt sabit **[Ürün Ekle][Rotaları Göster]**; `onImport` callback (Task 9 doldurur); `onAddProducts` callback (Task 10 doldurur).

- [ ] **Step 1: `ListActionsSheet` bileşeni** — basit alt-sheet modal (mevcut `SelectListModal` overlay desenini izler). Props:
```tsx
interface ListActionsSheetProps {
  visible: boolean;
  isActive: boolean;
  onClose: () => void;
  onSetActive: () => void;
  onClone: () => void;
  onImport: () => void;
  onDelete: () => void;
}
```
Satırlar (≥44px, ikon+etiket): `!isActive && "Aktif liste yap"`, "Klonla", "Başka listeden aktar", "Sil" (kırmızı `colors.error`/`danger`). Başlık `t('list.menu_title')`.

- [ ] **Step 2: ListDetailScreen header + menü** — başlıktaki `deleteButton`'ı kaldırıp yerine ⋮ (overflow) ikon-butonu koy (40×40). `showActionsSheet` state. `list.status==='active'` ise ad yanına küçük "✓ Aktif" chip.

- [ ] **Step 3: Aktif şeridi** — `list.status !== 'active'` ise başlık kartının altında ince şerit: sol `t('list.not_active_hint')`, sağ küçük outline "Aktif Yap" butonu (`onPress` → `handleSetActive`).

- [ ] **Step 4: Aksiyon handler'ları**
```ts
const handleSetActive = async () => {
  try { await listService.activate(list.id); await loadList(); cart.refresh(); }
  catch { Alert.alert(t('common.error'), t('list.select_modal.add_error')); }
};
const handleClone = async () => {
  try { await listService.clone(list.id); toast.show(t('list.clone_done')); }
  catch { Alert.alert(t('common.error'), t('list.select_modal.add_error')); }
};
```
(`toast` = `useToast()`.)

- [ ] **Step 5: Alt sabit çubuk** — mevcut tek "Rotaları Göster" yerine iki buton yan yana (kalem varsa):
```tsx
{items.length > 0 && (
  <View style={[styles.actions, { bottom: insets.bottom + 72 }]}>
    <View style={styles.actionRow}>
      <Button title={t('list.add_products')} variant="outline" onPress={handleAddProducts} style={styles.actionBtn} />
      <Button title={t('compare.show_routes') /* mevcut anahtar */} onPress={handleCompare} style={styles.actionBtn} />
    </View>
  </View>
)}
```
`actionRow: { flexDirection:'row', gap: spacing.sm }`, `actionBtn: { flex:1 }`. `handleAddProducts` şimdilik stub (Task 10). Boş durumdaki `EmptyState` aksiyonu `t('list.add_products')` → `handleAddProducts`.

- [ ] **Step 6: Kaydırma garantisi** — kalemler `FlatList` `style={{flex:1}}`, `contentContainerStyle` `paddingBottom` alt çubuğu (≈140) aşacak şekilde. Uzun listede (>5 kalem) son kaleme erişim doğrulanır (harness/cihaz).

- [ ] **Step 7: typecheck + commit**
Run: `npx tsc --noEmit -p tsconfig.json`
```bash
git add Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx Cheep-Mobile/src/components/list/ListActionsSheet.tsx
git commit -m "feat(lists-mobile): detail redesign — overflow menu, active strip, dual bottom bar"
```

---

## Task 9: Mobil — Import akışı (kaynak seç + mod modalı)

**Files:**
- Create: `Cheep-Mobile/src/components/list/SelectSourceListModal.tsx`, `src/components/list/ImportModeModal.tsx`
- Modify: `Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx`

**Interfaces:**
- Consumes: `listService.getLists()`, `listService.importFromList(id, sourceId, mode)`.
- Produces: iki modal + `ListDetailScreen`'in ⋮ "Başka listeden aktar" akışı.

- [ ] **Step 1: `SelectSourceListModal`** — `getLists()` çağırır, **mevcut liste hariç** listeler; `onSelect(sourceId)`. Boşsa "başka liste yok" durumu. (SelectListModal görsel dili.)

- [ ] **Step 2: `ImportModeModal`** — iki büyük seçenek kartı:
```tsx
interface ImportModeModalProps {
  visible: boolean; onClose: () => void; onChoose: (mode: 'merge' | 'replace') => void;
}
```
Kart 1: `import_mode.merge_title` + `merge_desc`; Kart 2: `replace_title` + `replace_desc` (≥44px, `spacing.md` aralık, `borderRadius.lg`).

- [ ] **Step 3: ListDetailScreen wiring**
```ts
const [showSource, setShowSource] = useState(false);
const [pendingSourceId, setPendingSourceId] = useState<number | null>(null);
// ⋮ "Başka listeden aktar" → setShowSource(true)
// SelectSourceListModal.onSelect: (id) => { setPendingSourceId(id); setShowSource(false); /* mod modalını aç */ }
const handleImport = async (mode: 'merge' | 'replace') => {
  if (pendingSourceId == null) return;
  try {
    await listService.importFromList(list.id, pendingSourceId, mode);
    toast.show(t('list.import_done')); await loadList(); cart.refresh();
  } catch { Alert.alert(t('common.error'), t('list.select_modal.add_error')); }
  finally { setPendingSourceId(null); }
};
```

- [ ] **Step 4: typecheck + commit**
Run: `npx tsc --noEmit -p tsconfig.json`
```bash
git add Cheep-Mobile/src/components/list/SelectSourceListModal.tsx Cheep-Mobile/src/components/list/ImportModeModal.tsx Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx
git commit -m "feat(lists-mobile): import-from-list flow (source picker + mode modal)"
```

---

## Task 10: Mobil — hedef-listeye ürün ekleme (Search param + Lists stack)

**Files:**
- Modify: `Cheep-Mobile/src/navigation/types.ts`, Lists & Home navigator dosyaları, `src/screens/search/SearchScreen.tsx`, `src/screens/lists/ListDetailScreen.tsx`

**Interfaces:**
- Consumes: `SearchScreen` (Task: search grid mevcut).
- Produces: `Search` route param `{ targetListId?: number; targetListName?: string }`; Lists stack'te `Search` kaydı; "Ürün Ekle" → o listeyi hedefler.

- [ ] **Step 1: types.ts** — `Search: { targetListId?: number; targetListName?: string } | undefined;` hem HomeStack hem ListsStack param list'lerine ekle.

- [ ] **Step 2: Lists navigator** — `Search` ekranını Lists stack'ine de kaydet (aynı `SearchScreen` bileşeni).

- [ ] **Step 3: SearchScreen** — `route.params?.targetListId` varsa:
  - `handleAdd`: `listId = targetListId` (aktif liste yerine); `addItem(targetListId, ...)`.
  - Üstte şerit: `t('search.adding_to_list', { name: targetListName })` (`colors.primary[50]`).
  - Param yoksa mevcut davranış (aktif liste).

- [ ] **Step 4: ListDetailScreen** — `handleAddProducts` (Task 8 stub'ını doldur):
```ts
const handleAddProducts = () => navigation.navigate('Search', { targetListId: list.id, targetListName: list.name });
```
(Lists stack içinde `Search`.)

- [ ] **Step 5: typecheck + commit**
Run: `npx tsc --noEmit -p tsconfig.json`
```bash
git add Cheep-Mobile/src/navigation/ Cheep-Mobile/src/screens/search/SearchScreen.tsx Cheep-Mobile/src/screens/lists/ListDetailScreen.tsx
git commit -m "feat(lists-mobile): add products to any list via targeted Search"
```

---

## Task 11: Mobil — StrategyDetail "Bu Rotayı Kullan" kaldır

**Files:**
- Modify: `Cheep-Mobile/src/screens/lists/StrategyDetailScreen.tsx`

**Interfaces:**
- Produces: tamamlama aksiyonu kaldırılmış rota detayı.

- [ ] **Step 1:** `actions` View'ını ve "Bu Rotayı Kullan" `Button`'ını + `listService.useRoute` çağrısını kaldır. Altta yalnızca `bottomSpacing` kalır. Kullanılmayan importları (`listService` hâlâ affiliate için gerekli değilse kontrol et — `affiliateService` kalır) temizle.

- [ ] **Step 2: typecheck + commit**
Run: `npx tsc --noEmit -p tsconfig.json`
```bash
git add Cheep-Mobile/src/screens/lists/StrategyDetailScreen.tsx
git commit -m "feat(lists-mobile): remove list-completion (Bu Rotayı Kullan)"
```

---

## Bitiş

- Backend testleri: `cd cheep-backend-express && npx vitest run` (tümü yeşil).
- Mobil typecheck: `cd Cheep-Mobile && npx tsc --noEmit -p tsconfig.json`.
- Deploy: backend droplet'e (`git reset --hard origin/main` + `docker compose up -d --build` → container `prisma migrate deploy` migration'ı uygular). Migration'ın prod'da tam-bir-aktif ürettiği `/health` sonrası doğrulanır.
- Mobil: v1.0.6 imzalı APK+AAB build + masaüstü.
- Whole-branch review sonrası superpowers:finishing-a-development-branch.
