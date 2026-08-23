import { describe, it, expect, vi, beforeEach } from 'vitest';

const subFindUnique = vi.fn();
const subUpsert = vi.fn();
const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const getSubscriber = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    subscription: {
      findUnique: (...a: any[]) => subFindUnique(...a),
      upsert: (...a: any[]) => subUpsert(...a),
    },
    user: {
      findUnique: (...a: any[]) => userFindUnique(...a),
      update: (...a: any[]) => userUpdate(...a),
    },
  },
}));

// Sinif fabrikanin ICINDE tanimlanmali: vi.mock hoist edilir, disarida tanimlanan
// sinif fabrika calistiginda henuz baslatilmamis olur (TDZ).
vi.mock('../src/services/revenuecat.client.js', () => {
  class RevenueCatUnavailable extends Error {}
  return { getSubscriber: (...a: any[]) => getSubscriber(...a), RevenueCatUnavailable };
});

import { applyEntitlement, recordEvent, syncUser, getStatus } from '../src/api/billing/billing.service.js';
import type { NormalizedEvent } from '../src/services/entitlement.js';
import { RevenueCatUnavailable } from '../src/services/revenuecat.client.js';

const FUTURE = new Date('2026-12-01T00:00:00Z');
const PAST = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-08-23T12:00:00Z');

const event = (over: Partial<NormalizedEvent> = {}): NormalizedEvent => ({
  userId: 42,
  store: 'APP_STORE',
  product_id: 'cheep_premium_monthly',
  entitlement: 'premium',
  status: 'ACTIVE',
  period_type: 'NORMAL',
  current_period_end: FUTURE,
  will_renew: true,
  environment: 'PRODUCTION',
  rc_app_user_id: '42',
  last_event_id: 'evt_2',
  last_event_at: new Date('2026-08-23T10:00:00Z'),
  ...over,
});

beforeEach(() => {
  [subFindUnique, subUpsert, userFindUnique, userUpdate, getSubscriber].forEach(m => m.mockReset());
});

describe('applyEntitlement', () => {
  it('aktif abonelikte premium verir', async () => {
    subFindUnique.mockResolvedValueOnce({ status: 'ACTIVE', current_period_end: FUTURE });
    userFindUnique.mockResolvedValueOnce({ is_premium: false });
    expect(await applyEntitlement(42, NOW)).toBe(true);
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 42 }, data: { is_premium: true } });
  });

  it('suresi gecmis abonelikte premium kaldirir', async () => {
    subFindUnique.mockResolvedValueOnce({ status: 'ACTIVE', current_period_end: PAST });
    userFindUnique.mockResolvedValueOnce({ is_premium: true });
    expect(await applyEntitlement(42, NOW)).toBe(false);
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 42 }, data: { is_premium: false } });
  });

  it('abonelik yoksa premium olmaz', async () => {
    subFindUnique.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ is_premium: false });
    expect(await applyEntitlement(42, NOW)).toBe(false);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('durum degismediyse gereksiz yazma yapmaz', async () => {
    subFindUnique.mockResolvedValueOnce({ status: 'ACTIVE', current_period_end: FUTURE });
    userFindUnique.mockResolvedValueOnce({ is_premium: true });
    await applyEntitlement(42, NOW);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('iade edilmis abonelikte sure dolmamis olsa bile hak kalkar', async () => {
    subFindUnique.mockResolvedValueOnce({ status: 'REFUNDED', current_period_end: FUTURE });
    userFindUnique.mockResolvedValueOnce({ is_premium: true });
    expect(await applyEntitlement(42, NOW)).toBe(false);
  });
});

