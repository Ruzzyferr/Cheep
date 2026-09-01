import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.client.js';
import { config } from '../../config/index.js';
import { AppError, conflict, notFound, badRequest } from '../../utils/app-error.js';
import { isRefreshTokenCurrent, type RefreshPayload } from '../../services/refresh-token.js';
import {
    generateVerificationCode,
    verificationExpiry,
    isCodeExpired,
    isValidCodeFormat,
} from '../../services/email-verification.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../services/email.service.js';
import logger from '../../utils/logger.js';

type UserRecord = { password_hash: string;[k: string]: unknown };

/**
 * Kullanıcı nesnesinden hassas/iç alanları çıkarır (client'a dönmeden önce).
 *
 * PAROLA SIFIRLAMA ALANLARI DA BURADAN GEÇMEK ZORUNDA. `password_reset_code`
 * bcrypt hash'i ama koruduğu sır yalnızca 6 HANELİ: bir milyon olasılık,
 * sızdığı anda çevrimdışı denemeyle saniyeler içinde çözülür. Yani bu alanı
 * yanıtta bırakmak, sıfırlama kodunu düz metin göndermekten farksız olurdu —
 * ve `sanitizeUser` login/register dahil HER yanıtta çalıştığı için sızıntı
 * tek bir uçla sınırlı kalmazdı.
 */
const sanitizeUser = (user: UserRecord) => {
    const {
        password_hash: _pw,
        email_verification_code: _c,
        email_verification_expires: _e,
        password_reset_code: _rc,
        password_reset_expires: _re,
        password_reset_attempts: _ra,
        ...safe
    } = user;
    return safe;
};

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '30d';

interface AccessPayload {
    userId: number;
    type: 'access';
    /**
     * Kullanicinin o anki `token_version`i.
     *
     * ESKIDEN YALNIZCA REFRESH TOKEN TASIYORDU ve bu, belgelenen guvencenin
     * ("logout/parola degisimi eski oturumlari sonlandirir") access token'lar
     * icin GECERSIZ olmasi demekti: calinmis bir access token, kurban cikis
     * yapsa ya da parolasini degistirse bile tam 1 saat daha calisiyordu.
     * Parola degistirmenin asil amaci tam olarak bunu kesmek.
     */
    tv: number;
}

/**
 * Bir kullanıcı için access (kısa ömürlü) ve refresh (uzun ömürlü) token üretir.
 * Refresh token, kullanıcının o anki `token_version`'ını `tv` claim'inde taşır;
 * bu sayede logout/parola değişiminde eski refresh token'lar geçersiz kılınabilir.
 */
const generateTokens = (userId: number, tokenVersion: number) => {
    const token = jwt.sign({ userId, type: 'access', tv: tokenVersion } as AccessPayload, config.jwtSecret, {
        expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = jwt.sign(
        { userId, type: 'refresh', tv: tokenVersion } as RefreshPayload,
        config.jwtRefreshSecret,
        { expiresIn: REFRESH_TOKEN_TTL }
    );
    return { token, refreshToken };
};

/**
 * E-postayi KIMLIK olarak normallestirir: kirp + kucuk harfe cevir.
 *
 * NEDEN: kayit ve giris `email`i ham haliyle ariyordu, yani kimlik BUYUK/KUCUK
 * HARFE DUYARLIYDI. `Ali@x.com` ile kaydolan kullanici ertesi gun `ali@x.com`
 * yazinca "Gecersiz email veya sifre" aliyor ve neden oldugunu anlamiyordu;
 * daha kotusu, ayni gercek posta kutusuna ikinci bir hesap acilabiliyordu.
 * Hiz limiti zaten e-postayi kucuk harfe cevirerek anahtarliyor (rate-limit
 * middleware) — yani sistem kendi icinde de tutarsizdi.
 *
 * Uretimde buyuk harfli veya bosluklu e-posta OLMADIGI olculdu (49/49 temiz),
 * bu yuzden normallestirme mevcut hicbir hesabi disarida birakmiyor.
 */
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

// Kullanıcı kayıt servisi
export const registerUser = async (rawEmail: string, pass: string, name: string) => {
    const email = normalizeEmail(rawEmail);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw conflict('Bu email adresi zaten kullanılıyor.');
    }

    const password_hash = await bcrypt.hash(pass, 10);

    // 6 haneli doğrulama kodu üret, hash'leyerek sakla (düz metin sadece e-postaya gider)
    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);

    const user = await prisma.user.create({
        data: {
            email,
            password_hash,
            name,
            email_verification_code: codeHash,
            email_verification_expires: verificationExpiry(),
        },
    });

    // E-postayı gönder — başarısız olsa bile kayıt akışı BOZULMAZ (kullanıcı "yeniden gönder" diyebilir)
    void sendVerificationEmail(email, name, code).catch((err) =>
        logger.error('[auth] doğrulama e-postası gönderilemedi:', err)
    );
    if (!config.emailEnabled) {
        logger.warn(`[auth] (DEV) ${email} için doğrulama kodu: ${code}`);
    }

    return { user: sanitizeUser(user), ...generateTokens(user.id, user.token_version) };
};

