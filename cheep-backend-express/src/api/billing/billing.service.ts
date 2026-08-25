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
    const [sub] = await Promise.all([
        prisma.subscription.findUnique({ where: { user_id: userId } }),
    ]);
    // ONBELLEKLENMIS `user.is_premium` OKUNMAZ — abonelik satirindan ZAMANA
    // DUYARLI turetilir. O sutun yalnizca webhook ya da /billing/sync
    // calistiginda yeniden hesaplaniyor; donem sessizce dolduysa (EXPIRATION
    // webhook'u kaybolursa) sonsuza dek `true` kaliyor ve istemciye "hala
    // premiumsun" deniyordu. `isEntitled` donem sonunu zaten kontrol ediyor.
    const premium = isEntitled(
        sub ? { status: sub.status as never, current_period_end: sub.current_period_end } : null
    );
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
            // `last_event_id` / `last_event_at` BILEREK YAZILMIYOR.
            //
            // Bu iki alan WEBHOOK OLAY AKISINA ait ve `recordEvent`in sira-disi
            // olay korumasi onlara bakiyor ("mevcut damga daha yeniyse olayi
            // atla"). `mapSubscriberPayload` sync icin `last_event_at = now`
            // uretiyordu; yani her sync damgayi SIMDIYE cekiyordu ve hemen
            // ardindan gelen mesru bir webhook "eski olay" diye REDDEDILIYORDU.
            // Somut: kullanici 14:00:00'da uygulamayi aciyor -> sync damgayi
            // 14:00:00 yapiyor. RevenueCat 13:59:30'da uretilmis CANCELLATION'i
            // 14:00:10'da teslim ediyor -> dusuruluyor. Iptal hic kaydedilmiyor,
            // paywall yanlis durum gosteriyor.
            //
            // Sync bir MUTABAKAT, bir olay degil: durumu yaziyor, olay akisina
            // dokunmuyor.
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
            };
            await prisma.subscription.upsert({
                where: { user_id: userId },
                create: { user_id: userId, ...data },
                update: data,
            });
        } else if (body) {
            // RevenueCat CEVAP VERDİ ama `premium` hakkını hiç bildirmedi.
            //
            // Bu, tam olarak iade/süre-dolumu sonrası görülen yanıt. Eskiden
            // burada HİÇBİR ŞEY yazılmıyordu ve hemen ardından gelen
            // `applyEntitlement` dokunulmamış, hâlâ ACTIVE ve dönem sonu
            // gelecekte olan satırdan yeniden türetiyordu. Sonuç: webhook
            // kaçarsa (deploy sırasında yeniden başlatma, ağ) iade edilmiş
            // kullanıcı 30 gün daha premium kalıyordu — üstelik `syncUser`
            // TAM OLARAK bu kaçış için yazılmış yedek yol. Yani yedek yol,
            // varlık sebebi olan durumda çalışmıyordu.
            //
            // "Hak verir" tarafta susmak güvenli, "hak keser" tarafta susmak
            // değil: RevenueCat'in sessizliği burada gerçek bir cevaptır.
            // Yalnızca kayıtlı satır hâlâ hak veriyorsa yazıyoruz.
            const existing = await prisma.subscription.findUnique({ where: { user_id: userId } });
            if (existing && isEntitled({ status: existing.status as never, current_period_end: existing.current_period_end })) {
                logger.warn(
                    `RevenueCat kullanici ${userId} icin premium hakki bildirmedi; ` +
                    `kayitli durum ${existing.status} -> EXPIRED olarak duzeltiliyor.`
                );
                await prisma.subscription.update({
                    where: { user_id: userId },
                    data: { status: 'EXPIRED', will_renew: false, current_period_end: new Date() },
                });
            }
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
