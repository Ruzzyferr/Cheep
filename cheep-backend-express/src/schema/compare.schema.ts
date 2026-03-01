import Joi from 'joi';

export const compareListSchema = Joi.object({
    maxStores: Joi.number().integer().min(1).max(5).default(3).messages({
        'number.min': 'Minimum 1 market seçilmeli',
        'number.max': 'Maksimum 5 market seçilebilir',
    }),
    userLocation: Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lon: Joi.number().min(-180).max(180).required(),
    }).optional().allow(null),
    favoriteStoreIds: Joi.array().items(Joi.number().integer()).optional().allow(null),
    includeMissingProducts: Joi.boolean().default(true),
});

