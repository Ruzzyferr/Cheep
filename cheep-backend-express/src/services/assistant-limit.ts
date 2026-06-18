export const FREE_DAILY_LIMIT = 5;
export const PREMIUM_DAILY_LIMIT = 500; // abuse tavanı (pratikte "sınırsız")

export interface LimitVerdict { allowed: boolean; remaining: number; limit: number }

export function checkDailyLimit(todayCount: number, isPremium: boolean): LimitVerdict {
  const limit = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const remaining = Math.max(0, limit - todayCount);
  return { allowed: todayCount < limit, remaining, limit };
}

const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, DST yok

export function startOfTrDay(now: Date): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - TR_OFFSET_MS);
}
