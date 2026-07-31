import { prisma } from '../../utils/prisma.client.js';
import logger from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { sendSupportMessage } from '../../services/email.service.js';

export interface ContactInput {
    email: string;
    message: string;
    topic: string;
    app_version?: string | null;
    platform?: string | null;
    os_version?: string | null;
    locale?: string | null;
    country_code?: string | null;
}

export interface ContactActor {
    id: number;
    email: string;
    name: string;
}

/**
 * Destek mesajını kaydeder ve ekibe e-postalar.
 *
 * SIRA ÖNEMLİ: önce veritabanı, sonra e-posta. E-posta sağlayıcısı geçici olarak
 * düşerse mesaj yine de duruyor olur (`emailed_at` NULL kalır) ve elle
 * kurtarılabilir. Tersi sırada, gönderim hatası kullanıcının yazdığını yok ederdi.
 *
 * E-posta gönderilemese bile çağıran taraf HATA GÖRMEZ: kullanıcı açısından
 * mesaj alınmıştır ve tekrar yazmasını istemeyiz.
 */
export const submitContactMessage = async (
    input: ContactInput,
    actor?: ContactActor
): Promise<{ id: number; emailed: boolean }> => {
    const saved = await prisma.supportMessage.create({
        data: {
            user_id: actor?.id ?? null,
            email: input.email,
            topic: input.topic,
            message: input.message,
            app_version: input.app_version || null,
            platform: input.platform || null,
            os_version: input.os_version || null,
            locale: input.locale || null,
            country_code: input.country_code || null,
        },
        select: { id: true },
    });

    const emailed = await sendSupportMessage({
        to: config.support.inbox,
        fromEmail: input.email,
        topic: input.topic,
        message: input.message,
        userLabel: actor ? `${actor.name} (hesap #${actor.id})` : 'Giriş yapmamış kullanıcı',
        context: {
            'Hesap e-postası': actor?.email,
            'Uygulama sürümü': input.app_version,
            Platform: input.platform,
            'OS sürümü': input.os_version,
            Dil: input.locale,
            Ülke: input.country_code,
            'Mesaj id': String(saved.id),
        },
        messageId: saved.id,
    });

    if (emailed) {
        await prisma.supportMessage.update({
            where: { id: saved.id },
            data: { emailed_at: new Date() },
        });
    } else {
        logger.error(
            `[support] Mesaj #${saved.id} kaydedildi ama e-postalanamadı — veritabanından okunabilir.`
        );
    }

    return { id: saved.id, emailed };
};
