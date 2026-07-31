import { type Request, type Response, type NextFunction } from 'express';
import * as SupportService from './support.service.js';

/**
 * Destek mesajı alır. Kimlik doğrulama İSTEĞE BAĞLI — sorun yaşayan kullanıcı
 * çoğu zaman giriş yapamadığı için yazıyor.
 */
export const contact = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await SupportService.submitContactMessage(
            {
                email: req.body.email,
                message: req.body.message,
                topic: req.body.topic ?? 'other',
                app_version: req.body.app_version,
                platform: req.body.platform,
                os_version: req.body.os_version,
                locale: req.body.locale,
                country_code: req.body.country_code ?? req.country?.code,
            },
            req.user ? { id: req.user.id, email: req.user.email, name: req.user.name } : undefined
        );

        // E-posta gönderilemese bile 201: mesaj kaydedildi, kullanıcıdan tekrar
        // yazmasını istemenin bir anlamı yok. Gönderim hatası sunucuda loglanır.
        res.status(201).json({
            success: true,
            data: { id: result.id },
            message: 'Mesajın bize ulaştı. En kısa sürede döneceğiz.',
        });
    } catch (error) {
        next(error);
    }
};
