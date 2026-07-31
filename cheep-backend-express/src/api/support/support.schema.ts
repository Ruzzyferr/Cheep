import Joi from 'joi';

export const TOPICS = ['bug', 'suggestion', 'price', 'account', 'other'] as const;

export const contactSchema = Joi.object({
    email: Joi.string().email().max(254).required().messages({
        'string.email': 'Geçerli bir e-posta adresi giriniz',
        'any.required': 'E-posta adresi zorunludur',
    }),
    // Alt sınır bilerek 10: tek kelimelik ("olmuyor") mesaj kimseye yardımcı olmuyor.
    message: Joi.string().trim().min(10).max(2000).required().messages({
        'string.min': 'Mesaj en az 10 karakter olmalıdır',
        'string.max': 'Mesaj en fazla 2000 karakter olabilir',
        'any.required': 'Mesaj zorunludur',
    }),
    topic: Joi.string().valid(...TOPICS).default('other'),

    // İstemci bağlamı — hepsi opsiyonel, eski sürümler göndermeyebilir.
    app_version: Joi.string().max(30).allow(null, '').optional(),
    platform: Joi.string().max(20).allow(null, '').optional(),
    os_version: Joi.string().max(40).allow(null, '').optional(),
    locale: Joi.string().max(10).allow(null, '').optional(),
    country_code: Joi.string().max(5).allow(null, '').optional(),
});
