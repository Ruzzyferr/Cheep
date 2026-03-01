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

        const { status } = req.query; // active, completed, all
        const lists = await ListService.getUserLists(req.user.id, status as string);
        
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
        const list = await ListService.getListById(parseInt(id), req.user.id);
        
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

        const list = await ListService.createList(req.user.id, req.body);
        
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
 * Liste güncelle
 */
export const updateList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const list = await ListService.updateList(parseInt(id), req.user.id, req.body);
        
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
        const result = await ListService.deleteList(parseInt(id), req.user.id);
        
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
        const stats = await ListService.getListStatistics(parseInt(id), req.user.id);
        
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
        const templates = await ListService.getTemplates();
        
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

        const { templateId } = req.params;
        const { name } = req.body;
        
        const list = await ListService.createFromTemplate(
            req.user.id,
            parseInt(templateId),
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
            parseInt(completedListId),
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
            parseInt(completedListId),
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
        const item = await ListService.addItemToList(parseInt(id), req.user.id, req.body);
        
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
        const item = await ListService.updateListItem(parseInt(itemId), req.user.id, req.body);
        
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
            parseInt(id),
            parseInt(itemId),
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
        const result = await ListService.clearList(parseInt(id), req.user.id);
        
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

