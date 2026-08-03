#!/usr/bin/env node
/**
 * Yeni upload anahtarı üretir — doğrudan proje DIŞINDAKİ kasaya.
 *
 * NEDEN VAR: keystore'u elle `keytool` ile üretmek, onu yanlış yere koymayı
 * (android/app/ — her prebuild'de silinen klasör) ve yedeklemeyi unutmayı
 * kolaylaştırıyordu. Bir kez öyle oldu ve anahtar geri gelmedi.
 *
 * Bu script yeri seçtirmiyor: kasa ~/CheepKeys (veya $CHEEP_KEYSTORE_DIR),
 * yani prebuild'in eli değmeyen bir dizin. Yanına parolayı da yazıyor ve
 * tarihli bir yedek kopya bırakıyor.
 *
 *   npm run keys:new
 *
 * Mevcut bir kasanın ÜZERİNE YAZMAZ — yayındaki anahtarı kazara değiştirmek,
 * kaybetmekle aynı sonucu doğurur. Bilerek değiştirilecekse eski kasa elle
 * taşınmalı.
 *
 * ÖNEMLİ: yeni bir upload anahtarı, Play'de yayında olan bir uygulamaya
 * KENDİLİĞİNDEN geçerli olmaz. Play Console → App integrity → upload key reset
 * ile bu sertifikanın Google tarafından kabul edilmesi gerekir (1-2 iş günü).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VAULT = process.env.CHEEP_KEYSTORE_DIR || path.join(os.homedir(), 'CheepKeys');
const ALIAS = 'cheep-upload';
const STORE = 'cheep-upload.keystore';
const DNAME = 'CN=Cheep, OU=Mobile, O=Cheep, L=Istanbul, C=TR';

function die(msg) {
    console.error(`\n✖ ${msg}\n`);
    process.exit(1);
}

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

/**
 * Parola. Karışıklık yaratan karakterler yok (0/O, 1/l/I) ve kabuk için
 * özel anlamı olan karakterler yok — elle kopyalanacağı için.
 */
function makePassword(len = 28) {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return Array.from(crypto.randomFillSync(new Uint32Array(len)), (n) => abc[n % abc.length]).join('');
}

const keystore = path.join(VAULT, STORE);
const signingFile = path.join(VAULT, 'signing.properties');

if (fs.existsSync(keystore) || fs.existsSync(signingFile)) {
    die(
        `kasada zaten bir anahtar var: ${VAULT}\n` +
            '  Üzerine yazmak, yayındaki anahtarı kaybetmekle aynı şey.\n' +
            '  Gerçekten değiştirilecekse eski dosyaları önce elle taşıyın.',
    );
}

fs.mkdirSync(VAULT, { recursive: true });
const keytool = findKeytool();
const password = makePassword();

console.log(`\nyeni upload anahtarı üretiliyor → ${keystore}\n`);
try {
    execFileSync(
        keytool,
        [
            '-genkeypair', '-v',
            '-keystore', keystore,
            '-alias', ALIAS,
            '-keyalg', 'RSA',
            '-keysize', '2048',
            '-validity', '10000',
            '-dname', DNAME,
            '-storepass', password,
            '-keypass', password,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
} catch (err) {
    die(`keytool başarısız:\n${String(err.stderr || err.message).trim()}`);
}

fs.writeFileSync(
    signingFile,
    [
        '# Cheep upload anahtarı. Bu dosya git\'te DEĞİLDİR ve olmamalıdır.',
        '# plugins/withReleaseSigning.js bunu okuyup android/key.properties üretir.',
        `storeFile=${STORE}`,
        `storePassword=${password}`,
        `keyAlias=${ALIAS}`,
        `keyPassword=${password}`,
        '',
    ].join('\n'),
    'utf8',
);

// Tarihli yedek: kasa dizini kazara silinirse ikinci bir kopya kalsın.
const stamp = new Date().toISOString().slice(0, 10);
const backupDir = path.join(VAULT, 'backups', stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(keystore, path.join(backupDir, STORE));
fs.copyFileSync(signingFile, path.join(backupDir, 'signing.properties'));

const cert = execFileSync(
    keytool,
    ['-list', '-v', '-keystore', keystore, '-alias', ALIAS, '-storepass', password],
    { encoding: 'utf8' },
);
const sha1 = cert.match(/SHA1:\s*([0-9A-F:]+)/i)?.[1];
const sha256 = cert.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1];

// Play Console'un upload key reset formu PEM sertifika ister.
const pem = path.join(VAULT, 'upload_certificate.pem');
execFileSync(keytool, [
    '-export', '-rfc',
    '-keystore', keystore,
    '-alias', ALIAS,
    '-storepass', password,
    '-file', pem,
]);

console.log('─'.repeat(72));
console.log(`kasa      : ${VAULT}`);
console.log(`keystore  : ${STORE}`);
console.log(`alias     : ${ALIAS}`);
console.log(`PAROLA    : ${password}`);
console.log(`SHA1      : ${sha1}`);
console.log(`SHA256    : ${sha256}`);
console.log(`sertifika : ${pem}   ← Play Console upload key reset formuna bu yüklenir`);
console.log(`yedek     : ${backupDir}`);
console.log('─'.repeat(72));
console.log('\n⚠️  Parolayı bir parola yöneticisine kaydedin. Kasayı harici bir diske/');
console.log('    şifreli buluta kopyalayın. Bu dosyalar kaybolursa Play\'e güncelleme');
console.log('    yüklenemez.\n');
