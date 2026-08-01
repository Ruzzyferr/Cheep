import { describe, it, expect, vi } from 'vitest';
import Joi from 'joi';
import { validate } from '../src/schema/validation.middleware.js';

/**
 * Express 5'te `req.query` bir GETTER: her erişimde query string'i yeniden
 * ayrıştırır. Middleware doğrulanmış değeri `Object.assign(req.query, value)`
 * ile yazıyordu ve bu yazma TUTMUYORDU.
 *
 * Düz parametrelerde fark edilmiyordu (değer zaten aynı), ama şemanın
 * DÖNÜŞTÜRDÜĞÜ değerler (virgüllü listenin diziye çevrilmesi, sayıya
 * dönüştürme, `default` atamaları) controller'a hiç ulaşmıyordu — sessizce
 * filtresiz sorgu çalışıyordu.
 */

const schema = Joi.object({
    store_slug: Joi.string()
        .custom((v: string) => v.split(',').map((s) => s.trim()).filter(Boolean))
        .optional(),
    limit: Joi.number().integer().default(50),
});

/** Express 5'in davranışını taklit eder: query salt-okunur bir getter. */
function makeReq(raw: Record<string, unknown>) {
    const req = {} as any;
    Object.defineProperty(req, 'query', {
        get: () => ({ ...raw }),
        configurable: true,
    });
    return req;
}

const runMiddleware = (raw: Record<string, unknown>) => {
    const req = makeReq(raw);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    validate(schema, 'query')(req, res, next);
    return { req, res, next };
};

describe('validate(query) — dönüştürülmüş değerler', () => {
    it('virgüllü listeyi diziye çevirip req.query\'ye YAZAR', () => {
        const { req, next } = runMiddleware({ store_slug: 'bim,a101' });
        expect(next).toHaveBeenCalled();
        expect(req.query.store_slug).toEqual(['bim', 'a101']);
    });

    it('şema varsayılanlarını uygular', () => {
        const { req } = runMiddleware({});
        expect(req.query.limit).toBe(50);
    });

    it('sayıya dönüştürmeyi uygular', () => {
        const { req } = runMiddleware({ limit: '12' });
        expect(req.query.limit).toBe(12);
    });

    it('geçersiz girdide 400 döner ve next çağrılmaz', () => {
        const { res, next } = runMiddleware({ limit: 'abc' });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('yazılabilir query\'de de çalışır (Express 4 uyumu)', () => {
        const req = { query: { store_slug: 'bim' } } as any;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
        const next = vi.fn();
        validate(schema, 'query')(req, res, next);
        expect(req.query.store_slug).toEqual(['bim']);
    });
});
