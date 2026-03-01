import Joi from 'joi';

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
    barcode: Joi.string().max(50).optional().allow(null, ''),
    image_url: Joi.string().uri().optional().allow(null, ''),
    category_id: Joi.string().optional().allow(null, ''),
    muadil_grup_id: Joi.string().optional().allow(null, ''),
});

export const updateProductSchema = Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    brand: Joi.string().max(100).optional().allow(null, ''),
    barcode: Joi.string().max(50).optional().allow(null, ''),
    image_url: Joi.string().uri().optional().allow(null, ''),
    category_id: Joi.string().optional().allow(null, ''),
    muadil_grup_id: Joi.string().optional().allow(null, ''),
}).min(1);

export const getProductsQuerySchema = Joi.object({
    category_id: Joi.alternatives().try(
        Joi.number().integer(),
        Joi.string()
    ).optional(),
    brand: Joi.string().optional(),
    search: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(500).default(50),  // 🔥 Max: 100 → 500, Default: 20 → 50
    offset: Joi.number().integer().min(0).default(0),
});