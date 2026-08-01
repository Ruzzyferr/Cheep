import { describe, it, expect } from 'vitest';
import { compareVersions, decideUpdateGate, type VersionPolicy } from '../updateGate';

/**
 * Zorunlu güncelleme kapısı.
 *
 * Bu karar yanlış olursa kullanıcı uygulamayı HİÇ açamaz. Bu yüzden kural
 * tek yönlü hata affeder: şüphede kalırsa kilitlemez.
 */

const policy = (over: Partial<VersionPolicy> = {}): VersionPolicy => ({
    minSupported: '1.2.0',
    latest: '1.4.0',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.cheep.mobile',
    ...over,
});

describe('compareVersions', () => {
    it('sayısal karşılaştırma yapar — metin sıralaması DEĞİL', () => {
        // '1.10.0' < '1.9.0' metin olarak doğru, sürüm olarak yanlış:
        // güncel sürümdeki kullanıcı kilitlenirdi.
        expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    });

    it('eşit sürümler için 0 döner', () => {
        expect(compareVersions('1.3.0', '1.3.0')).toBe(0);
    });

    it('eksik parçaları sıfır sayar', () => {
        expect(compareVersions('1.3', '1.3.0')).toBe(0);
    });

    it('ön-sürüm etiketini yok sayar', () => {
        expect(compareVersions('1.3.0-beta.1', '1.3.0')).toBe(0);
    });
});

describe('decideUpdateGate', () => {
    it('eşiğin altındaki sürümü KİLİTLER', () => {
        expect(decideUpdateGate('1.1.0', policy())).toBe('blocked');
    });

    it('eşiğe eşit sürümü kilitlemez — sınır dahil', () => {
        expect(decideUpdateGate('1.2.0', policy())).toBe('optional');
    });

    it('eşiğin üstünde ama güncel değilse yumuşak uyarı verir', () => {
        expect(decideUpdateGate('1.3.0', policy())).toBe('optional');
    });

    it('güncel sürümde hiçbir şey göstermez', () => {
        expect(decideUpdateGate('1.4.0', policy())).toBe('none');
    });

    it('mağazadakinden yeni sürümde (dahili yapı) hiçbir şey göstermez', () => {
        expect(decideUpdateGate('1.5.0', policy())).toBe('none');
    });

    // ——— Hata affediciliği: bunların hepsi "kilitleme" demeli ———

    it('politika yoksa kilitlemez — sunucuya ulaşılamadı demektir', () => {
        expect(decideUpdateGate('1.0.0', null)).toBe('none');
    });

    it('eşikler boşsa kilitlemez — yapılandırılmamış ortam', () => {
        expect(decideUpdateGate('1.0.0', policy({ minSupported: '', latest: '' }))).toBe('none');
    });

    it('istemci sürümü okunamıyorsa kilitlemez', () => {
        expect(decideUpdateGate('', policy())).toBe('none');
        expect(decideUpdateGate(undefined, policy())).toBe('none');
    });

    it('mağaza bağlantısı yoksa KİLİTLEMEZ — çıkışı olmayan kapı kurmayız', () => {
        // Kilitleyip "Güncelle" düğmesini boşa çıkarmak kullanıcıyı
        // uygulamadan tamamen dışarıda bırakırdı.
        expect(decideUpdateGate('1.1.0', policy({ storeUrl: '' }))).toBe('none');
    });

    it('latest boş ama minSupported doluysa kilit yine çalışır', () => {
        expect(decideUpdateGate('1.1.0', policy({ latest: '' }))).toBe('blocked');
    });

    it('minSupported latest ile eşitse herkes kilitlenir — istenirse mümkün', () => {
        const strict = policy({ minSupported: '1.4.0', latest: '1.4.0' });
        expect(decideUpdateGate('1.3.0', strict)).toBe('blocked');
        expect(decideUpdateGate('1.4.0', strict)).toBe('none');
    });
});
