import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.client.js';
import logger from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Push gönderimi — doğrudan Firebase Cloud Messaging (HTTP v1).
 *
 * Expo'nun push servisi bilerek KULLANILMIYOR: o da sonunda FCM'e gidiyor ama
 * araya ekstra bir hesap, bir `projectId` ve Expo'ya FCM kimlik bilgisi yükleme
 * adımı sokuyordu. Firebase zaten kurulu olduğu için aracıya gerek yok.
 *
 * Kimlik doğrulama: servis hesabı anahtarıyla imzalanan JWT → OAuth2 access
 * token → FCM v1. Token ~1 saat geçerli, bellekte önbelleklenir.
 *
 * NOT: FCM v1'de toplu (batch) uç 2024'te kaldırıldı; mesajlar tek tek gönderilir.
 * Eşzamanlılık sınırlı tutuluyor ki tek bir tespit koşusu sunucuyu boğmasın.
 */

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Aynı anda kaç gönderim uçuşta olsun. */
const CONCURRENCY = 10;

export interface PushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

interface CachedToken {
    value: string;
    expiresAt: number;
}

let cached: CachedToken | null = null;

/** Servis hesabıyla OAuth2 access token alır (60 sn pay bırakarak önbellekler). */
async function getAccessToken(): Promise<string | null> {
    const sa = config.fcm.serviceAccount;
    if (!sa) return null;

    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
        {
            iss: sa.client_email,
            scope: FCM_SCOPE,
            aud: TOKEN_URL,
            iat: now,
            exp: now + 3600,
        },
        sa.private_key,
        { algorithm: 'RS256' }
    );

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    });

    if (!res.ok) {
        logger.error(`[push] OAuth token alınamadı (${res.status}): ${(await res.text()).slice(0, 200)}`);
        return null;
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    cached = {
        value: json.access_token,
        expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    };
    return cached.value;
}

/** Tek mesaj gönderir. Dönüş: 'ok' | 'dead' (token geçersiz) | 'fail'. */
async function sendOne(accessToken: string, projectId: string, m: PushMessage): Promise<'ok' | 'dead' | 'fail'> {
    try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: {
                    token: m.to,
                    notification: { title: m.title, body: m.body },
                    // FCM data alanları yalnızca string kabul eder.
                    data: Object.fromEntries(
                        Object.entries(m.data ?? {}).map(([k, v]) => [k, String(v)])
                    ),
                    android: {
                        priority: 'high' as const,
                        notification: { channel_id: 'price-drops' },
                    },
                },
            }),
        });

        if (res.ok) return 'ok';

        const body = await res.text().catch(() => '');
        // Uygulama kaldırılmış / token geçersiz → temizlenmeli.
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(body)) return 'dead';

        logger.warn(`[push] FCM ${res.status}: ${body.slice(0, 200)}`);
        return 'fail';
    } catch (err) {
        logger.error('[push] Gönderim hatası:', err);
        return 'fail';
    }
}

/**
 * Mesajları gönderir ve ARTIK GEÇERSİZ token'ları siler.
 *
 * Temizlik şart: kullanıcı uygulamayı kaldırdıysa token sonsuza dek ölü kalır ve
 * her koşuda boşa istek atılır.
 */
export const sendPushBatch = async (
    messages: PushMessage[]
): Promise<{ sent: number; failed: number; pruned: number }> => {
    if (messages.length === 0) return { sent: 0, failed: 0, pruned: 0 };

    const projectId = config.fcm.projectId;
    const accessToken = await getAccessToken();
    if (!accessToken || !projectId) {
        logger.warn(
            '[push] FCM yapılandırılmamış (FCM_SERVICE_ACCOUNT). Bildirimler uygulama içinde duruyor, push gönderilmedi.'
        );
        return { sent: 0, failed: messages.length, pruned: 0 };
    }

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];

    // Sabit boyutlu havuz: CONCURRENCY kadar iş paralel ilerler.
    let cursor = 0;
    const worker = async () => {
        while (cursor < messages.length) {
            const m = messages[cursor++]!;
            const r = await sendOne(accessToken, projectId, m);
            if (r === 'ok') sent++;
            else if (r === 'dead') dead.push(m.to);
            else failed++;
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, messages.length) }, worker));

    let pruned = 0;
    if (dead.length) {
        const r = await prisma.userPushToken.deleteMany({ where: { token: { in: dead } } });
        pruned = r.count;
        failed += dead.length;
        logger.info(`[push] ${pruned} geçersiz token silindi`);
    }

    return { sent, failed, pruned };
};

/** Cihaz token'ı kaydeder/tazeler. Aynı token başka hesaba geçmişse sahibi güncellenir. */
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
