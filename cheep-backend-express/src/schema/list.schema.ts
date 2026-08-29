import Joi from "joi";
import { ALLOWED_UNITS_MUTABLE } from '../config/units.js';

export const createListSchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.empty': 'Liste adı boş olamaz',
        'any.required': 'Liste adı zorunludur',
    }),
    // `is_template` ISTEMCIDEN ALINMIYOR (bilerek kaldirildi).
    //
    // Bu bayrak listeyi `GET /lists/templates/all` ucuna dusuruyor; o uc
    // KIMLIK DOGRULAMASIZ ve her sablonu list_items + product ile birlikte,
    // ustelik `user_id` alanini da tasiyarak donduruyor. Yani herhangi bir
    // kullanici tek bir PUT ile hem kendi listesini ve kullanici kimligini
    // internete acabiliyor, hem de istedigi icerigi (spam, taciz) butun
    // kullanicilarin gordugu galeriye koyabiliyordu -- hicbir moderasyon yok.
    // Sablonlar kurulmus (seed) icerik olmali; kullanici uretimi degil.
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
    // is_template: bkz. createListSchema -- istemciden kabul edilmiyor.
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
        .valid(...ALLOWED_UNITS_MUTABLE)
        .default('adet'),
    brand_independent: Joi.boolean().optional(),
});

export const updateListItemSchema = Joi.object({
    quantity: Joi.number().positive().optional(),
    unit: Joi.string()
        .valid(...ALLOWED_UNITS_MUTABLE)
        .optional(),
    brand_independent: Joi.boolean().optional(),
}).min(1);

export const importSchema = Joi.object({
    sourceId: Joi.number().integer().positive().required(),
    mode: Joi.string().valid('merge', 'replace').required(),
});