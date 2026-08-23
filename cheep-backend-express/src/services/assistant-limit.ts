/**
 * Asistan kullanım kotası.
 *
 * Ücretsiz katman GÜNLÜK sınırlıdır: uygulamayı denemek için yeterli, kötüye
 * kullanıma kapalı.
 *
 * Premium katman AYLIK sınırlıdır — bilinçli bir tercih: karşıladığımız LLM
 * maliyeti aylık tahakkuk ediyor, gelir de aylık geliyor. Günlük bir tavan
 * aylık maliyeti sınırlamaz (30 × günlük tavan kadar açık bırakır). Yanına
 * yalnızca tek günde patlamayı kesen bir emniyet supabı koyuyoruz.
 *
 * 300 mesaj/ay ≈ mesaj başına ~$0.005 ile ~$1.50/ay tavan maliyet; aboneliğin
 * net kazancının belirgin şekilde altında.
 */

export const FREE_DAILY_LIMIT = 5;
export const PREMIUM_MONTHLY_LIMIT = 300;
export const PREMIUM_DAILY_GUARD = 50;

export type LimitWindow = 'day' | 'month';

export interface LimitVerdict {
  allowed: boolean;
  /** Bağlayıcı pencerede kalan hak. */
  remaining: number;
  /** Bağlayıcı pencerenin tavanı. */
  limit: number;
  /** Kullanıcıya hangi pencereyi anlatmalıyız. */
  window: LimitWindow;
}

export interface UsageCounts {
  /** TR gününün başından bu yana atılan kullanıcı mesajı sayısı. */
  today: number;
  /** TR ayının başından bu yana atılan kullanıcı mesajı sayısı. */
  month: number;
}

/**
 * Kullanıcının bir sonraki asistan mesajını atıp atamayacağına karar verir.
 *
 * Premium'da normal durumda AYLIK pencere raporlanır (kullanıcının satın aldığı
 * söz budur); yalnızca günlük emniyet supabı devreye girdiğinde günlük pencereye
 * düşülür, çünkü o an doğru mesaj "bugünlük doldu, yarın devam" olur.
 */
export function checkAssistantLimit(counts: UsageCounts, isPremium: boolean): LimitVerdict {
  if (!isPremium) {
    const remaining = Math.max(0, FREE_DAILY_LIMIT - counts.today);
    return { allowed: counts.today < FREE_DAILY_LIMIT, remaining, limit: FREE_DAILY_LIMIT, window: 'day' };
  }

  // Günlük emniyet supabı önce: aylık kota dolu olsa bile kullanıcıya
  // "bugünlük doldu" demek "ayın bitti"den daha doğru bir yönlendirme.
  if (counts.today >= PREMIUM_DAILY_GUARD) {
    return { allowed: false, remaining: 0, limit: PREMIUM_DAILY_GUARD, window: 'day' };
  }
  if (counts.month >= PREMIUM_MONTHLY_LIMIT) {
    return { allowed: false, remaining: 0, limit: PREMIUM_MONTHLY_LIMIT, window: 'month' };
  }
  return {
    allowed: true,
    remaining: Math.max(0, PREMIUM_MONTHLY_LIMIT - counts.month),
    limit: PREMIUM_MONTHLY_LIMIT,
    window: 'month',
  };
}

const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, DST yok

/** İçinde bulunulan TR gününün 00:00'ı (UTC olarak). */
export function startOfTrDay(now: Date): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - TR_OFFSET_MS);
}

/** İçinde bulunulan TR ayının 1. gününün 00:00'ı (UTC olarak). */
export function startOfTrMonth(now: Date): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  tr.setUTCDate(1);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - TR_OFFSET_MS);
}
