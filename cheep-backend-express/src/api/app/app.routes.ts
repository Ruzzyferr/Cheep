import { Router } from 'express';
import { param } from '../../utils/request-params.js';
import { type Request, type Response } from 'express';
import { resolveVersionPolicy, type Platform } from '../../config/app-version.js';
import { getAvailableCountries } from './countries.service.js';

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

/**
 * @swagger
 * /api/v1/app/countries:
 *   get:
 *     summary: Kataloğu gerçekten dolu olan ülkeler (istemci ülke kapısı)
 *     tags: [App]
 *     responses:
 *       200:
 *         description: code / name / currency / productCount listesi
 */

/**
 * Verisi olan ülkeler.
 *
 * KİMLİK DOĞRULAMA YOK — `/version` ile aynı gerekçe: bu liste onboarding'de,
 * kullanıcı daha hesap açmadan gerekiyor.
 *
 * Neden var: istemcideki sabit ülke listesi tek başına kapı olduğunda "önce
 * veri, sonra sürüm" sırası elle korunmak zorundaydı ve sıra bozulduğunda
 * kullanıcı sessizce BOŞ bir katalog görüyordu. Artık istemci listesi üst
 * sınır, bu uç nokta kapı (bkz. countries.service.ts).
 */
router.get('/countries', async (_req: Request, res: Response) => {
    const countries = await getAvailableCountries();
    // 10 dk: bir ülke canlıya alındığında yüklü uygulamalarda kısa sürede
    // belirmeli, ama her açılışta COUNT sorgusu koşturmaya da gerek yok.
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).json({ success: true, data: countries });
});

export default router;
