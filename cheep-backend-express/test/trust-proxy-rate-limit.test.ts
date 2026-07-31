import { describe, it, expect, afterEach } from 'vitest';
import express, { type Application } from 'express';
import rateLimit from 'express-rate-limit';
import { createServer, type Server } from 'node:http';
import { applyTrustProxy } from '../src/config/trust-proxy.js';

/**
 * Uygulama Caddy'nin arkasında (client → Caddy → backend:3000). Express'e
 * `trust proxy` söylenmezse `req.ip` her istekte Caddy container'ının Docker
 * IP'si olur — yani HERKES için aynı. express-rate-limit varsayılan olarak
 * req.ip ile anahtarladığından bütün kullanıcılar tek bir kovayı paylaşır ve
 * yeni bir kullanıcı ilk denemesinde "çok fazla giriş denemesi" görür.
 */

let server: Server | undefined;

afterEach(async () => {
    if (server) {
        await new Promise<void>((r) => server!.close(() => r()));
        server = undefined;
    }
});

async function listen(app: Application): Promise<string> {
    server = createServer(app);
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('port alınamadı');
    return `http://127.0.0.1:${addr.port}`;
}

/** Test istemcisi doğrudan bağlanır; Caddy'nin eklediği XFF'i taklit ediyoruz. */
const asClient = (ip: string) => ({ 'X-Forwarded-For': ip });

describe('proxy arkasında istemci IP çözümü', () => {
    it('req.ip olarak soket adresini değil, X-Forwarded-For istemcisini verir', async () => {
        const app = express();
        applyTrustProxy(app);
        app.get('/ip', (req, res) => res.json({ ip: req.ip }));

        const base = await listen(app);
        const res = await fetch(`${base}/ip`, { headers: asClient('203.0.113.7') });

        expect(await res.json()).toEqual({ ip: '203.0.113.7' });
    });

    it('istemcinin uydurduğu XFF zincirine güvenmez — proxy’nin eklediği son atlamayı alır', async () => {
        // Saldırgan "9.9.9.9" gönderir, Caddy kendi gördüğü IP'yi sona ekler.
        const app = express();
        applyTrustProxy(app);
        app.get('/ip', (req, res) => res.json({ ip: req.ip }));

        const base = await listen(app);
        const res = await fetch(`${base}/ip`, {
            headers: { 'X-Forwarded-For': '9.9.9.9, 203.0.113.7' },
        });

        expect(await res.json()).toEqual({ ip: '203.0.113.7' });
    });

    it('rate limit kovaları IP başına ayrışır (asıl hata: tek global kova)', async () => {
        const app = express();
        applyTrustProxy(app);
        app.use(
            rateLimit({
                windowMs: 60_000,
                max: 2,
                standardHeaders: true,
                legacyHeaders: false,
                message: { success: false, message: 'limit' },
            }),
        );
        app.get('/', (_req, res) => res.json({ ok: true }));

        const base = await listen(app);
        const hit = (ip: string) => fetch(base, { headers: asClient(ip) });

        // Birinci kullanıcı kotasını tüketir.
        expect((await hit('198.51.100.1')).status).toBe(200);
        expect((await hit('198.51.100.1')).status).toBe(200);
        expect((await hit('198.51.100.1')).status).toBe(429);

        // İkinci kullanıcı bundan etkilenmemeli — hata buradaydı: 429 dönüyordu.
        const other = await hit('198.51.100.2');
        expect(other.status).toBe(200);
        expect(other.headers.get('ratelimit-remaining')).toBe('1');
    });

    it('kimlik doğrulanmış istekleri IP değil kullanıcı başına sayar (CGNAT)', async () => {
        // Mobil operatörlerde yüzlerce abone aynı public IP'nin arkasında.
        // Aynı IP'den gelen farklı kullanıcılar birbirinin kotasını yememeli.
        const app = express();
        applyTrustProxy(app);
        app.use((req, _res, next) => {
            const id = req.header('X-Test-User');
            if (id) req.user = { id: Number(id) } as NonNullable<typeof req.user>;
            next();
        });
        app.use(
            rateLimit({
                windowMs: 60_000,
                max: 1,
                standardHeaders: true,
                legacyHeaders: false,
                keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`),
            }),
        );
        app.get('/', (_req, res) => res.json({ ok: true }));

        const base = await listen(app);
        const CGNAT = '100.64.0.1'; // ortak operatör IP'si
        const as = (user: string) =>
            fetch(base, { headers: { ...asClient(CGNAT), 'X-Test-User': user } });

        expect((await as('1')).status).toBe(200);
        expect((await as('1')).status).toBe(429); // aynı kullanıcı kotasını doldurdu
        expect((await as('2')).status).toBe(200); // komşu abone etkilenmedi
    });
});

describe('gerçek limiter yapılandırması', () => {
    it('kayıt ve giriş ayrı kovalarda — biri diğerini kilitlemez', async () => {
        const { registerLimiter, loginIpLimiter } = await import(
            '../src/middleware/rate-limit.middleware.js'
        );

        const app = express();
        applyTrustProxy(app);
        app.use(express.json());
        app.post('/register', registerLimiter, (_req, res) => res.json({ ok: 'register' }));
        app.post('/login', loginIpLimiter, (_req, res) => res.status(401).json({ ok: 'login' }));

        const base = await listen(app);
        const post = (path: string) =>
            fetch(base + path, {
                method: 'POST',
                headers: { ...asClient('203.0.113.9'), 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'a@b.co', password: 'x' }),
            });

        const reg = await post('/register');
        const login = await post('/login');

        expect(reg.status).toBe(200);
        expect(login.status).toBe(401);

        // Ayrı kova: login'in ilk isteği kendi kotasından SADECE 1 düşürmeli.
        // Ortak kovada (eski hâl) register'ın isteği de sayılır ve 2 düşerdi.
        const limit = Number(login.headers.get('ratelimit-limit'));
        expect(Number(login.headers.get('ratelimit-remaining'))).toBe(limit - 1);
    });
});
