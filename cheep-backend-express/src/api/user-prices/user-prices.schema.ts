import Joi from 'joi';

/**
 * Fiyat bildirimi doğrulaması.
 *
 * Üst sınır servis katmanında DA var — çift kontrol bilerek: şema HTTP
 * sınırında, servis ise doğrudan çağrılarda (ileride bir iş ya da içe
 * aktarma) korur.
 */
export const createUserPriceSchema = Joi.object({
    product_id: Joi.number().integer().positive().required().messages({
        'number.base': 'product_id bir sayı olmalıdır',
        'any.required': 'product_id zorunludur',
    }),
    store_id: Joi.number().integer().positive().required().messages({
        'number.base': 'store_id bir sayı olmalıdır',
        'any.required': 'store_id zorunludur',
    }),
    price: Joi.number().positive().max(100000).required().messages({
        'number.positive': 'Fiyat sıfırdan büyük olmalıdır',
        'number.max': 'Fiyat beklenen aralığın dışında',
        'any.required': 'price zorunludur',
    }),
    unit: Joi.string().min(1).max(20).optional(),
});
