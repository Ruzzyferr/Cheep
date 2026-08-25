/**
 * 🤖 LLM istemcisi — Vercel AI Gateway (OpenAI Chat Completions uyumlu)
 *
 * Asistan eskiden doğrudan Google Generative AI SDK'sını kullanıyordu; Google
 * `gemini-2.0-flash` modelini kaldırınca her istek 404 dönmeye başladı. Artık
 * tek bir gateway anahtarı üzerinden model seçiyoruz (AI_MODEL) — model değişimi
 * kod değişikliği gerektirmiyor, harcama da anahtar bazlı bütçeyle sınırlı.
 *
 * Dışa açık arayüz (ChatSession) bilinçli olarak Gemini SDK'sındakiyle aynı
 * bırakıldı: agent-loop Gemini biçimli `functionResponse` parçaları gönderir,
 * çeviriyi burada yapıyoruz.
 */

import { AppError } from '../utils/app-error.js';
import logger from '../utils/logger.js';

export interface ChatSessionResult { text: string; functionCalls: { name: string; args: any }[] }
export interface ChatSession { sendMessage(parts: any): Promise<ChatSessionResult> }

const GATEWAY_URL = process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1/chat/completions';
/** Tek gateway turu için üst sınır (ms). Bkz. fetch çağrısındaki gerekçe. */
const GATEWAY_TIMEOUT_MS = Number(process.env.AI_GATEWAY_TIMEOUT_MS) || 60_000;

type OaiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

/** Gemini function declaration → OpenAI tool tanımı */
function toOpenAiTools(declarations: any[]) {
  return declarations.map(d => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters ?? { type: 'object', properties: {} },
    },
  }));
}

function stringify(value: any): string {
  try { return JSON.stringify(value ?? null); } catch { return '"[serileştirilemedi]"'; }
}

function parseArgs(raw: any): any {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export function createChatSession(opts: {
  systemInstruction: string;
  history: { role: 'user' | 'model'; parts: any[] }[];
  toolDeclarations: any[];
}): ChatSession {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error('AI_GATEWAY_API_KEY tanımlı değil');
  const model = process.env.AI_MODEL || 'inclusionai/ling-3.0-flash';

  const messages: OaiMessage[] = [{ role: 'system', content: opts.systemInstruction }];
  for (const turn of opts.history) {
    const text = (turn.parts ?? []).map((p: any) => p?.text ?? '').join('').trim();
    if (!text) continue;
    messages.push({ role: turn.role === 'user' ? 'user' : 'assistant', content: text });
  }

  const tools = opts.toolDeclarations.length ? toOpenAiTools(opts.toolDeclarations) : undefined;
  // Son asistan turunda gelen, henüz sonucu yollanmamış araç çağrıları
  let pending: { id: string; name: string }[] = [];

  return {
    async sendMessage(parts: any): Promise<ChatSessionResult> {
      if (typeof parts === 'string') {
        messages.push({ role: 'user', content: parts });
      } else if (Array.isArray(parts)) {
        for (const part of parts) {
          const fr = part?.functionResponse;
          if (!fr) continue;
          const idx = pending.findIndex(c => c.name === fr.name);
          if (idx === -1) continue;
          const [call] = pending.splice(idx, 1);
          messages.push({ role: 'tool', tool_call_id: call.id, content: stringify(fr.response?.result) });
        }
        // OpenAI protokolü her tool_call için bir tool mesajı bekler; eksik kalanı doldur.
        for (const call of pending) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: '{"error":"sonuç üretilemedi"}' });
        }
        pending = [];
      } else {
        throw new Error('sendMessage: desteklenmeyen parametre tipi');
      }

      // ZAMAN AŞIMI ŞART. Bu çağrı zaman aşımsızdı: gateway bağlantıyı kabul
      // edip yanıt vermezse Express isteği SÜRESİZ asılı kalıyordu. Tek bir
      // asistan mesajı bu çağrıyı araç döngüsünde 9 kez yapabiliyor ve kaç
      // tane böyle isteğin birikeceğinin bir sınırı yok — takılan bir
      // sağlayıcı, hızlı 503'ler yerine 1 vCPU'luk sunucuda sınırsız asılı
      // istek yığını üretirdi. (Kardeş `revenuecat.client.ts` bunu 8 sn'lik
      // AbortController ile zaten doğru yapıyor.)
      //
      // 60 sn tek TUR için: modelin kendisi ölçülen en kötü hâlde ~34 sn
      // sürebiliyor, dolayısıyla eşik gerçek yavaşlığı kesmemeli.
      const res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, ...(tools ? { tools, tool_choice: 'auto' } : {}) }),
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      }).catch((e: unknown) => {
        const name = (e as { name?: string })?.name;
        if (name === 'TimeoutError' || name === 'AbortError') {
          logger.error(`AI Gateway zaman asimi (${GATEWAY_TIMEOUT_MS}ms, model=${model})`);
          throw new AppError('Asistan yanıt vermedi, tekrar dene.', 503, 'AI_TIMEOUT');
        }
        logger.error(`AI Gateway aglatma hatasi (model=${model}): ${String(e)}`);
        throw new AppError('Asistan servisine ulaşılamadı.', 503, 'AI_UPSTREAM');
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        if (res.status === 402) {
          throw new AppError('Asistan bütçesi doldu (402). Lütfen daha sonra tekrar dene.', 503, 'AI_BUDGET');
        }
        if (res.status === 429) {
          throw new AppError('Asistan şu an çok yoğun, birazdan tekrar dene.', 429, 'AI_RATE_LIMIT');
        }
        logger.error(`AI Gateway ${res.status} (model=${model}): ${body.slice(0, 500)}`);
        throw new AppError(`Asistan servisine ulaşılamadı (${res.status}).`, 503, 'AI_UPSTREAM');
      }

      const data: any = await res.json();
      const message = data?.choices?.[0]?.message;
      if (!message) throw new AppError('Asistan boş yanıt döndü.', 503, 'AI_EMPTY');

      // Araç çağrısı kimlikleri sonraki turda eşleşmeli — mesajı geldiği gibi sakla.
      messages.push(message);

      const calls = (message.tool_calls ?? [])
        .filter((c: any) => c?.function?.name)
        .map((c: any) => ({ id: c.id, name: c.function.name, args: parseArgs(c.function.arguments) }));
      pending = calls.map((c: any) => ({ id: c.id, name: c.name }));

      return {
        text: calls.length ? '' : (message.content ?? ''),
        functionCalls: calls.map(({ name, args }: any) => ({ name, args })),
      };
    },
  };
}
