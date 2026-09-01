import Joi from "joi";

export const registerSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Geçerli bir email adresi giriniz',
        'any.required': 'Email zorunludur',
    }),
    password: Joi.string().min(6).max(50).required().messages({
        'string.min': 'Şifre en az 6 karakter olmalıdır',
        'string.max': 'Şifre en fazla 50 karakter olmalıdır',
        'any.required': 'Şifre zorunludur',
    }),
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'İsim en az 2 karakter olmalıdır',
        'any.required': 'İsim zorunludur',
    }),
});

export const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Geçerli bir email adresi giriniz',
        'any.required': 'Email zorunludur',
    }),
    password: Joi.string().required().messages({
        'any.required': 'Şifre zorunludur',
    }),
});

export const verifyEmailSchema = Joi.object({
    code: Joi.string()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.pattern.base': 'Doğrulama kodu 6 haneli olmalıdır',
            'any.required': 'Doğrulama kodu zorunludur',
        }),
});

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Mevcut şifre zorunludur',
    }),
    newPassword: Joi.string().min(6).max(50).required().messages({
        'string.min': 'Yeni şifre en az 6 karakter olmalıdır',
        'string.max': 'Yeni şifre en fazla 50 karakter olmalıdır',
        'any.required': 'Yeni şifre zorunludur',
    }),
});

export const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Geçerli bir email adresi giriniz',
        'any.required': 'Email zorunludur',
    }),
});

/**
 * Sıfırlama: e-posta + koda ek olarak YENİ PAROLA da aynı istekte gelir.
 *
 * Kodu ayrı bir uçta doğrulayıp "sıfırlama oturumu" açmak yerine tek adım,
 * çünkü ara adım kodu bir kez daha (bu sefer geçici token olarak) dolaştırır
 * ve saklanacak yeni bir sır üretir. Tek istekte kod hem doğrulanıp hem
 * tüketiliyor.
 *
 * Parola kuralı `registerSchema` ile AYNI olmak zorunda: sıfırlamada daha
 * gevşek olsaydı, kullanıcı kayıt ekranında reddedilen bir parolayı buradan
 * geçirebilirdi.
 */
export const resetPasswordSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Geçerli bir email adresi giriniz',
        'any.required': 'Email zorunludur',
    }),
    code: Joi.string()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.pattern.base': 'Sıfırlama kodu 6 haneli olmalıdır',
            'any.required': 'Sıfırlama kodu zorunludur',
        }),
    newPassword: Joi.string().min(6).max(50).required().messages({
        'string.min': 'Yeni şifre en az 6 karakter olmalıdır',
        'string.max': 'Yeni şifre en fazla 50 karakter olmalıdır',
        'any.required': 'Yeni şifre zorunludur',
    }),
});
