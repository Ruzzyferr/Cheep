import Joi from 'joi';

export const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(4000).required().messages({
    'string.empty': 'Mesaj boş olamaz',
    'string.max': 'Mesaj 4000 karakterden uzun olamaz',
    'any.required': 'Mesaj içeriği zorunludur',
  }),
});
