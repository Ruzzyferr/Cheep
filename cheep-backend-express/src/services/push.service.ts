import { prisma } from '../utils/prisma.client.js';
import logger from '../utils/logger.js';

/**
 * Expo Push gönderimi.
 *
 * Expo'nun push servisi ücretsiz ve sınırsız; Android tarafında altında FCM
 * çalışır (google-services.json ile bağlandı). Doğrudan FCM yerine Expo
 * kullanılıyor çünkü token yönetimini ve platform farklarını o üstleniyor.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo tek istekte en fazla 100 mesaj kabul ediyor. */
const BATCH_SIZE = 100;

export interface PushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

interface ExpoTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
}

const chunk = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

/**
 * Mesajları gönderir ve ARTIK GEÇERSİZ token'ları siler.
 *
 * `DeviceNotRegistered`: kullanıcı uygulamayı kaldırmış veya izni kapatmış.
 * Temizlenmezse her koşuda boşa istek atılır ve Expo bu token'ları biriktirmemizi
 * istemez.
 */
export const sendPushBatch = async (messages: PushMessage[]): Promise<{ sent: number; failed: number; pruned: number }> => {
    if (messages.length === 0) return { sent: 0, failed: 0, pruned: 0 };

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];

    for (const group of chunk(messages, BATCH_SIZE)) {
        try {
            const res = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(group),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                logger.error(`[push] Expo hata ${res.status}: ${body.slice(0, 300)}`);
                failed += group.length;
                continue;
            }

            const json = (await res.json()) as { data?: ExpoTicket[] };
            const tickets = json.data ?? [];
            tickets.forEach((ticket, i) => {
                if (ticket.status === 'ok') {
                    sent++;
                    return;
                }
                failed++;
                if (ticket.details?.error === 'DeviceNotRegistered') dead.push(group[i]!.to);
                else logger.warn(`[push] Bilet hatası: ${ticket.message ?? ticket.details?.error}`);
            });
        } catch (err) {
            logger.error('[push] Gönderim hatası:', err);
            failed += group.length;
        }
    }

    let pruned = 0;
    if (dead.length) {
        const r = await prisma.userPushToken.deleteMany({ where: { token: { in: dead } } });
        pruned = r.count;
        logger.info(`[push] ${pruned} geçersiz token silindi`);
    }

    return { sent, failed, pruned };
};

/** Kullanıcı token'ı kaydeder/tazeler. Aynı token başka hesaba geçmişse sahibi güncellenir. */
export const registerToken = async (
    userId: number,
    token: string,
    platform: string,
    locale?: string | null
) =>
    prisma.userPushToken.upsert({
        where: { token },
        create: { user_id: userId, token, platform, locale: locale ?? null },
        update: { user_id: userId, platform, locale: locale ?? null },
    });

/** Kullanıcı bildirimleri kapattığında veya çıkış yaptığında. */
export const removeToken = async (token: string) => {
    await prisma.userPushToken.deleteMany({ where: { token } });
};
