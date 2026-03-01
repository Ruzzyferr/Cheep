import Joi from "joi";

// ++ GÜNCELLENMİŞ ŞEMA: Artık ürün bilgilerini de içeriyor
export const upsertStorePriceSchema = Joi.object({
    // Fiyat Bilgileri
    store_id: Joi.number().integer().required().messages({
        'number.base': 'store_id sayı olmalıdır',
        'any.required': 'store_id zorunludur'
    }),
    product_id: Joi.number().integer().optional(), // Artık zorunlu değil, SKU'dan bulacağız
    store_sku: Joi.string().required().messages({
        'any.required': 'store_sku zorunludur'
    }),
    price: Joi.alternatives().try(Joi.number().positive(), Joi.string().pattern(/^\d+(\.\d{1,2})?$/)).required(),
    unit: Joi.string().valid('adet', 'kg', 'g', 'l', 'ml', 'cl', 'paket', 'kutu').default('adet'),
    source: Joi.string().valid('scrape', 'api', 'user').default('scrape'),
    confidence_score: Joi.number().min(0).max(1).default(1.0),

    // Ürün Bilgileri
    name: Joi.string().min(2).max(255).required(),
    brand: Joi.string().max(100).optional().allow(null, ''),
    ean_barcode: Joi.string().max(50).optional().allow(null, ''),
    image_url: Joi.string().uri({ allowRelative: false }).optional().allow(null, '').empty(''),
    category_id: Joi.number().integer().optional().allow(null), // Integer olarak kabul et
});

export const bulkUpsertStorePricesSchema = Joi.object({
    prices: Joi.array()
        .items(upsertStorePriceSchema)
        .min(1)
        .max(1000) // Limiti ihtiyaca göre ayarlayabilirsiniz
        .required(),
});

