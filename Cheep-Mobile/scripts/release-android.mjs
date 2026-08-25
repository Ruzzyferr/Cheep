#!/usr/bin/env node
/**
 * Android sürüm derlemesi — tek komut, ön kontrollü.
 *
 * NEDEN VAR: sürüm çıkarma adımları belgede duruyordu ve elle yazılıyordu.
 * Adımlardan biri `expo prebuild --platform android --clean`, yani android/
 * klasörünü tamamen silen bir komut. Belge "önce keystore'u yedekle" diyordu
 * ama koruma, o satırı okumayı hatırlamaya bağlıydı. Bir kez hatırlanmadı ve
 * upload keystore geri dönülmez biçimde kayboldu.
 *
 * Artık iki şey birden doğru:
 *   1. Anahtar zaten proje dışındaki kasada (bkz. plugins/withReleaseSigning.js),
 *      yani --clean onu göremiyor bile.
 *   2. Sürüm çıkarmak için elle --clean yazmaya gerek yok — bu script yapıyor,
 *      önce kasayı doğruluyor, sonra imzayı denetliyor.
 *
 * Kullanım:
 *   npm run release:android            # prebuild + bundleRelease + doğrula
 *   npm run release:android -- --apk   # AAB yerine kurulabilir APK
 *   npm run release:android -- --skip-prebuild
 *
 * En sinsi hata AAB'nin DEBUG anahtarıyla imzalanmış olmasıdır: derleme başarılı
 * görünür, dosya üretilir, Play Console yüklemeyi reddeder. Script bunu üretimden
 * SONRA sertifika parmak izini karşılaştırarak yakalar ve hata koduyla çıkar.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = path.join(PROJECT, 'android');
const VAULT = process.env.CHEEP_KEYSTORE_DIR || path.join(os.homedir(), 'CheepKeys');

const args = process.argv.slice(2);
const wantApk = args.includes('--apk');
const skipPrebuild = args.includes('--skip-prebuild');

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
function die(msg) {
    console.error(`\n✖ ${msg}\n`);
    process.exit(1);
}

/** JDK 17'nin keytool'u. JAVA_HOME → bilinen konumlar → PATH. */
function findKeytool() {
    const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool';
    const candidates = [
        process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', exe),
        'C:/Program Files/Java/jdk-17/bin/keytool.exe',
        'C:/Program Files/Android/Android Studio/jbr/bin/keytool.exe',
    ].filter(Boolean);
    for (const c of candidates) if (fs.existsSync(c)) return c;
    const probe = spawnSync(exe, ['-help'], { stdio: 'ignore' });
    if (probe.status === 0 || probe.status === 1) return exe;
    die('keytool bulunamadı. JDK 17 kurun veya JAVA_HOME ayarlayın.');
}

/** keytool çıktısından SHA-256 parmak izini ve sahibini çeker. */
function certInfo(output) {
    const sha256 = output.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1];
    const owner = output.match(/Owner:\s*(.+)/)?.[1]?.trim();
    return { sha256, owner };
}

/**
 * SDK'daki en yeni build-tools içinden `apksigner` yolunu bulur.
 * Bulunamazsa null — çağıran keytool'a düşer.
 */
function findApksigner() {
    const sdk =
        process.env.ANDROID_HOME ||
        process.env.ANDROID_SDK_ROOT ||
        path.join(os.homedir(), 'AppData/Local/Android/Sdk');
    const dir = path.join(sdk, 'build-tools');
    if (!fs.existsSync(dir)) return null;
    const versions = fs
        .readdirSync(dir)
        .filter((v) => /^\d+/.test(v))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const v of versions.reverse()) {
        const exe = path.join(dir, v, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner');
        if (fs.existsSync(exe)) return exe;
    }
    return null;
}

