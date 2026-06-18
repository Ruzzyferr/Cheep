# Profil & Kısıtlar + Onboarding (Faz 5-P) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının alışverişle ilgili kısıtlarını (beslenme tarzı, kaçındıkları, alerjiler, hane, bütçe) ilk kayıtta maskotlu/animasyonlu bir onboarding ile toplayıp profil olarak saklamak; bu profili asistana ve ürün listelerine yansıtmak.

**Architecture:** `UserProfile` (User ile 1:1) + `GET/PUT /profile` endpoint'leri. Mobilde RootNavigator, `onboarding_done=false` ise onboarding sihirbazını gösterir; profil ekranından her şey düzenlenir. Diyet/avoid kısıtının ürünlere uygulanması, DB'siz test edilebilen saf bir kategori-sezgi fonksiyonuyla başlar (v1).

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), Vitest (backend); React Native / Expo, React Navigation, axios, React Native `Animated` (yeni bağımlılık yok).

## Global Constraints

- Prisma model ID'leri: `Int @id @default(autoincrement())`, tablo adları snake_case `@@map`.
- Backend feature deseni: `src/api/<feature>/` → `*.routes.ts` (`authenticate` + `validate`), `*.controller.ts` (`req.user.id`), `*.service.ts`, `*.schema.ts` (zod, co-located feedback gibi).
- Router mount: `src/api/index.ts`.
- Backend testleri DB gerektirmemeli → yeni mantık saf fonksiyon olarak test edilir. Vitest: `npm test`.
- Mobil: `npx tsc --noEmit` temiz. Auth durumu `src/context/AuthContext.tsx`; root geçişi `src/navigation/RootNavigator.tsx`.
- Maskot = login ekranındaki kuş logosu (mevcut asset). Animasyon RN `Animated` ile (fade/slide), yeni paket yok.
- Sert kısıt ilkesi: alerji/diyet asla sessizce ihlal edilmez; emin olunmayan ürün için "etiketi kontrol et" uyarısı (sessiz "güvenli" iması yok).

---

### Task 1: Prisma `UserProfile` modeli + migration

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma` (User modeli:17-33 — ilişki ekle; yeni model)
- Create: migration (Prisma üretir)

**Interfaces:**
- Produces: `UserProfile { user_id, household_size?, diet?, avoid?:Json, allergies?:Json, weekly_budget?, onboarding_done }`.

- [ ] **Step 1: Modeli ekle**

`schema.prisma` içinde `User` modeline ilişki ekle (`price_feedbacks` satırının altına):

```prisma
  price_feedbacks PriceFeedback[]
  profile         UserProfile?
```

Dosyanın uygun bir yerine yeni model ekle:

```prisma
model UserProfile {
  id              Int      @id @default(autoincrement())
  user_id         Int      @unique
  household_size  String?  // '1' | '2' | '3-4' | '5+'
  diet            String?  // 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian'
  avoid           Json?    // ['pork_gelatin','alcohol', ...]
  allergies       Json?    // ['lactose','gluten','peanut','tree_nut', ...serbest]
  weekly_budget   Decimal? @db.Decimal(10, 2)
  onboarding_done Boolean  @default(false)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  user            User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}
```

- [ ] **Step 2: Migration + generate**

Run: `cd cheep-backend-express && npx prisma migrate dev --name add_user_profile && npx prisma generate`
Expected: "in sync" + `user_profiles` tablosu oluşur, Prisma Client güncellenir.

- [ ] **Step 3: Commit**

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations
git commit -m "feat(profile): add UserProfile model"
```

---

### Task 2: profile.service + schema + controller + routes

**Files:**
- Create: `cheep-backend-express/src/api/profile/profile.service.ts`
- Create: `cheep-backend-express/src/api/profile/profile.schema.ts`
- Create: `cheep-backend-express/src/api/profile/profile.controller.ts`
- Create: `cheep-backend-express/src/api/profile/profile.routes.ts`
- Modify: `cheep-backend-express/src/api/index.ts` (mount)

