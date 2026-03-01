import Joi from "joi";

export const createListSchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.empty': 'Liste adı boş olamaz',
        'any.required': 'Liste adı zorunludur',
    }),
    is_template: Joi.boolean().default(false),
    budget: Joi.alternatives()
        .try(
            Joi.number().positive(),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        )
        .optional()
        .allow(null),
});

export const updateListSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    is_template: Joi.boolean().optional(),
    budget: Joi.alternatives()
        .try(
            Joi.number().positive(),
            Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
        )
        .optional()
        .allow(null),
}).min(1);

export const addListItemSchema = Joi.object({
    product_id: Joi.number().integer().required().messages({
        'any.required': 'Ürün ID zorunludur',
    }),
    quantity: Joi.number().positive().default(1).messages({
        'number.positive': 'Miktar pozitif olmalıdır',
    }),
    unit: Joi.string()
        .valid('adet', 'kg', 'g', 'l', 'ml', 'cl', 'paket', 'kutu')
        .default('adet'),
});

export const updateListItemSchema = Joi.object({
    quantity: Joi.number().positive().optional(),
    unit: Joi.string()
        .valid('adet', 'kg', 'g', 'l', 'ml', 'cl', 'paket', 'kutu')
        .optional(),
}).min(1);