/**
 * Çıktının imzalayan sertifikasını okur.
 *
 * NEDEN İKİ YOL VAR: `keytool -printcert -jarfile` yalnızca **v1 (JAR)** imzasını
 * görebilir. R8 açık modern bir APK yalnızca **v2** şemasıyla imzalanıyor ve
 * keytool onu "imzasız" sanıp doğrulamayı düşürüyordu — derleme doğruyken
 * script hata veriyordu. APK'lar için `apksigner` kullanılır (v1/v2/v3 hepsini
 * okur); AAB bir JAR olduğu için keytool orada doğru araçtır.
 */
function readArtifactCert(artifact) {
    if (artifact.endsWith('.apk')) {
        const apksigner = findApksigner();
        if (apksigner) {
            // apksigner Windows'ta bir .bat sarmalayıcı; execFileSync onu
            // doğrudan çalıştıramaz (EINVAL). `shell: true` işe yarar ama
            // argümanları kaçışsız birleştirir (Node DEP0190). Bunun yerine
            // cmd.exe AÇIKÇA çağrılıp argümanlar dizi olarak veriliyor —
            // hem çalışır hem kaçış sorunu olmaz.
            const [cmd, cmdArgs] =
                process.platform === 'win32'
                    ? ['cmd.exe', ['/d', '/s', '/c', apksigner, 'verify', '--print-certs', artifact]]
                    : [apksigner, ['verify', '--print-certs', artifact]];
            const out = execFileSync(cmd, cmdArgs, { encoding: 'utf8' });
            // apksigner tireli değil düz hex basar; keystore çıktısıyla
            // karşılaştırılabilmesi için aynı biçime getiriliyor.
            const hex = out.match(/certificate SHA-256 digest:\s*([0-9a-f]+)/i)?.[1];
            const sha256 = hex ? hex.toUpperCase().match(/../g).join(':') : undefined;
            const owner = out.match(/certificate DN:\s*(.+)/)?.[1]?.trim();
            return { sha256, owner };
        }
        console.log('    ⚠ apksigner bulunamadı, keytool ile deneniyor (v2-only imzayı göremeyebilir)');
    }
    return certInfo(execFileSync(keytool, ['-printcert', '-jarfile', artifact], { encoding: 'utf8' }));
}

function readProps(file) {
    const out = {};
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return out;
}

/** Masaüstü — OneDrive'a yönlendirilmiş olabilir. */
function desktopDir() {
    for (const d of [path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'OneDrive', 'Desktop')]) {
        if (fs.existsSync(d)) return d;
    }
    return os.homedir();
}

/**
 * Windows'ta .bat/.cmd yalnızca kabuk üzerinden çalıştırılabiliyor, kabuk da
 * argümanları kendisi ayrıştırdığı için boşluklu yolları elle tırnaklamak
 * gerekiyor (spawnSync shell:true modunda tırnaklamıyor).
 */
function run(cmd, cmdArgs, cwd) {
    const shell = process.platform === 'win32';
    const quote = (s) => (shell && /[\s&|<>^]/.test(s) ? `"${s}"` : s);
    const r = shell
        ? spawnSync(quote(cmd), cmdArgs.map(quote), { cwd, stdio: 'inherit', shell: true })
        : spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
    if (r.status !== 0) die(`komut başarısız: ${cmd} ${cmdArgs.join(' ')}`);
}

// ── 1) Kasa ön kontrolü ─────────────────────────────────────────────────────
// Derlemeden ÖNCE. Anahtar yoksa 15 dakikalık bir Gradle derlemesinin sonunda
// öğrenmek yerine hemen öğren.
step('1/5', 'imza kasası doğrulanıyor');

const signingFile = path.join(VAULT, 'signing.properties');
if (!fs.existsSync(signingFile)) {
    die(
        `imza kasası yok: ${signingFile}\n` +
            '  Kasa git\'te değildir; başka makineden kopyalayın veya\n' +
            '  CHEEP_KEYSTORE_DIR ile yerini gösterin.\n' +
            '  Yeni anahtar üretimi için: docs/BUILD-RELEASE.md → "İmza kasası"',
    );
}

const signing = readProps(signingFile);
const keystore = path.resolve(VAULT, signing.storeFile || 'cheep-upload.keystore');
if (!fs.existsSync(keystore)) die(`keystore dosyası yok: ${keystore}`);
for (const k of ['storePassword', 'keyAlias', 'keyPassword']) {
    if (!signing[k]) die(`signing.properties içinde ${k} eksik`);
}

