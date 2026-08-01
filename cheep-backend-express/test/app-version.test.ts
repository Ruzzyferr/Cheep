import { describe, it, expect } from 'vitest';
import {
    compareVersions,
    isOutdated,
    resolveVersionPolicy,
    type Platform,
} from '../src/config/app-version.js';

/**
 * Zorunlu güncelleme kapısı.
 *
 * Bu mantık YANLIŞ olursa kullanıcı uygulamayı hiç açamaz. Bu yüzden karar
 * saf, testli ve hata affedici: şüphede kalırsa KİLİTLEMEZ.
 */

describe('compareVersions', () => {
    it('eşit sürümler için 0 döner', () => {
        expect(compareVersions('1.3.0', '1.3.0')).toBe(0);
    });

    it('sayısal karşılaştırma yapar — metin sıralaması DEĞİL', () => {
        // '1.10.0' < '1.9.0' metin olarak doğru ama sürüm olarak yanlış.
        expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
        expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    });

    it('yama sürümlerini karşılaştırır', () => {
        expect(compareVersions('1.3.1', '1.3.0')).toBeGreaterThan(0);
    });

    it('eksik parçaları sıfır sayar', () => {
        expect(compareVersions('1.3', '1.3.0')).toBe(0);
        expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
    });

    it('ön-sürüm etiketini yok sayar — 1.3.0-beta.2 ile 1.3.0 aynı yayın', () => {
        expect(compareVersions('1.3.0-beta.2', '1.3.0')).toBe(0);
    });

    it('sayı olmayan parçayı sıfır sayar — çöp girdi kilitlemeye yol açmasın', () => {
        expect(compareVersions('abc', '0.0.0')).toBe(0);
    });
});

describe('isOutdated', () => {
    it('eşik altındaki sürüm eski sayılır', () => {
        expect(isOutdated('1.2.0', '1.3.0')).toBe(true);
    });

    it('eşiğe eşit sürüm eski SAYILMAZ — sınır dahil', () => {
        expect(isOutdated('1.3.0', '1.3.0')).toBe(false);
    });

    it('eşiğin üstü eski sayılmaz', () => {
        expect(isOutdated('1.4.0', '1.3.0')).toBe(false);
    });

    it('eşik yoksa hiçbir şey eski değil', () => {
        expect(isOutdated('1.0.0', undefined)).toBe(false);
        expect(isOutdated('1.0.0', '')).toBe(false);
    });

    it('istemci sürümü okunamıyorsa kilitlemez — kullanıcıyı dışarıda bırakmaktansa içeri al', () => {
        expect(isOutdated('', '9.9.9')).toBe(false);
        expect(isOutdated(undefined, '9.9.9')).toBe(false);
    });
});

describe('resolveVersionPolicy', () => {
    const env = {
        ANDROID_MIN_SUPPORTED_VERSION: '1.2.0',
        ANDROID_LATEST_VERSION: '1.4.0',
        IOS_MIN_SUPPORTED_VERSION: '1.1.0',
        IOS_LATEST_VERSION: '1.3.0',
    };

    it('android politikasını döner', () => {
        const p = resolveVersionPolicy('android', env);
        expect(p.minSupported).toBe('1.2.0');
        expect(p.latest).toBe('1.4.0');
        expect(p.storeUrl).toContain('play.google.com');
    });

    it('ios politikasını döner', () => {
        const p = resolveVersionPolicy('ios', env);
        expect(p.minSupported).toBe('1.1.0');
        expect(p.storeUrl).toContain('apps.apple.com');
    });

    it('yapılandırılmamış ortamda BOŞ eşik döner — kimse kilitlenmez', () => {
        const p = resolveVersionPolicy('android', {});
        expect(p.minSupported).toBe('');
        expect(p.latest).toBe('');
    });

    it('bilinmeyen platformu android sayar — en yaygın istemci', () => {
        expect(resolveVersionPolicy('web' as Platform, env).minSupported).toBe('1.2.0');
    });

    it('mağaza bağlantısı her zaman doludur — "Güncelle" düğmesi boşa çıkmasın', () => {
        for (const platform of ['android', 'ios'] as Platform[]) {
            expect(resolveVersionPolicy(platform, {}).storeUrl.length).toBeGreaterThan(0);
        }
    });
});
