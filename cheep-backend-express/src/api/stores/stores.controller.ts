import { intParam } from '../../utils/request-params.js';
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
        const store = await StoreService.getStoreById(intParam(req.params.id));
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
        const store = await StoreService.updateStore(intParam(req.params.id), req.body);
        res.status(200).json(store);
    } catch (error) {
        next(error);
    }
};

export const deleteStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await StoreService.deleteStore(intParam(req.params.id));
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
        // `radius` (km) İSTEĞE BAĞLI. Verilmezse davranış eskisiyle birebir aynı
        // kalır (mobil konum kapısı geniş kümeyi isteyip kendi süzer). Verilirse
        // gerçek mesafeyle süzülür — daha önce parametre sessizce YOK SAYILIYORDU,
        // yani `radius=1` diyen bir çağıran 4,6 km'deki şubeyi "yakın" sanıyordu.
        // Geçersiz/negatif değer sessizce yok sayılmaz: 400 döner, çünkü sessiz
        // yok sayma tam da bu hatanın kaynağıydı.
        let radiusKm: number | undefined;
        if (req.query.radius !== undefined) {
            const r = Number(req.query.radius);
            if (!Number.isFinite(r) || r <= 0) {
                res.status(400).json({ success: false, message: 'radius pozitif bir sayı olmalıdır' });
                return;
            }
            radiusKm = Math.min(r, StoreBranchService.MAX_BRANCH_DISTANCE_KM);
        }
        const countryId = req.country?.id;
        if (!countryId) {
            res.status(200).json({ success: true, data: [] });
            return;
        }
        const nearby = await StoreBranchService.getNearbyStores(countryId, { lat, lon }, undefined, radiusKm);
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
