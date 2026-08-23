import { describe, it, expect } from 'vitest';
import {
  checkAssistantLimit, startOfTrDay, startOfTrMonth,
  FREE_DAILY_LIMIT, PREMIUM_MONTHLY_LIMIT, PREMIUM_DAILY_GUARD,
} from '../src/services/assistant-limit';

describe('sabitler', () => {
  it('ücretsiz günlük 5, premium aylık 300, günlük emniyet 50', () => {
    expect(FREE_DAILY_LIMIT).toBe(5);
    expect(PREMIUM_MONTHLY_LIMIT).toBe(300);
    expect(PREMIUM_DAILY_GUARD).toBe(50);
  });
});

describe('checkAssistantLimit — ücretsiz', () => {
  it('0 mesaj: izinli, günlük pencere, 5 kaldı', () => {
    expect(checkAssistantLimit({ today: 0, month: 0 }, false))
      .toEqual({ allowed: true, remaining: 5, limit: 5, window: 'day' });
  });
  it('4 mesaj: son hak', () => {
    expect(checkAssistantLimit({ today: 4, month: 4 }, false))
      .toEqual({ allowed: true, remaining: 1, limit: 5, window: 'day' });
  });
  it('5 mesaj: bloke', () => {
    expect(checkAssistantLimit({ today: 5, month: 5 }, false))
      .toEqual({ allowed: false, remaining: 0, limit: 5, window: 'day' });
  });
  it('aylık sayaç ücretsiz kullanıcıyı etkilemez', () => {
    expect(checkAssistantLimit({ today: 0, month: 9999 }, false).allowed).toBe(true);
  });
});

describe('checkAssistantLimit — premium', () => {
  it('normalde aylık pencereyi raporlar', () => {
    expect(checkAssistantLimit({ today: 3, month: 42 }, true))
      .toEqual({ allowed: true, remaining: 258, limit: 300, window: 'month' });
  });
  it('aylık kota dolduğunda bloke, aylık pencere', () => {
    expect(checkAssistantLimit({ today: 1, month: 300 }, true))
      .toEqual({ allowed: false, remaining: 0, limit: 300, window: 'month' });
  });
  it('günlük emniyet supabı dolduğunda bloke ve günlük pencereye geçer', () => {
    expect(checkAssistantLimit({ today: 50, month: 60 }, true))
      .toEqual({ allowed: false, remaining: 0, limit: 50, window: 'day' });
  });
  it('günlük emniyet aylık kotadan önce gelir', () => {
    // ikisi de dolu: kullanıcıya "bugünlük doldu" demek daha doğru
    expect(checkAssistantLimit({ today: 50, month: 300 }, true).window).toBe('day');
  });
  it('49. mesaj hâlâ izinli', () => {
    expect(checkAssistantLimit({ today: 49, month: 100 }, true).allowed).toBe(true);
  });
});

describe('startOfTrDay', () => {
  it('TR sabahı → aynı TR gününün 00:00 (UTC 21:00 önceki gün)', () => {
    expect(startOfTrDay(new Date('2026-06-18T10:00:00Z')).toISOString()).toBe('2026-06-17T21:00:00.000Z');
  });
  it('TR gece yarısından az sonra → yeni TR günü başı', () => {
    expect(startOfTrDay(new Date('2026-06-18T21:30:00Z')).toISOString()).toBe('2026-06-18T21:00:00.000Z');
  });
  it('UTC akşamı (TR aynı gün gece) → o TR gününün başı', () => {
    expect(startOfTrDay(new Date('2026-06-18T20:00:00Z')).toISOString()).toBe('2026-06-17T21:00:00.000Z');
  });
});

describe('startOfTrMonth', () => {
  it('ay ortası → TR ayının 1. günü 00:00', () => {
    expect(startOfTrMonth(new Date('2026-06-18T10:00:00Z')).toISOString()).toBe('2026-05-31T21:00:00.000Z');
  });
  it('TR ayının ilk saatleri → aynı ayın başı', () => {
    // UTC 2026-05-31T21:30 = TR 2026-06-01 00:30
    expect(startOfTrMonth(new Date('2026-05-31T21:30:00Z')).toISOString()).toBe('2026-05-31T21:00:00.000Z');
  });
  it('TR ayının son saatleri → hâlâ o ayın başı', () => {
    // UTC 2026-06-30T20:00 = TR 2026-06-30 23:00
    expect(startOfTrMonth(new Date('2026-06-30T20:00:00Z')).toISOString()).toBe('2026-05-31T21:00:00.000Z');
  });
  it('yıl dönümü: TR 1 Ocak', () => {
    expect(startOfTrMonth(new Date('2027-01-05T12:00:00Z')).toISOString()).toBe('2026-12-31T21:00:00.000Z');
  });
});
