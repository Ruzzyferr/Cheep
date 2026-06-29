import Joi from 'joi';

export const trackClickSchema = Joi.object({
    storeId: Joi.number().integer().positive().required().messages({
        'any.required': 'storeId zorunludur',
    }),
    listId: Joi.number().integer().positive().optional(),
    productId: Joi.number().integer().positive().optional(),
    context: Joi.string().valid('cart', 'product', 'store').optional(),
});
