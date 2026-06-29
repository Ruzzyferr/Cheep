import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * E-posta servisi (Gmail/Workspace SMTP).
 *
 * Transporter tembel (lazy) oluşturulur; SMTP yapılandırılmamışsa gönderim
 * sessizce atlanır ve içerik log'a yazılır (geliştirme/test). Kayıt akışı
 * e-posta hatasında ASLA başarısız olmamalı — çağıran tarafı bunu yutar.
 */
let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
    if (!config.smtpEnabled) return null;
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465, // 465 => TLS
        auth: {
            user: config.smtp.user,
            pass: config.smtp.password,
        },
    });
    return transporter;
};

interface SendMailArgs {
    to: string;
    subject: string;
    html: string;
    text: string;
}

const sendMail = async ({ to, subject, html, text }: SendMailArgs): Promise<boolean> => {
    const tx = getTransporter();
    if (!tx) {
        logger.warn(`[email] SMTP devre dışı — gönderilmedi. (to=${to}, subject="${subject}")`);
        return false;
    }
    try {
        await tx.sendMail({
            from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
            to,
            subject,
            text,
            html,
        });
        logger.info(`[email] gönderildi: to=${to}, subject="${subject}"`);
        return true;
    } catch (err) {
        logger.error('[email] gönderim hatası:', err);
        return false;
    }
};

/**
 * Doğrulama testi — SMTP kimlik bilgileri geçerli mi? (deploy öncesi kontrol)
 */
export const verifyEmailTransport = async (): Promise<boolean> => {
    const tx = getTransporter();
    if (!tx) return false;
    try {
        await tx.verify();
        return true;
    } catch (err) {
        logger.error('[email] SMTP doğrulama hatası:', err);
        return false;
    }
};

const brandHeader = `
  <div style="text-align:center;padding:24px 0;">
    <span style="font-size:32px;">🐦</span>
    <div style="font-size:22px;font-weight:700;color:#0D9488;letter-spacing:.5px;">Cheep</div>
  </div>`;

/**
 * 6 haneli e-posta doğrulama kodunu gönderir.
 */
export const sendVerificationEmail = async (
    to: string,
    name: string,
    code: string
): Promise<boolean> => {
    const subject = 'Cheep — E-posta doğrulama kodun';
    const text = `Merhaba ${name},\n\nCheep doğrulama kodun: ${code}\n\nKod 15 dakika geçerlidir. Bu işlemi sen başlatmadıysan bu e-postayı yok sayabilirsin.`;
    const html = `
  <div style="background:#F6F8FA;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.06);">
      ${brandHeader}
      <div style="padding:8px 32px 32px;color:#0F172A;">
        <p style="font-size:16px;margin:0 0 8px;">Merhaba <b>${name}</b>,</p>
        <p style="font-size:14px;color:#64748B;margin:0 0 24px;">Hesabını doğrulamak için aşağıdaki kodu uygulamaya gir:</p>
        <div style="text-align:center;background:#F0FDFA;border:1px dashed #0D9488;border-radius:12px;padding:18px;margin-bottom:20px;">
          <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0D9488;">${code}</span>
        </div>
        <p style="font-size:13px;color:#94A3B8;margin:0;">Kod <b>15 dakika</b> geçerlidir. Bu işlemi sen başlatmadıysan e-postayı yok sayabilirsin.</p>
      </div>
    </div>
    <p style="text-align:center;color:#94A3B8;font-size:12px;margin-top:16px;">© Cheep · Akıllı Alışveriş Asistanı</p>
  </div>`;
    return sendMail({ to, subject, html, text });
};
