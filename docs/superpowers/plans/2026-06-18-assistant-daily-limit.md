# Asistan Günlük Limiti + Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free kullanıcıyı günde 5 asistan mesajı ile sınırla; premium sınırsız (abuse tavanı). Toplam Gemini maliyetine sert tavan + premium ayrımı.

**Architecture:** `User.is_premium` bayrağı + bugünün `ChatMessage` (role='user') sayımı (yeni tablo yok). Saf `checkDailyLimit`/`startOfTrDay` helper'ları (DB'siz test). `assistant.service.sendMessage` Gemini'den ÖNCE kontrol eder; dolunca 429 `DAILY_LIMIT` fırlatır. Mobil kalan-hak gösterir + limitte input kilitler.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), Vitest (backend); React Native / Expo, axios.

## Global Constraints

- Validation Joi; responses `{ success, data }` envelope; mobile reads `res.data.data`. Prisma Int IDs, snake_case @@map. Project uses **pnpm** (npm install fails); prisma via `npx prisma ...`.
- Backend testleri DB gerektirmemeli → limit mantığı saf fonksiyon olarak test edilir. Vitest: `npm test`.
- Windows: `prisma generate` EPERM (dev server DLL kilidi) benign — types yazılır, tsc temiz, migration uygulanır; DONE_WITH_CONCERNS, blocker değil.
- Free limit = **5**; premium tavan = **500**. "Mesaj" = bir `role='user'` ChatMessage turu. Gün sıfırlama = **Europe/Istanbul (UTC+3, DST yok)**.
- Geriye uyumlu: `is_premium` default false; additif migration; limit-altı asistan davranışı değişmez.
- Mesajlar yalnızca başarılı agent döngüsü SONRASI persist edilir (mevcut davranış) → başarısız Gemini denemesi kotadan düşmez. Sayım Gemini çağrısından ÖNCE yapılır.

---

### Task 1: Prisma `User.is_premium` + migration

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma` (model User)
- Create: migration (Prisma üretir)

**Interfaces:**
- Produces: `User.is_premium: boolean` (default false).

- [ ] **Step 1: Alanı ekle**

`schema.prisma` `model User` içine (mevcut bir alanın yanına, ilişkilerden önce) ekle:

```prisma
  is_premium    Boolean  @default(false)
```

- [ ] **Step 2: Migration + generate**

Run: `cd cheep-backend-express && npx prisma migrate dev --name add_user_is_premium && npx prisma generate`
Expected: `users` tablosuna `ALTER TABLE "users" ADD COLUMN "is_premium" BOOLEAN NOT NULL DEFAULT false;`; Prisma Client güncellenir. (Windows EPERM olursa types yine yazılır — DONE_WITH_CONCERNS.)

- [ ] **Step 3: tsc + commit**

Run: `cd cheep-backend-express && npx tsc --noEmit` → temiz.

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations
git commit -m "feat(assistant): add User.is_premium flag"
```

---

### Task 2: Saf limit helper'ları `checkDailyLimit` + `startOfTrDay` (TDD)

**Files:**
- Create: `cheep-backend-express/src/services/assistant-limit.ts`
- Test: `cheep-backend-express/test/assistant-limit.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const FREE_DAILY_LIMIT = 5;
  export const PREMIUM_DAILY_LIMIT = 500;
  export interface LimitVerdict { allowed: boolean; remaining: number; limit: number }
  export function checkDailyLimit(todayCount: number, isPremium: boolean): LimitVerdict
  export function startOfTrDay(now: Date): Date  // Europe/Istanbul (UTC+3) gün başının UTC karşılığı
  ```

- [ ] **Step 1: Failing testler**

