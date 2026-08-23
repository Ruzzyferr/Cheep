import { describe, it, expect, vi, beforeEach } from 'vitest';

// Nesne fabrikanin ICINDE uretilmeli (vi.mock hoist edilir); test ayni referansi
// import edip mutasyona ugratir.
vi.mock('../src/config/index.js', () => ({
  config: { revenuecat: { webhookSecret: '', apiKey: '' } },
}));

import { config } from '../src/config/index.js';
import { requireRevenueCatSecret } from '../src/middleware/revenuecat-auth.middleware.js';

function run(headerValue: string | undefined) {
  const req: any = { header: (n: string) => (n.toLowerCase() === 'authorization' ? headerValue : undefined) };
  const json = vi.fn();
  const res: any = { status: vi.fn(() => res), json };
  const next = vi.fn();
  requireRevenueCatSecret(req, res, next);
  return { res, next, json };
}

beforeEach(() => { (config as any).revenuecat.webhookSecret = 'super-secret-value'; });

describe('requireRevenueCatSecret', () => {
  it('dogru sir ile gecer', () => {
    const { next, res } = run('super-secret-value');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('yanlis sir 401', () => {
    const { next, res } = run('wrong-secret-value');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('baslik yoksa 401', () => {
    const { next, res } = run(undefined);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('dogru on ek ama kisa deger 401 (uzunluk farki cokme yaratmamali)', () => {
    const { next, res } = run('super');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('daha uzun deger 401', () => {
    const { next, res } = run('super-secret-value-extra');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sir yapilandirilmamissa uc KAPALI (503), acik degil', () => {
    (config as any).revenuecat.webhookSecret = '';
    const { next, res } = run('anything');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
