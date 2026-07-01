import { type Request, type Response, type NextFunction } from 'express';
import * as StoreService from './stores.service.js';
import * as StoreBranchService from '../../services/store-branch.service.js';

export const getAllStores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stores = await StoreService.getAllStores(req.country?.id);
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

export const getNearbyStores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            res.status(400).json({ success: false, message: 'lat ve lon zorunludur' });
            return;
        }
        const countryId = req.country?.id;
        if (!countryId) {
            res.status(200).json({ success: true, data: [] });
            return;
        }
        const nearby = await StoreBranchService.getNearbyStores(countryId, { lat, lon });
        res.status(200).json({
            success: true,
            data: nearby.map(n => ({
                store_id: n.store_id,
                distanceKm: Math.round(n.distanceKm * 10) / 10,
                branch: n.branch,
            })),
        });
    } catch (error) {
        next(error);
    }
};