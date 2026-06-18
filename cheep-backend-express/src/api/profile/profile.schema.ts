import Joi from 'joi';

export const updateProfileSchema = Joi.object({
    household_size: Joi.string().valid('1', '2', '3-4', '5+').optional(),
    diet: Joi.string().valid('omnivore', 'vegetarian', 'vegan', 'pescatarian').optional(),
    avoid: Joi.array().items(Joi.string()).optional(),
    allergies: Joi.array().items(Joi.string()).optional(),
    weekly_budget: Joi.number().min(0).optional(),
    onboarding_done: Joi.boolean().optional(),
});