/**
 * E-posta doğrulama: kullanıcının girdiği 6 haneli kodu saklanan hash ile karşılaştırır.
 * Başarılıysa `email_verified = true` yapar ve kodu temizler.
 */
export const verifyEmailCode = async (userId: number, code: string) => {
    if (!isValidCodeFormat(code)) {
        throw badRequest('Doğrulama kodu 6 haneli olmalıdır.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }
    if (user.email_verified) {
        return { user: sanitizeUser(user) }; // zaten doğrulanmış — idempotent
    }
    if (!user.email_verification_code || isCodeExpired(user.email_verification_expires)) {
        throw new AppError('Doğrulama kodunun süresi dolmuş. Yeni kod isteyin.', 400, 'CODE_EXPIRED');
    }

    const ok = await bcrypt.compare(code, user.email_verification_code);
    if (!ok) {
        throw new AppError('Doğrulama kodu hatalı.', 400, 'CODE_INVALID');
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            email_verified: true,
            email_verification_code: null,
            email_verification_expires: null,
        },
    });

    return { user: sanitizeUser(updated) };
};

/**
 * Yeni doğrulama kodu üretip e-posta ile tekrar gönderir.
 */
export const resendVerification = async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }
    if (user.email_verified) {
        throw badRequest('E-posta adresi zaten doğrulanmış.');
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.user.update({
        where: { id: userId },
        data: {
            email_verification_code: codeHash,
            email_verification_expires: verificationExpiry(),
        },
    });

    void sendVerificationEmail(user.email, user.name, code).catch((err) =>
        logger.error('[auth] doğrulama e-postası (yeniden) gönderilemedi:', err)
    );
    if (!config.emailEnabled) {
        logger.warn(`[auth] (DEV) ${user.email} için yeni doğrulama kodu: ${code}`);
    }
};

// Kullanıcı giriş servisi
export const loginUser = async (rawEmail: string, pass: string) => {
    const email = normalizeEmail(rawEmail);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new AppError('Geçersiz email veya şifre.', 401);
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password_hash);
    if (!isPasswordValid) {
        throw new AppError('Geçersiz email veya şifre.', 401);
    }

    return { user: sanitizeUser(user), ...generateTokens(user.id, user.token_version) };
};

/**
 * Geçerli bir refresh token karşılığında yeni bir access token (ve refresh token) üretir.
 * Token'ın `tv` claim'i kullanıcının güncel `token_version`'ı ile eşleşmiyorsa (iptal edilmiş)
 * reddedilir → yeniden giriş gerekir.
 */