`test/assistant-limit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkDailyLimit, startOfTrDay, FREE_DAILY_LIMIT } from '../src/services/assistant-limit';

describe('checkDailyLimit', () => {
  it('free, 0 mesaj: izinli, remaining 5', () => {
    expect(checkDailyLimit(0, false)).toEqual({ allowed: true, remaining: 5, limit: 5 });
  });
  it('free, 4 mesaj (5. mesaj): izinli, remaining 1', () => {
    expect(checkDailyLimit(4, false)).toEqual({ allowed: true, remaining: 1, limit: 5 });
  });
  it('free, 5 mesaj: bloke, remaining 0', () => {
    expect(checkDailyLimit(5, false)).toEqual({ allowed: false, remaining: 0, limit: 5 });
  });
  it('premium yüksek tavana kadar izinli', () => {
    expect(checkDailyLimit(50, true).allowed).toBe(true);
    expect(checkDailyLimit(500, true).allowed).toBe(false);
  });
  it('FREE_DAILY_LIMIT 5', () => { expect(FREE_DAILY_LIMIT).toBe(5); });
});

describe('startOfTrDay', () => {
  it('TR sabahı → aynı TR gününün 00:00 (UTC 21:00 önceki gün)', () => {
    const now = new Date('2026-06-18T10:00:00Z'); // TR 13:00
    expect(startOfTrDay(now).toISOString()).toBe('2026-06-17T21:00:00.000Z');
  });
  it('TR gece yarısından az sonra → yeni TR günü başı', () => {
    const now = new Date('2026-06-18T21:30:00Z'); // TR 2026-06-19 00:30
    expect(startOfTrDay(now).toISOString()).toBe('2026-06-18T21:00:00.000Z');
  });
  it('UTC akşamı (TR aynı gün gece) → o TR gününün başı', () => {
    const now = new Date('2026-06-18T20:00:00Z'); // TR 23:00
    expect(startOfTrDay(now).toISOString()).toBe('2026-06-17T21:00:00.000Z');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd cheep-backend-express && npx vitest run test/assistant-limit.test.ts`
Expected: FAIL — "Cannot find module '../src/services/assistant-limit'".

- [ ] **Step 3: Implementasyon**

`src/services/assistant-limit.ts`:

```ts
export const FREE_DAILY_LIMIT = 5;
export const PREMIUM_DAILY_LIMIT = 500; // abuse tavanı (pratikte "sınırsız")

export interface LimitVerdict { allowed: boolean; remaining: number; limit: number }

export function checkDailyLimit(todayCount: number, isPremium: boolean): LimitVerdict {
  const limit = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const remaining = Math.max(0, limit - todayCount);
  return { allowed: todayCount < limit, remaining, limit };
}

const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, DST yok

export function startOfTrDay(now: Date): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - TR_OFFSET_MS);
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd cheep-backend-express && npx vitest run test/assistant-limit.test.ts`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/services/assistant-limit.ts cheep-backend-express/test/assistant-limit.test.ts
git commit -m "feat(assistant): pure daily-limit + TR-day helpers"
```

---

### Task 3: Backend enforcement (service + controller)

**Files:**
- Modify: `cheep-backend-express/src/api/assistant/assistant.service.ts` (`sendMessage`)
- Modify: `cheep-backend-express/src/api/assistant/assistant.controller.ts` (`message` handler)

**Interfaces:**
- Consumes: `checkDailyLimit`, `startOfTrDay` (Task 2), `User.is_premium` (Task 1).
- Produces: `sendMessage` artık `{ message, toolCalls, remaining }` döndürür; limit dolunca `Error & { status:429, code:'DAILY_LIMIT' }` fırlatır.

- [ ] **Step 1: Service — sayım + kontrol + remaining**

`assistant.service.ts` başına import ekle:

```ts
import { checkDailyLimit, startOfTrDay } from '../../services/assistant-limit.js';
```

`sendMessage(userId, threadId, content)` içinde, `assertOwner` SONRASI ve Gemini/`runAgentLoop` çağrısından ÖNCE ekle:

```ts
  // Günlük limit kontrolü (Gemini çağrısından ÖNCE)
  const dayStart = startOfTrDay(new Date());
  const [todayCount, user] = await Promise.all([
    prisma.chatMessage.count({
      where: { role: 'user', thread: { user_id: userId }, created_at: { gte: dayStart } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { is_premium: true } }),
  ]);
  const verdict = checkDailyLimit(todayCount, user?.is_premium ?? false);
  if (!verdict.allowed) {
    throw Object.assign(new Error('Günlük mesaj limitin doldu.'), { status: 429, code: 'DAILY_LIMIT' });
  }
```

`sendMessage`'in dönüş satırını güncelle (mevcut `return { message: result.text, toolCalls: result.toolCalls };` benzeri):

```ts
  return { message: result.text, toolCalls: result.toolCalls, remaining: Math.max(0, verdict.remaining - 1) };
```

(`verdict.remaining - 1` = bu mesaj işlendikten sonra kalan.)

> Not: Mevcut `sendMessage` profili/`history`'yi zaten `Promise.all` ile çekiyor olabilir; limit sorgusunu ayrı bir `Promise.all`'da tutmak veya mevcut `Promise.all`'a eklemek serbest — yeter ki kontrol `runAgentLoop`'tan ÖNCE olsun. Gerçek koddaki değişken adlarına uyarla.

- [ ] **Step 2: Controller — DAILY_LIMIT eşlemesi**

`assistant.controller.ts` `message` handler'ın catch bloğunda, diğer status eşlemelerinden ÖNCE `DAILY_LIMIT`'i ele al. Mevcut handler şöyle (sanitize edilmiş, final-fix sonrası):

```ts
  } catch (e: any) {
    if (e?.code === 'DAILY_LIMIT') {
      return res.status(429).json({
        success: false, code: 'DAILY_LIMIT', remaining: 0,
        message: 'Günlük 5 mesaj hakkın doldu. Sınırsız için Premium\'a geç.',
      });
    }
    if (e?.status === 404) { /* mevcut 404 dalı */ }
    // ... mevcut Gemini quota→503 ve genel→502 mantığı DEĞİŞMEZ
  }
