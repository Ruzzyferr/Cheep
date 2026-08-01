import { type Request, type Response, type NextFunction } from 'express';
import { resolveLang } from '../config/category-i18n.js';

/**
 * İsteğin dilini belirler ve `req.lang`'e yazar.
 *
 * Sıra: `x-lang` başlığı → `Accept-Language` → ülkenin varsayılan dili.
 *
 * NEDEN ÜLKEDEN AYRI: uygulama dili ile katalog ülkesi bağımsızdır. Türkiye'de
 * yaşayıp uygulamayı İngilizce kullanan biri TR kataloğunu İngilizce kategori
 * adlarıyla görmeli. Dili ülkeden türetmek bu kullanıcıyı Türkçeye mahkûm
 * ederdi.
 *
 * `resolveCountry`'den SONRA çalışmalı — `req.country` varsayılan dile
 * düşmek için gerekli.
 */
export const resolveRequestLang = (req: Request, _res: Response, next: NextFunction) => {
    req.lang = resolveLang(req.header('x-lang'), req.header('accept-language'), req.country?.code ?? 'TR');
    next();
};
