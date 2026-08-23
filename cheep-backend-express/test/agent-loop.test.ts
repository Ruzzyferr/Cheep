import { describe, it, expect } from 'vitest';
import { runAgentLoop } from '../src/api/assistant/agent-loop';
import type { ChatSession, ChatSessionResult } from '../src/services/llm.client';

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
