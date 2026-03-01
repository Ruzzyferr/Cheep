import { type Request, type Response, type NextFunction } from 'express';
import * as AuthService from './auth.service.js'; // <-- .js uzantısı

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name } = req.body;
        const result = await AuthService.registerUser(email, password, name);
        res.status(201).json({
            success: true,
            token: result.token,
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
            user: result.user
        });
    } catch (error) {
        next(error);
    }
};