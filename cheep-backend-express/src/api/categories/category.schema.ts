import Joi from "joi";

export const createCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.empty': 'Kategori adı boş olamaz',
        'any.required': 'Kategori adı zorunludur',
    }),
    // 🔥 Slug artık opsiyonel! CategoryMatcher otomatik oluşturur
    slug: Joi.string().min(2).max(100).pattern(/^[a-z0-9-]+$/).optional().messages({
        'string.pattern.base': 'Slug sadece küçük harf, rakam ve tire içerebilir',
    }),
    parent_id: Joi.number().integer().positive().optional().allow(null),
    display_order: Joi.number().integer().min(0).default(0),
    icon_url: Joi.string().max(255).optional().allow(null, ''),
});

export const updateCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    slug: Joi.string().min(2).max(100).pattern(/^[a-z0-9-]+$/).optional().messages({
        'string.pattern.base': 'Slug sadece küçük harf, rakam ve tire içerebilir',
    }),
    parent_id: Joi.number().integer().positive().optional().allow(null),
    display_order: Joi.number().integer().min(0).optional(),
    icon_url: Joi.string().max(255).optional().allow(null, ''),
}).min(1);

