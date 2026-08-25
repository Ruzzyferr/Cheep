#!/usr/bin/env node
/**
 * Sürüm hattının sonucunu e-postayla bildirir.
 *
 * NEDEN AYRI BİR BETİK: GitHub'ın kendi bildirimi yalnızca BAŞARISIZLIKTA ve
 * yalnızca "workflow failed" düzeyinde gelir — hangi işin düştüğü, hangi
 * sürümün çıktığı, derlemenin nereye gittiği yazmaz. Başarıda hiç gelmez.
 * Burada ikisi de gönderiliyor ve içinde asıl merak edilen şey var:
 * hangi sürüm hangi kanala düştü.
 *
 * Gönderim, nöbetçinin (watchdog.sh) kullandığı Resend hesabının aynısı —
 * yeni servis, yeni alan adı doğrulaması yok.
 *
 * Kullanım: NOTIFY_* ortam değişkenlerini kurup `node notify.mjs`.
 *   NOTIFY_BASLIK      e-postanın üst satırı ("Cheep · mobil sürüm hattı")
 *   NOTIFY_JOBS        satır başına "İş adı|sonuc"
 *   NOTIFY_VERSION/VC/BUILD/TRACK   sürüm hattına özel, CI'da boş
 *   NOTIFY_NOTES, NOTIFY_SHA, NOTIFY_COMMIT_MSG, NOTIFY_RUN_URL
 *   NOTIFY_ANDROID, NOTIFY_IOS      kısmi yayın tespiti için
 * Ayrıca: RESEND_API_KEY (zorunlu), EMAIL_FROM, EMAIL_TO, NOTIFY_DRY_RUN
 */

const FROM = process.env.EMAIL_FROM || 'noreply@cheep.live';
const TO = process.env.EMAIL_TO || 'info@swiip.app';
const KEY = process.env.RESEND_API_KEY;

if (!KEY) {
    // Sessizce geçmiyoruz: bildirimin çalışmadığını fark etmenin tek yolu
    // işin kırmızı yanması. Aksi hâlde "bildirim gelmiyor mu, hiç sorun mu
    // yok mu" ayrımı yapılamaz hâle gelir.
    console.error('::error::RESEND_API_KEY tanımlı değil — bildirim gönderilemedi.');
    process.exit(1);
}

/**
 * Girdi DÜZ ORTAM DEĞİŞKENLERİ, JSON değil.
 *
 * Önce jq ile JSON kuruluyordu; iki sorunu vardı. Birincisi jq yerelde yok,
 * yani ifadeyi denemeden göndermek gerekiyordu. İkincisi ve asıl olanı: jq
 * ifadesi bozuk olsa adım `set -e` ile düşer, bildirim işi kırmızı yanar ve
 * E-POSTA HİÇ GİTMEZ — bildirim sisteminin var olma sebebi olan anda susar.
 * Ortam değişkeni okumanın bozulacak bir yeri yok ve yerelde birebir
 * denenebiliyor.
 */
const env = (k) => process.env[`NOTIFY_${k}`] || '';

const p = {
    baslik: env('BASLIK'),
    version: env('VERSION'),
    versionCode: env('VC'),
    buildNumber: env('BUILD'),
    track: env('TRACK'),
    notes: env('NOTES'),
    // Sürümü engellemeyen ama gözden kaçmaması gereken uyarı (ör. Apple
    // sertifikası yakında doluyor). Koşu kaydında kalsa kimse görmez.
    uyari: env('UYARI'),
    sha: env('SHA'),
    commitMsg: env('COMMIT_MSG').split('\n')[0],
    runUrl: env('RUN_URL'),
    android: env('ANDROID'),
    ios: env('IOS'),
};

/**
 * İş listesi: satır başına "Ad|sonuc". Sonuç GitHub'ın `needs.<is>.result`
 * değeri (success | failure | cancelled | skipped | ''). Liste çağıran iş
 * akışına göre değiştiği için sabit değil — aynı betik hem sürüm hattında
 * hem CI'da kullanılıyor.
 */
