/**
 * Depolama anahtarlarının expo-secure-store kuralına uygunluğu.
 *
 * NEDEN VAR: iki anahtar bir süre `@cheep:` önekiyle yazılmıştı. Bu bir
 * AsyncStorage alışkanlığı; expo-secure-store ise anahtarı `/^[\w.-]+$/` ile
 * doğruluyor ve uymayan anahtarda native çağrıya HİÇ gitmeden senkron
 * `throw` atıyor (node_modules/expo-secure-store/build/SecureStore.js,
 * `ensureValidKey`).
 *
 * Bedeli sessiz ve büyüktü: `notificationPromptStorage.clear()` her seferinde
 * reject ediyor, hemen ardındaki `registerPushToken()` hiç çalışmıyordu.
 * Üretimde 49 kullanıcının HİÇBİRİNDE push token yoktu ve sunucu tek bir
 * `/notifications/push-token` isteği bile görmedi — üstelik fiyat düşüşü
 * tespiti 131 bildirim üretmişti. Yani özellik tamamen ölüydü.
 *
 * Testler bunu yakalayamadı çünkü hepsi expo-secure-store'u anahtar
 * doğrulaması OLMAYAN düz bir Map ile taklit ediyor. Bu test sahteyi değil
 * GERÇEK kuralı sınar; yeni bir anahtar yanlış yazılırsa CI'da düşer.
 */
/* eslint-disable import/first -- vi.mock, storage.ts'in native bağımlılıklarını karşılamalı. */
import { describe, it, expect, vi } from 'vitest';

// storage.ts `expo-secure-store` ve `react-native` çekiyor; ikisi de düğüm
// ortamında ayrıştırılamıyor. Testin ilgilendiği tek şey ANAHTAR SABİTLERİ,
// dolayısıyla native yüzeyler en küçük hâlleriyle taklit ediliyor.
vi.mock('expo-secure-store', () => ({
    setItemAsync: async () => undefined,
    getItemAsync: async () => null,
    deleteItemAsync: async () => undefined,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { STORAGE_KEYS } from '../storage';

/** expo-secure-store'un `isValidKey` fonksiyonundaki desenin birebir kopyası. */
const SECURE_STORE_KEY_PATTERN = /^[\w.-]+$/;

describe('STORAGE_KEYS — expo-secure-store uyumu', () => {
    const entries = Object.entries(STORAGE_KEYS);

    it('en az bir anahtar tanımlı (test boşa koşmasın)', () => {
        expect(entries.length).toBeGreaterThan(10);
    });

    it.each(entries)('%s anahtarı SecureStore desenine uyar', (name, key) => {
        expect(
            SECURE_STORE_KEY_PATTERN.test(key as string),
            `"${name}" anahtarı "${key}" — SecureStore yalnızca harf, rakam, "_", "." ve "-" kabul eder. ` +
            'Bu anahtarla yapılan her setItem/removeItem çağrısı sessizce patlar.',
        ).toBe(true);
    });

    it('anahtarlar benzersiz — iki alan aynı kutuyu ezmemeli', () => {
        const values = entries.map(([, v]) => v);
        expect(new Set(values).size).toBe(values.length);
    });
});
