import Joi from 'joi';
import { SORT_MODES } from './product-filter.js';

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const createProductSchema = Joi.object({
    name: Joi.string().min(2).max(255).required().messages({
        'string.empty': 'Ürün adı boş olamaz',
        'string.min': 'Ürün adı en az 2 karakter olmalıdır',
        'string.max': 'Ürün adı en fazla 255 karakter olmalıdır',
        'any.required': 'Ürün adı zorunludur',
    }),
    brand: Joi.string().max(100).optional().allow(null, ''),
    ean_barcode: Joi.string().max(50).optional().allow(null, ''),
    image_url: Joi.string().uri().optional().allow(null, ''),
    category_id: Joi.string().optional().allow(null, ''),
    muadil_grup_id: Joi.string().optional().allow(null, ''),
});

export const updateProductSchema = Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    brand: Joi.string().max(100).optional().allow(null, ''),
    ean_barcode: Joi.string().max(50).optional().allow(null, ''),
    image_url: Joi.string().uri().optional().allow(null, ''),
    category_id: Joi.string().optional().allow(null, ''),
    muadil_grup_id: Joi.string().optional().allow(null, ''),
}).min(1);

/**
 * Ürün listeleme sorgusu.
 *
 * Website'nin ürünler sayfası bu uçtan besleniyor: kategori ağacı, market
 * çipleri, sıralama ve fiyat aralığı. Bilinmeyen sıralama SESSİZCE varsayılana
 * düşmez — kullanıcı istediğinden farklı bir sıra görüp bunu fark etmemeli.
 */
export const getProductsQuerySchema = Joi.object({
    category_id: Joi.alternatives().try(
        Joi.number().integer(),
        Joi.string()
    ).optional(),
    // Website URL'leri slug tabanlı; id'yi istemciye taşımak gereksiz bağ kurardı.
    category_slug: Joi.string().max(120).optional(),
    // Virgüllü çoklu market: ?store_slug=bim,a101 → ['bim','a101']
    store_slug: Joi.string()
        .max(400)
        .custom((value: string) =>
            value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0),
        )
        .optional(),
    brand: Joi.string().optional(),
    search: Joi.string().optional(),
    sort: Joi.string().valid(...SORT_MODES).optional(),
    min_stores: Joi.number().integer().min(1).max(20).optional(),
    min_price: Joi.number().min(0).optional(),
    max_price: Joi.number().min(0).optional(),
    // Facet sayıları (website filtre paneli). İki fazladan toplu sorgu demek;
    // mobil listeler istemez, bu yüzden varsayılan kapalı.
    facets: Joi.boolean().truthy('1').falsy('0').default(false),
    limit: Joi.number().integer().min(1).max(500).default(50),
    offset: Joi.number().integer().min(0).default(0),
});