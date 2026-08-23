/**
 * RevenueCat REST istemcisi (v1).
 *
 * Yalnızca OKUMA için: webhook kaçtığında ya da kullanıcı yeni cihazdan giriş
 * yaptığında abonelik durumunu tazelemek üzere `GET /subscribers/{id}` çağırır.
 * Yazma işlemleri mağazalara ait; buradan abonelik oluşturulmaz.
 */
import logger from '../utils/logger.js';
import { config } from '../config/index.js';

const BASE = process.env.REVENUECAT_API_URL || 'https://api.revenuecat.com/v1';

export class RevenueCatUnavailable extends Error {}

/**
 * Aboneyi getirir. Kullanıcı RevenueCat'te hiç görülmemişse `null` döner —
 * bu bir hata değil, "hiç satın alma yapmamış" demektir.
 */
export async function getSubscriber(appUserId: string, timeoutMs = 8000): Promise<any | null> {
    if (!config.revenuecat.apiKey) throw new RevenueCatUnavailable('REVENUECAT_API_KEY tanımlı değil');

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const res = await fetch(`${BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
            headers: { Authorization: `Bearer ${config.revenuecat.apiKey}` },
            signal: ac.signal,
        });
        if (res.status === 404) return null;
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            logger.error(`RevenueCat ${res.status} (subscriber ${appUserId}): ${body.slice(0, 300)}`);
            throw new RevenueCatUnavailable(`RevenueCat ${res.status}`);
        }
        return await res.json();
    } catch (e: any) {
        if (e instanceof RevenueCatUnavailable) throw e;
        throw new RevenueCatUnavailable(e?.name === 'AbortError' ? 'RevenueCat zaman aşımı' : String(e?.message ?? e));
    } finally {
        clearTimeout(timer);
    }
}
