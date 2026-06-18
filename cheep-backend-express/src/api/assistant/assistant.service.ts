import { prisma } from '../../utils/prisma.client.js';
import { createChatSession } from '../../services/gemini.client.js';
import { toolDeclarations, buildToolExecutor } from './assistant.tools.js';
import { runAgentLoop } from './agent-loop.js';
import { getProfile } from '../profile/profile.service.js';

// ============================================
// OWNER GUARD
// ============================================

const assertOwner = async (threadId: number, userId: number) => {
  const t = await prisma.chatThread.findFirst({ where: { id: threadId, user_id: userId } });
  if (!t) throw Object.assign(new Error('Sohbet bulunamadı'), { status: 404 });
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

export function buildSystemPrompt(profile: any): string {
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

// ============================================
// SEND MESSAGE (agent orchestration)
// ============================================

export const sendMessage = async (userId: number, threadId: number, content: string) => {
  await assertOwner(threadId, userId);

  const [history, profile] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { thread_id: threadId },
      orderBy: { created_at: 'asc' },
    }),
    getProfile(userId),
  ]);

  const session = createChatSession({
    systemInstruction: buildSystemPrompt(profile),
    history: history.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    })),
    toolDeclarations,
  });

  const result = await runAgentLoop(session, content, buildToolExecutor(userId), 6);

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

  return { message: result.text, toolCalls: result.toolCalls };
};
