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
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

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

if (isProduction && !smtpEnabled) {
    // eslint-disable-next-line no-console
    console.warn(
        '⚠️  SMTP yapılandırılmadı (SMTP_USER/SMTP_PASSWORD). E-posta doğrulama kodları gönderilemeyecek.'
    );
}

export const config = {
    isProduction,
    jwtSecret: jwtSecret as string,
    jwtRefreshSecret: jwtRefreshSecret as string,
    ingestApiKey,
    allowedOrigins,
    port,
    smtp,
    smtpEnabled,
};
