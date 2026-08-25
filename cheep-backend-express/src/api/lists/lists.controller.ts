import { intParam } from '../../utils/request-params.js';
import { type Request, type Response, type NextFunction } from 'express';
import * as ListService from './lists.service.js';

// ============================================
// LIST CRUD
// ============================================

/**
 * Kullanıcının tüm listelerini getir
 */
export const getMyLists = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        if (!req.country) {
            res.status(400).json({ success: false, message: 'Ülke belirlenemedi' });
            return;
        }

        const lists = await ListService.getUserLists(req.user.id, req.country.id);

        res.status(200).json({
            success: true,
            data: lists,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Liste detayını getir
 */
export const getListById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const list = await ListService.getListById(intParam(id), req.user.id);
        
        res.status(200).json({
            success: true,
            data: list,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Yeni liste oluştur
 */
export const createList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        if (!req.country) {
            res.status(400).json({ success: false, message: 'Ülke belirlenemedi' });
            return;
        }

        const list = await ListService.createList(req.user.id, req.country.id, req.body);
        
        res.status(201).json({
            success: true,
            data: list,
            message: 'Liste başarıyla oluşturuldu',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listeyi aktif yap
 */
export const activateList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const listId = Number(req.params.id);
        const result = await ListService.activateList(listId, req.user.id);
        if (!result) {
            res.status(404).json({ success: false, message: 'Liste bulunamadı' });
            return;
        }
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Listeyi klonla (yeni pasif liste)
 */
export const cloneList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const result = await ListService.cloneList(Number(req.params.id), req.user.id);
        if (!result) {
            res.status(404).json({ success: false, message: 'Liste bulunamadı' });
            return;
        }
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Başka listeden aktar (merge/replace)
 */
export const importFromList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { sourceId, mode } = req.body;
        const result = await ListService.importFromList(Number(req.params.id), sourceId, mode, req.user.id);
        if (!result) {
            res.status(404).json({ success: false, message: 'Liste bulunamadı veya geçersiz kaynak' });
            return;
        }
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Liste güncelle
 */
export const updateList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const list = await ListService.updateList(intParam(id), req.user.id, req.body);
        
        res.status(200).json({
            success: true,
            data: list,
            message: 'Liste güncellendi',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Liste sil
 */
export const deleteList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const result = await ListService.deleteList(intParam(id), req.user.id);
        
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Liste istatistikleri
 */
export const getListStatistics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const stats = await ListService.getListStatistics(intParam(id), req.user.id);
        
        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// TEMPLATES
// ============================================

/**
 * Tüm şablonları getir (public)
 */
export const getTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const templates = await ListService.getTemplates(req.country?.id);
        
        res.status(200).json({
            success: true,
            data: templates,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Şablondan liste oluştur
 */
export const createFromTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        if (!req.country) {
            res.status(400).json({ success: false, message: 'Ülke belirlenemedi' });
            return;
        }

        const { templateId } = req.params;
        const { name } = req.body;

        const list = await ListService.createFromTemplate(
            req.user.id,
            intParam(templateId),
            req.country.id,
            name
        );
        
        res.status(201).json({
            success: true,
            data: list,
            message: 'Şablondan liste oluşturuldu',
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// COMPLETED LIST IMPORT/REUSE
// ============================================

/**
 * Geçmiş listeden MEVCUT LİSTEYE EKLE (Merge)
 */
export const importFromCompletedList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { completedListId } = req.params;
        const { targetListId } = req.body;
        
        const result = await ListService.importFromCompletedList(
            req.user.id,
            intParam(completedListId),
            targetListId
        );
        
        res.status(200).json({
            success: true,
            data: result.list,
            stats: result.stats,
            message: `✅ ${result.stats.added} ürün eklendi, ${result.stats.skipped} ürün zaten mevcuttu`,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Geçmiş listeden YENİ LİSTE OLUŞTUR (Replace - eski liste SİLİNİR!)
 */
export const replaceWithCompletedList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { completedListId } = req.params;
        const { oldActiveListId } = req.body; // Silinecek eski liste (opsiyonel)
        
        const newList = await ListService.replaceWithCompletedList(
            req.user.id,
            intParam(completedListId),
            oldActiveListId
        );
        
        res.status(201).json({
            success: true,
            data: newList,
            message: oldActiveListId 
                ? '✅ Eski liste silindi ve geçmiş listeden yeni liste oluşturuldu' 
                : '✅ Geçmiş listeden yeni liste oluşturuldu',
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// LIST ITEMS
// ============================================

/**
 * Listeye ürün ekle
 */
export const addItemToList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const item = await ListService.addItemToList(intParam(id), req.user.id, req.body);
        
        res.status(201).json({
            success: true,
            data: item,
            message: 'Ürün listeye eklendi',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Liste item'ı güncelle
 */
export const updateListItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { itemId } = req.params;
        const item = await ListService.updateListItem(intParam(itemId), req.user.id, req.body);
        
        res.status(200).json({
            success: true,
            data: item,
            message: 'Ürün güncellendi',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listeden ürün çıkar
 */
export const removeItemFromList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id, itemId } = req.params;
        const result = await ListService.removeItemFromList(
            intParam(id),
            intParam(itemId),
            req.user.id
        );
        
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Listedeki tüm ürünleri sil
 */
export const clearList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const result = await ListService.clearList(intParam(id), req.user.id);
        
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

