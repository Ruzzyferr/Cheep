import { type Request, type Response, type NextFunction } from 'express';
import * as CategoryService from './categories.service.js';
import { categoryMatcher } from './category-matcher.service.js';

/**
 * Tüm kategorileri getir (düz liste)
 */
export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await CategoryService.getAllCategories();
        res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Sadece ana kategorileri getir
 */
export const getParentCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await CategoryService.getParentCategories();
        res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Hiyerarşik tree yapısını getir
 */
export const getCategoryTree = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tree = await CategoryService.getCategoryTree();
        res.status(200).json(tree);
    } catch (error) {
        next(error);
    }
};

/**
 * ID'ye göre kategori getir
 */
export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        const category = await CategoryService.getCategoryById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Kategori bulunamadı',
            });
        }

        res.status(200).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Slug'a göre kategori getir
 */
export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const category = await CategoryService.getCategoryBySlug(slug);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Kategori bulunamadı',
            });
        }

        res.status(200).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Bir kategorinin alt kategorilerini getir
 */
export const getSubcategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        const subcategories = await CategoryService.getSubcategories(id);
        res.status(200).json({
            success: true,
            data: subcategories,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Kategori oluştur veya bul (Smart Matching)
 * 🔥 YENİ: Category Matcher kullanarak otomatik eşleştir
 * - Scraper'lar sadece isim gönderir
 * - Backend otomatik parent bulur ve eşleştirir
 */
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, parent_id, slug } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Kategori adı gerekli',
                error: 'NAME_REQUIRED'
            });
        }
        
        // 🔥 Smart Matching: Eğer slug YOK ve parent_id YOK ise CategoryMatcher kullan
        // (Bu durumda scraper'dan geliyordur)
        if (!slug && (parent_id === null || parent_id === undefined)) {
            const productName = req.body.product_name; // Opsiyonel: Ürün adı (daha iyi eşleştirme için)
            console.log(`🔍 Category Matcher: Finding or creating "${name}"${productName ? ` (product: "${productName}")` : ''}`);
            
            try {
                const categoryId = await categoryMatcher.findOrCreateCategory(name, productName);
                const category = await CategoryService.getCategoryById(categoryId);
                
                return res.status(200).json({
                    success: true,
                    data: category,
                    message: 'Kategori eşleştirildi veya oluşturuldu (smart matching)',
                });
            } catch (matchError: any) {
                console.error(`❌ Category Matcher error for "${name}":`, matchError);
                return res.status(500).json({
                    success: false,
                    message: 'Kategori eşleştirme hatası',
                    error: matchError?.message || 'Unknown error'
                });
            }
        }
        
        // Admin tarafından gönderilmişse, direkt oluştur
        // (slug varsa veya parent_id varsa)
        const category = await CategoryService.createCategory(req.body);
        res.status(201).json({
            success: true,
            data: category,
            message: 'Kategori oluşturuldu',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Kategori güncelle
 */
export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        const category = await CategoryService.updateCategory(id, req.body);
        res.status(200).json(category);
    } catch (error) {
        next(error);
    }
};

/**
 * Kategori sil
 */
export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        await CategoryService.deleteCategory(id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Breadcrumb getir
 */
export const getCategoryBreadcrumb = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        const breadcrumb = await CategoryService.getCategoryBreadcrumb(id);
        res.status(200).json(breadcrumb);
    } catch (error) {
        next(error);
    }
};

/**
 * Kategori ürün sayısı
 */
export const getCategoryProductCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        const includeChildren = req.query.includeChildren === 'true';
        const count = await CategoryService.getCategoryProductCount(id, includeChildren);
        res.status(200).json({ count });
    } catch (error) {
        next(error);
    }
};