**Interfaces:**
- Consumes: `UserProfile` (Task 1), `authenticate` middleware (`req.user.id`).
- Produces:
  - `getProfile(userId: number)` → `UserProfile | null`
  - `upsertProfile(userId, data: ProfileInput)` → `UserProfile`
  - `ProfileInput = { household_size?, diet?, avoid?: string[], allergies?: string[], weekly_budget?: number, onboarding_done?: boolean }`
  - Routes: `GET /profile`, `PUT /profile`.

- [ ] **Step 1: Zod şeması**

`profile.schema.ts`:

```ts
import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    household_size: z.enum(['1', '2', '3-4', '5+']).optional(),
    diet: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian']).optional(),
    avoid: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
    weekly_budget: z.number().nonnegative().optional(),
    onboarding_done: z.boolean().optional(),
  }),
});
```

> Not: `validate` middleware'in şekil beklentisini (`body`/`params` sarmalı mı, düz mü) `src/schema/validation.middleware.ts` ve mevcut bir şema (`feedback.schema.ts`) ile teyit et; ona göre hizala.

- [ ] **Step 2: Service**

`profile.service.ts`:

```ts
import { prisma } from '../../utils/prisma.client.js';

export interface ProfileInput {
  household_size?: string;
  diet?: string;
  avoid?: string[];
  allergies?: string[];
  weekly_budget?: number;
  onboarding_done?: boolean;
}

export const getProfile = async (userId: number) => {
  return prisma.userProfile.findUnique({ where: { user_id: userId } });
};

export const upsertProfile = async (userId: number, data: ProfileInput) => {
  return prisma.userProfile.upsert({
    where: { user_id: userId },
    create: { user_id: userId, ...data },
    update: { ...data },
  });
};
```

- [ ] **Step 3: Controller**

`profile.controller.ts`:

```ts
import { Request, Response } from 'express';
import * as ProfileService from './profile.service.js';

export const getMyProfile = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Yetkisiz' });
  const profile = await ProfileService.getProfile(req.user.id);
  return res.json({ profile });
};

export const updateMyProfile = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Yetkisiz' });
  const profile = await ProfileService.upsertProfile(req.user.id, req.body);
  return res.json({ profile });
};
```

- [ ] **Step 4: Routes + mount**

`profile.routes.ts`:

```ts
import { Router } from 'express';
import * as ProfileController from './profile.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { updateProfileSchema } from './profile.schema.js';

const router = Router();
router.get('/', authenticate, ProfileController.getMyProfile);
router.put('/', authenticate, validate(updateProfileSchema), ProfileController.updateMyProfile);
export default router;
```

`src/api/index.ts`: import + `router.use('/profile', profileRouter);`

- [ ] **Step 5: Tip kontrolü**

Run: `cd cheep-backend-express && npx tsc --noEmit`
Expected: hatasız.

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/src/api/profile cheep-backend-express/src/api/index.ts
git commit -m "feat(profile): GET/PUT /profile endpoints"
```

---

### Task 3: Saf kısıt değerlendirici `evaluateProductConstraints` (TDD, DB'siz)

**Files:**
- Create: `cheep-backend-express/src/services/product-constraints.ts`
- Test: `cheep-backend-express/test/product-constraints.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ConstraintProfile { diet?: string; avoid?: string[]; allergies?: string[] }
  export interface ConstraintVerdict { hidden: boolean; warnings: string[] }
  // Ürünün kategori adına göre diyet/avoid uyumunu kaba (v1) değerlendirir.
  export function evaluateProductConstraints(
    categoryName: string | null,
    profile: ConstraintProfile
  ): ConstraintVerdict
  ```
  Kurallar (v1 kategori-sezgi): vegan/vejetaryen profilde "et/tavuk/balık/şarküteri" kategorileri `hidden=true`; pesketaryen'de "et/tavuk" hidden ama "balık" değil; `avoid` 'pork_gelatin' → "şarküteri/şarkuteri" içeren kategori uyarı; emin olunamayan durumda hidden değil, sadece uyarı.

- [ ] **Step 1: Failing testler**

`test/product-constraints.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluateProductConstraints } from '../src/services/product-constraints';

