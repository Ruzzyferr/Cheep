import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// --- JWT secret ---
// Production: zorunlu ve min 32 karakter.
// Development: env yoksa güvenli olmayan bir dev default kullanılır + yüksek sesle uyarı.
const jwtSecretEnv = process.env.JWT_SECRET;
let jwtSecret = jwtSecretEnv;

if (!jwtSecretEnv || jwtSecretEnv.length < 32) {
    if (isProduction) {
        throw new Error(
            'JWT_SECRET ortam değişkeni production için zorunludur (min 32 karakter).'
        );
    }
    // eslint-disable-next-line no-console
    console.warn(
        '⚠️  JWT_SECRET ayarlanmadı veya çok kısa. SADECE development için güvensiz bir default kullanılıyor.'
    );
    jwtSecret = 'dev-only-insecure-secret-do-not-use-in-prod-0123456789';
}

// --- JWT refresh secret ---
// Access token secret'ından AYRI olmalı (token-tipi karışıklığına karşı derinlemesine savunma).
// Production: zorunlu, min 32 karakter ve access secret'ından farklı.
const jwtRefreshSecretEnv = process.env.JWT_REFRESH_SECRET;
let jwtRefreshSecret = jwtRefreshSecretEnv;

if (!jwtRefreshSecretEnv || jwtRefreshSecretEnv.length < 32) {
    if (isProduction) {
        throw new Error(
            'JWT_REFRESH_SECRET ortam değişkeni production için zorunludur (min 32 karakter).'
        );
    }
    // eslint-disable-next-line no-console
    console.warn(
        '⚠️  JWT_REFRESH_SECRET ayarlanmadı veya çok kısa. SADECE development için güvensiz bir default kullanılıyor.'
    );
    jwtRefreshSecret = 'dev-only-insecure-refresh-secret-do-not-use-in-prod-9876543210';
}

if (isProduction && jwtRefreshSecret === jwtSecret) {
    throw new Error(
        'JWT_REFRESH_SECRET, JWT_SECRET ile aynı olamaz (token-tipi izolasyonu için farklı olmalı).'
    );
}

// --- Ingestion API key (scraper -> backend yazma endpoint'leri) ---
const ingestApiKey = process.env.INGEST_API_KEY;
if (!ingestApiKey && isProduction) {
    throw new Error(
        'INGEST_API_KEY ortam değişkeni production için zorunludur (ingestion endpoint güvenliği).'
    );
}

// --- CORS allowlist ---
// Not: Mobil uygulama (React Native) Origin göndermez, CORS onu ilgilendirmez.
// Bu liste yalnızca TARAYICIDAN gelen istekler için: cheep.live'daki hesap silme
// formu API'ye tarayıcıdan POST atıyor.
//
// Site origin'i her zaman ekli: prod .env'de ALLOWED_ORIGINS yanlışlıkla
// geliştirme değerlerinde kalmıştı (localhost:8081) ve hesap silme formu
// sessizce CORS'a takılıyordu — Play Store'un zorunlu tuttuğu bir özellik.
// Yapılandırma hatası bu sayfayı bir daha kıramasın diye kodda sabit.
const SITE_ORIGINS = ['https://cheep.live'];

const allowedOrigins = Array.from(
    new Set([
        ...SITE_ORIGINS,
        ...(process.env.ALLOWED_ORIGINS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    ])
);

// --- HTTP port ---
const port = Number(process.env.PORT) || 3000;

// --- SMTP (e-posta doğrulama / bildirim) ---
// Üretimde değerler yoksa e-posta gönderimi devre dışı kalır (kayıt yine de çalışır,
// kod log'a yazılır). Gmail/Workspace: host smtp.gmail.com, port 465 (secure).
const smtp = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    // Gmail uygulama şifreleri boşluklu gösterilir; boşlukları temizle.
    password: (process.env.SMTP_PASSWORD || '').replace(/\s+/g, ''),
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'Cheep',
};
const smtpEnabled = Boolean(smtp.user && smtp.password);

// --- E-posta taşıma (Resend HTTP API tercih edilir; bulutta SMTP bloklanabilir) ---
const email = {
    resendApiKey: process.env.RESEND_API_KEY || '',
    // Gönderen adresi: EMAIL_FROM > SMTP_FROM_EMAIL > SMTP_USER
    fromEmail: process.env.EMAIL_FROM || smtp.fromEmail,
};
const emailEnabled = Boolean(email.resendApiKey) || smtpEnabled;

