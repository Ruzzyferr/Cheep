import { type Request, type Response, type NextFunction } from 'express';
import { intParam } from '../../utils/request-params.js';
import * as NotificationsService from './notifications.service.js';
import { detectPriceDrops } from './price-drop.service.js';
import * as PushService from '../../services/push.service.js';

const requireUser = (req: Request, res: Response): number | null => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Kullanıcı bilgisi bulunamadı' });
        return null;
    }
    return req.user.id;
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = requireUser(req, res);
        if (userId === null) return;

        const limit = Math.min(Number(req.query.limit) || 30, 100);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        const data = await NotificationsService.listNotifications(userId, limit, offset);

        res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

export const unreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = requireUser(req, res);
        if (userId === null) return;
        res.status(200).json({ success: true, data: { count: await NotificationsService.unreadCount(userId) } });
    } catch (error) {
        next(error);
    }
};

export const markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = requireUser(req, res);
        if (userId === null) return;
        const ok = await NotificationsService.markRead(userId, intParam(req.params.id));
        res.status(200).json({ success: true, data: { updated: ok } });
    } catch (error) {
        next(error);
    }
};

export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = requireUser(req, res);
        if (userId === null) return;
        res.status(200).json({ success: true, data: { updated: await NotificationsService.markAllRead(userId) } });
    } catch (error) {
        next(error);
    }
};

/**
 * Günlük tespit işi. `requireIngestKey` ile korunur ve run-daily.sh içinden
 * ingest sonrası çağrılır — harvest-ean ucuyla aynı desen.
 */
export const runDetection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sinceHours = Math.min(Math.max(Number(req.query.since_hours) || 26, 1), 24 * 14);
        res.status(200).json({ success: true, data: await detectPriceDrops(sinceHours) });
    } catch (error) {
        next(error);
    }
};

/** Cihaz push token'ı kaydeder (uygulama izin aldıktan sonra çağırır). */
export const registerPushToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = requireUser(req, res);
        if (userId === null) return;

        const { token, platform, locale } = req.body ?? {};
        // FCM kayıt token'ları uzun, opak dizeler — sabit bir önek yok.
        // Yalnızca kabaca doğrula; geçersizi FCM zaten reddeder ve temizleriz.
        if (typeof token !== 'string' || token.length < 32 || token.length > 4096) {
            res.status(400).json({ success: false, message: 'Geçersiz push token' });
            return;
        }

        await PushService.registerToken(userId, token, typeof platform === 'string' ? platform : 'android', locale);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

/** Kullanıcı bildirimleri kapattığında / çıkış yaptığında token'ı siler. */
export const removePushToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = requireUser(req, res);
        if (userId === null) return;

        const { token } = req.body ?? {};
        if (typeof token !== 'string') {
            res.status(400).json({ success: false, message: 'token zorunludur' });
            return;
        }
        await PushService.removeToken(token, userId);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};
