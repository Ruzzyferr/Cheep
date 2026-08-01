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

        if (property === 'body') {
            // req.body düz bir özellik; doğrudan atanabilir.
            req.body = value;
        } else {
            // DİKKAT — Express 5'te `req.query` bir GETTER: her erişimde query
            // string'i yeniden ayrıştırır. Buraya eskiden
            // `Object.assign(req.query, value)` yazılıyordu ve o yazma
            // TUTMUYORDU: getter bir sonraki okumada ham değeri geri veriyordu.
            //
            // Düz parametrelerde fark edilmiyordu (değer zaten aynı), ama
            // şemanın DÖNÜŞTÜRDÜĞÜ her şey sessizce kayboluyordu — virgüllü
            // listenin diziye çevrilmesi, sayıya dönüştürme ve `default`
            // atamaları controller'a hiç ulaşmıyordu.
            //
            // Getter'ı doğrulanmış değerle değiştiriyoruz: controller'lar
            // değişmeden doğru veriyi görür ve `stripUnknown` nihayet gerçekten
            // uygulanır.
            try {
                Object.defineProperty(req, property, {
                    value,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            } catch {
                // Tanımlanamıyorsa (donmuş nesne) en azından birleştirmeyi dene.
                Object.assign(req[property], value);
            }
        }

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