import { describe, it, expect } from 'vitest';
import { mapWebhookEvent, isEntitled, type SubscriptionRecord } from '../src/services/entitlement';

const base = (over: Partial<any> = {}) => ({
  id: 'evt_1',
  type: 'INITIAL_PURCHASE',
  event_timestamp_ms: 1_787_000_000_000,
  app_user_id: '42',
  product_id: 'cheep_premium_monthly',
  period_type: 'NORMAL',
  store: 'APP_STORE',
  environment: 'PRODUCTION',
  entitlement_ids: ['premium'],
  expiration_at_ms: 1_789_000_000_000,
  ...over,
});

const rec = (over: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  status: 'ACTIVE',
  current_period_end: new Date('2026-09-01T00:00:00Z'),
  ...over,
} as SubscriptionRecord);

describe('mapWebhookEvent — kullanıcı kimliği', () => {
  it('app_user_id sayısal ise userId olarak çözer', () => {
    expect(mapWebhookEvent(base())?.userId).toBe(42);
  });
  it('sayısal olmayan app_user_id reddedilir (anonim RevenueCat kimliği)', () => {
    expect(mapWebhookEvent(base({ app_user_id: '$RCAnonymousID:abc123' }))).toBeNull();
  });
  it('app_user_id yoksa reddedilir', () => {
    expect(mapWebhookEvent(base({ app_user_id: undefined }))).toBeNull();
  });
});