const JOBS = env('JOBS')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
        const i = s.indexOf('|');
        return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    });
const BASLIK = p.baslik || 'Cheep';

const ISARET = {
    success: '✅',
    failure: '❌',
    cancelled: '⚪',
    skipped: '⏭️',
};
const TURKCE = {
    success: 'başarılı',
    failure: 'BAŞARISIZ',
    cancelled: 'iptal edildi',
    skipped: 'atlandı',
};
const isaret = (r) => ISARET[r] || '❔';
const turkce = (r) => TURKCE[r] || r || 'bilinmiyor';

const dusenler = JOBS.filter(([, r]) => r === 'failure').map(([ad]) => ad);
const iptaller = JOBS.filter(([, r]) => r === 'cancelled').map(([ad]) => ad);
const genel = dusenler.length ? 'failure' : iptaller.length ? 'cancelled' : 'success';

const surumEtiketi = [
    p.version && `${p.version}`,
    p.versionCode && `vc${p.versionCode}`,
    p.buildNumber && `build ${p.buildNumber}`,
].filter(Boolean).join(' · ');

// Mağaza bilgisi yalnızca sürüm hattında var; CI'da yok. Metinler buna göre
// değişiyor ki CI e-postası "test kanallarında" gibi anlamsız bir şey demesin.
const surumHatti = Boolean(p.versionCode || p.buildNumber);

let subject;
if (genel === 'failure') {
    subject = `❌ ${BASLIK} düştü — ${dusenler.join(', ')}`;
} else if (genel === 'cancelled') {
    subject = `⚪ ${BASLIK} iptal edildi${surumEtiketi ? ` (${surumEtiketi})` : ''}`;
} else if (surumHatti) {
    subject = `✅ Cheep ${surumEtiketi} test kanallarında`;
} else {
    subject = `✅ ${BASLIK} geçti`;
}

/**
 * Kısmi başarı gerçeği. İki platform BİRBİRİNDEN BAĞIMSIZ yükleniyor: Android
 * düşse bile iOS build'i TestFlight'a çıkmış olabilir. "Hiçbir şey
 * yayınlanmadı" demek bu durumda yalan olur ve testçi elindeki yeni build'i
 * yok sanar — o yüzden hangi tarafın çıktığı tek tek yazılıyor.
 */
const cikanlar = [
    p.android === 'success' && `Android vc${p.versionCode} → Play "${p.track || 'alpha'}"`,
    p.ios === 'success' && `iOS build ${p.buildNumber} → TestFlight`,
].filter(Boolean);

const kismiMetin = !surumHatti
    ? 'Düşen işin kayıtlarına bakın.'
    : cikanlar.length
      ? `Dikkat: hattın bir kısmı YAYINLANDI — ${cikanlar.join(' ve ')}. Kalanı için düşen işin kayıtlarına bakın.`
      : 'Hiçbir şey yayınlanmadı; düşen işin kayıtlarına bakın.';

/* ---------- düz metin ---------- */
const satirlar = [];
satirlar.push(subject.replace(/^\S+\s/, ''));
satirlar.push('');
if (p.version) satirlar.push(`Sürüm:        ${p.version}`);
if (p.versionCode) satirlar.push(`Play          vc${p.versionCode} → "${p.track || 'alpha'}" (kapalı test)`);
if (p.buildNumber) satirlar.push(`TestFlight    build ${p.buildNumber}`);
satirlar.push('');
satirlar.push('İşler:');
for (const [ad, r] of JOBS) satirlar.push(`  ${isaret(r)} ${ad} — ${turkce(r)}`);

if (genel === 'success' && surumHatti) {
    satirlar.push('');
    satirlar.push('Sırada: testte doğrulayıp mağazalara elle geçirmek.');
    satirlar.push('(Hat üretime kendiliğinden çıkmaz — bu bilinçli bir insan kararı.)');
} else if (genel === 'failure') {
    satirlar.push('');
    satirlar.push(kismiMetin);
}

if (p.uyari) {
    satirlar.push('');
    satirlar.push(`⚠ DİKKAT: ${p.uyari}`);
}

