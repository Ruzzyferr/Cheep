import type { ChatSession } from '../../services/llm.client.js';

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
