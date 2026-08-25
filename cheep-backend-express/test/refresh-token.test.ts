import { describe, it, expect } from 'vitest';
import { isRefreshTokenCurrent, isAccessTokenCurrent } from '../src/services/refresh-token';

describe('isRefreshTokenCurrent', () => {
    it('tv kullanıcının güncel sürümüyle eşleşiyorsa geçerli', () => {
        expect(isRefreshTokenCurrent(0, 0)).toBe(true);
        expect(isRefreshTokenCurrent(3, 3)).toBe(true);
    });

    it('tv eski (logout/parola değişimi ile bump edilmiş) ise geçersiz', () => {
        expect(isRefreshTokenCurrent(0, 1)).toBe(false);
        expect(isRefreshTokenCurrent(2, 5)).toBe(false);
    });

    it('tv ileri bir değerse (manipülasyon) geçersiz', () => {
        expect(isRefreshTokenCurrent(9, 1)).toBe(false);
    });

    it('eski tv-siz token (undefined) geçersiz — yeniden giriş gerekir', () => {
        expect(isRefreshTokenCurrent(undefined, 0)).toBe(false);
    });

    it('tam sayı olmayan tv geçersiz', () => {
        expect(isRefreshTokenCurrent(1.5, 1)).toBe(false);
        expect(isRefreshTokenCurrent(NaN, 0)).toBe(false);
    });
});

describe('isAccessTokenCurrent', () => {
    it('tv güncel sürümle eşleşiyorsa geçerli', () => {
        expect(isAccessTokenCurrent(0, 0)).toBe(true);
        expect(isAccessTokenCurrent(7, 7)).toBe(true);
    });

    it('tv eskiyse geçersiz — çıkış/parola değişimi access token\'ı da keser', () => {
        // Belgelenen güvence buydu ama access token\'lar `tv` HİÇ taşımadığı için
        // geçerli değildi: çalınan bir access token, kurban çıkış yapıp parolasını
        // değiştirse bile TTL\'i (1 saat) boyunca çalışmaya devam ediyordu.
        expect(isAccessTokenCurrent(0, 1)).toBe(false);
        expect(isAccessTokenCurrent(2, 5)).toBe(false);
    });

    it('tv ileri bir değerse (manipülasyon) geçersiz', () => {
        expect(isAccessTokenCurrent(9, 1)).toBe(false);
    });

    it('tv YOKSA geçerli — refresh\'ten bilerek farklı', () => {
        // Access TTL 1 saat. Bu kontrol eklendiği anda sahadaki tüm access
        // token\'lar tv\'siz; hepsini reddetmek bütün kullanıcıları aynı anda
        // 401\'e düşürürdü. Tolerans bir saat içinde kendiliğinden kapanıyor.
        expect(isAccessTokenCurrent(undefined, 0)).toBe(true);
        expect(isAccessTokenCurrent(undefined, 42)).toBe(true);
    });

    it('tam sayı olmayan tv geçersiz', () => {
        expect(isAccessTokenCurrent(1.5, 1)).toBe(false);
        expect(isAccessTokenCurrent(NaN, 0)).toBe(false);
    });
});
