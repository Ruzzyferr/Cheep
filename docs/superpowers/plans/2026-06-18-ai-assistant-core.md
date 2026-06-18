# AI Asistan Çekirdeği (Faz 5a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gemini tabanlı, araç-çağıran (tool-calling), sohbet geçmişi tutan bir asistan eklemek; kullanıcının listelerine/ürünlere/fiyatlara araçlarla erişerek liste oluşturup düzenlesin, profili her sohbette okuyup önerileri ona göre uyarlasın.

**Architecture:** Backend `api/assistant/` modülü Gemini `gemini-2.0-flash` ile bir agent döngüsü yürütür: kullanıcı mesajı → model → `functionCall` → mevcut servisleri çağıran executor → tekrar (max 6 tur) → final metin. Döngü çekirdeği (`runAgentLoop`) soyut bir `ChatSession` üstünden çalışır → sahte session ile DB'siz/Gemini'siz test edilir. Mobilde merkez FAB butonu Asistan sohbetini açar.

**Tech Stack:** TypeScript, Express, Prisma, `@google/generative-ai`, Vitest (backend); React Native / Expo, React Navigation, axios.

## Global Constraints

- **Bağımlılık:** Bu plan **5-0** (`ListItem.brand_independent`) ve **5-P** (`UserProfile`, `profileService`) tamamlandıktan sonra uygulanır. `add_items_to_list` aracı `brand_independent` geçer; sistem prompt `UserProfile` okur.
- Gemini API anahtarı yalnızca `process.env.GEMINI_API_KEY`'den okunur; repoya yazılmaz. `.env.example`'a `GEMINI_API_KEY=` ve `GEMINI_MODEL=gemini-2.0-flash` placeholder eklenir.
- Prisma ID'leri `Int @id @default(autoincrement())`, snake_case `@@map`. Para `Number(...)`.
- Backend feature deseni: `src/api/<feature>/` (routes `authenticate`+`validate`, controller `req.user.id`, service, schema). Mount: `src/api/index.ts`.
- Backend testleri DB/Gemini gerektirmemeli → `runAgentLoop` + tool dispatch sahte bağımlılıklarla test edilir. Vitest: `npm test`.
- Mobil: `npx tsc --noEmit` temiz. Merkez buton = `TabNavigator.tsx` içindeki `TabFAB`. Liste oluşturma `Listelerim` başlığına taşınır.
- Agent döngüsü maksimum **6 tur**. Tüm asistan rotaları auth'lu; thread'ler `user_id` ile scope'lu (başkasının thread'i 404).

---

### Task 1: Gemini istemcisi + bağımlılık + env

**Files:**
- Modify: `cheep-backend-express/package.json` (dependency)
- Create: `cheep-backend-express/src/services/gemini.client.ts`
- Modify: `cheep-backend-express/.env.example`

**Interfaces:**
- Produces:
  ```ts
  export interface ChatSessionResult { text: string; functionCalls: { name: string; args: any }[] }
  export interface ChatSession { sendMessage(parts: any): Promise<ChatSessionResult> }
  export function createChatSession(opts: {
    systemInstruction: string;
    history: { role: 'user'|'model'; parts: any[] }[];
    toolDeclarations: any[];
  }): ChatSession
  ```

- [ ] **Step 1: Paketi kur**

Run: `cd cheep-backend-express && npm install @google/generative-ai`
Expected: `package.json` dependencies'e eklenir.

- [ ] **Step 2: İstemci**

