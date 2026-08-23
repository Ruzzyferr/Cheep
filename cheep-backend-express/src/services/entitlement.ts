/**
 * Abonelik hakkı (entitlement) — saf mantık.
 *
 * Burada veritabanı yok: RevenueCat olaylarını normalize eder ve bir abonelik
 * satırının hak verip vermediğine karar verir. DB tarafı billing.service.ts'te.
 *
 * Tasarım kararı: mağaza olaylarının tamamı bizim `status` alfabemize indirgenir.
 * RevenueCat'in olay tipleri değişebilir; uygulamanın geri kalanı yalnızca bu
 * yedi durumu bilir.
 */

export type SubscriptionStatus =
  | 'ACTIVE'         // yürürlükte, yenilenecek
  | 'CANCELLED'      // yenilenmeyecek ama dönem sonuna kadar hak sürüyor
  | 'BILLING_ISSUE'  // ödeme alınamadı; mağaza grace süresi tanıyor
  | 'PAUSED'         // (Play) kullanıcı duraklattı — hak yok
  | 'EXPIRED'        // dönem bitti, yenilenmedi
  | 'REFUNDED';      // iade edildi — hak DERHAL biter

/** İçinde bulunduğumuz uygulamada tek bir hak var. */
export const PREMIUM_ENTITLEMENT = 'premium';

export interface SubscriptionRecord {
  status: SubscriptionStatus;
  current_period_end: Date | null;
}

export interface NormalizedEvent {
  userId: number;
  store: 'APP_STORE' | 'PLAY_STORE';
  product_id: string;
  entitlement: string;
  status: SubscriptionStatus;
  period_type: string;
  current_period_end: Date | null;
  will_renew: boolean;
  environment: string;
  rc_app_user_id: string;
  last_event_id: string;
  last_event_at: Date;
}

/** Hakkın bittiği anlamına gelen durumlar — süre dolmamış olsa bile erişim yok. */
const REVOKED_IMMEDIATELY: SubscriptionStatus[] = ['REFUNDED', 'PAUSED', 'EXPIRED'];

/**
 * Bu abonelik satırı şu an premium hakkı veriyor mu?
 *
 * Kural: iade/duraklatma/süre dolumu derhal keser; iptal ve ödeme sorunu ise
 * ödenmiş dönemin sonuna kadar hakkı SÜRDÜRÜR (kullanıcı parasını ödedi).
 */
export function isEntitled(sub: SubscriptionRecord | null | undefined, now: Date = new Date()): boolean {
  if (!sub) return false;
  if (REVOKED_IMMEDIATELY.includes(sub.status)) return false;
  if (sub.current_period_end && sub.current_period_end.getTime() <= now.getTime()) return false;
  return true;
}

function statusOf(event: any): SubscriptionStatus | null {
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'SUBSCRIPTION_EXTENDED':
    case 'NON_RENEWING_PURCHASE':
    case 'TRANSFER':
      return 'ACTIVE';

    case 'CANCELLATION':
      // RevenueCat iadeyi de CANCELLATION olarak yollar; ayrımı cancel_reason yapar.
      if (event.cancel_reason === 'CUSTOMER_SUPPORT') return 'REFUNDED';
      if (event.cancel_reason === 'BILLING_ERROR') return 'BILLING_ISSUE';
      return 'CANCELLED';

    case 'EXPIRATION':
      if (event.expiration_reason === 'CUSTOMER_SUPPORT') return 'REFUNDED';
      return 'EXPIRED';

    case 'BILLING_ISSUE':
      return 'BILLING_ISSUE';

    case 'SUBSCRIPTION_PAUSED':
      return 'PAUSED';

    default:
      // TEST, SUBSCRIBER_ALIAS ve bilmediğimiz gelecekteki tipler: sessizce yok say.
      return null;
  }
}

/** Yenilenmeyeceği kesinleşen durumlar. */
const WILL_NOT_RENEW: SubscriptionStatus[] = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'PAUSED'];

