import { intParam, param } from '../../utils/request-params.js';
import { type Request, type Response, type NextFunction } from 'express';
import * as CategoryService from './categories.service.js';
import { categoryMatcher } from './category-matcher.service.js';
import logger from '../../utils/logger.js';

/**
 * Kategori uçları ÜLKEYE göre süzer. `req.country` `resolveCountry`
 * middleware'inden gelir ve her zaman doludur (bilinmeyen kod 400 alır).
 */
const countryIdOf = (req: Request): number => req.country!.id;

/**
 * Tüm kategorileri getir (düz liste)
 */
export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await CategoryService.getAllCategories(countryIdOf(req));
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
        const categories = await CategoryService.getParentCategories(countryIdOf(req));
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
        const tree = await CategoryService.getCategoryTree(countryIdOf(req));
        res.status(200).json({ success: true, data: tree });
    } catch (error) {
        next(error);
    }
};

/**
 * ID'ye göre kategori getir
 */
export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = intParam(req.params.id);
        const category = await CategoryService.getCategoryById(id, countryIdOf(req));

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
        const slug = param(req.params.slug);
        const category = await CategoryService.getCategoryBySlug(slug, countryIdOf(req));

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
        const id = intParam(req.params.id);
        const subcategories = await CategoryService.getSubcategories(id, countryIdOf(req));
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
 * - Scraper'lar sadece isim gönderir
 * - Backend otomatik parent bulur ve eşleştirir
 */
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, parent_id, slug } = req.body;
        const countryId = countryIdOf(req);

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Kategori adı gerekli',
                error: 'NAME_REQUIRED'
            });
        }

        // Smart Matching: slug YOK ve parent_id YOK ise CategoryMatcher kullan
        // (bu durumda scraper'dan geliyordur)
        if (!slug && (parent_id === null || parent_id === undefined)) {
            const productName = req.body.product_name;
            logger.debug(`[Categories] Matcher: "${name}"${productName ? ` (product: "${productName}")` : ''}`);

            try {
                const categoryId = await categoryMatcher.findOrCreateCategory(name, countryId, productName);
                const category = await CategoryService.getCategoryById(categoryId, countryId);

                return res.status(200).json({
                    success: true,
                    data: category,
                    message: 'Kategori eşleştirildi veya oluşturuldu (smart matching)',
                });
            } catch (matchError: any) {
                logger.error(`[Categories] Matcher error for "${name}": ${matchError?.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Kategori eşleştirme hatası',
                    error: matchError?.message || 'Unknown error'
                });
            }
        }

        // Admin tarafından gönderilmişse, direkt oluştur (slug veya parent_id varsa)
        const category = await CategoryService.createCategory({ ...req.body, country_id: countryId });
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
        const id = intParam(req.params.id);
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
        const id = intParam(req.params.id);
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
        const id = intParam(req.params.id);
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
        const id = intParam(req.params.id);
        const includeChildren = req.query.includeChildren === 'true';
        const count = await CategoryService.getCategoryProductCount(id, countryIdOf(req), includeChildren);
        res.status(200).json({ count });
    } catch (error) {
        next(error);
    }
};
