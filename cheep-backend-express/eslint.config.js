// @ts-check
/**
 * Backend lint yapılandırması.
 *
 * NEDEN VAR: `package.json` içinde uzun süredir bir `lint` script'i vardı ama
 * `eslint` bağımlılık olarak KURULU DEĞİLDİ — komut "'eslint' is not
 * recognized" ile çöküyordu ve CI de onu hiç çağırmadığı için kimse fark
 * etmedi. Yani backend'de fiilen hiç lint yoktu.
 *
 * Kural seti bilinçli olarak DAR: tip kontrolü zaten `tsc --noEmit` ile
 * yapılıyor, buradaki iş `tsc`'nin görmediği gerçek hata sınıflarını
 * yakalamak (kullanılmayan değişken, kaçmış `await`, sabit koşul). Stil
 * kuralları yok — mevcut kodu yeniden biçimlendirmek denetlenemeyecek kadar
 * büyük bir fark üretirdi.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'prisma/migrations/**',
            'generated/**',
            '*.config.js',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: { ...globals.node },
        },
        rules: {
            // Kullanılmayan değişken gerçek bir koku; ama `_` önekli olanlar
            // bilinçli olarak atılmış (destructuring ile alan çıkarma) —
            // `sanitizeUser` tam olarak bunu yapıyor.
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
            // `any` bu kod tabanında Prisma/LLM sınırlarında bilinçli kullanılıyor.
            '@typescript-eslint/no-explicit-any': 'off',
            // Boş yakalama blokları burada kasıtlı ("hata olursa varsayılana düş").
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
    {
        // Testler ve tek seferlik betikler daha gevşek.
        // `prisma/seed.ts` upsert sonuclarini degiskene aliyor; kullanilmasalar
        // da hangi kaydin yaratildigini belgeliyorlar.
        files: ['test/**', 'scripts/**', 'prisma/**'],
        rules: { '@typescript-eslint/no-unused-vars': 'off' },
    },
);