/**
 * RevenueCat webhook olayını bizim abonelik satırımıza çevirir.
 * İşlenmeyecek olaylarda null döner (bilinmeyen tip, anonim kimlik, başka hak).
 */
export function mapWebhookEvent(event: any): NormalizedEvent | null {
  if (!event) return null;

  const status = statusOf(event);
  if (!status) return null;

  // app_user_id bizim kullanıcı id'mizin string hâli olmalı. Anonim RevenueCat
  // kimlikleri ($RCAnonymousID:...) bir hesaba bağlanamaz — yok sayılır; kullanıcı
  // giriş yaptığında logIn() ile kimlik birleşince yeni olay gelir.
  const raw = event.app_user_id;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const userId = Number(raw);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;

  // Başka bir hakka ait olaylar bizi ilgilendirmiyor.
  const ents: unknown = event.entitlement_ids;
  if (Array.isArray(ents) && ents.length && !ents.includes(PREMIUM_ENTITLEMENT)) return null;

  return {
    userId,
    store: event.store === 'PLAY_STORE' ? 'PLAY_STORE' : 'APP_STORE',
    product_id: String(event.product_id ?? ''),
    entitlement: PREMIUM_ENTITLEMENT,
    status,
    period_type: String(event.period_type ?? 'NORMAL'),
    current_period_end: event.expiration_at_ms ? new Date(Number(event.expiration_at_ms)) : null,
    will_renew: !WILL_NOT_RENEW.includes(status),
    environment: event.environment === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION',
    rc_app_user_id: raw,
    last_event_id: String(event.id ?? ''),
    last_event_at: new Date(Number(event.event_timestamp_ms ?? Date.now())),
  };
}

/**
 * RevenueCat REST `GET /v1/subscribers/{id}` yanıtını abonelik satırına çevirir.
 *
 * Bu yol webhook'un yedeğidir: bir olay kaçarsa kullanıcı giriş yaptığında
 * durum buradan tazelenir. Webhook'ta olayın TİPİ durumu söyler; burada tip
 * yok, durumu abonelik nesnesinin damgalarından çıkarıyoruz.
 */
export function mapSubscriberPayload(
  body: any,
  userId: number,
  now: Date = new Date()
): NormalizedEvent | null {
  const subscriber = body?.subscriber;
  if (!subscriber) return null;

  const ent = subscriber.entitlements?.[PREMIUM_ENTITLEMENT];
  const productId: string | undefined = ent?.product_identifier;
  // Hak hiç görülmemişse eşlenecek bir abonelik de yok.
  if (!productId) return null;

  const sub = subscriber.subscriptions?.[productId];
  const parse = (v: unknown): Date | null => (typeof v === 'string' ? new Date(v) : null);

  const expires = parse(ent.expires_date) ?? parse(sub?.expires_date);
  const refundedAt = parse(sub?.refunded_at);
  const billingIssueAt = parse(sub?.billing_issues_detected_at);
  const unsubscribedAt = parse(sub?.unsubscribe_detected_at);

  let status: SubscriptionStatus;
  if (refundedAt) status = 'REFUNDED';
  else if (expires && expires.getTime() <= now.getTime()) status = 'EXPIRED';
  else if (billingIssueAt) status = 'BILLING_ISSUE';
  else if (unsubscribedAt) status = 'CANCELLED';
  else status = 'ACTIVE';

  return {
    userId,
    store: sub?.store === 'play_store' || sub?.store === 'PLAY_STORE' ? 'PLAY_STORE' : 'APP_STORE',
    product_id: productId,
    entitlement: PREMIUM_ENTITLEMENT,
    status,
    period_type: String(sub?.period_type ?? 'normal').toUpperCase(),
    current_period_end: expires,
    will_renew: !WILL_NOT_RENEW.includes(status),
    environment: sub?.is_sandbox ? 'SANDBOX' : 'PRODUCTION',
    rc_app_user_id: String(userId),
    last_event_id: `sync:${productId}:${expires?.toISOString() ?? 'none'}`,
    last_event_at: now,
  };
}