export const refreshAccessToken = async (refreshToken: string) => {
    let decoded: RefreshPayload;
    try {
        decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as RefreshPayload;
    } catch {
        throw new AppError('Geçersiz veya süresi dolmuş refresh token.', 401);
    }

    if (decoded.type !== 'refresh') {
        throw new AppError('Geçersiz token tipi.', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }

    if (!isRefreshTokenCurrent(decoded.tv, user.token_version)) {
        throw new AppError('Oturum geçersiz kılınmış. Lütfen tekrar giriş yapın.', 401);
    }

    return generateTokens(user.id, user.token_version);
};

/**
 * Çıkış: kullanıcının `token_version`'ını artırarak dağıtılmış tüm refresh token'ları geçersiz kılar.
 */
export const logoutUser = async (userId: number) => {
    await prisma.user.update({
        where: { id: userId },
        data: { token_version: { increment: 1 } },
    });
};

/**
 * Parola değiştirme: mevcut parolayı doğrular, yeni hash yazar ve `token_version`'ı artırarak
 * eski oturumları (refresh token'ları) sonlandırır. Çağırana taze token çifti döner.
 */
export const changePassword = async (
    userId: number,
    currentPassword: string,
    newPassword: string
) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentValid) {
        throw new AppError('Mevcut şifre hatalı.', 401);
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
        where: { id: userId },
        data: { password_hash, token_version: { increment: 1 } },
    });

    // Eski refresh token'lar artık geçersiz; çağırana yeni geçerli çift verilir.
    return generateTokens(updated.id, updated.token_version);
};

/**
 * Bir sıfırlama kodunun yanmadan önce dayanacağı HATALI deneme sayısı.
 *
 * IP bazlı hız limiti tek başına yetmiyor: kod 6 haneli (1.000.000 olasılık)
 * ve saldırgan IP'sini değiştirebilir, kullanıcı hesabı ise elinde değil.
 * Sayaç KODUN KENDİSİNE bağlı olduğu için ağ tarafından dolaşılamaz —
 * beşinci hatalı denemede kod geçersiz olur ve saldırgan sıfırdan başlamak
 * için kurbanın posta kutusuna erişmek zorunda kalır.
 *
 * 5, gerçek kullanıcıyı (kodu yanlış kopyalayan, eski e-postaya bakan)
 * cezalandırmayacak kadar yüksek; kaba kuvveti anlamsız kılacak kadar düşük.
 */
const MAX_RESET_ATTEMPTS = 5;

/**
 * "Şifremi unuttum": e-postaya 6 haneli sıfırlama kodu gönderir.
 *
 * HESAP OLSA DA OLMASA DA AYNI ŞEY OLUR ve çağırana hiçbir şey dönmez.
 * Aksi hâlde bu uç bedava bir "bu e-posta kayıtlı mı?" sorgusuna dönerdi:
 * saldırgan bir liste yükleyip hangi adreslerin Cheep hesabı olduğunu
 * öğrenir, o adresleri hedefli oltalamada kullanırdı. Bu yüzden kullanıcı
 * yoksa sessizce çıkılıyor — kayıt akışının aksine burada `conflict`
 * fırlatmak GÜVENLİK AÇIĞI olurdu.
 *
 * Aynı sebeple e-posta gönderimi de akışı bozmuyor: gönderim hatası da
 * "kullanıcı yok" ile aynı görünmeli.
 */
export const requestPasswordReset = async (rawEmail: string): Promise<void> => {
    const email = normalizeEmail(rawEmail);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Zamanlama farkını da küçültmek için loglayıp çıkıyoruz; bcrypt
        // maliyeti burada zaten yok, asıl koruma tek tip yanıt.
        logger.info(`[auth] parola sıfırlama: kayıtlı olmayan adres (${email})`);
        return;
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password_reset_code: codeHash,
            password_reset_expires: verificationExpiry(),
            // Yeni kod = temiz sayfa. Sıfırlanmasaydı, önceki koda yapılmış
            // 5 hatalı deneme yeni kodu daha doğmadan yakardı ve kullanıcı
            // "kod gelmiyor" değil "kod hep hatalı" döngüsüne girerdi.
            password_reset_attempts: 0,
        },
    });

    void sendPasswordResetEmail(user.email, user.name, code, user.language).catch((err) =>
        logger.error('[auth] parola sıfırlama e-postası gönderilemedi:', err)
    );
    if (!config.emailEnabled) {
        logger.warn(`[auth] (DEV) ${user.email} için parola sıfırlama kodu: ${code}`);
    }
};

