import Joi from 'joi';

export const createPriceFeedbackSchema = Joi.object({
    store_price_id: Joi.number().integer().required().messages({
        'number.base': 'store_price_id bir sayı olmalıdır',
        'any.required': 'store_price_id zorunludur',
    }),
    is_accurate: Joi.boolean().required().messages({
        'boolean.base': 'is_accurate boolean olmalıdır',
        'any.required': 'is_accurate zorunludur',
    }),
    suggested_price: Joi.number().positive().allow(null).optional(),
    comment: Joi.string().max(500).allow(null, '').optional(),
});

