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

export const config = {
    isProduction,
    jwtSecret: jwtSecret as string,
    ingestApiKey,
    allowedOrigins,
};
