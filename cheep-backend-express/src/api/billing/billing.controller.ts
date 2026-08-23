import { type Request, type Response, type NextFunction } from 'express';
import * as Billing from './billing.service.js';
import { mapWebhookEvent } from '../../services/entitlement.js';
import logger from '../../utils/logger.js';

/**
 * RevenueCat webhook ucu.
 *
 * Kimlik doğrulaması geçtikten sonra HER ZAMAN 200 döner. 5xx dönmek
 * RevenueCat'in saatlerce yeniden denemesine yol açar; işleyemediğimiz bir olayı
 * (bilinmeyen tip, silinmiş kullanıcı) sonsuza dek tekrar almanın faydası yok.
 * Gerçek hatalar log'a düşer, `/billing/sync` yedeği durumu toparlar.
 */
export const revenuecatWebhook = async (req: Request, res: Response) => {
    const event = req.body?.event;
    try {
        const mapped = mapWebhookEvent(event);
        if (!mapped) {
            logger.info(`RevenueCat olayi yok sayildi: tip=${event?.type} kullanici=${event?.app_user_id}`);
            res.status(200).json({ success: true, handled: false });
            return;
        }
        const result = await Billing.recordEvent(mapped);
        logger.info(
            `RevenueCat olayi ${result.applied ? 'islendi' : 'atlandi (' + result.reason + ')'}: ` +
            `${event?.type} kullanici=${mapped.userId} durum=${mapped.status}`
        );
        res.status(200).json({ success: true, handled: result.applied });
    } catch (error) {
        logger.error(`RevenueCat webhook hatasi (tip=${event?.type}): ${(error as Error)?.message}`);
        res.status(200).json({ success: true, handled: false });
    }
};

/** Kullanıcının abonelik durumu (kayıtlı hâl). */
export const status = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({ success: true, data: await Billing.getStatus(req.user!.id) });
    } catch (error) {
        next(error);
    }
};

/** Durumu RevenueCat'ten tazeler — girişte ve satın alma dönüşünde çağrılır. */
export const sync = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({ success: true, data: await Billing.syncUser(req.user!.id) });
    } catch (error) {
        next(error);
    }
};
