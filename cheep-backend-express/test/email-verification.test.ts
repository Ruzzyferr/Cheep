import { describe, it, expect } from 'vitest';
import {
    generateVerificationCode,
    verificationExpiry,
    isCodeExpired,
    isValidCodeFormat,
    CODE_TTL_MS,
} from '../src/services/email-verification';

describe('generateVerificationCode', () => {
    it('her zaman tam 6 haneli string üretir', () => {
        for (let i = 0; i < 200; i++) {
            const code = generateVerificationCode();
            expect(code).toMatch(/^\d{6}$/);
            expect(code.length).toBe(6);
        }
    });

    it('baştaki sıfırları korur (örn. "000123")', () => {
        // İstatistiksel olarak 200 denemede en az bir kısa sayı 6'ya tamamlanmış olmalı
        const codes = Array.from({ length: 500 }, () => generateVerificationCode());
        expect(codes.every((c) => c.length === 6)).toBe(true);
    });
});

describe('verificationExpiry / isCodeExpired', () => {
    it('son geçerlilik anı now + 15dk olmalı', () => {
        const now = new Date('2026-06-29T10:00:00Z');
        const exp = verificationExpiry(now);
        expect(exp.getTime()).toBe(now.getTime() + CODE_TTL_MS);
    });

    it('süre dolmadan geçerli', () => {
        const now = new Date('2026-06-29T10:00:00Z');
        const exp = verificationExpiry(now);
        const later = new Date(now.getTime() + 5 * 60 * 1000); // 5 dk sonra
        expect(isCodeExpired(exp, later)).toBe(false);
    });

    it('süre dolduktan sonra geçersiz', () => {
        const now = new Date('2026-06-29T10:00:00Z');
        const exp = verificationExpiry(now);
        const later = new Date(now.getTime() + 16 * 60 * 1000); // 16 dk sonra
        expect(isCodeExpired(exp, later)).toBe(true);
    });

    it('expires null ise süresi dolmuş sayılır', () => {
        expect(isCodeExpired(null)).toBe(true);
        expect(isCodeExpired(undefined)).toBe(true);
    });
});

describe('isValidCodeFormat', () => {
    it('tam 6 hane kabul', () => {
        expect(isValidCodeFormat('123456')).toBe(true);
        expect(isValidCodeFormat('000000')).toBe(true);
    });
    it('hatalı formatları reddeder', () => {
        expect(isValidCodeFormat('12345')).toBe(false);
        expect(isValidCodeFormat('1234567')).toBe(false);
        expect(isValidCodeFormat('12a456')).toBe(false);
        expect(isValidCodeFormat('')).toBe(false);
        expect(isValidCodeFormat(' 123456 ')).toBe(false);
    });
});
