/**
 * "Şifremi unuttum" akışı.
 *
 * Bu testlerin çoğu UX değil GÜVENLİK testi: uç kimliksiz, tek girdisi bir
 * e-posta adresi ve başarısında hesabın parolasını değiştiriyor. Yanlış
 * davranışın bedeli burada "kötü deneyim" değil, hesap devri.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();
const hash = vi.fn();
const compare = vi.fn();
const sendReset = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    user: {
      findUnique: (...a: any[]) => findUnique(...a),
      update: (...a: any[]) => update(...a),
    },
  },
}));
vi.mock('bcryptjs', () => ({
  default: {
    hash: (...a: any[]) => hash(...a),
    compare: (...a: any[]) => compare(...a),
  },
}));
vi.mock('../src/services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: (...a: any[]) => sendReset(...a),
}));
vi.mock('jsonwebtoken', () => ({
  default: { sign: () => 'jwt', verify: () => ({}) },
}));

import { requestPasswordReset, resetPassword } from '../src/api/auth/auth.service.js';

/** Elinde geçerli, taze bir sıfırlama kodu olan kullanıcı. */
const userWithCode = (over: Record<string, unknown> = {}) => ({
  id: 7,
  email: 'a@b.com',
  name: 'Ada',
  language: 'pl',
  password_hash: 'eski',
  token_version: 3,
  password_reset_code: 'kod-hash',
  password_reset_expires: new Date(Date.now() + 60_000),
  password_reset_attempts: 0,
  ...over,
});

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  hash.mockReset();
  compare.mockReset();
  sendReset.mockReset();
  update.mockResolvedValue({ id: 7, token_version: 4 });
  hash.mockResolvedValue('yeni-hash');
  sendReset.mockResolvedValue(true);
});

describe('requestPasswordReset', () => {
  it('kayıtlı adrese kod yazar ve kullanıcının DİLİNDE e-posta gönderir', async () => {
    findUnique.mockResolvedValueOnce(userWithCode({ password_reset_code: null }));

    await requestPasswordReset('a@b.com');

    const data = update.mock.calls[0][0].data;
    expect(data.password_reset_code).toBe('yeni-hash');
    expect(data.password_reset_expires).toBeInstanceOf(Date);
    // Yeni kod = temiz sayaç; yoksa eski kodun hataları yeniyi doğmadan yakardı.
    expect(data.password_reset_attempts).toBe(0);
    expect(sendReset).toHaveBeenCalledWith('a@b.com', 'Ada', expect.stringMatching(/^\d{6}$/), 'pl');
  });

  it('e-postayı küçük harfe indirger — kimlik büyük/küçük harfe duyarlı değil', async () => {
    findUnique.mockResolvedValueOnce(null);
    await requestPasswordReset('  A@B.CoM  ');
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
  });

  it('KAYITLI OLMAYAN adreste sessizce başarılı olur — hesap varlığı sızdırmaz', async () => {
    findUnique.mockResolvedValueOnce(null);

    // Fırlatmamalı: çağıran her iki durumda da aynı 200'ü döner.
    await expect(requestPasswordReset('yok@b.com')).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
    expect(sendReset).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  it('doğru kodla parolayı yazar, kodu temizler ve OTURUMLARI SONLANDIRIR', async () => {
    findUnique.mockResolvedValueOnce(userWithCode());
    compare.mockResolvedValueOnce(true);

    const out = await resetPassword('a@b.com', '123456', 'yeniparola');

    const data = update.mock.calls[0][0].data;
    expect(data.password_hash).toBe('yeni-hash');
    expect(data.password_reset_code).toBeNull();
    expect(data.password_reset_attempts).toBe(0);
    // Sıfırlamanın asıl güvenlik değeri: varsa saldırganın açık oturumu da düşer.
    expect(data.token_version).toEqual({ increment: 1 });
    // Kodu okuyabilmek posta kutusuna erişimi zaten kanıtladı.
    expect(data.email_verified).toBe(true);
    expect(out.token).toBe('jwt');
  });

  it('yanıtta parola/kod hash’i SIZDIRMAZ', async () => {
    findUnique.mockResolvedValueOnce(userWithCode());
    compare.mockResolvedValueOnce(true);
    update.mockResolvedValueOnce({
      id: 7,
      email: 'a@b.com',
      token_version: 4,
      password_hash: 'gizli',
      password_reset_code: 'kod-hash',
      password_reset_expires: new Date(),
      password_reset_attempts: 0,
      email_verification_code: 'x',
      email_verification_expires: new Date(),
    });

    const { user } = await resetPassword('a@b.com', '123456', 'yeniparola');

    // 6 haneli bir sırrın bcrypt hash'i çevrimdışı saniyeler içinde çözülür —
    // yanıtta bırakmak kodu düz metin göndermekle eşdeğerdi.
    expect(user).not.toHaveProperty('password_reset_code');
    expect(user).not.toHaveProperty('password_reset_expires');
    expect(user).not.toHaveProperty('password_reset_attempts');
    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('email_verification_code');
  });

  it('hatalı kodda sayacı ARTIRIR ve parolaya dokunmaz', async () => {
    findUnique.mockResolvedValueOnce(userWithCode());
    compare.mockResolvedValueOnce(false);

    await expect(resetPassword('a@b.com', '000000', 'yeni')).rejects.toMatchObject({ statusCode: 400 });

    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { password_reset_attempts: { increment: 1 } },
    });
  });

  it('5 hatalı denemeden sonra kod YANAR — kod artık doğru olsa bile kabul edilmez', async () => {
    findUnique.mockResolvedValueOnce(userWithCode({ password_reset_attempts: 5 }));

    await expect(resetPassword('a@b.com', '123456', 'yeni')).rejects.toMatchObject({ statusCode: 400 });

    // Karşılaştırma HİÇ yapılmamalı: kod tükendi.
    expect(compare).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.password_reset_code).toBeNull();
  });

  it('süresi dolmuş kodu reddeder ve temizler', async () => {
    findUnique.mockResolvedValueOnce(
      userWithCode({ password_reset_expires: new Date(Date.now() - 1) }),
    );

    await expect(resetPassword('a@b.com', '123456', 'yeni')).rejects.toMatchObject({ statusCode: 400 });
    expect(compare).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.password_reset_code).toBeNull();
  });

  it('hiç kod istenmemişse reddeder', async () => {
    findUnique.mockResolvedValueOnce(userWithCode({ password_reset_code: null }));
    await expect(resetPassword('a@b.com', '123456', 'yeni')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('BİLİNMEYEN hesapla bilinen hesabın hatası AYNI — varlık sızdırmaz', async () => {
    findUnique.mockResolvedValueOnce(null);
    const bilinmeyen = await resetPassword('yok@b.com', '123456', 'yeni').catch((e) => e);

    findUnique.mockResolvedValueOnce(userWithCode());
    compare.mockResolvedValueOnce(false);
    const bilinen = await resetPassword('a@b.com', '000000', 'yeni').catch((e) => e);

    expect(bilinmeyen.message).toBe(bilinen.message);
    expect(bilinmeyen.statusCode).toBe(bilinen.statusCode);
    expect(bilinmeyen.code).toBe(bilinen.code);
  });

  it('6 hane olmayan kodu veritabanına hiç gitmeden reddeder', async () => {
    await expect(resetPassword('a@b.com', '12ab', 'yeni')).rejects.toMatchObject({ statusCode: 400 });
    expect(findUnique).not.toHaveBeenCalled();
  });
});
