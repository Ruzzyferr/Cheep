import { type Request, type Response, type NextFunction } from 'express';
import * as StoreService from './stores.service.js';

export const getAllStores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stores = await StoreService.getAllStores();
        res.status(200).json({
            success: true,
            data: stores,
        });
    } catch (error) {
        next(error);
    }
};

export const getStoreById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const store = await StoreService.getStoreById(parseInt(req.params.id));
        if (!store) {
            res.status(404).json({ 
                success: false,
                message: 'Market bulunamadı',
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: store,
        });
    } catch (error) {
        next(error);
    }
};

export const createStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const store = await StoreService.createStore(req.body);
        res.status(201).json(store);
    } catch (error) {
        next(error);
    }
};

export const updateStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const store = await StoreService.updateStore(parseInt(req.params.id), req.body);
        res.status(200).json(store);
    } catch (error) {
        next(error);
    }
};

export const deleteStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await StoreService.deleteStore(parseInt(req.params.id));
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};