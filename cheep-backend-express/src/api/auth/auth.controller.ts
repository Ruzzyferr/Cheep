import { type Request, type Response, type NextFunction } from 'express';
import * as AuthService from './auth.service.js'; // <-- .js uzantısı

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name } = req.body;
        const result = await AuthService.registerUser(email, password, name);
        res.status(201).json({
            success: true,
            token: result.token,
            refreshToken: result.refreshToken,
            user: result.user
        });
    } catch (error) {
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const result = await AuthService.loginUser(email, password);
        res.status(200).json({
            success: true,
            token: result.token,
            refreshToken: result.refreshToken,
            user: result.user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * E-posta doğrulama: kullanıcı 6 haneli kodu gönderir; doğruysa hesap doğrulanır.
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { code } = req.body;
        const result = await AuthService.verifyEmailCode(req.user!.id, String(code));
        res.status(200).json({ success: true, user: result.user });
    } catch (error) {
        next(error);
    }
};

/**
 * Doğrulama kodunu yeniden gönderir.
 */
export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await AuthService.resendVerification(req.user!.id);
        res.status(200).json({ success: true, message: 'Doğrulama kodu e-postana gönderildi.' });
    } catch (error) {
        next(error);
    }
};

export const refresh = async (req: Request, res: Response, _next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({ success: false, message: 'refreshToken zorunludur.' });
            return;
        }
        const tokens = await AuthService.refreshAccessToken(refreshToken);
        res.status(200).json({ success: true, ...tokens });
    } catch (error) {
        // Refresh hatası 401 olmalı (yeniden login gerekir)
        res.status(401).json({ success: false, message: (error as Error).message });
    }
};

/**
 * Çıkış: kullanıcının tüm refresh token'larını geçersiz kılar (token_version bump).
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await AuthService.logoutUser(req.user!.id);
        res.status(200).json({ success: true, message: 'Çıkış yapıldı.' });
    } catch (error) {
        next(error);
    }
};

/**
 * Parola değiştirme: mevcut parolayı doğrular, yenisini yazar, eski oturumları sonlandırır.
 * Çağırana taze access/refresh çifti döner.
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const tokens = await AuthService.changePassword(
            req.user!.id,
            currentPassword,
            newPassword
        );
        res.status(200).json({ success: true, ...tokens });
    } catch (error) {
        next(error);
    }
};