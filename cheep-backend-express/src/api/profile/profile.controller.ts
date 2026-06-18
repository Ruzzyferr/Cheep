import { type Request, type Response, type NextFunction } from 'express';
import * as ProfileService from './profile.service.js';

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const profile = await ProfileService.getProfile(req.user.id);
        res.status(200).json({ success: true, data: profile });
    } catch (error) {
        next(error);
    }
};

export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const profile = await ProfileService.upsertProfile(req.user.id, req.body);
        res.status(200).json({ success: true, data: profile });
    } catch (error) {
        next(error);
    }
};
