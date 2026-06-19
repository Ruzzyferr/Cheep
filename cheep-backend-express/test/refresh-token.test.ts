import { describe, it, expect } from 'vitest';
import { isRefreshTokenCurrent } from '../src/services/refresh-token';

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