const keytool = findKeytool();
let keystoreCert;
try {
    keystoreCert = certInfo(
        execFileSync(
            keytool,
            ['-list', '-v', '-keystore', keystore, '-alias', signing.keyAlias, '-storepass', signing.storePassword],
            { encoding: 'utf8' },
        ),
    );
} catch (err) {
    die(`keystore açılamadı — parola veya alias yanlış olabilir.\n  ${String(err.stderr || err.message).trim()}`);
}
if (!keystoreCert.sha256) die('keystore parmak izi okunamadı');
console.log(`    ${keystoreCert.owner}`);
console.log(`    SHA256 ${keystoreCert.sha256}`);

// ── 2) Native proje ─────────────────────────────────────────────────────────
// --clean artık güvenli: sildiği her şey türetilebilir. key.properties'i plugin
// kasadan yeniden yazıyor, keystore zaten android/ içinde değil.
step('2/5', skipPrebuild ? 'prebuild atlandı' : 'native proje üretiliyor (expo prebuild --clean)');
if (!skipPrebuild) {
    run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean'], PROJECT);
}

const keyProps = path.join(ANDROID, 'key.properties');
if (!fs.existsSync(keyProps)) {
    die(
        'android/key.properties üretilmedi — release DEBUG anahtarıyla imzalanırdı.\n' +
            '  plugins/withReleaseSigning.js kasayı bulamamış olabilir.',
    );
}
console.log('    ✓ key.properties kasadan üretildi');

// ── 3) Derleme ──────────────────────────────────────────────────────────────
// Mutlak yol: cmd.exe her ortamda çalışma dizinini PATH'e katmıyor.
const gradlew = path.join(ANDROID, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const task = wantApk ? 'assembleRelease' : 'bundleRelease';
step('3/5', `${task} çalışıyor (birkaç dakika sürer)`);
run(gradlew, [task], ANDROID);

const artifact = wantApk
    ? path.join(ANDROID, 'app/build/outputs/apk/release/app-release.apk')
    : path.join(ANDROID, 'app/build/outputs/bundle/release/app-release.aab');
if (!fs.existsSync(artifact)) die(`çıktı bulunamadı: ${artifact}`);

// ── 4) İmza doğrulaması ─────────────────────────────────────────────────────
// Derlemenin başarılı olması imzanın doğru olduğunu göstermez.
step('4/5', 'imza doğrulanıyor');
const artifactCert = readArtifactCert(artifact);
console.log(`    ${artifactCert.owner ?? '(sahip okunamadı)'}`);
if (!artifactCert.sha256) die('çıktının sertifikası okunamadı — imzasız olabilir');
if (artifactCert.sha256 !== keystoreCert.sha256) {
    die(
        'ÇIKTI YANLIŞ ANAHTARLA İMZALANMIŞ — Play Console reddeder.\n' +
            `  beklenen: ${keystoreCert.sha256}\n` +
            `  bulunan : ${artifactCert.sha256}\n` +
            (/Android Debug/.test(artifactCert.owner || '') ? '  (debug anahtarı — key.properties uygulanmamış)\n' : ''),
    );
}
console.log('    ✓ upload anahtarıyla imzalanmış');

// ── 5) Masaüstüne kopyala ───────────────────────────────────────────────────
step('5/5', 'çıktı kopyalanıyor');
const app = JSON.parse(fs.readFileSync(path.join(PROJECT, 'app.json'), 'utf8')).expo;
const name = `cheep-${app.version}-vc${app.android.versionCode}${wantApk ? '.apk' : '.aab'}`;
const dest = path.join(desktopDir(), name);
fs.copyFileSync(artifact, dest);

console.log(`\n✅ ${dest}`);
console.log(`   sürüm ${app.version} (versionCode ${app.android.versionCode})`);
console.log(`   SHA256 ${artifactCert.sha256}\n`);