`src/services/gemini.client.ts`:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ChatSessionResult { text: string; functionCalls: { name: string; args: any }[] }
export interface ChatSession { sendMessage(parts: any): Promise<ChatSessionResult> }

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export function createChatSession(opts: {
  systemInstruction: string;
  history: { role: 'user' | 'model'; parts: any[] }[];
  toolDeclarations: any[];
}): ChatSession {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY tanımlı değil');
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: opts.systemInstruction,
    tools: opts.toolDeclarations.length ? [{ functionDeclarations: opts.toolDeclarations }] : undefined,
  });
  const chat = model.startChat({ history: opts.history });
  return {
    async sendMessage(parts: any): Promise<ChatSessionResult> {
      const result = await chat.sendMessage(parts);
      const resp = result.response;
      const calls = (resp.functionCalls?.() ?? []).map((c: any) => ({ name: c.name, args: c.args }));
      const text = calls.length ? '' : (resp.text?.() ?? '');
      return { text, functionCalls: calls };
    },
  };
}
```

- [ ] **Step 3: .env.example**

`.env.example`'a ekle:
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

- [ ] **Step 4: Tip kontrolü + commit**

Run: `cd cheep-backend-express && npx tsc --noEmit` → hatasız.

```bash
git add cheep-backend-express/package.json cheep-backend-express/package-lock.json cheep-backend-express/src/services/gemini.client.ts cheep-backend-express/.env.example
git commit -m "feat(assistant): Gemini client wrapper + env"
```

---

### Task 2: Prisma ChatThread + ChatMessage + migration

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma` (User ilişkisi + 2 model)

**Interfaces:**
- Produces: `ChatThread`, `ChatMessage` Prisma modelleri.

- [ ] **Step 1: Modeller**

`User` modeline ekle: `chat_threads ChatThread[]`. Yeni modeller:

```prisma
model ChatThread {
  id         Int           @id @default(autoincrement())
  user_id    Int
  title      String?
  created_at DateTime      @default(now())
  updated_at DateTime      @updatedAt
  user       User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  messages   ChatMessage[]
  @@index([user_id])
  @@map("chat_threads")
}

model ChatMessage {
  id         Int        @id @default(autoincrement())
  thread_id  Int
  role       String     // 'user' | 'model' | 'tool'
  content    String     @db.Text
  tool_calls Json?
  created_at DateTime   @default(now())
  thread     ChatThread @relation(fields: [thread_id], references: [id], onDelete: Cascade)
  @@index([thread_id])
  @@map("chat_messages")
}
```

- [ ] **Step 2: Migration + generate**

Run: `cd cheep-backend-express && npx prisma migrate dev --name add_chat_threads && npx prisma generate`
Expected: `chat_threads` + `chat_messages` tabloları.

- [ ] **Step 3: Commit**

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations
git commit -m "feat(assistant): ChatThread + ChatMessage models"
```

---

### Task 3: Araç tanımları + executor dispatcher

**Files:**
- Create: `cheep-backend-express/src/api/assistant/assistant.tools.ts`
- Test: `cheep-backend-express/test/assistant-tools.test.ts`

**Interfaces:**
- Consumes: `lists.service`, `products.service`, `store-prices.service`, `compare-engine.service` (mevcut), `brand_independent` (5-0).
- Produces:
  ```ts
  export const toolDeclarations: any[]  // Gemini functionDeclarations
  export function buildToolExecutor(userId: number): (name: string, args: any) => Promise<any>
  ```

- [ ] **Step 1: Failing test (dispatcher bilinmeyen aracı reddeder + bilinen aracı yönlendirir)**

`test/assistant-tools.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/api/lists/lists.service.js', () => ({
  getUserLists: vi.fn(async (uid: number) => [{ id: 1, name: 'Test', user_id: uid }]),
}));

import { buildToolExecutor, toolDeclarations } from '../src/api/assistant/assistant.tools';