describe('mapWebhookEvent — durum eşlemesi', () => {
  const status = (over: any) => mapWebhookEvent(base(over))!.status;

  it('satın alma / yenileme / iptal-geri-alma → ACTIVE', () => {
    for (const t of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED'])
      expect(status({ type: t })).toBe('ACTIVE');
  });
  it('kullanıcı iptali → CANCELLED (dönem sonuna kadar hak sürer)', () => {
    expect(status({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' })).toBe('CANCELLED');
  });
  it('ödeme hatası kaynaklı iptal → BILLING_ISSUE', () => {
    expect(status({ type: 'CANCELLATION', cancel_reason: 'BILLING_ERROR' })).toBe('BILLING_ISSUE');
  });
  it('iade → REFUNDED', () => {
    expect(status({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })).toBe('REFUNDED');
    expect(status({ type: 'EXPIRATION', expiration_reason: 'CUSTOMER_SUPPORT' })).toBe('REFUNDED');
  });
  it('süre dolumu → EXPIRED', () => {
    expect(status({ type: 'EXPIRATION', expiration_reason: 'UNSUBSCRIBE' })).toBe('EXPIRED');
  });
  it('ödeme sorunu → BILLING_ISSUE, duraklatma → PAUSED', () => {
    expect(status({ type: 'BILLING_ISSUE' })).toBe('BILLING_ISSUE');
    expect(status({ type: 'SUBSCRIPTION_PAUSED' })).toBe('PAUSED');
  });
  it('bilinmeyen olay tipi yok sayılır', () => {
    expect(mapWebhookEvent(base({ type: 'TEST' }))).toBeNull();
  });
});

describe('mapWebhookEvent — alanlar', () => {
  it('zamanları Date\'e, will_renew ve mağazayı doğru çevirir', () => {
    const m = mapWebhookEvent(base({ store: 'PLAY_STORE', environment: 'SANDBOX' }))!;
    expect(m.store).toBe('PLAY_STORE');
    expect(m.environment).toBe('SANDBOX');
    expect(m.current_period_end?.toISOString()).toBe(new Date(1_789_000_000_000).toISOString());
    expect(m.last_event_at.toISOString()).toBe(new Date(1_787_000_000_000).toISOString());
    expect(m.last_event_id).toBe('evt_1');
    expect(m.will_renew).toBe(true);
  });
  it('iptal/süre dolumu sonrası will_renew false', () => {
    expect(mapWebhookEvent(base({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' }))!.will_renew).toBe(false);
    expect(mapWebhookEvent(base({ type: 'EXPIRATION', expiration_reason: 'UNSUBSCRIBE' }))!.will_renew).toBe(false);
  });
  it('expiration_at_ms yoksa current_period_end null (süresiz)', () => {
    expect(mapWebhookEvent(base({ expiration_at_ms: null }))!.current_period_end).toBeNull();
  });
  it('premium hakkı içermeyen olay yok sayılır', () => {
    expect(mapWebhookEvent(base({ entitlement_ids: ['some_other'] }))).toBeNull();
  });
});

describe('isEntitled', () => {
  const now = new Date('2026-08-23T12:00:00Z');

  it('aktif ve süresi dolmamış → hak var', () => {
    expect(isEntitled(rec({ status: 'ACTIVE' }), now)).toBe(true);
  });
  it('iptal edilmiş ama dönem sonu gelmemiş → hak SÜRER', () => {
    expect(isEntitled(rec({ status: 'CANCELLED' }), now)).toBe(true);
  });
  it('ödeme sorunu ama grace süresi bitmemiş → hak sürer', () => {
    expect(isEntitled(rec({ status: 'BILLING_ISSUE' }), now)).toBe(true);
  });
  it('dönem sonu geçmiş → hak yok (durumdan bağımsız)', () => {
    expect(isEntitled(rec({ status: 'ACTIVE', current_period_end: new Date('2026-08-01T00:00:00Z') }), now)).toBe(false);
  });
  it('iade → süre dolmamış olsa bile hak DERHAL biter', () => {
    expect(isEntitled(rec({ status: 'REFUNDED' }), now)).toBe(false);
  });
  it('duraklatılmış ve süresi dolmuş → hak yok', () => {
    expect(isEntitled(rec({ status: 'PAUSED' }), now)).toBe(false);
    expect(isEntitled(rec({ status: 'EXPIRED' }), now)).toBe(false);
  });
  it('current_period_end null (süresiz) ve aktif → hak var', () => {
    expect(isEntitled(rec({ status: 'ACTIVE', current_period_end: null }), now)).toBe(true);
  });
  it('abonelik yoksa hak yok', () => {
    expect(isEntitled(null, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

import { mapSubscriberPayload } from '../src/services/entitlement';

const NOW = new Date('2026-08-23T12:00:00Z');
const subscriberBody = (subOver: any = {}, entOver: any = {}) => ({
  subscriber: {
    entitlements: {
      premium: { product_identifier: 'cheep_premium_monthly', expires_date: '2026-09-20T00:00:00Z', ...entOver },
    },
    subscriptions: {
      cheep_premium_monthly: { store: 'app_store', expires_date: '2026-09-20T00:00:00Z', period_type: 'normal', ...subOver },
    },
  },
});

describe('mapSubscriberPayload — webhook yedeği', () => {
  it('temiz aktif abonelik', () => {
    const m = mapSubscriberPayload(subscriberBody(), 42, NOW)!;
    expect(m.userId).toBe(42);
    expect(m.status).toBe('ACTIVE');
    expect(m.store).toBe('APP_STORE');
    expect(m.product_id).toBe('cheep_premium_monthly');
    expect(m.will_renew).toBe(true);
    expect(m.current_period_end?.toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });
  it('hak hiç yoksa null', () => {
    expect(mapSubscriberPayload({ subscriber: { entitlements: {}, subscriptions: {} } }, 42, NOW)).toBeNull();
    expect(mapSubscriberPayload({}, 42, NOW)).toBeNull();
  });
  it('iade damgası → REFUNDED', () => {
    expect(mapSubscriberPayload(subscriberBody({ refunded_at: '2026-08-20T00:00:00Z' }), 42, NOW)!.status).toBe('REFUNDED');
  });
  it('süresi geçmiş → EXPIRED (iade damgasından sonraki öncelik)', () => {
    const b = subscriberBody({ expires_date: '2026-08-01T00:00:00Z' }, { expires_date: '2026-08-01T00:00:00Z' });
    expect(mapSubscriberPayload(b, 42, NOW)!.status).toBe('EXPIRED');
  });
  it('ödeme sorunu damgası → BILLING_ISSUE', () => {
    expect(mapSubscriberPayload(subscriberBody({ billing_issues_detected_at: '2026-08-22T00:00:00Z' }), 42, NOW)!.status).toBe('BILLING_ISSUE');
  });
  it('iptal damgası → CANCELLED, will_renew false', () => {
    const m = mapSubscriberPayload(subscriberBody({ unsubscribe_detected_at: '2026-08-22T00:00:00Z' }), 42, NOW)!;
    expect(m.status).toBe('CANCELLED');
    expect(m.will_renew).toBe(false);
  });
  it('play store ve sandbox tanınır', () => {
    const m = mapSubscriberPayload(subscriberBody({ store: 'play_store', is_sandbox: true }), 7, NOW)!;
    expect(m.store).toBe('PLAY_STORE');
    expect(m.environment).toBe('SANDBOX');
  });
});
