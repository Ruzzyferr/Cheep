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