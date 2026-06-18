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
