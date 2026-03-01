import { type Request, type Response, type NextFunction } from 'express';
import { type ObjectSchema } from 'joi';
import logger from "../utils/logger.js";

/**
 * JOI validation middleware factory
 * @param schema - JOI validation schema
 * @param property - Request property to validate ('body', 'query', 'params')
 */
export const validate = (
    schema: ObjectSchema,
    property: 'body' | 'query' | 'params' = 'body'
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            logger.error('❌ Validation Error:', JSON.stringify(errors, null, 2));

            return res.status(400).json({
                success: false,
                message: 'Validation hatası',
                errors,
            });
        }

        // --- DEĞİŞTİRİLEN BÖLÜM BAŞLANGICI ---
        // 'req.query' ve 'req.params' üzerine doğrudan yazılamaz,
        // bu yüzden 'req.body' için farklı bir mantık uyguluyoruz.
        if (property === 'body') {
            // req.body değiştirilebilir, bu yüzden doğrudan atama yapabiliriz.
            // Bu, bilinmeyen alanların (stripUnknown) kaldırıldığı temiz bir body sağlar.
            req.body = value;
        } else {
            // req.query ve req.params üzerine yazılamaz.
            // Bunun yerine, doğrulanmış ve varsayılan değerleri içeren 'value' nesnesini
            // mevcut req[property] (yani req.query veya req.params) içine birleştiririz.
            Object.assign(req[property], value);
        }
        // --- DEĞİŞTİRİLEN BÖLÜM SONU ---

        next();
    };
};
/**
 * Multiple validation (body + query gibi)
 */
export const validateMultiple = (
    validations: Array<{
        schema: ObjectSchema;
        property: 'body' | 'query' | 'params';
    }>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const allErrors: Array<{ field: string; message: string }> = [];

        for (const { schema, property } of validations) {
            const { error, value } = schema.validate(req[property], {
                abortEarly: false,
                stripUnknown: true,
            });

            if (error) {
                const errors = error.details.map((detail) => ({
                    field: `${property}.${detail.path.join('.')}`,
                    message: detail.message,
                }));
                allErrors.push(...errors);
            } else {
                req[property] = value;
            }
        }

        if (allErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation hatası',
                errors: allErrors,
            });
        }

        next();
    };
};