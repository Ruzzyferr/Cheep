#!/usr/bin/env node
/**
 * Bir sonraki sürüm numaralarını MAĞAZAYA SORARAK belirler.
 *
 * NEDEN MAĞAZAYA SORUYORUZ: `github.run_number` gibi bir sayaçtan türetmek
 * basit ama kırılgan — iş akışı yeniden adlandırılırsa sayaç sıfırlanır ve
 * numara geriye gider; elle yüklenen bir build de sayacın önüne geçebilir.
 * Mağazadaki EN YÜKSEK numarayı okuyup bir artırmak her iki durumda da
 * kendini onarır ve "duplicate version code" reddini kökten önler.
 *
 * Çıktı: GITHUB_OUTPUT'a `version_code` ve `build_number`.
 * Yerelde çalıştırılırsa stdout'a yazar.
 *
 * Gerekli ortam:
 *   PLAY_SERVICE_ACCOUNT_JSON  (Play; androidpublisher yetkili servis hesabı)
 *   ASC_KEY_P8 / ASC_KEY_ID / ASC_ISSUER_ID   (App Store Connect)
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const PKG = 'com.cheep.mobile';
const ASC_APP_ID = '6803882626';

const b64url = (b) =>
    Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* ------------------------------------------------------------------ Play */

async function playToken(saJson) {
    const sa = JSON.parse(saJson);
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
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${header}.${claim}.${sig}`,
        }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error(`Play OAuth başarısız: ${JSON.stringify(data).slice(0, 200)}`);
    return data.access_token;
}

/** Tüm kanallardaki en yüksek versionCode. Hiç sürüm yoksa 0. */
async function highestVersionCode(token) {
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
    const call = async (path, method = 'GET', body) => {
        const r = await fetch(base + path, {
            method,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await r.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        if (!r.ok) throw new Error(`Play ${method} ${path} -> ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
        return data;
    };

    const edit = await call('/edits', 'POST', {});
    try {
        const { tracks = [] } = await call(`/edits/${edit.id}/tracks`);
        let max = 0;
        for (const t of tracks) {
            for (const r of t.releases ?? []) {
                for (const v of r.versionCodes ?? []) max = Math.max(max, Number(v));
            }
        }
        return max;
    } finally {
        // Edit'i AÇIK BIRAKMA: aynı anda başka bir edit açılamaz ve bir sonraki
        // koşu "edit already in progress" ile düşer.
        await call(`/edits/${edit.id}`, 'DELETE').catch(() => {});
    }
}

/* ------------------------------------------------------- App Store Connect */

function ascToken(p8, keyId, issuerId) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
    const payload = b64url(
        JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }),
    );
    const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), {
        key: p8,
        dsaEncoding: 'ieee-p1363',
    });
    return `${header}.${payload}.${b64url(sig)}`;
}

/** ASC'deki en yüksek build numarası. Hiç build yoksa 0. */
async function highestBuildNumber(jwt) {
    const url =
        `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${ASC_APP_ID}` +
        '&limit=200&fields[builds]=version&sort=-version';
    const r = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
    if (!r.ok) throw new Error(`ASC builds -> ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const { data = [] } = await r.json();
    let max = 0;
    for (const b of data) {
        const n = Number.parseInt(b.attributes?.version ?? '0', 10);
        if (Number.isFinite(n)) max = Math.max(max, n);
    }
    return max;
}

/* ----------------------------------------------------------------- main */

const emit = (key, value) => {
    console.log(`${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
};

const want = process.argv[2] ?? 'both'; // android | ios | both

if (want === 'android' || want === 'both') {
    const sa = process.env.PLAY_SERVICE_ACCOUNT_JSON;
    if (!sa) throw new Error('PLAY_SERVICE_ACCOUNT_JSON tanımlı değil');
    const max = await highestVersionCode(await playToken(sa));
    console.error(`  Play'deki en yüksek versionCode: ${max}`);
    emit('version_code', max + 1);
}

if (want === 'ios' || want === 'both') {
    const p8 = process.env.ASC_KEY_P8;
    const keyId = process.env.ASC_KEY_ID;
    const issuer = process.env.ASC_ISSUER_ID;
    if (!p8 || !keyId || !issuer) throw new Error('ASC_KEY_P8 / ASC_KEY_ID / ASC_ISSUER_ID eksik');
    const max = await highestBuildNumber(ascToken(p8, keyId, issuer));
    console.error(`  ASC'deki en yüksek build numarası: ${max}`);
    emit('build_number', max + 1);
}
