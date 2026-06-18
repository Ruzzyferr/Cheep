import { describe, it, expect } from 'vitest';
import { checkDailyLimit, startOfTrDay, FREE_DAILY_LIMIT } from '../src/services/assistant-limit';

describe('checkDailyLimit', () => {
  it('free, 0 mesaj: izinli, remaining 5', () => {
    expect(checkDailyLimit(0, false)).toEqual({ allowed: true, remaining: 5, limit: 5 });
  });
  it('free, 4 mesaj (5. mesaj): izinli, remaining 1', () => {
    expect(checkDailyLimit(4, false)).toEqual({ allowed: true, remaining: 1, limit: 5 });
  });
  it('free, 5 mesaj: bloke, remaining 0', () => {
    expect(checkDailyLimit(5, false)).toEqual({ allowed: false, remaining: 0, limit: 5 });
  });
  it('premium yüksek tavana kadar izinli', () => {
    expect(checkDailyLimit(50, true).allowed).toBe(true);
    expect(checkDailyLimit(500, true).allowed).toBe(false);
  });
  it('FREE_DAILY_LIMIT 5', () => { expect(FREE_DAILY_LIMIT).toBe(5); });
});

describe('startOfTrDay', () => {
  it('TR sabahı → aynı TR gününün 00:00 (UTC 21:00 önceki gün)', () => {
    const now = new Date('2026-06-18T10:00:00Z'); // TR 13:00
    expect(startOfTrDay(now).toISOString()).toBe('2026-06-17T21:00:00.000Z');
  });
  it('TR gece yarısından az sonra → yeni TR günü başı', () => {
    const now = new Date('2026-06-18T21:30:00Z'); // TR 2026-06-19 00:30
    expect(startOfTrDay(now).toISOString()).toBe('2026-06-18T21:00:00.000Z');
  });
  it('UTC akşamı (TR aynı gün gece) → o TR gününün başı', () => {
    const now = new Date('2026-06-18T20:00:00Z'); // TR 23:00
    expect(startOfTrDay(now).toISOString()).toBe('2026-06-17T21:00:00.000Z');
  });
});