if (isProduction && !emailEnabled) {
    // eslint-disable-next-line no-console
    console.warn(
        '⚠️  E-posta taşıma yok (RESEND_API_KEY veya SMTP_*). Doğrulama kodları gönderilemeyecek.'
    );
}


// --- Destek kutusu ---
// Uygulama içi iletişim formundan gelen mesajlar buraya düşer. destek@cheep.live
// şu an MX kaydı olmadığı için mail ALMIYOR; yönlendirme kurulunca SUPPORT_INBOX
// env'i ona çevrilir. Varsayılan, bugün gerçekten çalışan adres.
const support = {
    inbox: process.env.SUPPORT_INBOX || 'info@swiip.app',
};


// --- Firebase Cloud Messaging (push bildirimleri) ---
// Servis hesabı anahtarı GERÇEK BİR SIR: google-services.json'ın aksine
// uygulamanın içine girmez, yalnızca sunucuda durur. Git'e KONMAZ.
// FCM_SERVICE_ACCOUNT: servis hesabı JSON'unun tamamı (tek satır) veya base64'ü.
interface FcmServiceAccount {
    client_email: string;
    private_key: string;
    project_id: string;
}

function parseServiceAccount(): FcmServiceAccount | null {
    const raw = process.env.FCM_SERVICE_ACCOUNT?.trim();
    if (!raw) return null;
    try {
        const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        const sa = JSON.parse(json) as FcmServiceAccount;
        if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error('eksik alan');
        // .env üzerinden taşınırken satır sonları kaçışlı ("\n") geliyor;
        // RS256 imzası için gerçek satır sonuna çevrilmeli.
        sa.private_key = sa.private_key.split(String.raw`\n`).join('\n');
        return sa;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`⚠️  FCM_SERVICE_ACCOUNT çözümlenemedi (${(err as Error).message}). Push devre dışı.`);
        return null;
    }
}

const fcmServiceAccount = parseServiceAccount();
const fcm = {
    serviceAccount: fcmServiceAccount,
    projectId: process.env.FCM_PROJECT_ID || fcmServiceAccount?.project_id || '',
};


// --- Apple Push Notification service (iOS) ---
// iOS token'ları FCM'e gönderilemez: mobil uygulama expo-notifications ile ham
// APNs CİHAZ token'ı alıyor (getDevicePushTokenAsync), FCM ise kendi kayıt
// token'ını bekliyor. Aradaki uyuşmazlık yüzünden iOS doğrudan APNs'e gönderilir.
//
// APNS_KEY: App Store Connect'ten indirilen .p8 anahtarının içeriği — ya tek
// satır halinde ("\\n" kaçışlı) ya da base64'ü. GERÇEK BİR SIR, git'e konmaz.
function parseApnsKey(): string | null {
    const raw = process.env.APNS_KEY?.trim();
    if (!raw) return null;
    const key = raw.includes('BEGIN PRIVATE KEY')
        ? raw.split(String.raw`\n`).join('\n')
        : Buffer.from(raw, 'base64').toString('utf8');
    if (!key.includes('BEGIN PRIVATE KEY')) {
        // eslint-disable-next-line no-console
        console.warn('⚠️  APNS_KEY çözümlenemedi (PEM değil). iOS push devre dışı.');
        return null;
    }
    return key;
}

const apnsKey = parseApnsKey();
const apns = {
    key: apnsKey,
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    bundleId: process.env.APNS_BUNDLE_ID || 'com.cheep.mobile',
    // Anahtar "Sandbox & Production" kapsamında üretildi; App Store sürümü
    // production ucunu kullanır. TestFlight/geliştirme için
    // APNS_HOST=api.sandbox.push.apple.com verilir.
    host: process.env.APNS_HOST || 'api.push.apple.com',
    enabled: Boolean(apnsKey && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID),
};

export const config = {
    isProduction,
    jwtSecret: jwtSecret as string,
    jwtRefreshSecret: jwtRefreshSecret as string,
    ingestApiKey,
    allowedOrigins,
    port,
    smtp,
    smtpEnabled,
    email,
    emailEnabled,
    support,
    fcm,
    apns,
};