describe('recordEvent — idempotans', () => {
  it('bilinmeyen kullanici icin yazma yapmaz', async () => {
    userFindUnique.mockResolvedValueOnce(null);
    expect(await recordEvent(event())).toEqual({ applied: false, reason: 'kullanici yok' });
    expect(subUpsert).not.toHaveBeenCalled();
  });

  it('ayni olay ikinci kez gelirse yok sayar', async () => {
    userFindUnique.mockResolvedValueOnce({ id: 42 });
    subFindUnique.mockResolvedValueOnce({ last_event_id: 'evt_2', last_event_at: new Date('2026-08-23T10:00:00Z') });
    expect(await recordEvent(event())).toEqual({ applied: false, reason: 'yinelenen olay' });
    expect(subUpsert).not.toHaveBeenCalled();
  });

  it('daha eski bir olay gec gelirse yeni durumu ezmez', async () => {
    userFindUnique.mockResolvedValueOnce({ id: 42 });
    subFindUnique.mockResolvedValueOnce({ last_event_id: 'evt_9', last_event_at: new Date('2026-08-23T11:00:00Z') });
    expect(await recordEvent(event({ last_event_at: new Date('2026-08-23T09:00:00Z') })))
      .toEqual({ applied: false, reason: 'eski olay' });
    expect(subUpsert).not.toHaveBeenCalled();
  });

  it('yeni olayi yazar ve hakki gunceller', async () => {
    userFindUnique
      .mockResolvedValueOnce({ id: 42 })
      .mockResolvedValueOnce({ is_premium: false });
    subFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'ACTIVE', current_period_end: FUTURE });
    subUpsert.mockResolvedValueOnce({});

    expect(await recordEvent(event())).toEqual({ applied: true });
    expect(subUpsert).toHaveBeenCalledTimes(1);
    const arg = subUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ user_id: 42 });
    expect(arg.update.status).toBe('ACTIVE');
    expect(arg.create.user_id).toBe(42);
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 42 }, data: { is_premium: true } });
  });
});

describe('syncUser — RevenueCat yedegi', () => {
  it('RevenueCat erisilemezse kayitli durum korunur, hata firlatmaz', async () => {
    getSubscriber.mockRejectedValueOnce(new RevenueCatUnavailable('zaman asimi'));
    subFindUnique.mockResolvedValueOnce({
      status: 'ACTIVE', current_period_end: FUTURE, product_id: 'cheep_premium_monthly',
      store: 'APP_STORE', will_renew: true,
    });
    userFindUnique.mockResolvedValueOnce({ is_premium: true });

    const out = await syncUser(42);
    expect(out.isPremium).toBe(true);
    expect(out.status).toBe('ACTIVE');
    expect(subUpsert).not.toHaveBeenCalled();
  });

  it('RevenueCat kullaniciyi tanimiyorsa hak hesabi yine yapilir', async () => {
    getSubscriber.mockResolvedValueOnce(null);
    subFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ is_premium: false }).mockResolvedValueOnce({ is_premium: false });
    const out = await syncUser(42);
    expect(out.isPremium).toBe(false);
    expect(subUpsert).not.toHaveBeenCalled();
  });
});

describe('getStatus', () => {
  it('premium kullaniciya aylik kotayi bildirir', async () => {
    subFindUnique.mockResolvedValueOnce({
      status: 'CANCELLED', product_id: 'cheep_premium_yearly', store: 'PLAY_STORE',
      current_period_end: FUTURE, will_renew: false,
    });
    userFindUnique.mockResolvedValueOnce({ is_premium: true });
    const s = await getStatus(42);
    expect(s).toMatchObject({
      isPremium: true, status: 'CANCELLED', productId: 'cheep_premium_yearly',
      store: 'PLAY_STORE', willRenew: false, monthlyLimit: 300, dailyLimit: 50,
    });
    expect(s.currentPeriodEnd).toBe(FUTURE.toISOString());
  });

  it('ucretsiz kullaniciya gunluk 5 bildirir', async () => {
    subFindUnique.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ is_premium: false });
    expect(await getStatus(1)).toMatchObject({ isPremium: false, status: null, dailyLimit: 5 });
  });
});
