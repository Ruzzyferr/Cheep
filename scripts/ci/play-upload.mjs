#!/usr/bin/env node
/**
 * AAB'yi Google Play'e bir TEST kanalına yükler.
 *
 * Play'in edit modeli işlem tabanlı: edit aç → yükle → kanalı ayarla → commit.
 * Commit edilmeyen edit hiçbir şey değiştirmez, bu yüzden hata durumunda
 * edit'i BIRAKMAK güvenli ama İYİ DEĞİL — açık edit bir sonraki koşuyu
 * "edit already in progress" ile düşürebilir, o yüzden hata yolunda siliniyor.
 *
 * Üretime ASLA yüklemez: kanal parametresi dışarıdan gelir ve `production`
 * ise açıkça reddedilir. Testten mağazaya geçiş insan kararı.
 *
 * Kullanım:
 *   node play-upload.mjs <aab-yolu> <kanal> <surum-adi> <notlar-dosyasi>
 * Ortam:
 *   PLAY_SERVICE_ACCOUNT_JSON
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const [, , aabPath, track, releaseName, notesPath] = process.argv;
const PKG = 'com.cheep.mobile';

if (!aabPath || !track || !releaseName) {
    throw new Error('kullanım: play-upload.mjs <aab> <kanal> <surum-adi> [notlar-dosyasi]');
}
if (track === 'production') {
    throw new Error(
        'Bu betik üretime yüklemez. Test kanalından mağazaya geçiş bilinçli bir insan kararıdır.',
    );
}
if (!fs.existsSync(aabPath)) throw new Error(`AAB bulunamadı: ${aabPath}`);

const notes = notesPath && fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8').trim() : '';

const b64url = (b) =>
    Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token() {
    const sa = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON ?? '');
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(
        JSON.stringify({
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/androidpublisher',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now,
        }),
    );
    const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claim}`), sa.private_key));
    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${header}.${claim}.${sig}`,
        }),
    });
    const d = await r.json();
    if (!d.access_token) throw new Error(`Play OAuth: ${JSON.stringify(d).slice(0, 200)}`);
    return d.access_token;
}

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}`;

const tok = await token();

async function call(url, { method = 'GET', json, body, contentType } = {}) {
    const headers = { Authorization: `Bearer ${tok}` };
    if (json !== undefined) headers['Content-Type'] = 'application/json';
    if (contentType) headers['Content-Type'] = contentType;
    const r = await fetch(url, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : body,
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!r.ok) throw new Error(`${method} ${url.replace(BASE, '').replace(UPLOAD, '')} -> ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
    return data;
}

const edit = await call(`${BASE}/edits`, { method: 'POST', json: {} });
console.log(`edit açıldı: ${edit.id}`);

try {
    console.log(`AAB yükleniyor (${(fs.statSync(aabPath).size / 1048576).toFixed(1)} MB)…`);
    const bundle = await call(`${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, {
        method: 'POST',
        body: fs.readFileSync(aabPath),
        contentType: 'application/octet-stream',
    });
    const versionCode = bundle.versionCode;
    console.log(`yüklendi: versionCode ${versionCode}`);

    // Notlar yalnızca mağaza listelemesi OLAN diller için kabul edilir;
    // olmayan bir dil gönderilirse Play tüm isteği reddeder.
    const releaseNotes = notes ? [{ language: 'tr-TR', text: notes }] : undefined;

    await call(`${BASE}/edits/${edit.id}/tracks/${track}`, {
        method: 'PUT',
        json: {
            track,
            releases: [
                {
                    name: releaseName,
                    versionCodes: [String(versionCode)],
                    status: 'completed', // test kanalında testçilere hemen açılır
                    ...(releaseNotes ? { releaseNotes } : {}),
                },
            ],
        },
    });
    console.log(`"${track}" kanalına atandı: ${releaseName}`);

    await call(`${BASE}/edits/${edit.id}:commit`, { method: 'POST' });
    console.log(`✅ commit edildi — vc${versionCode} artık "${track}" kanalında`);
} catch (err) {
    // Açık edit bırakma: bir sonraki koşu "edit already in progress" ile düşer.
    await call(`${BASE}/edits/${edit.id}`, { method: 'DELETE' }).catch(() => {});
    console.error('edit geri alındı (hiçbir değişiklik yayınlanmadı)');
    throw err;
}