if (p.notes) {
    satirlar.push('');
    satirlar.push('Sürüm notları:');
    satirlar.push(p.notes);
}
satirlar.push('');
satirlar.push(`Commit:  ${(p.sha || '').slice(0, 7)} — ${p.commitMsg || ''}`);
satirlar.push(`Koşu:    ${p.runUrl || ''}`);

// Künye bölümü boş kalabildiği için (hazırlık işi düştüyse sürüm bilgisi yok)
// arka arkaya gelen boş satırlar tekil hâle getiriliyor.
const duzMetin = satirlar.join('\n').replace(/\n{3,}/g, '\n\n');

/* ---------- HTML ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RENK = { success: '#15803d', failure: '#b91c1c', cancelled: '#6b7280', skipped: '#6b7280' };

const satirHtml = JOBS.map(([ad, r]) => `
    <tr>
      <td style="padding:6px 12px 6px 0;">${isaret(r)} ${esc(ad)}</td>
      <td style="padding:6px 0;color:${RENK[r] || '#6b7280'};font-weight:600;">${esc(turkce(r))}</td>
    </tr>`).join('');

const kunye = [
    p.version && ['Sürüm', esc(p.version)],
    p.versionCode && ['Play', `vc${esc(p.versionCode)} → <code>${esc(p.track || 'alpha')}</code> (kapalı test)`],
    p.buildNumber && ['TestFlight', `build ${esc(p.buildNumber)}`],
].filter(Boolean).map(([k, v]) => `
    <tr>
      <td style="padding:6px 16px 6px 0;color:#6b7280;">${k}</td>
      <td style="padding:6px 0;font-weight:600;">${v}</td>
    </tr>`).join('');

const html = `<!doctype html>
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111827;line-height:1.5;">
  <h2 style="margin:0 0 4px;font-size:18px;color:${RENK[genel]};">${esc(subject)}</h2>
  <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">${esc(BASLIK)}</p>
  ${kunye ? `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px;">${kunye}</table>` : ''}
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px;">${satirHtml}</table>
  ${genel === 'success' && surumHatti ? `<p style="margin:0 0 20px;padding:12px 14px;background:#f0fdf4;border-left:3px solid #15803d;font-size:13px;">
    Sırada testte doğrulayıp mağazalara <b>elle</b> geçirmek var.
    Hat üretime kendiliğinden çıkmaz.</p>` : ''}
  ${genel === 'failure' ? `<p style="margin:0 0 20px;padding:12px 14px;background:#fef2f2;border-left:3px solid #b91c1c;font-size:13px;">
    ${esc(kismiMetin)}</p>` : ''}
  ${p.uyari ? `<p style="margin:0 0 20px;padding:12px 14px;background:#fffbeb;border-left:3px solid #b45309;font-size:13px;">
    <b>Dikkat:</b> ${esc(p.uyari)}</p>` : ''}
  ${p.notes ? `<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Sürüm notları</p>
  <pre style="margin:0 0 20px;padding:12px 14px;background:#f9fafb;border-radius:6px;font-size:13px;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;">${esc(p.notes)}</pre>` : ''}
  <p style="margin:0;font-size:13px;color:#6b7280;">
    <code>${esc((p.sha || '').slice(0, 7))}</code> ${esc(p.commitMsg || '')}<br>
    <a href="${esc(p.runUrl)}" style="color:#2563eb;">Koşu kayıtlarını aç →</a>
  </p>
</div>`;

// Göndermeden içeriği görmek için: NOTIFY_DRY_RUN=1. Başarısızlık metnini
// sahte bir alarm e-postası atmadan denemenin yolu bu.
if (process.env.NOTIFY_DRY_RUN) {
    console.log(`--- konu ---\n${subject}\n--- gövde ---\n${duzMetin}`);
    process.exit(0);
}

const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject, text: duzMetin, html }),
});
const body = await r.text();
if (!r.ok) {
    console.error(`::error::Resend ${r.status}: ${body.slice(0, 300)}`);
    process.exit(1);
}
console.log(`bildirim gönderildi → ${TO} (${genel})`);
