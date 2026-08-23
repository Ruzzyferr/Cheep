import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createChatSession } from '../src/services/llm.client';

const DECLS = [
  { name: 'get_user_lists', description: 'listeleri getirir', parameters: { type: 'object', properties: {} } },
  {
    name: 'create_list',
    description: 'liste açar',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
];

/** Sıradaki gateway yanıtlarını kuyruğa alır, gönderilen gövdeleri kaydeder. */
function stubGateway(responses: any[]) {
  const sent: any[] = [];
  let i = 0;
  const fetchMock = vi.fn(async (_url: any, init: any) => {
    sent.push(JSON.parse(init.body));
    const r = responses[i++];
    if (r.__status) return { ok: false, status: r.__status, text: async () => r.__body ?? '' } as any;
    return { ok: true, status: 200, json: async () => r } as any;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent, fetchMock };
}

const assistantText = (t: string) => ({ choices: [{ message: { role: 'assistant', content: t } }] });
const assistantToolCall = (id: string, name: string, args: any) => ({
  choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }],
});

beforeEach(() => { process.env.AI_GATEWAY_API_KEY = 'vck_test'; process.env.AI_MODEL = 'google/gemini-3.6-flash'; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('llm.client — AI Gateway istemcisi', () => {
  it('anahtar yoksa açık hata verir', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    expect(() => createChatSession({ systemInstruction: 's', history: [], toolDeclarations: [] })).toThrow(/AI_GATEWAY_API_KEY/);
  });

  it('sistem promptu + geçmişi OpenAI biçimine çevirir, model ve araçları yollar', async () => {
    const { sent } = stubGateway([assistantText('Merhaba!')]);
    const s = createChatSession({
      systemInstruction: 'Sen Cheep\'sin',
      history: [
        { role: 'user', parts: [{ text: 'selam' }] },
        { role: 'model', parts: [{ text: 'merhaba' }] },
      ],
      toolDeclarations: DECLS,
    });
    const r = await s.sendMessage('süt ekle');

    expect(r).toEqual({ text: 'Merhaba!', functionCalls: [] });
    const body = sent[0];
    expect(body.model).toBe('google/gemini-3.6-flash');
    expect(body.messages).toEqual([
      { role: 'system', content: 'Sen Cheep\'sin' },
      { role: 'user', content: 'selam' },
      { role: 'assistant', content: 'merhaba' },
      { role: 'user', content: 'süt ekle' },
    ]);
    expect(body.tools[0]).toEqual({
      type: 'function',
      function: { name: 'get_user_lists', description: 'listeleri getirir', parameters: { type: 'object', properties: {} } },
    });
  });

  it('tool_calls\'ı functionCalls olarak döndürür ve argümanları parse eder', async () => {
    stubGateway([assistantToolCall('call_1', 'create_list', { name: 'Haftalık' })]);
    const s = createChatSession({ systemInstruction: 's', history: [], toolDeclarations: DECLS });
    const r = await s.sendMessage('haftalık liste aç');
    expect(r.text).toBe('');
    expect(r.functionCalls).toEqual([{ name: 'create_list', args: { name: 'Haftalık' } }]);
  });

  it('functionResponse parçalarını doğru tool_call_id ile role:tool mesajına çevirir', async () => {
    const { sent } = stubGateway([
      assistantToolCall('call_abc', 'get_user_lists', {}),
      assistantText('Tek listen var: Market.'),
    ]);
    const s = createChatSession({ systemInstruction: 's', history: [], toolDeclarations: DECLS });
    await s.sendMessage('listelerim ne?');
    const r = await s.sendMessage([{ functionResponse: { name: 'get_user_lists', response: { result: [{ id: 1, name: 'Market' }] } } }]);

    expect(r.text).toBe('Tek listen var: Market.');
    const msgs = sent[1].messages;
    const toolMsg = msgs[msgs.length - 1];
    expect(toolMsg.role).toBe('tool');
    expect(toolMsg.tool_call_id).toBe('call_abc');
    expect(JSON.parse(toolMsg.content)).toEqual([{ id: 1, name: 'Market' }]);
    // araç çağrısını yapan asistan mesajı geçmişte aynen korunmalı
    expect(msgs[msgs.length - 2].tool_calls[0].id).toBe('call_abc');
  });

  it('cevapsız kalan tool_call için de bir tool mesajı üretir (API 400 vermesin)', async () => {
    const { sent } = stubGateway([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'get_user_lists', arguments: '{}' } },
        { id: 'c2', type: 'function', function: { name: 'create_list', arguments: '{"name":"X"}' } },
      ] } }] },
      assistantText('tamam'),
    ]);
    const s = createChatSession({ systemInstruction: 's', history: [], toolDeclarations: DECLS });
    await s.sendMessage('iki şey yap');
    await s.sendMessage([{ functionResponse: { name: 'get_user_lists', response: { result: [] } } }]);
    const toolMsgs = sent[1].messages.filter((m: any) => m.role === 'tool');
    expect(toolMsgs.map((m: any) => m.tool_call_id).sort()).toEqual(['c1', 'c2']);
  });

  it('bütçe aşımında (402) anlaşılır hata fırlatır', async () => {
    stubGateway([{ __status: 402, __body: '{"error":{"message":"Quota limit exceeded"}}' }]);
    const s = createChatSession({ systemInstruction: 's', history: [], toolDeclarations: [] });
    await expect(s.sendMessage('selam')).rejects.toThrow(/bütçe|402/i);
  });

  it('bozuk argüman JSON\'unda çökmez, boş args ile devam eder', async () => {
    stubGateway([{ choices: [{ message: { role: 'assistant', content: null, tool_calls: [
      { id: 'c9', type: 'function', function: { name: 'get_user_lists', arguments: 'bozuk-json' } },
    ] } }] }]);
    const s = createChatSession({ systemInstruction: 's', history: [], toolDeclarations: DECLS });
    const r = await s.sendMessage('x');
    expect(r.functionCalls).toEqual([{ name: 'get_user_lists', args: {} }]);
  });
});
