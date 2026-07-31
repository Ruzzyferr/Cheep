import { describe, it, expect, afterEach } from 'vitest';
import express, { type Application } from 'express';
import { createServer, type Server } from 'node:http';
import { jsonBodyParser, BULK_INGEST_PATHS } from '../src/middleware/body-parser.middleware.js';
import { config } from '../src/config/index.js';

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

/** ~2 MB'lık JSON gövde — standart limitin (1mb) üstünde, bulk limitin altında. */
const bigBody = JSON.stringify({ pad: 'x'.repeat(2 * 1024 * 1024) });

describe('gövde boyutu limiti', () => {
    it('sıradan uçta 1mb üstünü reddeder (bellek tüketme saldırısı)', async () => {
        const app = express();
        app.use(jsonBodyParser());
        app.post('/api/v1/auth/login', (_req, res) => res.json({ ok: true }));
        app.use((err: any, _req: any, res: any, _next: any) =>
            res.status(err.status ?? 500).json({ error: err.type }),
        );

        const base = await listen(app);
        const res = await fetch(`${base}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bigBody,
        });

        expect(res.status).toBe(413); // Payload Too Large
    });

    it('toplu ingest ucunda büyük gövdeye izin verir (scraper bunu kullanıyor)', async () => {
        const app = express();
        app.use(jsonBodyParser());
        app.post(BULK_INGEST_PATHS[0]!, (_req, res) => res.json({ ok: true }));

        const base = await listen(app);
        const res = await fetch(base + BULK_INGEST_PATHS[0], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bigBody,
        });

        expect(res.status).toBe(200);
    });
});

describe('CORS allowlist', () => {
    it('site origin’i her zaman içerir — hesap silme formu ona bağlı', () => {
        // Prod .env yanlışlıkla geliştirme değerlerinde kalmıştı ve
        // cheep.live/delete formu sessizce CORS'a takılıyordu.
        expect(config.allowedOrigins).toContain('https://cheep.live');
    });
});
