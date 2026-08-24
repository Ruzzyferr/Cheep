import { prisma } from '../../utils/prisma.client.js';
import { createChatSession } from '../../services/llm.client.js';
import { toolDeclarations, buildToolExecutor } from './assistant.tools.js';
import { runAgentLoop } from './agent-loop.js';
import { getProfile } from '../profile/profile.service.js';
import { checkAssistantLimit, startOfTrDay, startOfTrMonth } from '../../services/assistant-limit.js';
import { AppError, notFound } from '../../utils/app-error.js';
import type { ConstraintProfile } from '../../services/product-constraints.js';

/** Modele yollanan azami geçmiş mesaj sayısı (maliyet tavanı). */
export const HISTORY_LIMIT = 20;

// ============================================
// OWNER GUARD
// ============================================

const assertOwner = async (threadId: number, userId: number) => {
  const t = await prisma.chatThread.findFirst({ where: { id: threadId, user_id: userId } });
  if (!t) throw notFound('Sohbet bulunamadı');
  return t;
};

// ============================================
// THREAD CRUD
// ============================================

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

// ============================================
// SYSTEM PROMPT BUILDER (exported for testability)
// ============================================

const LANGUAGE_NAMES: Record<string, string> = {
  tr: 'Turkish', en: 'English', de: 'German', pl: 'Polish', sv: 'Swedish',
};

export function buildSystemPrompt(profile: any, currency: string = 'TRY', language: string = 'tr'): string {
  const langName = LANGUAGE_NAMES[language] ?? 'Turkish';
  const lines = [
    `You are Cheep, a smart shopping assistant. ALWAYS reply in ${langName} — every message, regardless of the language the user writes in. Be warm and non-judgmental; frame saving money positively.`,
    'Access the user\'s lists/products/prices via tools. Before modifying a list, ask a short clarifying question if needed (e.g. "it\'s already on your list — add another?").',
    'If the user asks for a generic/brandless product, pass brandIndependent=true to add_items_to_list; if a brand is named, pass false.',
    'Catalog search matches on the product name, so query with a specific phrase, never a bare category word: "beyaz peynir" not "peynir", "siyah zeytin" not "zeytin", "tam yagli sut" not "sut". A bare word can match something unrelated. If the user states a size or volume, include it in the query (e.g. "2 lt ayran").',
    `Today: ${new Date().toISOString().slice(0, 10)}.`,
  ];
  if (profile) {
    lines.push('User profile (adapt suggestions; NEVER violate hard constraints):');
    if (profile.diet) lines.push(`- Diet: ${profile.diet}`);
    if (profile.avoid?.length) lines.push(`- Avoids: ${profile.avoid.join(', ')}`);
    if (profile.allergies?.length) lines.push(`- Allergies: ${profile.allergies.join(', ')} (never suggest)`);
    if (profile.household_size) lines.push(`- Household: ${profile.household_size}`);
    if (profile.weekly_budget) lines.push(`- Weekly budget: ${profile.weekly_budget} ${currency}`);
  }
  return lines.join('\n');
}

// ============================================
// SEND MESSAGE (agent orchestration)
// ============================================

export const sendMessage = async (userId: number, threadId: number, content: string, currency: string = 'TRY', countryId?: number) => {
  await assertOwner(threadId, userId);

  // Kota kontrolü (LLM çağrısından ÖNCE — reddedilen istek para harcamamalı).
  // Ücretsiz katman günlük, premium aylık sayılır; ikisini de tek turda çekiyoruz.
  const now = new Date();
  const dayStart = startOfTrDay(now);
  const monthStart = startOfTrMonth(now);
  const [history, profile, todayCount, monthCount, limitUser] = await Promise.all([
    // Geçmiş SON N mesajla sınırlı: agent-loop her turda tüm geçmişi tekrar
    // yolluyor, dolayısıyla sınırsız geçmiş girdi maliyetini sohbet uzadıkça
    // doğrusal büyütür. Son 20 mesaj bağlamı korumaya fazlasıyla yetiyor.
    prisma.chatMessage.findMany({
      where: { thread_id: threadId },
      orderBy: { created_at: 'desc' },
      take: HISTORY_LIMIT,
    }),
    getProfile(userId),
    prisma.chatMessage.count({
      where: { role: 'user', thread: { user_id: userId }, created_at: { gte: dayStart } },
    }),
    prisma.chatMessage.count({
      where: { role: 'user', thread: { user_id: userId }, created_at: { gte: monthStart } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { is_premium: true, language: true } }),
  ]);
  const verdict = checkAssistantLimit(
    { today: todayCount, month: monthCount },
    limitUser?.is_premium ?? false
  );
  if (!verdict.allowed) {
    // İstemci bu kodu görüp doğru ekranı açıyor: ücretsiz kullanıcıya paywall,
    // premium kullanıcıya "yarın devam" bilgisi.
    throw new AppError('Mesaj limitin doldu.', 429, 'DAILY_LIMIT');
  }

  const session = createChatSession({
    systemInstruction: buildSystemPrompt(profile, currency, limitUser?.language ?? 'tr'),
    // desc çekildi — modele kronolojik sırayla verilmeli.
    history: [...history].reverse().map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    })),
    toolDeclarations,
  });

  // Profil araç yürütücüsüne geçiriliyor: diyet/alerjen kısıtı artık yalnızca
  // sistem isteminde bir RİCA değil, ürün seçiminde uygulanan bir KURAL.
  //
  // Prisma satırı doğrudan geçilemez: `diet` orada `string | null`, kısıt
  // arayüzünde `string | undefined`; `avoid`/`allergies` ise şemada `Json`
  // olduğu için dizi olduğu GARANTİ DEĞİL. Bozuk bir Json değeri değerlendirici
  // içinde patlamasın diye burada daraltılıyor.
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const constraints: ConstraintProfile | null = profile
    ? {
        diet: profile.diet ?? undefined,
        avoid: strList(profile.avoid),
        allergies: strList(profile.allergies),
      }
    : null;

  const lang = limitUser?.language ?? 'tr';
  const result = await runAgentLoop(
    session,
    content,
    buildToolExecutor(userId, countryId, constraints),
    8,
    lang,
  );

  // Persist user message then assistant reply
  await prisma.chatMessage.create({
    data: { thread_id: threadId, role: 'user', content },
  });
  await prisma.chatMessage.create({
    data: {
      thread_id: threadId,
      role: 'model',
      content: result.text,
      tool_calls: result.toolCalls.length ? (result.toolCalls as any) : undefined,
    },
  });

  // Update thread: bump updated_at; set title from first user message if blank
  await prisma.chatThread.update({
    where: { id: threadId },
    data: {
      updated_at: new Date(),
      ...(history.length === 0 ? { title: content.slice(0, 40) } : {}),
    },
  });

  return {
    message: result.text,
    toolCalls: result.toolCalls,
    remaining: Math.max(0, verdict.remaining - 1),
    limit: verdict.limit,
    window: verdict.window,
    isPremium: limitUser?.is_premium ?? false,
  };
};
