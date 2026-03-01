import Joi from "joi";
import {upsertStorePriceSchema} from "../store-prices/store-price.schema.js";

export const createStoreSchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.empty': 'Market adı boş olamaz',
        'any.required': 'Market adı zorunludur',
    }),
    logo_url: Joi.string().uri().optional().allow(null, ''),
    address: Joi.string().max(255).optional().allow(null, ''),
    lat: Joi.number().min(-90).max(90).optional().allow(null),
    lon: Joi.number().min(-180).max(180).optional().allow(null),
});

export const updateStoreSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    logo_url: Joi.string().uri().optional().allow(null, ''),
    address: Joi.string().max(255).optional().allow(null, ''),
    lat: Joi.number().min(-90).max(90).optional().allow(null),
    lon: Joi.number().min(-180).max(180).optional().allow(null),
}).min(1);

