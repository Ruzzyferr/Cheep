import { type Request, type Response, type NextFunction } from 'express';
import * as UserService from './users.service.js';

/**
 * Giriş yapmış kullanıcının bilgilerini getirir
 */
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // authenticate middleware'den gelen user bilgisi
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: req.user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Kullanıcı profilini günceller
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        const { name, country_code, language } = req.body;
        const updatedUser = await UserService.updateUser(req.user.id, { name, country_code, language });

        res.status(200).json({
            success: true,
            data: updatedUser,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Hesabı ve tüm verileri kalıcı olarak siler (giriş yapmış kullanıcı — mobil buton)
 */
export const deleteMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        await UserService.deleteUser(req.user.id);

        res.status(200).json({
            success: true,
            message: 'Hesabınız ve tüm verileriniz kalıcı olarak silindi.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Hesap silme talebi (uygulamasız web formu — cheep.live/delete).
 * E-posta + şifre ile doğrular, sonra kalıcı siler.
 */
export const requestAccountDeletion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body ?? {};
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: 'E-posta ve şifre gereklidir.',
            });
            return;
        }

        await UserService.deleteAccountByCredentials(email, password);

        res.status(200).json({
            success: true,
            message: 'Hesabınız ve tüm verileriniz kalıcı olarak silindi.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Favori marketleri getir
 */
export const getFavoriteStores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        const stores = await UserService.getFavoriteStores(req.user.id);

        res.status(200).json({
            success: true,
            data: stores,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Favori markete ekle
 */
export const addFavoriteStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        const { storeId } = req.params;
        const result = await UserService.addFavoriteStore(req.user.id, parseInt(storeId));

        res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Favorilerden çıkar
 */
export const removeFavoriteStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        const { storeId } = req.params;
        const result = await UserService.removeFavoriteStore(req.user.id, parseInt(storeId));

        res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
};