describe('assistant tools', () => {
  it('toolDeclarations boş değil ve isimleri benzersiz', () => {
    const names = toolDeclarations.map((t: any) => t.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
  it('bilinmeyen araç hata döndürür (throw etmez)', async () => {
    const exec = buildToolExecutor(42);
    const res = await exec('nope', {});
    expect(res.error).toBeTruthy();
  });
  it('get_user_lists kullanıcıya scope\'lu çağrılır', async () => {
    const exec = buildToolExecutor(42);
    const res = await exec('get_user_lists', {});
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].user_id).toBe(42);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd cheep-backend-express && npx vitest run test/assistant-tools.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Implementasyon**

`src/api/assistant/assistant.tools.ts`:

```ts
import * as Lists from '../lists/lists.service.js';
import * as Products from '../products/products.service.js';
import * as StorePrices from '../store-prices/store-prices.service.js';
import { compareShoppingList } from '../../services/compare-engine.service.js';

export const toolDeclarations: any[] = [
  { name: 'search_products', description: 'Katalogda ürün arar', parameters: {
    type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } },
  { name: 'get_user_lists', description: 'Kullanıcının listeleri', parameters: { type: 'object', properties: {} } },
  { name: 'get_list_items', description: 'Listedeki ürünler', parameters: {
    type: 'object', properties: { listId: { type: 'number' } }, required: ['listId'] } },
  { name: 'create_list', description: 'Yeni liste açar', parameters: {
    type: 'object', properties: { name: { type: 'string' }, budget: { type: 'number' } }, required: ['name'] } },
  { name: 'add_items_to_list', description: 'Listeye ürün(ler) ekler', parameters: {
    type: 'object', properties: { listId: { type: 'number' }, items: { type: 'array', items: {
      type: 'object', properties: { query: { type: 'string' }, quantity: { type: 'number' },
        unit: { type: 'string' }, brandIndependent: { type: 'boolean' } }, required: ['query'] } } },
    required: ['listId', 'items'] } },
  { name: 'remove_list_item', description: 'Listeden ürün çıkarır', parameters: {
    type: 'object', properties: { listId: { type: 'number' }, itemId: { type: 'number' } }, required: ['listId', 'itemId'] } },
  { name: 'get_product_prices', description: 'Ürünün marketlere göre fiyatı', parameters: {
    type: 'object', properties: { productId: { type: 'number' } }, required: ['productId'] } },
  { name: 'get_cheapest_route', description: 'Liste için en ucuz rota', parameters: {
    type: 'object', properties: { listId: { type: 'number' } }, required: ['listId'] } },
];

export function buildToolExecutor(userId: number) {
  return async (name: string, args: any): Promise<any> => {
    try {
      switch (name) {
        case 'search_products': return await Products.searchProducts(args.query, args.limit ?? 10);
        case 'get_user_lists': return await Lists.getUserLists(userId);
        case 'get_list_items': return await Lists.getListById(args.listId, userId);
        case 'create_list': return await Lists.createList(userId, { name: args.name, budget: args.budget });
        case 'add_items_to_list': {
          const results = [];
          for (const it of args.items as any[]) {
            const matched = await Products.searchProducts(it.query, 1);
            if (!matched || matched.length === 0) { results.push({ query: it.query, matched: false }); continue; }
            const added = await Lists.addItemToList(args.listId, userId, {
              product_id: matched[0].id, quantity: it.quantity ?? 1, unit: it.unit ?? 'adet',
              brand_independent: it.brandIndependent ?? false,
            });
            results.push({ query: it.query, matched: true, product: matched[0].name, itemId: added.id });
          }
          return { added: results };
        }
        case 'remove_list_item': return await Lists.removeItemFromList(args.itemId, userId);
        case 'get_product_prices': return await StorePrices.getPricesByProduct(args.productId);
        case 'get_cheapest_route': return await compareShoppingList(args.listId, userId, {});
        default: return { error: `Bilinmeyen araç: ${name}` };
      }
    } catch (e: any) {
      return { error: e?.message ?? 'Araç çalıştırılamadı' };
    }
  };
}
```

> Not: Mevcut servis fonksiyon adlarını doğrula (`Products.searchProducts`, `StorePrices.getPricesByProduct`, `Lists.removeItemFromList`); farklıysa gerçek imzalara göre düzelt. Test mock'u `getUserLists`'i kapsar; diğerleri tsc + e2e ile doğrulanır.

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd cheep-backend-express && npx vitest run test/assistant-tools.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/api/assistant/assistant.tools.ts cheep-backend-express/test/assistant-tools.test.ts
git commit -m "feat(assistant): tool declarations + user-scoped executor"
```

---

### Task 4: `runAgentLoop` (TDD, sahte session)

**Files:**
- Create: `cheep-backend-express/src/api/assistant/agent-loop.ts`
- Test: `cheep-backend-express/test/agent-loop.test.ts`

**Interfaces:**
- Consumes: `ChatSession` (Task 1).
- Produces:
  ```ts
  export interface AgentResult { text: string; toolCalls: { name: string; args: any; result: any }[] }
  export async function runAgentLoop(
    session: ChatSession,
    firstMessage: string,
    executeTool: (name: string, args: any) => Promise<any>,
    maxTurns?: number
  ): Promise<AgentResult>
  ```

- [ ] **Step 1: Failing testler**

`test/agent-loop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runAgentLoop } from '../src/api/assistant/agent-loop';
import type { ChatSession, ChatSessionResult } from '../src/services/gemini.client';

function fakeSession(script: ChatSessionResult[]): ChatSession {
  let i = 0;
  return { async sendMessage() { return script[i++] ?? { text: 'son', functionCalls: [] }; } };
}

describe('runAgentLoop', () => {
  it('tek tur: araçsız metin döndürür', async () => {
    const s = fakeSession([{ text: 'Merhaba!', functionCalls: [] }]);
    const r = await runAgentLoop(s, 'selam', async () => ({}));
    expect(r.text).toBe('Merhaba!');
    expect(r.toolCalls).toEqual([]);
  });

  it('araç çağrısı → executor → ikinci tur final metin', async () => {
    const s = fakeSession([
      { text: '', functionCalls: [{ name: 'get_user_lists', args: {} }] },
      { text: 'Listen hazır.', functionCalls: [] },
    ]);
    const r = await runAgentLoop(s, 'listemi göster', async (name) => ({ called: name }));
    expect(r.text).toBe('Listen hazır.');
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].name).toBe('get_user_lists');
    expect(r.toolCalls[0].result).toEqual({ called: 'get_user_lists' });
  });

  it('maks tur aşımında güvenli kapanış (sonsuz functionCall)', async () => {
    const looping: ChatSessionResult = { text: '', functionCalls: [{ name: 'x', args: {} }] };
    const s: ChatSession = { async sendMessage() { return looping; } };
    const r = await runAgentLoop(s, 'döngü', async () => ({}), 3);
    expect(r.toolCalls.length).toBeLessThanOrEqual(3);
    expect(typeof r.text).toBe('string');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd cheep-backend-express && npx vitest run test/agent-loop.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Implementasyon**

`src/api/assistant/agent-loop.ts`:

```ts
import type { ChatSession } from '../../services/gemini.client.js';

export interface AgentResult { text: string; toolCalls: { name: string; args: any; result: any }[] }

export async function runAgentLoop(
  session: ChatSession,
  firstMessage: string,
  executeTool: (name: string, args: any) => Promise<any>,
  maxTurns = 6
): Promise<AgentResult> {
  const toolCalls: AgentResult['toolCalls'] = [];
  let res = await session.sendMessage(firstMessage);

  for (let turn = 0; turn < maxTurns; turn++) {
    if (!res.functionCalls.length) {
      return { text: res.text, toolCalls };
    }
    const responseParts: any[] = [];
    for (const call of res.functionCalls) {
      const result = await executeTool(call.name, call.args);
      toolCalls.push({ name: call.name, args: call.args, result });
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    res = await session.sendMessage(responseParts);
  }
  // Maks tur aşıldı — güvenli kapanış
  return { text: res.text || 'İsteğini tamamlayamadım, tekrar dener misin?', toolCalls };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd cheep-backend-express && npx vitest run test/agent-loop.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/api/assistant/agent-loop.ts cheep-backend-express/test/agent-loop.test.ts
git commit -m "feat(assistant): testable agent loop with max-turn guard"
```

---

### Task 5: assistant.service — thread CRUD + sendMessage orkestrasyonu

**Files:**
- Create: `cheep-backend-express/src/api/assistant/assistant.service.ts`

**Interfaces:**
- Consumes: `createChatSession` (T1), `toolDeclarations`/`buildToolExecutor` (T3), `runAgentLoop` (T4), `getProfile` (5-P), Prisma `chatThread`/`chatMessage`.
- Produces:
  - `createThread(userId)`, `listThreads(userId)`, `getThread(threadId, userId)`, `deleteThread(threadId, userId)`
  - `sendMessage(userId, threadId, content)` → `{ message: string; toolCalls }`

- [ ] **Step 1: Servis**

`src/api/assistant/assistant.service.ts`:

```ts
import { prisma } from '../../utils/prisma.client.js';
import { createChatSession } from '../../services/gemini.client.js';
import { toolDeclarations, buildToolExecutor } from './assistant.tools.js';
import { runAgentLoop } from './agent-loop.js';
import { getProfile } from '../profile/profile.service.js';

const assertOwner = async (threadId: number, userId: number) => {
  const t = await prisma.chatThread.findFirst({ where: { id: threadId, user_id: userId } });
  if (!t) throw Object.assign(new Error('Sohbet bulunamadı'), { status: 404 });
  return t;
};

export const createThread = (userId: number) =>
  prisma.chatThread.create({ data: { user_id: userId } });

export const listThreads = (userId: number) =>
  prisma.chatThread.findMany({ where: { user_id: userId }, orderBy: { updated_at: 'desc' } });

export const getThread = async (threadId: number, userId: number) => {
  await assertOwner(threadId, userId);
  return prisma.chatThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
};

export const deleteThread = async (threadId: number, userId: number) => {
  await assertOwner(threadId, userId);
  await prisma.chatThread.delete({ where: { id: threadId } });
  return { success: true };
};

function buildSystemPrompt(profile: any): string {
  const lines = [
    'Sen Cheep akıllı alışveriş asistanısın. Türkçe, sıcak ve yargılamadan konuş; tasarrufu olumlu çerçevele.',
    'Kullanıcının listelerine/ürünlere/fiyatlara araçlarla eriş. Liste değiştirmeden önce gerekirse kısa sorular sor (ör. "listende zaten var, bir tane daha mı?").',
    'Markasız/jenerik ürün istenirse add_items_to_list ile brandIndependent=true geç; marka belirtilirse false.',
    `Bugün: ${new Date().toISOString().slice(0, 10)}.`,
  ];
  if (profile) {
    lines.push('Kullanıcı profili (önerileri buna göre uyarla, sert kısıtları ASLA ihlal etme):');
    if (profile.diet) lines.push(`- Beslenme: ${profile.diet}`);
    if (profile.avoid?.length) lines.push(`- Kaçındıkları: ${profile.avoid.join(', ')}`);
    if (profile.allergies?.length) lines.push(`- Alerjiler: ${profile.allergies.join(', ')} (asla önerme)`);
    if (profile.household_size) lines.push(`- Hane: ${profile.household_size} kişi`);
    if (profile.weekly_budget) lines.push(`- Haftalık bütçe: ${profile.weekly_budget} TL`);
  }
  return lines.join('\n');
}

export const sendMessage = async (userId: number, threadId: number, content: string) => {
  await assertOwner(threadId, userId);
  const history = await prisma.chatMessage.findMany({
    where: { thread_id: threadId }, orderBy: { created_at: 'asc' },
  });
  const profile = await getProfile(userId);

  const session = createChatSession({
    systemInstruction: buildSystemPrompt(profile),
    history: history.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    })),
    toolDeclarations,
  });

  const result = await runAgentLoop(session, content, buildToolExecutor(userId), 6);

  await prisma.chatMessage.create({ data: { thread_id: threadId, role: 'user', content } });
  await prisma.chatMessage.create({
    data: { thread_id: threadId, role: 'model', content: result.text,
      tool_calls: result.toolCalls.length ? (result.toolCalls as any) : undefined },
  });
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { updated_at: new Date(), ...(history.length === 0 ? { title: content.slice(0, 40) } : {}) },
  });

  return { message: result.text, toolCalls: result.toolCalls };
};
```

- [ ] **Step 2: Tip kontrolü**

Run: `cd cheep-backend-express && npx tsc --noEmit`
Expected: hatasız (servis adları T3'te doğrulandıysa).

- [ ] **Step 3: Commit**

```bash
git add cheep-backend-express/src/api/assistant/assistant.service.ts
git commit -m "feat(assistant): thread CRUD + agent orchestration with profile-aware prompt"
```

---

### Task 6: assistant schema + controller + routes + mount

**Files:**
- Create: `cheep-backend-express/src/api/assistant/assistant.schema.ts`, `assistant.controller.ts`, `assistant.routes.ts`
- Modify: `cheep-backend-express/src/api/index.ts`

**Interfaces:**
- Consumes: `assistant.service` (T5).
- Produces: `GET/POST /assistant/threads`, `GET/DELETE /assistant/threads/:id`, `POST /assistant/threads/:id/messages`.

- [ ] **Step 1: Schema**

`assistant.schema.ts`:

```ts
import { z } from 'zod';
export const sendMessageSchema = z.object({
  body: z.object({ content: z.string().min(1).max(4000) }),
});
```

- [ ] **Step 2: Controller**

`assistant.controller.ts`:

```ts
import { Request, Response } from 'express';
import * as Service from './assistant.service.js';

const uid = (req: Request) => req.user!.id;

export const create = async (req: Request, res: Response) => res.json(await Service.createThread(uid(req)));
export const list = async (req: Request, res: Response) => res.json(await Service.listThreads(uid(req)));
export const get = async (req: Request, res: Response) => {
  try { res.json(await Service.getThread(parseInt(req.params.id), uid(req))); }
  catch (e: any) { res.status(e.status ?? 500).json({ error: e.message }); }
};
export const remove = async (req: Request, res: Response) => {
  try { res.json(await Service.deleteThread(parseInt(req.params.id), uid(req))); }
  catch (e: any) { res.status(e.status ?? 500).json({ error: e.message }); }
};
export const message = async (req: Request, res: Response) => {
  try { res.json(await Service.sendMessage(uid(req), parseInt(req.params.id), req.body.content)); }
  catch (e: any) { res.status(e.status ?? 502).json({ error: e.message ?? 'Asistan yanıt veremedi' }); }
};
```

- [ ] **Step 3: Routes + mount**

`assistant.routes.ts`:

```ts
import { Router } from 'express';
import * as C from './assistant.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { sendMessageSchema } from './assistant.schema.js';

const router = Router();
router.post('/threads', authenticate, C.create);
router.get('/threads', authenticate, C.list);
router.get('/threads/:id', authenticate, C.get);
router.delete('/threads/:id', authenticate, C.remove);
router.post('/threads/:id/messages', authenticate, validate(sendMessageSchema), C.message);
export default router;
```

`src/api/index.ts`: import + `router.use('/assistant', assistantRouter);`

> Opsiyonel: mevcut `rate-limit.middleware.ts`'ten bir limiter'ı `/threads/:id/messages`'a ekle (Gemini free katman koruması).

- [ ] **Step 4: Tip kontrolü + commit**

Run: `cd cheep-backend-express && npx tsc --noEmit` → hatasız.

```bash
git add cheep-backend-express/src/api/assistant cheep-backend-express/src/api/index.ts
git commit -m "feat(assistant): routes + controller + schema"
```

---

### Task 7: Mobil — asistan API servisi

**Files:**
- Create: `Cheep-Mobile/src/services/assistant.service.ts`
- Modify: `Cheep-Mobile/src/services/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ChatThread { id: number; title: string | null; updated_at: string }
  export interface ChatMessage { id: number; role: string; content: string; tool_calls?: any }
  assistantService: {
    listThreads(): Promise<ChatThread[]>;
    createThread(): Promise<ChatThread>;
    getThread(id: number): Promise<ChatThread & { messages: ChatMessage[] }>;
    deleteThread(id: number): Promise<void>;
    sendMessage(id: number, content: string): Promise<{ message: string; toolCalls: any[] }>;
  }
  ```

- [ ] **Step 1: Servis**

`assistant.service.ts`:

```ts
import apiClient from './api.client';

export interface ChatThread { id: number; title: string | null; updated_at: string }
export interface ChatMessage { id: number; role: string; content: string; tool_calls?: any }

export const assistantService = {
  async listThreads(): Promise<ChatThread[]> { return (await apiClient.get('/assistant/threads')).data; },
  async createThread(): Promise<ChatThread> { return (await apiClient.post('/assistant/threads')).data; },
  async getThread(id: number) { return (await apiClient.get(`/assistant/threads/${id}`)).data; },
  async deleteThread(id: number): Promise<void> { await apiClient.delete(`/assistant/threads/${id}`); },
  async sendMessage(id: number, content: string): Promise<{ message: string; toolCalls: any[] }> {
    return (await apiClient.post(`/assistant/threads/${id}/messages`, { content })).data;
  },
};
```

`services/index.ts`'e export ekle.

- [ ] **Step 2: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add Cheep-Mobile/src/services/assistant.service.ts Cheep-Mobile/src/services/index.ts
git commit -m "feat(mobile): assistant API service"
```

---

### Task 8: Mobil — AssistantChatScreen + bileşenler + navigator

**Files:**
- Create: `Cheep-Mobile/src/screens/assistant/AssistantChatScreen.tsx`
- Create: `Cheep-Mobile/src/components/assistant/MessageBubble.tsx`, `ChatInputBar.tsx`, `ToolActivityChip.tsx`, `ListActionCard.tsx`
- Create: `Cheep-Mobile/src/navigation/AssistantNavigator.tsx`
- Modify: `Cheep-Mobile/src/navigation/types.ts`

**Interfaces:**
- Consumes: `assistantService` (T7).

- [ ] **Step 1: Bileşenler**

- `MessageBubble` (props `{ role: string; content: string }`): rol 'user' → sağ/teal, değilse sol/beyaz; `src/theme` renkleri.
- `ChatInputBar` (props `{ value; onChangeText; onSend; sending }`): `TextInput` + gönder ikonu; `sending` iken devre dışı.
- `ToolActivityChip` (props `{ label }`): soluk küçük satır "🔧 {label}".
- `ListActionCard` (props `{ listId; title; itemCount; onPress }`): inline kart → `onPress` ile `ListDetail`'e git.

- [ ] **Step 2: Ekran**

`AssistantChatScreen.tsx`: mount'ta aktif thread yoksa `assistantService.createThread()`; mesaj listesi state. Gönderince optimistic `user` mesajı ekle + `sendMessage` çağır; yanıt gelince `model` mesajı ekle. `toolCalls` içinde liste oluşturma/ekleme varsa `ListActionCard` göster. Boş durumda karşılama balonu + öneri çipleri ("Haftalık liste hazırla", "Bütçeme göre sepet", "Tarif ver"). Başlıkta "🕘 geçmiş" (T9 sheet) ve "✎ yeni" (yeni thread).

- [ ] **Step 3: Navigator + types**

`AssistantNavigator.tsx`: stack, varsayılan `AssistantChatScreen`. `types.ts`'e `Assistant` route'unu ekle (TabParamList'e gizli ekran veya RootStack'e modal — T10'da FAB buradan açacak).

- [ ] **Step 4: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add Cheep-Mobile/src/screens/assistant Cheep-Mobile/src/components/assistant Cheep-Mobile/src/navigation/AssistantNavigator.tsx Cheep-Mobile/src/navigation/types.ts
git commit -m "feat(mobile): assistant chat screen + components"
```

---

### Task 9: Mobil — ThreadListSheet (geçmiş + silme)

**Files:**
- Create: `Cheep-Mobile/src/components/assistant/ThreadListSheet.tsx`
- Modify: `Cheep-Mobile/src/screens/assistant/AssistantChatScreen.tsx` (başlıktan aç)

**Interfaces:**
- Consumes: `assistantService.listThreads/deleteThread`.

- [ ] **Step 1: Sheet**

`ThreadListSheet` (modal): `listThreads()` ile geçmişi listeler; satıra dokununca o thread'i açar (`getThread` → ekrana yükle); satırda çöp ikonu → `deleteThread(id)` + listeyi yenile; üstte "Yeni sohbet". Başlıktaki "🕘 geçmiş" bunu açar.

- [ ] **Step 2: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add Cheep-Mobile/src/components/assistant/ThreadListSheet.tsx Cheep-Mobile/src/screens/assistant/AssistantChatScreen.tsx
git commit -m "feat(mobile): chat history sheet with delete"
```

---

### Task 10: Mobil — merkez FAB → Asistan; liste oluşturma Listelerim'e taşı

**Files:**
- Modify: `Cheep-Mobile/src/navigation/TabNavigator.tsx` (`TabFAB.handlePress`)
- Modify: `Cheep-Mobile/src/screens/lists/ListsScreen.tsx` (başlığa "+" — yeni liste)

**Interfaces:**
- Consumes: `AssistantNavigator` (T8).

- [ ] **Step 1: FAB → Asistan**

`TabNavigator.tsx` içinde `Assistant` ekranını navigasyona ekle (RootStack veya gizli tab) ve `TabFAB.handlePress`'i Asistan'ı açacak şekilde değiştir (mevcut aktif-liste/create mantığını kaldır). FAB ikonunu `add` → `auto-awesome` (✨) yap, teal glow için stilini koru.

- [ ] **Step 2: Liste oluşturmayı Listelerim'e taşı**

`ListsScreen.tsx` başlığına bir "+" butonu ekle → mevcut "yeni liste oluştur" akışını (önceden FAB'ın yaptığı `setShouldOpenCreateModalFromFAB`/create modal) buradan tetikle. `fabState` artık FAB tarafından kullanılmıyorsa sadeleştir.

- [ ] **Step 3: Tip kontrolü + commit**

Run: `cd Cheep-Mobile && npx tsc --noEmit` → hatasız.

```bash
git add Cheep-Mobile/src/navigation/TabNavigator.tsx Cheep-Mobile/src/screens/lists/ListsScreen.tsx
git commit -m "feat(mobile): center button opens Assistant; list-create moves to Lists header"
```

---

### Task 11: Uçtan uca doğrulama (Playwright + gerçek Gemini anahtarı)

- [ ] **Step 1: Anahtar + servisler**

Kullanıcı `cheep-backend-express/.env`'e `GEMINI_API_KEY` ekledi mi teyit et (yoksa kullanıcıdan iste). `netstat -ano | grep -E ':8081|:3000' | grep LISTEN` → ikisi de ayakta.

- [ ] **Step 2: Akış**

Login → merkez ✨ butonu → Asistan açılır → "mercimek çorbası için liste hazırla" yaz → asistanın araçlarla liste oluşturduğunu, `ListActionCard`'ın çıktığını; "geçmiş" sheet'inde sohbetin göründüğünü ve silinebildiğini ekran görüntüleriyle doğrula (`fitflow.py` deseninde script).

- [ ] **Step 3: Raporla**

Ekran görüntülerini incele. Gemini 429/hata olursa zarif mesajı doğrula. Sorun varsa systematic-debugging.

---

## Self-Review Notları

- **Spec kapsamı (5. Backend / 6. Mobil):** Gemini client (T1), Chat modelleri (T2), araçlar (T3), agent döngüsü max-6-tur (T4), thread CRUD + profil-okuyan sistem prompt + scope (T5), rotalar/şema (T6), mobil servis (T7), chat ekranı+bileşenler (T8), geçmiş+silme (T9), merkez FAB→Asistan + liste-create taşıma (T10), e2e (T11).
- **Bağımlılıklar:** `add_items_to_list` → `brand_independent` (5-0); sistem prompt → `getProfile` (5-P). İkisi de tamamlanmış varsayılır.
- **Test edilebilirlik:** `runAgentLoop` (T4) ve tool dispatcher (T3) sahte bağımlılıklarla DB/Gemini'siz test edilir. Servis/HTTP tsc + e2e (gerçek anahtar) ile.
- **Tip tutarlılığı:** `ChatSession`/`ChatSessionResult` T1'de, `runAgentLoop` T4'te, `toolDeclarations`/`buildToolExecutor` T3'te tanımlı; T5 hepsini aynı imzalarla tüketir.
- **Güvenlik:** sistem prompt sert kısıtları (alerji/diyet) asla ihlal etme talimatı taşır; thread'ler user-scope (404).
```