/**
 * Sıfırlama kodunu doğrular ve yeni parolayı yazar.
 *
 * BAŞARIDA `token_version` ARTIYOR — bu, özelliğin asıl güvenlik değeri.
 * Parolasını unutan kullanıcıların önemli bir kısmı aslında hesabının ele
 * geçirildiğinden şüphelendiği için sıfırlama yapıyor; saldırganın açık
 * oturumu sürerken parolayı değiştirmek hiçbir işe yaramazdı. Artış, dağıtılmış
 * bütün access/refresh token'ları anında geçersiz kılıyor.
 *
 * `email_verified` de true yapılıyor: kullanıcı, kodu ancak o posta kutusuna
 * erişerek okuyabildi — doğrulamanın kanıtlamak istediği tam olarak bu. Kodu
 * girip parolasını değiştiren ama hâlâ "e-postanı doğrula" duvarına çarpan bir
 * kullanıcı, sistemin elinde kanıt varken sorulan anlamsız bir soruyla
 * karşılaşırdı.
 *
 * Çağırana taze token çifti dönüyor (otomatik giriş): kodu okuyan kişi posta
 * kutusuna sahip ve yeni parolayı zaten kendi belirledi, dolayısıyla ardından
 * giriş ekranına yollamak güvenliğe hiçbir şey katmaz, yalnızca zaten sıkışmış
 * kullanıcıya bir adım daha ekler.
 */
export const resetPassword = async (
    rawEmail: string,
    code: string,
    newPassword: string
) => {
    // Tek tip hata: "kod yanlış" ile "böyle bir kod hiç istenmemiş" ayırt
    // edilebilseydi, uç yine bir hesap varlığı sızdırırdı.
    const invalid = () =>
        new AppError('Kod hatalı veya süresi dolmuş. Yeni kod isteyin.', 400, 'RESET_CODE_INVALID');

    if (!isValidCodeFormat(code)) {
        throw badRequest('Sıfırlama kodu 6 haneli olmalıdır.');
    }

    const email = normalizeEmail(rawEmail);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_reset_code) {
        throw invalid();
    }

    if (isCodeExpired(user.password_reset_expires)) {
        await clearResetCode(user.id);
        throw invalid();
    }

    if (user.password_reset_attempts >= MAX_RESET_ATTEMPTS) {
        // Kod yanmış: temizleyip kullanıcıyı yeni kod istemeye zorluyoruz.
        await clearResetCode(user.id);
        throw invalid();
    }

    const ok = await bcrypt.compare(code, user.password_reset_code);
    if (!ok) {
        await prisma.user.update({
            where: { id: user.id },
            data: { password_reset_attempts: { increment: 1 } },
        });
        throw invalid();
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
            password_hash,
            password_reset_code: null,
            password_reset_expires: null,
            password_reset_attempts: 0,
            email_verified: true,
            token_version: { increment: 1 },
        },
    });

    return { user: sanitizeUser(updated), ...generateTokens(updated.id, updated.token_version) };
};

/** Sıfırlama kodunu (ve sayacını) temizler — süre dolumu/yanma sonrası. */
const clearResetCode = (userId: number) =>
    prisma.user.update({
        where: { id: userId },
        data: {
            password_reset_code: null,
            password_reset_expires: null,
            password_reset_attempts: 0,
        },
    });
