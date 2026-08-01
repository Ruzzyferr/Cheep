import { Router } from 'express';
import { param } from '../../utils/request-params.js';
import { type Request, type Response } from 'express';
import { resolveVersionPolicy, type Platform } from '../../config/app-version.js';

const router = Router();

/**
 * @swagger
 * /api/v1/app/version:
 *   get:
 *     summary: Uygulama sürüm politikası (zorunlu güncelleme kapısı)
 *     tags: [App]
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema: { type: string, enum: [android, ios] }
 *     responses:
 *       200:
 *         description: minSupported / latest / storeUrl
 */

/**
 * Sürüm politikası.
 *
 * KİMLİK DOĞRULAMA YOK ve olmamalı: bu kontrol giriş ekranından ÖNCE, uygulama
 * daha açılırken çalışıyor. Token gerektirseydi, oturumu olmayan bir kullanıcı
 * eski bir istemcide sonsuza kadar sıkışırdı.
 *
 * Yanıt yalnızca yapılandırma değerlerini içeriyor; sızacak bir şey yok.
 */
router.get('/version', (req: Request, res: Response) => {
    const raw = param(req.query.platform as string | undefined) || 'android';
    const platform = (raw.toLowerCase() === 'ios' ? 'ios' : 'android') as Platform;

    const policy = resolveVersionPolicy(platform);

    // Kısa önbellek: her açılışta sorulacak ama eşiği yükselttiğimizde birkaç
    // dakika içinde yayılmalı. `no-store` gereksiz yük, uzun cache ise
    // acil bir kilidi geciktirirdi.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({ success: true, data: { platform, ...policy } });
});

export default router;
