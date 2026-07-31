import type { Application } from 'express';

/**
 * Zincirdeki proxy atlaması sayısı: client → Caddy → backend. Tek atlama.
 *
 * `TRUST_PROXY_HOPS` env'i ile ezilebilir (ör. önüne bir CDN daha girerse).
 * Sayı vermek `true`'dan güvenli: `true` istemcinin gönderdiği tüm
 * X-Forwarded-For zincirine güvenir ve rate limit atlatılabilir hale gelir.
 */
const DEFAULT_HOPS = 1;

export function trustProxyHops(): number {
    const raw = process.env.TRUST_PROXY_HOPS;
    if (!raw) return DEFAULT_HOPS;
    const n = Number.parseInt(raw, 10);
    return Number.isInteger(n) && n >= 0 ? n : DEFAULT_HOPS;
}

/**
 * Express'e kaç proxy atlamasının arkasında olduğunu söyler.
 *
 * Ayarlanmazsa `req.ip` soketin karşı ucu olur — Caddy container'ının Docker
 * IP'si, yani her istek için AYNI değer. express-rate-limit varsayılan olarak
 * req.ip ile anahtarladığı için bütün kullanıcılar tek bir kovayı paylaşır:
 * rastgele 5 kişi giriş/kayıt denedikten sonra 6. kişi ilk denemesinde
 * "Çok fazla giriş denemesi" görür. Aynı şey generalLimiter, verifyLimiter,
 * feedbackLimiter ve compareLimiter için de geçerliydi.
 *
 * `n` atlama ile `req.ip`, X-Forwarded-For zincirinde soldan sağa ilerlerken
 * güvenilen n adres çıkarıldıktan sonra kalan en sağdaki adrestir; yani
 * proxy'nin kendi eklediği değer. İstemcinin başa yazdığı sahte adresler
 * dikkate alınmaz. Ayrıca Caddy XFF'i gerçek istemci IP'siyle yeniden yazıyor
 * (deploy/Caddyfile) ve backend portu artık dışarı açık değil — üç kat savunma.
 */
export function applyTrustProxy(app: Application): void {
    app.set('trust proxy', trustProxyHops());
}
