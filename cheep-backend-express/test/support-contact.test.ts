import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn();
const update = vi.fn();
const sendSupportMessage = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
    prisma: {
        supportMessage: {
            create: (...a: any[]) => create(...a),
            update: (...a: any[]) => update(...a),
        },
    },
}));
vi.mock('../src/services/email.service.js', () => ({
    sendSupportMessage: (...a: any[]) => sendSupportMessage(...a),
}));

import { submitContactMessage } from '../src/api/support/support.service.js';
import { contactSchema } from '../src/api/support/support.schema.js';

beforeEach(() => {
    create.mockReset();
    update.mockReset();
    sendSupportMessage.mockReset();
    create.mockResolvedValue({ id: 42 });
});

describe('destek mesajı', () => {
    it('önce veritabanına yazar, sonra e-postalar', async () => {
        sendSupportMessage.mockResolvedValue(true);

        await submitContactMessage({
            email: 'a@b.co',
            message: 'Uygulama açılışta kapanıyor',
            topic: 'bug',
            app_version: '1.3.0',
        });

        expect(create).toHaveBeenCalledOnce();
        // Sıra kritik: kayıt e-postadan ÖNCE olmalı ki gönderim hatasında mesaj kaybolmasın.
        expect(create.mock.invocationCallOrder[0]).toBeLessThan(
            sendSupportMessage.mock.invocationCallOrder[0],
        );
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 42 }, data: { emailed_at: expect.any(Date) } }),
        );
    });

    it('e-posta gönderilemezse mesaj yine kayıtlı kalır ve emailed_at işaretlenmez', async () => {
        sendSupportMessage.mockResolvedValue(false);

        const r = await submitContactMessage({
            email: 'a@b.co',
            message: 'Fiyat yanlış görünüyor',
            topic: 'price',
        });

        expect(r).toEqual({ id: 42, emailed: false });
        expect(create).toHaveBeenCalledOnce();
        expect(update).not.toHaveBeenCalled(); // emailed_at NULL kalır → elle kurtarılabilir
    });

    it('giriş yapmış kullanıcıda hesap bilgisini bağlama ekler', async () => {
        sendSupportMessage.mockResolvedValue(true);

        await submitContactMessage(
            { email: 'yazan@b.co', message: 'Bir önerim var...', topic: 'suggestion' },
            { id: 7, email: 'hesap@b.co', name: 'Ada' },
        );

        const arg = sendSupportMessage.mock.calls[0][0];
        expect(arg.userLabel).toContain('Ada');
        expect(arg.context['Hesap e-postası']).toBe('hesap@b.co');
        // Reply-To yazanın adresi olmalı, hesabınki değil.
        expect(arg.fromEmail).toBe('yazan@b.co');
        expect(create.mock.calls[0][0].data.user_id).toBe(7);
    });

    it('anonim kullanıcıda user_id null kalır', async () => {
        sendSupportMessage.mockResolvedValue(true);
        await submitContactMessage({ email: 'a@b.co', message: 'Giriş yapamıyorum', topic: 'account' });
        expect(create.mock.calls[0][0].data.user_id).toBeNull();
    });
});

describe('destek formu doğrulaması', () => {
    it('çok kısa mesajı reddeder — "olmuyor" kimseye yardımcı olmuyor', () => {
        const { error } = contactSchema.validate({ email: 'a@b.co', message: 'olmuyor' });
        expect(error?.message).toMatch(/en az 10/);
    });

    it('geçersiz e-postayı reddeder', () => {
        const { error } = contactSchema.validate({ email: 'bozuk', message: 'Yeterince uzun bir mesaj' });
        expect(error?.message).toMatch(/e-posta/i);
    });

    it('bilinmeyen konuyu reddeder, varsayılanı other yapar', () => {
        expect(contactSchema.validate({ email: 'a@b.co', message: 'Yeterince uzun mesaj', topic: 'hack' }).error)
            .toBeTruthy();
        expect(contactSchema.validate({ email: 'a@b.co', message: 'Yeterince uzun mesaj' }).value.topic)
            .toBe('other');
    });
});