describe('evaluateProductConstraints', () => {
  it('vegan profilde et kategorisini gizler', () => {
    const v = evaluateProductConstraints('Et & Tavuk', { diet: 'vegan' });
    expect(v.hidden).toBe(true);
  });
  it('vegan profilde sebzeyi gizlemez', () => {
    const v = evaluateProductConstraints('Meyve & Sebze', { diet: 'vegan' });
    expect(v.hidden).toBe(false);
  });
  it('pesketaryen balığı gizlemez ama tavuğu gizler', () => {
    expect(evaluateProductConstraints('Balık', { diet: 'pescatarian' }).hidden).toBe(false);
    expect(evaluateProductConstraints('Et & Tavuk', { diet: 'pescatarian' }).hidden).toBe(true);
  });
  it('pork_gelatin avoid: şarküteri için uyarı verir', () => {
    const v = evaluateProductConstraints('Şarküteri', { avoid: ['pork_gelatin'] });
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it('kategori null ise gizlemez, kısıt yoksa temiz döner', () => {
    const v = evaluateProductConstraints(null, {});
    expect(v.hidden).toBe(false);
    expect(v.warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd cheep-backend-express && npx vitest run test/product-constraints.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Implementasyon**

`src/services/product-constraints.ts`:

```ts
export interface ConstraintProfile { diet?: string; avoid?: string[]; allergies?: string[] }
export interface ConstraintVerdict { hidden: boolean; warnings: string[] }

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');
const has = (cat: string, kws: string[]) => kws.some(k => cat.includes(k));

export function evaluateProductConstraints(
  categoryName: string | null,
  profile: ConstraintProfile
): ConstraintVerdict {
  const warnings: string[] = [];
  if (!categoryName) return { hidden: false, warnings };
  const cat = norm(categoryName);

  const isMeat = has(cat, ['et', 'tavuk', 'kırmızı et', 'sarkuteri', 'şarküteri', 'sucuk', 'salam']);
  const isFish = has(cat, ['balık', 'balik', 'deniz']);
  const isAnimal = isMeat || isFish || has(cat, ['süt', 'peynir', 'yumurta', 'tereyağ']);

  const diet = profile.diet;
  let hidden = false;
  if (diet === 'vegan' && (isAnimal)) hidden = true;
  if (diet === 'vegetarian' && (isMeat || isFish)) hidden = true;
  if (diet === 'pescatarian' && isMeat && !isFish) hidden = true;

  if (profile.avoid?.includes('pork_gelatin') && has(cat, ['sarkuteri', 'şarküteri', 'sucuk', 'salam'])) {
    warnings.push('Domuz/jelatin içerebilir — etiketi kontrol et');
  }
  if (profile.allergies && profile.allergies.length > 0 && isAnimal === false && has(cat, ['fırın', 'pastane', 'bisküvi', 'çikolata'])) {
    warnings.push('Alerjen içerebilir — etiketi kontrol et');
  }
  return { hidden, warnings };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd cheep-backend-express && npx vitest run test/product-constraints.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/services/product-constraints.ts cheep-backend-express/test/product-constraints.test.ts
git commit -m "feat(profile): pure category-heuristic constraint evaluator (v1)"
```

---

### Task 4: Mobil — profil API servisi + tipler

**Files:**
- Create: `Cheep-Mobile/src/services/profile.service.ts`
- Modify: `Cheep-Mobile/src/services/index.ts` (export)

**Interfaces:**
- Consumes: backend `GET/PUT /profile` (Task 2).
- Produces:
  ```ts
  export interface UserProfile {
    household_size?: string; diet?: string;
    avoid?: string[]; allergies?: string[];
    weekly_budget?: number; onboarding_done: boolean;
  }
  profileService.getProfile(): Promise<UserProfile | null>
  profileService.updateProfile(data: Partial<UserProfile>): Promise<UserProfile>
  ```

- [ ] **Step 1: Servis**

`profile.service.ts` (mevcut `api.client.ts` deseniyle):

```ts
import apiClient from './api.client';

export interface UserProfile {
  household_size?: string;
  diet?: string;
  avoid?: string[];
  allergies?: string[];
  weekly_budget?: number;
  onboarding_done: boolean;
}

export const profileService = {
  async getProfile(): Promise<UserProfile | null> {
    const res = await apiClient.get('/profile');
    return res.data.profile ?? null;
  },
  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    const res = await apiClient.put('/profile', data);
    return res.data.profile;
  },
};
```

`services/index.ts`'e ekle: `export { profileService } from './profile.service';`

- [ ] **Step 2: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add Cheep-Mobile/src/services/profile.service.ts Cheep-Mobile/src/services/index.ts
git commit -m "feat(mobile): profile API service"
```

---

### Task 5: Mobil — AuthContext'e onboarding durumu + RootNavigator kapısı

**Files:**
- Modify: `Cheep-Mobile/src/context/AuthContext.tsx`
- Modify: `Cheep-Mobile/src/navigation/RootNavigator.tsx`
- Modify: `Cheep-Mobile/src/navigation/types.ts` (RootStackParamList'e 'Onboarding')

**Interfaces:**
- Consumes: `profileService.getProfile` (Task 4).
- Produces: `useAuth()` artık `onboardingDone: boolean` ve `refreshOnboarding(): Promise<void>` verir; RootNavigator buna göre `Onboarding` ekranını gösterir.

- [ ] **Step 1: AuthContext'e profil yükle**

`AuthContext.tsx` içinde, auth yüklenince profil de çekilsin. State ekle: `const [onboardingDone, setOnboardingDone] = useState(false);`. Login/oturum yükleme sonrası:

```tsx
  const refreshOnboarding = async () => {
    try {
      const p = await profileService.getProfile();
      setOnboardingDone(!!p?.onboarding_done);
    } catch { setOnboardingDone(false); }
  };
```

`isAuthenticated` true olduğunda `refreshOnboarding()` çağır (auth yükleme effect'inde). Context value'ya `onboardingDone` ve `refreshOnboarding` ekle.

- [ ] **Step 2: RootNavigator kapısı**

`RootNavigator.tsx`:

```tsx
  const { isAuthenticated, isLoading, onboardingDone } = useAuth();
  ...
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !onboardingDone ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Stack.Screen name="Main" component={TabNavigator} />
        )}
```

`types.ts` `RootStackParamList`'e `Onboarding: undefined;` ekle. `OnboardingNavigator` import et (Task 6'da oluşturulacak — geçici olarak boş bir ekranla derlenebilir bırak; Task 6'da doldurulur).

- [ ] **Step 3: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: hatasız (OnboardingNavigator placeholder bileşeni ile).

```bash
git add Cheep-Mobile/src/context/AuthContext.tsx Cheep-Mobile/src/navigation/RootNavigator.tsx Cheep-Mobile/src/navigation/types.ts
git commit -m "feat(mobile): onboarding gate in RootNavigator"
```

---

### Task 6: Mobil — Onboarding sihirbazı (config-driven, maskotlu)

**Files:**
- Create: `Cheep-Mobile/src/screens/onboarding/onboardingConfig.ts`
- Create: `Cheep-Mobile/src/screens/onboarding/OnboardingScreen.tsx`
- Create: `Cheep-Mobile/src/navigation/OnboardingNavigator.tsx`

**Interfaces:**
- Consumes: `profileService.updateProfile`, `useAuth().refreshOnboarding` (Task 4-5).
- Produces: bitince `updateProfile({ ...answers, onboarding_done: true })` + `refreshOnboarding()`.

- [ ] **Step 1: Soru config'i**

`onboardingConfig.ts`:

```ts
export type QuestionType = 'single' | 'multi' | 'budget';
export interface OnboardingQuestion {
  key: 'household_size' | 'diet' | 'avoid' | 'allergies' | 'weekly_budget';
  type: QuestionType;
  title: string;
  mascot: string; // kısa teşvik metni
  options?: { value: string; label: string }[];
  allowCustom?: boolean; // 'Sen yaz...'
  optional?: boolean;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { key: 'household_size', type: 'single', title: 'Kaç kişiye alışveriş yapıyorsun?', mascot: 'Başlayalım! 🐦',
    options: [{value:'1',label:'1'},{value:'2',label:'2'},{value:'3-4',label:'3-4'},{value:'5+',label:'5+'}] },
  { key: 'diet', type: 'single', title: 'Beslenme tarzın?', mascot: 'Harika gidiyorsun!',
    options: [{value:'omnivore',label:'Hepçil'},{value:'vegetarian',label:'Vejetaryen'},{value:'vegan',label:'Vegan'},{value:'pescatarian',label:'Pesketaryen'}] },
  { key: 'avoid', type: 'multi', title: 'Şunlardan kaçınıyor musun?', mascot: 'Sana göre süzeceğiz 🐦',
    options: [{value:'pork_gelatin',label:'Domuz eti & jelatin'},{value:'alcohol',label:'Alkollü ürünler'}] },
  { key: 'allergies', type: 'multi', title: 'Alerjin/intoleransın?', mascot: 'Güvenlik önce!', allowCustom: true,
    options: [{value:'lactose',label:'Laktoz'},{value:'gluten',label:'Gluten'},{value:'peanut',label:'Fıstık'},{value:'tree_nut',label:'Kabuklu yemiş'},{value:'none',label:'Yok'}] },
  { key: 'weekly_budget', type: 'budget', title: 'Haftalık bütçen?', mascot: 'Son soru! 🐦', optional: true },
];
```

- [ ] **Step 2: Sihirbaz ekranı**

`OnboardingScreen.tsx`: `ONBOARDING_QUESTIONS` üzerinde adım adım ilerleyen tek ekran. State: `step`, `answers` (Record). Üstte ilerleme çubuğu (`(step+1)/length`), maskot kuş görseli (login'deki asset) + `question.mascot`, soru başlığı, `type`'a göre seçenekler (single=radyo, multi=çoklu chip + `allowCustom` ise `TextInput`, budget=`TextInput`/slider). Altta "Şimdilik geç" (optional/skip → cevapsız ilerле) ve "Devam". RN `Animated` ile her adımda fade/slide-in. Son adımda:

```tsx
  const finish = async () => {
    await profileService.updateProfile({ ...answers, onboarding_done: true });
    await refreshOnboarding(); // RootNavigator otomatik Main'e geçer
  };
```

> Maskot görseli: login ekranındaki kuş asset yolunu (`assets/...`) `LoginScreen.tsx`'ten al ve aynısını kullan.

- [ ] **Step 3: Navigator**

`OnboardingNavigator.tsx`: tek ekranlı stack (`OnboardingScreen`). Task 5'teki placeholder import'u bununla değiştir.

- [ ] **Step 4: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add Cheep-Mobile/src/screens/onboarding Cheep-Mobile/src/navigation/OnboardingNavigator.tsx Cheep-Mobile/src/navigation/RootNavigator.tsx
git commit -m "feat(mobile): animated mascot onboarding wizard (5 questions)"
```

---

### Task 7: Mobil — ProfileScreen'de profili düzenle/sil

**Files:**
- Modify: `Cheep-Mobile/src/screens/profile/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `profileService.getProfile/updateProfile` (Task 4).

- [ ] **Step 1: Profil bölümü ekle**

`ProfileScreen.tsx`'e "Tercihlerim" bölümü ekle: yüklenince `getProfile()` ile mevcut değerleri göster (hane, beslenme, kaçındıkları, alerjiler, bütçe). Her alan düzenlenebilir (onboarding'deki aynı seçenek bileşenleri yeniden kullanılabilir veya basit satırlar). "Kaydet" → `updateProfile(changed)`. Bir alanı boşaltıp kaydetmek o kısıtı kaldırır (boş dizi / undefined).

- [ ] **Step 2: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add Cheep-Mobile/src/screens/profile/ProfileScreen.tsx
git commit -m "feat(mobile): edit profile preferences in ProfileScreen"
```

---

### Task 8: Ürün listelerinde kısıt rozeti/süzme (v1, opsiyonel sürfas)

**Files:**
- Modify: `cheep-backend-express/src/api/products/products.service.ts` (liste sorgusuna kategori adı + verdict ekle) VEYA controller seviyesinde annotate
- Modify: `Cheep-Mobile/src/components/product/ProductGridCard.tsx` (rozet)

**Interfaces:**
- Consumes: `evaluateProductConstraints` (Task 3), `getProfile` (Task 2).

- [ ] **Step 1: Backend annotate**

Ürün liste döndüren serviste (örn. kategori ürünleri), istek sahibinin profili varsa her ürüne `constraint` alanı ekle: `evaluateProductConstraints(product.category?.name ?? null, profile)`. `hidden=true` olanları süzme yerine **işaretle** (v1: gizleme opsiyonel; varsayılan göster+rozet). Yanıt tipine `constraint?: { hidden: boolean; warnings: string[] }` ekle.

- [ ] **Step 2: Mobil rozet**

`ProductGridCard`'a, `product.constraint?.warnings?.length` varsa küçük bir "⚠️ etiketi kontrol et" rozeti; diyete uymayan (`hidden`) ürünlerde soluk bir "diyetine uymuyor" etiketi göster.

- [ ] **Step 3: Tip kontrolü + commit**

Run: `cd cheep-backend-express && npx tsc --noEmit` ve `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add cheep-backend-express/src/api/products Cheep-Mobile/src/components/product/ProductGridCard.tsx
git commit -m "feat(profile): surface diet/allergen constraints on product cards (v1)"
```

---

### Task 9: Uçtan uca doğrulama (Playwright)

- [ ] **Step 1: Servisler ayakta**

Run: `netstat -ano | grep -E ':8081|:3000' | grep LISTEN` → ikisi de LISTENING.

- [ ] **Step 2: Akış**

Yeni kullanıcı kaydı → onboarding sihirbazının açıldığını, 5 soruyu yanıtlayıp bitince ana uygulamaya geçtiğini; Profil ekranında değerlerin göründüğünü; vegan profilde et kategorisinde rozetin/etiketin çıktığını ekran görüntüleriyle doğrula (`fitflow.py` deseninde yeni bir akış scripti yaz).

- [ ] **Step 3: Raporla**

Ekran görüntülerini incele; sorun varsa systematic-debugging.

---

## Self-Review Notları

- **Spec kapsamı (4.1-4.7):** UserProfile (T1), CRUD endpoint (T2), saf kısıt değerlendirici/kategori-sezgi (T3), mobil servis (T4), onboarding kapısı (T5), maskotlu sihirbaz 5 soru + "Sen yaz" + "Şimdilik geç" (T6), profil ekranı düzenle/sil (T7), app-geneli rozet/süzme v1 (T8), e2e (T9). Asistan entegrasyonu (4.5) 5a planında profili okur.
- **Güvenlik (4.6):** sert kısıt asla sessiz "güvenli" demez; emin olunamayan ürün "etiketi kontrol et" uyarısı (T3 + T8).
- **Test edilebilirlik:** çekirdek kısıt mantığı saf fonksiyon (T3) → DB'siz birim test. CRUD/onboarding tsc + e2e.
- **Tip tutarlılığı:** `ConstraintProfile/ConstraintVerdict` T3'te tanımlı, T8'de tüketilir; `UserProfile` tipi mobilde T4'te, kullanımı T5-T7'de aynı alan adları.
