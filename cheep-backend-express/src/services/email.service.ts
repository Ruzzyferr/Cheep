import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * E-posta servisi — iki taşıma desteği:
 *   1) HTTP API (Resend, 443 portu)  → bulut sunucularında SMTP bloklansa bile çalışır (ÖNERİLEN)
 *   2) SMTP (Gmail/Workspace, 465)    → yerel/dev veya SMTP'ye izin veren ortamlar
 * Hiçbiri yoksa içerik log'a yazılır (dev/test). Kayıt akışı e-posta hatasında
 * ASLA başarısız olmaz — çağıran tarafı bunu yutar.
 *
 * Öncelik: RESEND_API_KEY varsa Resend; yoksa SMTP; o da yoksa log.
 */

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
    if (!config.smtpEnabled) return null;
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.password },
    });
    return transporter;
};

interface SendMailArgs {
    to: string;
    subject: string;
    html: string;
    text: string;
    /** Cevap adresi. Destek formunda kullanıcının adresi konur; "Yanıtla"
     *  doğrudan ona gitsin, noreply@ kutusuna değil. */
    replyTo?: string;
}

const fromHeader = () => `"${config.smtp.fromName}" <${config.email.fromEmail}>`;

/** Resend HTTP API üzerinden gönderim (port 443). */
const sendViaResend = async ({ to, subject, html, text, replyTo }: SendMailArgs): Promise<boolean> => {
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.email.resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromHeader(),
                to: [to],
                subject,
                html,
                text,
                ...(replyTo ? { reply_to: replyTo } : {}),
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            logger.error(`[email] Resend hata ${res.status}: ${body.slice(0, 300)}`);
            return false;
        }
        logger.info(`[email] Resend ile gönderildi: to=${to}, subject="${subject}"`);
        return true;
    } catch (err) {
        logger.error('[email] Resend gönderim hatası:', err);
        return false;
    }
};

/** SMTP üzerinden gönderim. */
const sendViaSmtp = async ({ to, subject, html, text, replyTo }: SendMailArgs): Promise<boolean> => {
    const tx = getTransporter();
    if (!tx) return false;
    try {
        await tx.sendMail({ from: fromHeader(), to, subject, text, html, ...(replyTo ? { replyTo } : {}) });
        logger.info(`[email] SMTP ile gönderildi: to=${to}, subject="${subject}"`);
        return true;
    } catch (err) {
        logger.error('[email] SMTP gönderim hatası:', err);
        return false;
    }
};

const sendMail = async (args: SendMailArgs): Promise<boolean> => {
    if (config.email.resendApiKey) return sendViaResend(args);
    if (config.smtpEnabled) return sendViaSmtp(args);
    logger.warn(`[email] Taşıma yok (Resend/SMTP) — gönderilmedi. (to=${args.to})`);
    return false;
};

/** Deploy öncesi taşıma kontrolü. */
export const verifyEmailTransport = async (): Promise<boolean> => {
    if (config.email.resendApiKey) return true; // HTTP API: anahtar varsa hazır
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

/** 6 haneli e-posta doğrulama kodunu gönderir. */
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

const escapeHtml = (s: string): string =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const TOPIC_LABELS: Record<string, string> = {
    bug: 'Hata bildirimi',
    suggestion: 'Öneri',
    price: 'Fiyat sorunu',
    account: 'Hesap',
    other: 'Diğer',
};

/**
 * Destek formundan gelen mesajı ekibe iletir.
 *
 * `replyTo` kullanıcının adresidir: "Yanıtla" dendiğinde doğrudan ona gider,
 * kimsenin okumadığı noreply@ kutusuna değil.
 */
export const sendSupportMessage = async (args: {
    to: string;
    fromEmail: string;
    topic: string;
    message: string;
    userLabel: string;
    context: Record<string, string | null | undefined>;
    messageId: number;
}): Promise<boolean> => {
    const topicLabel = TOPIC_LABELS[args.topic] ?? args.topic;
    const subject = `Cheep destek — ${topicLabel} (#${args.messageId})`;

    const ctxLines = Object.entries(args.context)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);

    const text = [
        `Konu: ${topicLabel}`,
        `Gönderen: ${args.userLabel} <${args.fromEmail}>`,
        '',
        args.message,
        '',
        '--- bağlam ---',
        ...ctxLines,
    ].join('\n');

    const html = `
  <div style="background:#F6F8FA;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.06);">
      ${brandHeader}
      <div style="padding:8px 32px 32px;color:#0F172A;">
        <p style="font-size:13px;color:#64748B;margin:0 0 4px;">${escapeHtml(topicLabel)} · #${args.messageId}</p>
        <p style="font-size:15px;margin:0 0 20px;">
          <b>${escapeHtml(args.userLabel)}</b>
          <span style="color:#64748B;">&lt;${escapeHtml(args.fromEmail)}&gt;</span>
        </p>
        <div style="background:#F8FAFC;border-left:3px solid #0D9488;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(args.message)}</div>
        <p style="font-size:12px;color:#94A3B8;margin:20px 0 6px;">Bağlam</p>
        <div style="font-size:12px;color:#64748B;line-height:1.7;">${ctxLines.map((l) => escapeHtml(l)).join('<br>')}</div>
      </div>
    </div>
  </div>`;

    return sendMail({ to: args.to, subject, html, text, replyTo: args.fromEmail });
};
