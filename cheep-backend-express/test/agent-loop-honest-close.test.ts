import { describe, it, expect } from 'vitest';
import { runAgentLoop } from '../src/api/assistant/agent-loop';
import type { ChatSession, ChatSessionResult } from '../src/services/llm.client';

/**
 * Tur sınırı dolduğunda kullanıcıya NE söylendiğini kilitler.
 *
 * Canlıda görülen hata: kullanıcı "haftalık vejetaryen liste oluştur" dedi,
 * ajan listeyi oluşturup ürünleri ekledi, turlar bitti ve cevap
 * "İsteğini tamamlayamadım, tekrar dener misin?" oldu. Yapılan iş gizlendi.
 */
describe('runAgentLoop — tur sınırı dolduğunda dürüst kapanış', () => {
  /** Hep araç çağıran, hiç metin üretmeyen model. */
  const looping: ChatSessionResult = { text: '', functionCalls: [{ name: 'create_list', args: {} }] };

  function sessionThatNeverStops(closingText = ''): ChatSession {
    let sawPlainMessage = false;
    return {
      async sendMessage(msg: unknown) {
        // Kapanış turu düz metinle gelir (functionResponse dizisi değil).
        if (typeof msg === 'string' && sawPlainMessage) return { text: closingText, functionCalls: [] };
        if (typeof msg === 'string') sawPlainMessage = true;
        return looping;
      },
    };
  }

  it('araçsız kapanış turu metin üretirse O metin kullanılır', async () => {
    const s = sessionThatNeverStops('Listeni oluşturdum ve 6 ürün ekledim.');
    const r = await runAgentLoop(s, 'liste yap', async () => ({}), 3);
    expect(r.text).toBe('Listeni oluşturdum ve 6 ürün ekledim.');
  });

  it('kapanış turu da boşsa yapılan İŞİ anlatır — "yapamadım" DEMEZ', async () => {
    const s = sessionThatNeverStops('');
    const r = await runAgentLoop(
      s,
      'liste yap',
      async (name) =>
        name === 'add_items_to_list'
          ? { added: [{ matched: true }, { matched: true }, { matched: false }] }
          : { id: 1 },
      3,
    );
    expect(r.text).not.toMatch(/tamamlayamadım/i);
    expect(r.text).toContain('listeni oluşturdum');
  });

  it('hiç yazma işlemi yapılmadıysa dürüstçe tamamlayamadığını söyler', async () => {
    const readOnly: ChatSessionResult = { text: '', functionCalls: [{ name: 'get_user_lists', args: {} }] };
    let plain = false;
    const s: ChatSession = {
      async sendMessage(msg: unknown) {
        if (typeof msg === 'string' && plain) return { text: '', functionCalls: [] };
        if (typeof msg === 'string') plain = true;
        return readOnly;
      },
    };
    const r = await runAgentLoop(s, 'ne var', async () => [], 3);
    expect(r.text).toMatch(/tamamlayamadım/i);
  });

  it('Lehçe kullanıcıya Türkçe yedek metin GÖSTERMEZ', async () => {
    const s = sessionThatNeverStops('');
    const r = await runAgentLoop(s, 'zrób listę', async () => ({ id: 1 }), 3, 'pl');
    expect(r.text).toContain('utworzyłem twoją listę');
    expect(r.text).not.toMatch(/listeni/i);
  });

  it('bilinmeyen dil İngilizceye düşer', async () => {
    const s = sessionThatNeverStops('');
    const r = await runAgentLoop(s, 'make a list', async () => ({ id: 1 }), 3, 'sv');
    expect(r.text).toContain('I created your list');
  });

  it('varsayılan tur sınırı 6 değil 8 — çok kalemli liste kurulumu yarıda kalmasın', async () => {
    let calls = 0;
    const s: ChatSession = {
      async sendMessage() {
        calls++;
        return looping;
      },
    };
    await runAgentLoop(s, 'x', async () => ({}));
    // 1 ilk mesaj + 8 tur + 1 kapanış turu
    expect(calls).toBe(10);
  });
});