```

Gerçek catch yapısına uyarla; **yalnızca** başa `DAILY_LIMIT` dalını ekle, kalan hata yönetimini olduğu gibi bırak. Başarılı yanıt `res.json({ success:true, data })` zaten `data`'da `remaining`'i taşıyacak (servis döndürdüğü için).

- [ ] **Step 3: tsc + suite**

Run: `cd cheep-backend-express && npx tsc --noEmit && npm test`
Expected: tsc temiz; tüm suite yeşil (Task 2 dahil).

- [ ] **Step 4: Commit**

```bash
git add cheep-backend-express/src/api/assistant
git commit -m "feat(assistant): enforce daily message limit before Gemini call"
```

---

### Task 4: Mobil — kalan göstergesi + limit kilidi

**Files:**
- Modify: `Cheep-Mobile/src/services/assistant.service.ts` (sendMessage dönüş tipi + 429 DAILY_LIMIT)
- Modify: `Cheep-Mobile/src/screens/assistant/AssistantChatScreen.tsx` (remaining state + banner + input kilit)

**Interfaces:**
- Consumes: backend `{ message, toolCalls, remaining }` ve 429 `{ code:'DAILY_LIMIT', message }`.

- [ ] **Step 1: assistant.service — remaining + limit hatası**

`assistant.service.ts` (mobil) `SendMessageResponse` tipine `remaining?: number` ekle. `sendMessage`'ı, axios 429 yanıtını yakalayıp özel bir hata fırlatacak şekilde güncelle (mevcut axios pattern'iyle):

```ts
async sendMessage(id: number, content: string): Promise<SendMessageResponse> {
  try {
    const res = await apiClient.post<ApiResponse<SendMessageResponse>>(`/assistant/threads/${id}/messages`, { content });
    return res.data.data!;
  } catch (e: any) {
    if (e?.response?.status === 429 && e?.response?.data?.code === 'DAILY_LIMIT') {
      throw Object.assign(new Error(e.response.data.message), { dailyLimit: true });
    }
    throw e;
  }
}
```

- [ ] **Step 2: AssistantChatScreen — gösterge + kilit**

`AssistantChatScreen.tsx`:
- `const [remaining, setRemaining] = useState<number | null>(null);` ve `const [limitReached, setLimitReached] = useState(false);`
- `handleSend` başarılı yanıtta: `if (typeof res.remaining === 'number') setRemaining(res.remaining);` ve `if (res.remaining === 0) setLimitReached(true);`
- `handleSend` catch'inde: `if (err?.dailyLimit) { setLimitReached(true); /* hata balonu yerine banner */ }` (mevcut hata-balonu mantığını koru; ama dailyLimit ise bunun yerine banner göster).
- **Başlık göstergesi:** başlıkta (mevcut headerRight/headerTitle alanında) `remaining !== null && !premium` ise küçük bir "`{remaining}/5`" metni göster. (Premium bilgisi yoksa sadece `remaining`'i göster; `remaining` zaten free için anlamlı.)
- **Limit banner'ı:** `limitReached` true iken input bar'ın üstünde bir satır: "Günlük 5 mesajlık limitin doldu. Sınırsız için Premium'a geç." ve `ChatInputBar`'a `disabled`/`sending` benzeri bir prop ya da koşullu render ile gönderiyi kapat (input devre dışı). "Premium'a geç" şimdilik bilgilendirme (onPress no-op / "yakında" alert).

`ChatInputBar`'ın gönderiyi kapatması için mevcut `sending` mekanizmasını kullan ya da yeni bir `disabled` prop ekle; limitReached iken gönder butonu pasif olsun.

- [ ] **Step 3: tsc + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → temiz.

```bash
git add Cheep-Mobile/src/services/assistant.service.ts Cheep-Mobile/src/screens/assistant/AssistantChatScreen.tsx
git commit -m "feat(mobile): assistant daily-limit indicator + lock"
```

---

### Task 5: Doğrulama (API + e2e)

- [ ] **Step 1: Servisler ayakta**

Run: `netstat -ano | grep -E ':8081|:3000' | grep LISTEN` → ikisi de LISTENING (değilse başlat).

- [ ] **Step 2: API ile limit doğrula**

Bir test kullanıcısı (`is_premium=false`) ile login → token al. Bir thread oluştur. `POST /assistant/threads/:id/messages` **6 kez** çağır.
- İlk 5 çağrı: Gemini kotası 503 dönebilir AMA mesaj persist edilmediği için sayım artmaz — bu durumda limit testi için DB'ye doğrudan 5 `user` mesajı eklemek VEYA Gemini kotası varken denemek gerekir. Pragmatik doğrulama: kullanıcının bugünkü `ChatMessage(role=user)` sayısını DB'de 5'e getir (veya 5 başarılı mesaj), sonra 6. çağrının **429 `DAILY_LIMIT`** + "Günlük 5 mesaj hakkın doldu" döndüğünü doğrula.
- Beklenen: `{"success":false,"code":"DAILY_LIMIT",...}` HTTP 429.

> Not: Gemini kotası (free-tier 429) başarılı mesaj üretmeyi engelliyorsa, limit sayımını DB'ye elle 5 `user` ChatMessage ekleyerek (geçerli bir thread'e) test et; ardından API'den 6. mesajın bloklandığını gör.

- [ ] **Step 3: Mobil e2e (Playwright)**

Login → ✨ FAB → Asistan. Başlıkta kalan göstergesinin ("5/5" vb.) göründüğünü; limit dolunca input'un kilitlendiğini ve banner'ın çıktığını ekran görüntüsüyle doğrula (`asstflow.py` benzeri). Auth rate-limiter'a takılırsan backend'i nodemon ile yeniden başlatıp (bir src dosyasının mtime'ını güncelle) limiter'ı sıfırla.

- [ ] **Step 4: Raporla**

Ekran görüntüleri + API yanıtlarıyla limitin uygulandığını teyit et. Sorun varsa systematic-debugging.

---

## Self-Review Notları

- **Spec kapsamı:** `is_premium` (T1), saf `checkDailyLimit`+`startOfTrDay` (T2), sayım+enforcement+remaining (T3), mobil gösterge+kilit (T4), doğrulama (T5). Ödeme entegrasyonu kapsam dışı (spec ile uyumlu). Token-optimizasyonu yok (spec ile uyumlu).
- **Test edilebilirlik:** limit/gün mantığı saf fonksiyon → DB'siz birim test (8 test). Sayım DB-bağlı → API/e2e.
- **Tip tutarlılığı:** `checkDailyLimit`/`startOfTrDay`/`LimitVerdict` T2'de tanımlı, T3'te tüketilir; `remaining` T3 servis→T4 mobil aynı isim. `DAILY_LIMIT` kodu T3 controller→T4 mobil aynı.
- **Güvenlik/doğruluk:** kontrol Gemini'den ÖNCE; başarısız (kota) deneme persist edilmediği için kotadan düşmez (spec Bölüm 5).
