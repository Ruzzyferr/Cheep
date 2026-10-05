import type { Request, Response, NextFunction } from 'express';
import * as Service from './user-prices.service.js';

export const create = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user_id = (req as any).user.id as number;
        const sonuc = await Service.bildirimOlustur({ user_id, ...req.body });
        res.status(201).json({ success: true, data: sonuc });
    } catch (e) {
        next(e);
    }
};

export const mine = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user_id = (req as any).user.id as number;
        res.json({ success: true, data: await Service.bildirimlerim(user_id) });
    } catch (e) {
        next(e);
    }
};
