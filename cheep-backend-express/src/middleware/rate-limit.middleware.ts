import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Rate limiting.
 *
 * İki tasarım kuralı var, ikisi de canlıda hataya yol açtığı için yazıldı:
 *
 * 1) **`req.ip` ancak `trust proxy` ayarlıysa doğrudur.** Ayarlı değilken
 *    Express soketin karşı ucunu (Caddy'nin Docker IP'si) görüyordu; bu değer
 *    her istekte aynı olduğu için tüm limitler kullanıcı başına değil GLOBAL
 *    çalıştı ve yeni kullanıcılar ilk denemelerinde kilitlendi.
 *    Bkz. `src/config/trust-proxy.ts`.
 *
 * 2) **IP tek başına kullanıcıyı temsil etmez.** Türkiye ve Polonya'da mobil
 *    operatörler yoğun CGNAT kullanıyor: yüzlerce abone tek bir public IPv4'ün
 *    arkasında. IP başına dar bir limit, o operatördeki herkesi birbirine
 *    kilitletir. Bu yüzden kimlik doğrulanmış isteklerde anahtar KULLANICI,
 *    yalnızca doğrulanmamış uçlarda IP — ve IP limitleri CGNAT'i taşıyacak
 *    kadar geniş tutuluyor.
 */

/** Kimlik doğrulanmışsa kullanıcı başına, değilse IP başına (IPv6-güvenli) anahtar. */
function userOrIpKey(req: Request): string {
    const id = req.user?.id;
    if (id) return `u:${id}`;
    return `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

const base = {
    standardHeaders: true,
    legacyHeaders: false,
} satisfies Partial<Options>;

/** Dev'de limitler pratikte devre dışı (scraper ve testler bloke olmasın). */
const isProd = process.env.NODE_ENV === 'production';
const perEnv = (prod: number) => (isProd ? prod : 100_000);

/**
 * Genel API limiti — tüm `/api/` altı. Kimliği doğrulanmış kullanıcı için
 * kullanıcı başına, anonim istekte IP başına. Tek bir gerçek kullanıcının
 * dakikada 600 istek yapması mümkün değil; sınır kötüye kullanım içindir ve
 * CGNAT arkasındaki kalabalığı boğmayacak kadar geniştir.
 */
export const generalLimiter = rateLimit({
    ...base,
    windowMs: 60_000,
    max: perEnv(600),
    keyGenerator: userOrIpKey,
    message: {
        success: false,
        message: 'Çok fazla istek gönderdiniz. Lütfen biraz sonra tekrar deneyin.',
    },
});

/**
 * Kayıt — IP başına. Bir kişi ömründe birkaç kez kayıt olur; saatte 20, CGNAT
 * arkasındaki gerçek kullanıcıları rahat bırakır ama toplu hesap açmayı durdurur.
 * Login'den AYRI kova: giriş denemesi yapan biri kayıt olmaktan men edilmemeli
 * (eski davranışta ikisi aynı kovadaydı, hata mesajı da bu yüzden kayıt
 * ekranında "çok fazla giriş denemesi" diyordu).
 */
export const registerLimiter = rateLimit({
    ...base,
    windowMs: 60 * 60 * 1000,
    max: perEnv(20),
    keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? '')}`,
    message: {
        success: false,
        message: 'Çok fazla kayıt denemesi. Lütfen bir süre sonra tekrar deneyin.',
    },
});

/**
 * Giriş, IP başına kaba sınır. `skipSuccessfulRequests`: başarılı girişler
 * kotadan düşmez, yani normal kullanan hiç kimse bu limite çarpmaz — yalnızca
 * başarısız denemeler sayılır. CGNAT nedeniyle geniş; asıl brute-force
 * korumasını aşağıdaki hesap-bazlı limit yapar.
 */
export const loginIpLimiter = rateLimit({
    ...base,
    windowMs: 15 * 60 * 1000,
    max: perEnv(50),
    keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? '')}`,
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
    },
});

/**
 * Asıl brute-force koruması: HESAP başına başarısız giriş sayısı. CGNAT'ten
 * etkilenmez (anahtar e-posta), ve saldırgan IP değiştirse bile hesap korunur.
 * E-posta yoksa (bozuk istek) IP'ye düşer.
 */
export const loginAccountLimiter = rateLimit({
    ...base,
    windowMs: 15 * 60 * 1000,
    max: perEnv(10),
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        return email ? `acct:${email}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: 'Bu hesap için çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
    },
});

/**
 * E-posta doğrulama (verify-email / resend-verification). Rotalarda
 * `authenticate` bu limiterden ÖNCE çalışıyor, dolayısıyla anahtar kullanıcı —
 * CGNAT sorunu yok.
 */
export const verifyLimiter = rateLimit({
    ...base,
    windowMs: 15 * 60 * 1000,
    max: perEnv(20),
    keyGenerator: userOrIpKey,
    message: {
        success: false,
        message: 'Çok fazla doğrulama denemesi. Lütfen biraz sonra tekrar deneyin.',
    },
});

/** Parola değiştirme — kullanıcı başına, kimliği doğrulanmış uç. */
export const changePasswordLimiter = rateLimit({
    ...base,
    windowMs: 15 * 60 * 1000,
    max: perEnv(10),
    keyGenerator: userOrIpKey,
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: 'Çok fazla parola değiştirme denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
    },
});

/** Fiyat geri bildirimi — kullanıcı başına (rota `authenticate` ardından geliyor). */
export const feedbackLimiter = rateLimit({
    ...base,
    windowMs: 60_000,
    max: perEnv(20),
    keyGenerator: userOrIpKey,
    message: {
        success: false,
        message: 'Çok fazla geri bildirim gönderdiniz. Lütfen biraz bekleyin.',
    },
});

/**
 * Destek formu. Uç kimlik doğrulaması İSTEĞE BAĞLI olduğu için anahtar da öyle:
 * girişliyse kullanıcı, değilse IP. Saatte 5 — gerçek bir kullanıcının aynı saat
 * içinde beşten fazla destek mesajı yazması beklenmez, ama tek bir hata için
 * ikinci/üçüncü kez yazmak isteyene de yer bırakır.
 */
export const contactLimiter = rateLimit({
    ...base,
    windowMs: 60 * 60 * 1000,
    max: perEnv(5),
    keyGenerator: userOrIpKey,
    message: {
        success: false,
        message: 'Çok fazla mesaj gönderdiniz. Lütfen bir süre sonra tekrar deneyin.',
    },
});

/** Liste karşılaştırma — kullanıcı başına; ağır bir uç olduğu için görece dar. */
export const compareLimiter = rateLimit({
    ...base,
    windowMs: 60_000,
    max: perEnv(60),
    keyGenerator: userOrIpKey,
    message: {
        success: false,
        message: 'Çok fazla karşılaştırma isteği gönderdiniz. Lütfen biraz bekleyin.',
    },
});
