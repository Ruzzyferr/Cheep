import type { ChatSession } from '../../services/llm.client.js';

export interface AgentResult { text: string; toolCalls: { name: string; args: any; result: any }[] }

/**
 * Ajan döngüsü: model araç çağırdıkça çağır, metin döndürünce dur.
 *
 * `maxTurns` bir emniyet freni — modelin sonsuz araç döngüsüne girmesini
 * engeller. Ama fren devreye girdiğinde ne SÖYLENECEĞİ ayrı bir mesele:
 *
 * Eskiden tur biterken sabit bir "İsteğini tamamlayamadım, tekrar dener misin?"
 * dönülüyordu. Canlıda bu YANLIŞ BİLGİ üretti: kullanıcı "iki kişilik haftalık
 * vejetaryen liste oluştur" dedi; ajan listeyi GERÇEKTEN oluşturup ürünleri
 * ekledi, sonra turlar bitti ve kullanıcı "yapamadım" cevabı aldı. Kullanıcı
 * ya işi tekrar isteyip listeyi ikinci kez oluşturur ya da yapılmış işten
 * habersiz kalır — ikisi de kötü.
 *
 * Bu yüzden fren devreye girdiğinde modele SON BİR ŞANS veriliyor: araçlar
 * kapalı, "artık araç çağırma, ne yaptığını özetle" talimatıyla. Böylece cevap
 * gerçekten yapılan işi anlatır. O çağrı da boş dönerse, en azından iş
 * yapıldığını söyleyen dürüst bir yedek metin kullanılır.
 */
export async function runAgentLoop(
  session: ChatSession,
  firstMessage: string,
  executeTool: (name: string, args: any) => Promise<any>,
  maxTurns = 8,
  lang = 'tr'
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

  // Tur sınırı doldu. Model hâlâ araç çağırmak istiyor ama duruyoruz.
  if (res.text) return { text: res.text, toolCalls };

  // Araçsız kapanış turu: yapılanı özetlet.
  try {
    const closing = await session.sendMessage(
      'Araç çağırmayı BIRAK. Şu ana kadar yaptığın işlemleri kullanıcıya kendi ' +
      'dilinde, kısa ve net özetle: ne yapıldı, ne yapılamadı, sırada ne var. ' +
      'Yeni bir işlem başlatma.'
    );
    if (closing.text) return { text: closing.text, toolCalls };
  } catch {
    // Kapanış turu da düşerse aşağıdaki dürüst yedeğe geçilir.
  }

  return { text: summarizeUnfinished(toolCalls, lang), toolCalls };
}

/**
 * Son çare metinleri. Uygulama TR ve PL'de yayında; bilinmeyen dil İngilizceye
 * düşer. Sunucuda sabit Türkçe bırakmak, Lehçe kullanan birine Türkçe hata
 * göstermek demekti.
 */
const FALLBACK_COPY: Record<string, { unclear: string; partial: (what: string) => string; list: string; items: (n: number) => string }> = {
  tr: {
    unclear: 'Bu isteği tamamlayamadım. Biraz daha net anlatır mısın?',
    partial: (what) => `İşlemi yarıda bırakmak zorunda kaldım ama ${what}. Listeni açıp kontrol edebilir, eksik kalanları bana tekrar söyleyebilirsin.`,
    list: 'listeni oluşturdum',
    items: (n) => `${n} ürün ekledim`,
  },
  pl: {
    unclear: 'Nie udało mi się wykonać tej prośby. Możesz opisać ją dokładniej?',
    partial: (what) => `Musiałem przerwać w połowie, ale ${what}. Otwórz listę i sprawdź — brakujące rzeczy podaj mi jeszcze raz.`,
    list: 'utworzyłem twoją listę',
    items: (n) => `dodałem ${n} produktów`,
  },
  en: {
    unclear: "I couldn't complete that request. Could you describe it more precisely?",
    partial: (what) => `I had to stop partway through, but ${what}. Open your list to check — tell me again what's missing.`,
    list: 'I created your list',
    items: (n) => `I added ${n} items`,
  },
};

/**
 * Model hiç metin üretemediğinde kullanılan son çare.
 *
 * "Yapamadım" DEMEZ — çünkü genellikle bir şeyler yapılmıştır ve bunu gizlemek
 * kullanıcıyı aynı işi tekrar yaptırmaya iter. Yapılan yazma işlemlerini sayar.
 */
function summarizeUnfinished(toolCalls: AgentResult['toolCalls'], lang: string): string {
  const copy = FALLBACK_COPY[lang] ?? FALLBACK_COPY.en;
  const WRITES = new Set(['create_list', 'add_items_to_list', 'remove_list_item']);
  if (!toolCalls.some((c) => WRITES.has(c.name))) {
    return copy.unclear;
  }
  const added = toolCalls
    .filter((c) => c.name === 'add_items_to_list')
    .reduce((n, c) => n + (Array.isArray(c.result?.added) ? c.result.added.filter((a: any) => a?.matched).length : 0), 0);

  const parts: string[] = [];
  if (toolCalls.some((c) => c.name === 'create_list')) parts.push(copy.list);
  if (added > 0) parts.push(copy.items(added));
  return copy.partial(parts.join(' + '));
}
