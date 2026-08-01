import { param } from '../../utils/request-params.js';
import { type Request, type Response, type NextFunction } from 'express';
import * as ProductService from './products.service.js';
import {productMatcher} from "./product-matcher.service.js";
import { getProfile } from '../profile/profile.service.js';
import { evaluateProductConstraints } from '../../services/product-constraints.js';
import { localizeCategory, type Lang } from '../../config/category-i18n.js';

/**
 * Ürün yanıtındaki kategori adını istemcinin diline çevirir.
 *
 * SIRALAMA ÖNEMLİ: diyet/alerjen değerlendirmesi
 * (`evaluateProductConstraints`) kategori adının TÜRKÇE olmasına dayanır —
 * kural tablosu Türkçe anahtarlarla yazılı. Çeviri o adımdan SONRA yapılır,
 * yoksa İngilizce arayüzde tüm diyet uyarıları sessizce kaybolurdu.
 */
function localizeProductCategory<T extends { category?: { name: string; slug: string | null } | null }>(
    products: T[],
    lang: Lang,
): T[] {
    if (lang === 'tr') return products;
    return products.map((p) => {
        if (!p.category?.slug) return p;
        const localized = localizeCategory(lang, p.category.name, p.category.slug);
        return { ...p, category: { ...p.category, ...localized } };
    });
}

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            category_id,
            brand,
            search,
            limit = 50,
            offset = 0
        } = req.query;

        const result = await ProductService.getAllProducts({
            category_id: category_id ? Number(category_id) : undefined,
            brand: brand as string | undefined,
            search: search as string | undefined,
            limit: Number(limit),
            offset: Number(offset),
            countryId: req.country?.id,
        });

        let products: (typeof result.products[number] & { constraint?: { hidden: boolean; warnings: string[] } })[] = result.products;

        if (req.user) {
            const profile = await getProfile(req.user.id);
            if (profile) {
                products = result.products.map(p => ({
                    ...p,
                    constraint: evaluateProductConstraints(
                        (p as any).category?.name ?? null,
                        {
                            diet: profile.diet ?? undefined,
                            avoid: Array.isArray(profile.avoid) ? (profile.avoid as string[]) : undefined,
                            allergies: Array.isArray(profile.allergies) ? (profile.allergies as string[]) : undefined,
                        }
                    ),
                }));
            }
        }

        res.status(200).json({
            success: true,
            data: localizeProductCategory(products, req.lang ?? 'tr'),
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const product = await ProductService.getProductById(Number(id), req.country?.id);
        res.status(200).json({
            success: true,
            data: localizeProductCategory([product], req.lang ?? 'tr')[0]
        });
    } catch (error) {
        next(error);
    }
};

export const getProductByBarcode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const barcode = param(req.params.barcode);
        const product = await ProductService.getProductByBarcode(barcode, req.country?.id);
        res.status(200).json(product);
    } catch (error) {
        next(error);
    }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const product = await ProductService.createProduct(req.body);
        res.status(201).json(product);
    } catch (error) {
        next(error);
    }
};

export const upsertProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const product = await ProductService.upsertProduct(req.body);
        res.status(200).json(product);
    } catch (error) {
        next(error);
    }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const product = await ProductService.updateProduct(Number(id), req.body);
        res.status(200).json(product);
    } catch (error) {
        next(error);
    }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await ProductService.deleteProduct(Number(id));
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const getProductPrices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const prices = await ProductService.getProductPrices(Number(id), req.country?.id);
        res.status(200).json(prices);
    } catch (error) {
        next(error);
    }
};

export const getProductPriceHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const days = req.query.days ? Number(req.query.days) : 90;
        const history = await ProductService.getProductPriceHistory(Number(id), days, req.country?.id);
        res.status(200).json(history);
    } catch (error) {
        next(error);
    }
};

export const compareProductPrices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const comparison = await ProductService.compareProductPrices(Number(id), req.country?.id);
        res.status(200).json(comparison);
    } catch (error) {
        next(error);
    }
};

export const findOrCreateProduct = async (data: {
    name: string;
    brand?: string;
    quantity?: number;
    unit?: string;
    category_id?: string;
    image_url?: string;
}) => {
    const result = await productMatcher.findOrCreateProduct(data);

    return {
        product: result.product,
        isNew: result.isNew,
        message: result.isNew
            ? 'Yeni ürün oluşturuldu'
            : 'Mevcut ürün eşleştirildi',
    };
};

/**
 * Debug - benzer ürünleri göster
 */
export const debugSimilarProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, brand } = req.query;
        
        if (!name || typeof name !== 'string') {
            res.status(400).json({
                success: false,
                message: 'name parametresi gerekli',
            });
            return;
        }
        
        const results = await productMatcher.debugSimilarProducts(
            name,
            brand ? String(brand) : undefined
        );
        
        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Manuel ürün birleştirme
 */
export const mergeProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sourceProductId, targetProductId } = req.body;
        
        if (!sourceProductId || !targetProductId) {
            res.status(400).json({
                success: false,
                message: 'sourceProductId ve targetProductId gerekli',
            });
            return;
        }
        
        const result = await productMatcher.mergeProducts(
            parseInt(sourceProductId),
            parseInt(targetProductId)
        );
        
        res.status(200).json({
            success: true,
            data: result,
            message: 'Ürünler başarıyla birleştirildi',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Tüm ürünler için fingerprint oluştur (migration)
 */
export const generateFingerprints = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await productMatcher.generateFingerprintsForAll();
        
        res.status(200).json({
            success: true,
            data: result,
            message: 'Fingerprint oluşturma tamamlandı',
        });
    } catch (error) {
        next(error);
    }
};
