#!/usr/bin/env node
/**
 * Apple imzalama kimliklerinin ne zaman dolacağını kontrol eder.
 *
 * NEDEN VAR: dağıtım sertifikası ve provisioning profili SÜRELİ (Apple'da
 * tipik olarak bir yıl). Dolduğu gün iOS derlemesi kırılır ve o ana kadar
 * hiçbir şey uyarmaz — hattın sessizce öleceği tek yer burası. Yenileme
 * ayrıca elle yapılan bir iş (yeni sertifika üret, .p12'yi dışa aktar,
 * GitHub secret'larını güncelle), yani son güne bırakılacak bir şey değil.
 *
 * ASLA DERLEMEYİ DÜŞÜRMEZ (dolmuş olsa bile): derleme zaten kendi başına
 * anlaşılır bir imza hatasıyla düşer. Buranın işi haber vermek. Ağ hatası
 * yüzünden bir sürümü engellemek de yanlış olurdu.
 *
 * Ortam: ASC_KEY_P8, ASC_KEY_ID, ASC_ISSUER_ID
 * Çıktı: GITHUB_OUTPUT'a `uyari` (boş = sorun yok)
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const UYARI_ESIGI_GUN = 45;

const { ASC_KEY_P8, ASC_KEY_ID, ASC_ISSUER_ID, GITHUB_OUTPUT } = process.env;

/** Uyarıyı hem loga hem iş akışı çıktısına yazar. */
function bitir(uyari) {
    if (uyari) {
        console.log(`::warning::${uyari}`);
    } else {
        console.log('Apple imzalama kimlikleri sağlam.');
    }
    if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `uyari=${uyari ?? ''}\n`);
    process.exit(0);
}

if (!ASC_KEY_P8 || !ASC_KEY_ID || !ASC_ISSUER_ID) {
    bitir('ASC kimlikleri tanımlı değil — sertifika süresi kontrol EDİLEMEDİ.');
}

const b64 = (o) =>
    Buffer.from(o).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let JWT;
try {
    const now = Math.floor(Date.now() / 1000);
    const h = b64(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
    const p = b64(
        JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }),
    );
    const sig = crypto
        .sign('sha256', Buffer.from(`${h}.${p}`), { key: ASC_KEY_P8, dsaEncoding: 'ieee-p1363' })
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    JWT = `${h}.${p}.${sig}`;
} catch (e) {
    bitir(`ASC anahtarı okunamadı, sertifika süresi kontrol edilemedi: ${e.message}`);
}

async function api(path) {
    const r = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
        headers: { Authorization: `Bearer ${JWT}` },
    });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r.json();
}

const gunKaldi = (iso) => Math.round((new Date(iso) - Date.now()) / 86400000);

try {
    const [certs, profiles] = await Promise.all([
        api('certificates?limit=50'),
        api('profiles?limit=50&include=bundleId'),
    ]);

    const dagitim = (certs.data ?? []).filter((c) =>
        String(c.attributes?.certificateType).includes('DISTRIBUTION'),
    );

    // Yalnızca BU uygulamanın profili ilgilendiriyor; hesapta başka
    // uygulamaların (Swiip, Conversa) profilleri de duruyor ve onların
    // süresi bu hattı etkilemiyor.
    const bundleAdlari = new Map(
        (profiles.included ?? []).map((b) => [b.id, b.attributes?.identifier]),
    );
    const cheepProfilleri = (profiles.data ?? []).filter(
        (p) =>
            bundleAdlari.get(p.relationships?.bundleId?.data?.id) === 'com.cheep.mobile' &&
            p.attributes?.profileState === 'ACTIVE',
    );

    const adaylar = [
        ...dagitim.map((c) => ({
            ne: `Dağıtım sertifikası "${c.attributes.name}"`,
            gun: gunKaldi(c.attributes.expirationDate),
            tarih: c.attributes.expirationDate?.slice(0, 10),
        })),
        ...cheepProfilleri.map((p) => ({
            ne: `Provisioning profili "${p.attributes.name}"`,
            gun: gunKaldi(p.attributes.expirationDate),
            tarih: p.attributes.expirationDate?.slice(0, 10),
        })),
    ];

    if (!adaylar.length) {
        bitir('App Store Connect hesabında dağıtım sertifikası/profili bulunamadı.');
    }

    for (const a of adaylar) {
        const durum = a.gun < 0 ? 'DOLMUŞ' : a.gun < UYARI_ESIGI_GUN ? 'yakında doluyor' : 'sağlam';
        console.log(`  ${a.ne} — ${a.tarih} (${a.gun} gün, ${durum})`);
    }

    // En yakın dolan hangisiyse uyarı onun üzerinden verilir.
    const enYakin = adaylar.reduce((a, b) => (a.gun <= b.gun ? a : b));
    if (enYakin.gun < 0) {
        bitir(`${enYakin.ne} ${enYakin.tarih} tarihinde DOLDU. iOS derlemesi imzalanamaz — yenileyip GitHub secret'larını güncelleyin.`);
    }
    if (enYakin.gun < UYARI_ESIGI_GUN) {
        bitir(`${enYakin.ne} ${enYakin.gun} gün sonra doluyor (${enYakin.tarih}). Yenileyip GitHub secret'larını güncelleyin; dolduğu gün iOS hattı durur.`);
    }
    bitir(null);
} catch (e) {
    bitir(`Sertifika süresi kontrol edilemedi (${e.message}). Sürüm etkilenmedi.`);
}
