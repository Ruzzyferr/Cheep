#!/usr/bin/env node
/**
 * Sürüm notlarını commit'lerden üretir.
 *
 * KAPSAM: bu notlar TEST kanalları için (Play kapalı test + TestFlight).
 * Okuyucu testçi, son kullanıcı değil — o yüzden pazarlama dili yerine
 * "neyin değiştiği" yazılıyor. Mağazaya çıkarken not elle yazılır.
 *
 * Nereden nereye: en son `mobil/*` etiketinden HEAD'e. Etiket yoksa son 20
 * commit. İş akışı her başarılı yayından sonra etiket attığı için ikinci
 * koşudan itibaren aralık kendiliğinden doğru olur.
 *
 * Play'in dil başına 500 karakter sınırı var; çıktı ona göre kırpılıyor.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PLAY_LIMIT = 500;

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Son yayın etiketi; yoksa null. */
function lastTag() {
    try {
        return sh('git describe --tags --abbrev=0 --match "mobil/*"');
    } catch {
        return null;
    }
}

/**
 * Bir önceki BAŞARILI sürüm koşusunun derlediği commit.
 *
 * NEDEN ETİKETE GÜVENMİYORUZ: GITHUB_TOKEN, `.github/workflows/**` değiştiren
 * bir commit'e etiket atamıyor — GitHub bunu "GitHub App'in workflows izni
 * yok" diyerek reddediyor ve bu izin YAML'daki `permissions:` anahtarları
 * arasında yok, yani izin ekleyerek çözülmüyor. Hattın kendisini
 * güncellediğimizde etiket atılamıyor; etiket aralığın TEK kaynağı olsaydı
 * notlar sessizce son 30 commit'e düşerdi.
 *
 * Koşu geçmişi bu bilgiyi zaten tutuyor ve okumak için hiçbir yazma izni
 * gerekmiyor. Etiket artık yalnızca insan kolaylığı.
 */
async function lastSuccessfulRunSha() {
    const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_WORKFLOW_REF } = process.env;
    if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) return null;
    // "owner/repo/.github/workflows/dosya.yml@refs/heads/main" -> "dosya.yml"
    const wf = (GITHUB_WORKFLOW_REF || '').split('@')[0].split('/').pop() || 'mobile-release.yml';
    try {
        const r = await fetch(
            `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${wf}/runs` +
                `?status=success&branch=main&per_page=10`,
            { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } },
        );
        if (!r.ok) return null;
        const d = await r.json();
        const onceki = (d.workflow_runs || []).find((x) => String(x.id) !== String(GITHUB_RUN_ID));
        return onceki?.head_sha ?? null;
    } catch {
        return null;
    }
}

/**
 * Commit yerelde var mı (sığ klonda olmayabilir).
 *
 * `git cat-file -e <sha>^{commit}` KULLANILMIYOR: execSync Windows'ta
 * cmd.exe'ye düşüyor ve orada `^` kaçış karakteri — ifade sessizce bozuluyor,
 * kontrol her zaman "yok" diyor. `-t` aynı işi özel karakter olmadan görüyor.
 */
const varMi = (sha) => {
    try {
        return sh(`git cat-file -t ${sha}`) === 'commit';
    } catch {
        return false;
    }
};

const runSha = await lastSuccessfulRunSha();
const since = runSha && varMi(runSha) ? runSha : lastTag();
const range = since ? `${since}..HEAD` : '-30';

// YALNIZCA MOBİL UYGULAMAYI DEĞİŞTİREN commit'ler.
//
// Sunucu, site ve deploy commit'leri bu derlemenin içinde DEĞİL — backend
// değişiklikleri zaten canlıda ve her istemciyi etkiliyor. Notu "bu build'de
// ne değişti" sorusuna dürüst tutmak için yol filtresi şart; yoksa testçi
// "yedekleri sunucu dışına çek" gibi kendisini hiç ilgilendirmeyen satırlar
// okuyor.
const raw = sh(`git log ${range} --no-merges --pretty=format:%s -- Cheep-Mobile/`);
const subjects = raw ? raw.split('\n').filter(Boolean) : [];

/**
 * `type(scope): konu` ayrıştırması. Uygulamayı ETKİLEMEYEN commit türleri
 * (docs, chore, ci, test) notlara girmez — testçiye bir şey ifade etmiyorlar.
 */
const SKIP = new Set(['docs', 'chore', 'ci', 'test', 'style', 'refactor']);
const yenilik = [];
const duzeltme = [];

for (const s of subjects) {
    const m = /^(\w+)(?:\(([^)]*)\))?:\s*(.+)$/.exec(s);
    if (!m) continue;
    const [, type, scope, subject] = m;
    if (SKIP.has(type)) continue;

    // Uzun açıklamaları ilk cümle/tireye kadar kısalt — not listesi okunabilir kalsın.
    let text = subject.split(' — ')[0].split(' -- ')[0].trim();
    if (text.length > 90) text = text.slice(0, 87).trimEnd() + '…';
    text = text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);

    const bucket = type === 'feat' ? yenilik : type === 'fix' || type === 'perf' ? duzeltme : null;
    if (bucket && !bucket.includes(text)) bucket.push(text);
    void scope;
}

function build(limit) {
    const parts = [];
    if (yenilik.length) parts.push('Yenilikler:\n' + yenilik.map((x) => `• ${x}`).join('\n'));
    if (duzeltme.length) parts.push('Düzeltmeler:\n' + duzeltme.map((x) => `• ${x}`).join('\n'));
    let out = parts.join('\n\n');
    if (!out) out = 'Bu derlemede kullanıcıya görünen bir değişiklik yok (altyapı ve bakım).';
    if (out.length > limit) {
        // Kırparken satır ortasında kesme: son tam satırda dur.
        out = out.slice(0, limit - 1);
        out = out.slice(0, out.lastIndexOf('\n')) + '…';
    }
    return out;
}

const notes = build(PLAY_LIMIT);
const commitCount = subjects.length;

const kaynak = runSha && varMi(runSha) ? 'son başarılı koşu' : since ? 'etiket' : 'yedek (son 30)';
console.error(`  aralık: ${since ?? '(kaynak yok)'} → HEAD  [${kaynak}]  (${commitCount} commit)`);
console.error(`  ${yenilik.length} yenilik, ${duzeltme.length} düzeltme, ${notes.length} karakter`);

if (process.env.GITHUB_OUTPUT) {
    // Çok satırlı çıktı için heredoc biçimi şart.
    const eof = `EOF_${Math.random().toString(36).slice(2)}`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `notes<<${eof}\n${notes}\n${eof}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `commit_count=${commitCount}\n`);
}
if (process.argv[2] === '--out' && process.argv[3]) {
    fs.writeFileSync(process.argv[3], notes, 'utf8');
}
console.log(notes);
