/**
 * Abonelik durumunun yazıldığı yer.
 *
 * Doğruluk kaynağı `subscriptions` tablosudur; `user.is_premium` ondan TÜRETİLİR
 * ve yalnızca `applyEntitlement` tarafından yazılır. Böylece kotayı okuyan mevcut
 * kod (assistant.service) değişmeden çalışmaya devam eder ve premium kontrolü
 * tek bir yerde kalır.
 */
import { prisma } from '../../utils/prisma.client.js';
import logger from '../../utils/logger.js';
import { isEntitled, mapSubscriberPayload, type NormalizedEvent } from '../../services/entitlement.js';
import { getSubscriber, RevenueCatUnavailable } from '../../services/revenuecat.client.js';
import { FREE_DAILY_LIMIT, PREMIUM_MONTHLY_LIMIT, PREMIUM_DAILY_GUARD } from '../../services/assistant-limit.js';

export interface BillingStatus {
    isPremium: boolean;
    status: string | null;
    productId: string | null;
    store: string | null;
    currentPeriodEnd: string | null;
    willRenew: boolean;
    monthlyLimit: number;
    dailyLimit: number;
}

/**
 * `subscriptions` satırından `user.is_premium` alanını yeniden hesaplar.
 * Abonelikle ilgili HER yazma işleminden sonra çağrılır.
 */
export async function applyEntitlement(userId: number, now = new Date()): Promise<boolean> {
    const sub = await prisma.subscription.findUnique({ where: { user_id: userId } });
    const entitled = isEntitled(
        sub ? { status: sub.status as any, current_period_end: sub.current_period_end } : null,
        now
    );

    // Gereksiz yazma yapma: webhook sık gelir, çoğu durumu değiştirmez.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { is_premium: true } });
    if (user && user.is_premium !== entitled) {
        await prisma.user.update({ where: { id: userId }, data: { is_premium: entitled } });
        logger.info(`Premium hakkı ${entitled ? 'verildi' : 'kaldirildi'}: kullanici ${userId} (${sub?.status ?? 'abonelik yok'})`);
    }
    return entitled;
}

/** Normalize edilmiş bir olayı kalıcılaştırır (idempotan). */
export async function recordEvent(ev: NormalizedEvent): Promise<{ applied: boolean; reason?: string }> {
    const user = await prisma.user.findUnique({ where: { id: ev.userId }, select: { id: true } });
    if (!user) return { applied: false, reason: 'kullanici yok' };

    // RevenueCat teslimi de sırayı da garanti etmez: aynı olay tekrar gelirse ya da
    // eski bir olay geç gelirse mevcut satır korunur.
    const existing = await prisma.subscription.findUnique({ where: { user_id: ev.userId } });
    if (existing) {
        if (existing.last_event_id && existing.last_event_id === ev.last_event_id) {
            return { applied: false, reason: 'yinelenen olay' };
        }
        if (existing.last_event_at && existing.last_event_at.getTime() > ev.last_event_at.getTime()) {
            return { applied: false, reason: 'eski olay' };
        }
    }

    const data = {
        store: ev.store,
        product_id: ev.product_id,
        entitlement: ev.entitlement,
        status: ev.status,
        period_type: ev.period_type,
        current_period_end: ev.current_period_end,
        will_renew: ev.will_renew,
        environment: ev.environment,
        rc_app_user_id: ev.rc_app_user_id,
        last_event_id: ev.last_event_id,
        last_event_at: ev.last_event_at,
    };
    await prisma.subscription.upsert({
        where: { user_id: ev.userId },
        create: { user_id: ev.userId, ...data },
        update: data,
    });

    await applyEntitlement(ev.userId);
    return { applied: true };
}

/** Kullanıcının kayıtlı durumu — istemcinin paywall/rozet göstermesi için. */
export async function getStatus(userId: number): Promise<BillingStatus> {
    const [sub, user] = await Promise.all([
        prisma.subscription.findUnique({ where: { user_id: userId } }),
        prisma.user.findUnique({ where: { id: userId }, select: { is_premium: true } }),
    ]);
    const premium = user?.is_premium ?? false;
    return {
        isPremium: premium,
        status: sub?.status ?? null,
        productId: sub?.product_id ?? null,
        store: sub?.store ?? null,
        currentPeriodEnd: sub?.current_period_end?.toISOString() ?? null,
        willRenew: sub?.will_renew ?? false,
        monthlyLimit: premium ? PREMIUM_MONTHLY_LIMIT : FREE_DAILY_LIMIT * 30,
        dailyLimit: premium ? PREMIUM_DAILY_GUARD : FREE_DAILY_LIMIT,
    };
}

/**
 * Durumu RevenueCat'ten tazeler (webhook yedeği).
 *
 * RevenueCat'e ulaşılamazsa HATA FIRLATMAZ: kayıtlı durum döner. Dış servis
 * çöktü diye ödemiş bir kullanıcının hakkını kesmek kabul edilemez.
 */
export async function syncUser(userId: number): Promise<BillingStatus> {
    try {
        const body = await getSubscriber(String(userId));
        const mapped = body ? mapSubscriberPayload(body, userId) : null;
        if (mapped) {
            // Sync webhook ile yarışabilir; idempotans kontrolünü atlıyoruz —
            // RevenueCat o an için daha güncel gerçeği taşır.
            const data = {
                store: mapped.store,
                product_id: mapped.product_id,
                entitlement: mapped.entitlement,
                status: mapped.status,
                period_type: mapped.period_type,
                current_period_end: mapped.current_period_end,
                will_renew: mapped.will_renew,
                environment: mapped.environment,
                rc_app_user_id: mapped.rc_app_user_id,
                last_event_id: mapped.last_event_id,
                last_event_at: mapped.last_event_at,
            };
            await prisma.subscription.upsert({
                where: { user_id: userId },
                create: { user_id: userId, ...data },
                update: data,
            });
        }
        await applyEntitlement(userId);
    } catch (e) {
        if (e instanceof RevenueCatUnavailable) {
            logger.warn(`Abonelik senkronu atlandi (kullanici ${userId}): ${e.message}`);
        } else {
            throw e;
        }
    }
    return getStatus(userId);
}
