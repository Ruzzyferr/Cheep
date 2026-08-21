import http2 from 'node:http2';
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
    /** 'ios' → APNs, diğerleri → FCM. Belirtilmezse FCM varsayılır. */
    platform?: string | null;
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
// ─────────────────────────────────────────────────────────────────────────────
// APNs (iOS)
//
// Neden ayrı yol: mobil uygulama iOS'ta expo-notifications'ın
// getDevicePushTokenAsync() çağrısıyla ham APNs cihaz token'ı alıyor. FCM v1
// ise yalnızca kendi kayıt token'larını kabul eder; APNs token'ı gönderilirse
// istek reddedilir. Bu yüzden iOS token'ları doğrudan Apple'a gider.
//
// APNs sağlayıcı API'si YALNIZCA HTTP/2 konuşur — fetch/undici ile
// çağrılamaz, node:http2 kullanılır.
// ─────────────────────────────────────────────────────────────────────────────

let apnsCached: CachedToken | null = null;

/** APNs sağlayıcı JWT'si. Apple 60 dakikadan eski token'ı reddeder; 50 dk önbelleklenir. */
function getApnsToken(): string | null {
    const { key, keyId, teamId } = config.apns;
    if (!key || !keyId || !teamId) return null;
    if (apnsCached && Date.now() < apnsCached.expiresAt) return apnsCached.value;
    try {
        const value = jwt.sign({ iss: teamId, iat: Math.floor(Date.now() / 1000) }, key, {
            algorithm: 'ES256',
            header: { alg: 'ES256', kid: keyId },
        });
        apnsCached = { value, expiresAt: Date.now() + 50 * 60 * 1000 };
        return value;
    } catch (err) {
        logger.error('[push] APNs JWT üretilemedi:', err);
        return null;
    }
}

/**
 * iOS mesajlarını tek bir HTTP/2 oturumu üzerinden gönderir.
 * Oturumu her mesaj için yeniden kurmak APNs'te pahalıdır; batch boyunca açık tutulur.
 */
async function sendApnsBatch(
    messages: PushMessage[]
): Promise<{ sent: number; failed: number; dead: string[] }> {
    const out = { sent: 0, failed: 0, dead: [] as string[] };
    if (messages.length === 0) return out;

    const token = getApnsToken();
    if (!token) {
        logger.warn('[push] APNs yapılandırılmamış (APNS_KEY/APNS_KEY_ID/APNS_TEAM_ID). iOS bildirimleri gönderilmedi.');
        out.failed = messages.length;
        return out;
    }

    const session = http2.connect(`https://${config.apns.host}`);
    session.on('error', (err) => logger.error('[push] APNs oturum hatası:', err));

    const sendOneApns = (m: PushMessage) =>
        new Promise<'ok' | 'dead' | 'fail'>((resolve) => {
            const payload = JSON.stringify({
                aps: {
                    alert: { title: m.title, body: m.body },
                    sound: 'default',
                    'mutable-content': 1,
                },
                ...Object.fromEntries(
                    Object.entries(m.data ?? {}).map(([k, v]) => [k, String(v)])
                ),
            });

            const req = session.request({
                ':method': 'POST',
                ':path': `/3/device/${m.to}`,
                authorization: `bearer ${token}`,
                'apns-topic': config.apns.bundleId,
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
            });

            let status = 0;
            let body = '';
            req.setEncoding('utf8');
            req.on('response', (h) => { status = Number(h[':status'] ?? 0); });
            req.on('data', (c: string) => { body += c; });
            req.on('error', (err) => { logger.error('[push] APNs istek hatası:', err); resolve('fail'); });
            req.on('end', () => {
                if (status === 200) return resolve('ok');
                // 410 Gone = cihaz artık kayıtlı değil; 400 BadDeviceToken = token geçersiz.
                if (status === 410 || /BadDeviceToken|Unregistered/i.test(body)) return resolve('dead');
                logger.warn(`[push] APNs ${status}: ${body.slice(0, 200)}`);
                resolve('fail');
            });
            req.end(payload);
        });

    let cursor = 0;
    const worker = async () => {
        while (cursor < messages.length) {
            const m = messages[cursor++]!;
            const r = await sendOneApns(m);
            if (r === 'ok') out.sent++;
            else if (r === 'dead') out.dead.push(m.to);
            else out.failed++;
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, messages.length) }, worker));

    session.close();
    return out;
}

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

    // iOS ayrı yoldan gider: cihaz token'ı APNs'e aittir, FCM kabul etmez.
    const iosMessages = messages.filter((m) => m.platform === 'ios');
    const fcmMessages = messages.filter((m) => m.platform !== 'ios');

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];

    if (iosMessages.length) {
        const r = await sendApnsBatch(iosMessages);
        sent += r.sent;
        failed += r.failed;
        dead.push(...r.dead);
    }

    if (fcmMessages.length === 0) {
        let prunedOnly = 0;
        if (dead.length) {
            const d = await prisma.userPushToken.deleteMany({ where: { token: { in: dead } } });
            prunedOnly = d.count;
            failed += dead.length;
            logger.info(`[push] ${prunedOnly} geçersiz token silindi`);
        }
        return { sent, failed, pruned: prunedOnly };
    }

    const projectId = config.fcm.projectId;
    const accessToken = await getAccessToken();
    if (!accessToken || !projectId) {
        logger.warn(
            '[push] FCM yapılandırılmamış (FCM_SERVICE_ACCOUNT). Android bildirimleri gönderilmedi.'
        );
        failed += fcmMessages.length;
        let prunedOnly = 0;
        if (dead.length) {
            const d = await prisma.userPushToken.deleteMany({ where: { token: { in: dead } } });
            prunedOnly = d.count;
            failed += dead.length;
        }
        return { sent, failed, pruned: prunedOnly };
    }

    // Sabit boyutlu havuz: CONCURRENCY kadar iş paralel ilerler.
    let cursor = 0;
    const worker = async () => {
        while (cursor < fcmMessages.length) {
            const m = fcmMessages[cursor++]!;
            const r = await sendOne(accessToken, projectId, m);
            if (r === 'ok') sent++;
            else if (r === 'dead') dead.push(m.to);
            else failed++;
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fcmMessages.length) }, worker));

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
