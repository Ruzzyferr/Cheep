/**
 * Kapalı testteki bir yapıyı Play ÜRETİM kanalına yükseltir.
 *
 * NEDEN AYRI BİR BETİK: `play-upload.mjs` üretim kanalını AÇIKÇA REDDEDİYOR ve
 * bu koruma bilinçli — sürüm hattı her push'ta üretime yazmamalı. Yükseltme
 * ayrı, insan tarafından tetiklenen bir eylem; koruma yerinde kalıyor.
 *
 * KADEMELİ DAĞITIM VARSAYILAN. Tam dağıtımı istemek açıkça `1` yazmayı
 * gerektiriyor: bozuk bir sürümü tüm kullanıcılara aynı anda vermek geri
 * alınamıyor (Play eski sürümü otomatik geri yüklemiyor), oysa kademeli
 * dağıtımda oran düşürülerek zarar durdurulabiliyor.
 *
 * Kullanım:
 *   PLAY_SERVICE_ACCOUNT_JSON=<json> node scripts/ci/play-promote.mjs <versionCode> <oran> [--commit]
 *     oran: 0 < x <= 1   (0.2 = %20 kademeli, 1 = tam dağıtım)
 *   --commit verilmezse hiçbir şey gönderilmez (kuru koşum).
 *
 * Sürüm notları `release-notes-production.json` dosyasından okunuyor —
 * commit başlıklarından ÜRETİLMİYOR. Test kanalının notları testçi içindir;
 * mağaza notunu insan yazar (dil başına 500 karakter).
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PKG = 'com.cheep.mobile';
const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;

const [vcArg, oranArg] = process.argv.slice(2);
const COMMIT = process.argv.includes('--commit');
const vc = Number(vcArg);
const oran = Number(oranArg);

if (!Number.isInteger(vc) || vc <= 0) {
  console.error('versionCode bir tamsayı olmalı. Örnek: node play-promote.mjs 40 0.2 --commit');
  process.exit(1);
}
if (!(oran > 0 && oran <= 1)) {
  console.error('oran 0 < x <= 1 olmalı (0.2 = %20, 1 = tam dağıtım).');
  process.exit(1);
}

const KEY = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON ?? readFileSync(process.env.PLAY_SA, 'utf8'));
const b64u = (x) => Buffer.from(x).toString('base64url');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64u(JSON.stringify({
    iss: KEY.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = createSign('RSA-SHA256').update(`${h}.${c}`).sign(KEY.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${sig}`,
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('token alınamadı: ' + JSON.stringify(d));
  return d.access_token;
}

const T = await token();

/**
 * Google ARA SIRA JSON yerine HTML hata sayfası döndürüyor; çıplak
 * `JSON.parse` o durumda nerede patladığı görünmeyen bir SyntaxError veriyor.
 * Yanıt önce metin olarak alınıp öyle ayrıştırılıyor.
 */
async function call(method, path, body) {
  const r = await fetch(BASE + path, {
    method, headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let d;
  try { d = raw ? JSON.parse(raw) : {}; } catch {
    throw new Error(`${method} ${path} -> ${r.status}: JSON DEĞİL: ${raw.slice(0, 200)}`);
  }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(d).slice(0, 400)}`);
  return d;
}

// `_` ile başlayan anahtarlar DİL DEĞİL, dosyanın kendi açıklaması.
//
// Notlar dosyası artık neden öyle yazıldığını (hangi sürümden hangi sürüme
// fark olduğunu) `_not` alanında taşıyor — bayat not yazmak somut bir hata
// olduğu için bu açıklama dosyanın yanında durmalı. Süzmezsek Play'e
// `language: "_not"` diye bir sürüm notu gönderilir.
const notlar = Object.fromEntries(
  Object.entries(
    JSON.parse(readFileSync(new URL('./release-notes-production.json', import.meta.url), 'utf8')),
  ).filter(([anahtar]) => !anahtar.startsWith('_')),
);
if (Object.keys(notlar).length === 0) throw new Error('sürüm notu dosyasında hiç dil yok');
for (const [dil, metin] of Object.entries(notlar)) {
  if ([...metin].length > 500) throw new Error(`${dil}: sürüm notu ${[...metin].length}/500 karakter`);
}

const edit = await call('POST', '/edits');
console.log('edit:', edit.id, COMMIT ? '(GÖNDERİLECEK)' : '(kuru koşum)');

// EMNİYET: istenen versionCode gerçekten yüklenmiş mi? Yüklenmemiş bir vc ile
// track güncellemek Play'de sessizce boş bir sürüm bırakabiliyor.
const bundles = await call('GET', `/edits/${edit.id}/bundles`);
const mevcut = (bundles.bundles || []).map((b) => b.versionCode);
if (!mevcut.includes(vc)) {
  throw new Error(`versionCode ${vc} yüklenmemiş. Yüklü olanlar: ${mevcut.join(', ')}`);
}

const oncesi = await call('GET', `/edits/${edit.id}/tracks/production`);
console.log('üretimdeki mevcut sürümler:',
  (oncesi.releases || []).map((r) => `${(r.versionCodes || []).join('/')} ${r.status} ${r.userFraction ?? 1}`).join(' | ') || '(yok)');

const release = {
  versionCodes: [String(vc)],
  status: oran === 1 ? 'completed' : 'inProgress',
  releaseNotes: Object.entries(notlar).map(([language, text]) => ({ language, text })),
};
if (oran !== 1) release.userFraction = oran;

console.log(`hedef: vc ${vc} -> ${release.status}${oran === 1 ? '' : ` (%${Math.round(oran * 100)})`}`);
console.log('sürüm notu dilleri:', Object.keys(notlar).join(', '));

if (!COMMIT) {
  await call('DELETE', `/edits/${edit.id}`).catch(() => {});
  console.log('kuru koşum bitti; uygulamak için --commit ekle.');
  process.exit(0);
}

await call('PUT', `/edits/${edit.id}/tracks/production`, { track: 'production', releases: [release] });
const res = await call('POST', `/edits/${edit.id}:commit`);
console.log('commit edildi:', res.id || 'ok');
