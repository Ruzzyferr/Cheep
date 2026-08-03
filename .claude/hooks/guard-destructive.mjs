#!/usr/bin/env node
/**
 * PreToolUse koruması — geri alınamaz klasör silmelerini reddeder.
 *
 * NEDEN VAR: `npx expo prebuild --platform android --clean` android/ klasörünü
 * tamamen siler. O klasörün içinde, git'te olmayan ve başka kopyası bulunmayan
 * upload keystore duruyordu. Komut bir kez çalıştırıldı, anahtar gitti; Play'e
 * güncelleme yükleyebilmek için Google'dan upload anahtarı sıfırlaması istemek
 * gerekti.
 *
 * Asıl onarım anahtarı proje dışına taşımaktı (plugins/withReleaseSigning.js).
 * Bu hook ikinci savunma hattı: aynı sınıftan komutlar — android/ veya ios/
 * klasörünü toptan silen her şey — otomatik onaydan geçemesin, insan görsün.
 *
 * Yalnızca REDDEDER; hiçbir şeyi çalıştırmaz. Kullanıcı gerçekten istiyorsa
 * komutu kendisi çalıştırabilir.
 */
import { readFileSync } from 'node:fs';

/**
 * Her kural: komut satırında hepsi birden geçmesi gereken kalıplar.
 * Böylece "prebuild" tek başına, "--clean" tek başına serbest kalıyor.
 */
const RULES = [
    {
        id: 'prebuild-clean',
        all: [/\bprebuild\b/, /--clean\b/],
        why: '`expo prebuild --clean` android/ ve ios/ klasörlerini tamamen siler.',
        instead: 'Bunun yerine: cd Cheep-Mobile && npm run release:android',
    },
    {
        id: 'rm-native',
        all: [/\brm\b[^\n]*-[a-zA-Z]*[rR]/, /(^|[\s"'`/\\])(android|ios)([\s"'`/\\]|$)/],
        why: 'android/ veya ios/ klasörünü özyinelemeli siliyor.',
        instead: 'Bu klasörler türetilebilir ama içlerinde git\'te olmayan dosyalar bulunabilir.',
    },
    {
        id: 'remove-item-native',
        all: [/Remove-Item/i, /-Recurse/i, /(^|[\s"'`/\\])(android|ios)([\s"'`/\\]|$)/],
        why: 'android/ veya ios/ klasörünü özyinelemeli siliyor.',
        instead: 'Bu klasörler türetilebilir ama içlerinde git\'te olmayan dosyalar bulunabilir.',
    },
];

function allow() {
    process.exit(0);
}

let input;
try {
    input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
    allow(); // Girdi okunamadıysa engelleme — koruma, aracı bozmamalı.
}

const command = input?.tool_input?.command;
if (typeof command !== 'string' || command.length === 0) allow();

const hit = RULES.find((rule) => rule.all.every((re) => re.test(command)));
if (!hit) allow();

process.stdout.write(
    JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason:
                `[${hit.id}] Bu komut engellendi. ${hit.why}\n` +
                `${hit.instead}\n` +
                'Gerçekten gerekiyorsa komutu kullanıcı kendisi çalıştırmalı. ' +
                'Ayrıntı: docs/BUILD-RELEASE.md',
        },
    }),
);
process.exit(0);
