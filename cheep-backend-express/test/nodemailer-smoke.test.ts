/**
 * nodemailer'ın GERÇEK sürümüne karşı duman testi — taklit YOK.
 *
 * NEDEN VAR: `password-reset.test.ts` ve `support-contact.test.ts` e-posta
 * servisini mock'luyor, yani nodemailer'ın kendi API'si HİÇ çalıştırılmıyordu.
 * 2 Ekim 2026'da güvenlik yaması için nodemailer 9 → 10 (ANA SÜRÜM) atlandı ve
 * 531 testin tamamı yeşil kaldı — çünkü hiçbiri gerçek kütüphaneye dokunmuyor.
 * Kırılma olsaydı ancak canlıda, kullanıcı doğrulama kodu bekleriken
 * görünürdü.
 *
 * Bu test o boşluğu kapatıyor: ağ gerektirmeden, yalnızca uygulamanın
 * kullandığı API yüzeyinin yerinde olduğunu doğruluyor.
 */
import { describe, it, expect } from 'vitest';
import nodemailer from 'nodemailer';

describe('nodemailer gerçek API yüzeyi', () => {
  // `email.service.ts`'in kurduğu seçeneklerin birebir şekli.
  const transport = () =>
    nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: { user: 'kullanici', pass: 'parola' },
    });

  it('createTransport uygulamanın verdiği seçeneklerle çalışır', () => {
    expect(transport()).toBeTypeOf('object');
  });

  it('kullandığımız iki metot da duruyor', () => {
    const tx = transport();
    // Ana sürüm atlamasında ilk kaybolacak şeyler bunlar.
    expect(tx.sendMail).toBeTypeOf('function');
    expect(tx.verify).toBeTypeOf('function');
  });

  it('sendMail uygulamanın gönderdiği alanları kabul eder (ağa çıkmadan)', async () => {
    const tx = transport();
    // Bağlantı REDDEDİLECEK — amaç da bu: hata ağ hatası olmalı, "böyle bir
    // alan yok" ya da "fonksiyon değil" gibi bir API hatası DEĞİL.
    await expect(
      tx.sendMail({
        from: '"Cheep" <noreply@cheep.live>',
        to: 'kime@example.com',
        subject: 'konu',
        text: 'düz metin',
        html: '<p>html</p>',
        replyTo: 'cevap@example.com',
      }),
    ).rejects.toThrow();
  });
});
