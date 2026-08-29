import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('../storage', () => ({
  storage: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => { store.set(k, v); },
  },
  STORAGE_KEYS: { AVAILABLE_COUNTRIES: 'available_countries' },
}));

/* eslint-disable import/first */
import {
  COLD_START_FALLBACK,
  SUPPORTED_COUNTRY_CODES,
  __resetAvailableCountries,
  getAvailableCountryCodes,
  intersectWithSupported,
  isCountryAvailable,
  loadCachedAvailableCountries,
  refreshAvailableCountries,
  pickRegionCountry,
} from '../countryAvailability';
/* eslint-enable import/first */

beforeEach(() => {
  store.clear();
  __resetAvailableCountries(null);
});

/**
 * Bu modülün varlık sebebi: ülke listesi tek başına istemcide sabit olduğunda
 * "önce veri, sonra sürüm" sırası elle korunmak zorundaydı. Sıra bozulunca
 * kullanıcı BOŞ katalog görüyor ve hiçbir hata çıkmıyordu.
 */
describe('ülke kullanılabilirliği', () => {
  it('sunucu listesini paketin desteklediğiyle kesiştirir', () => {
    // Sunucu, bu sürümün çeviremeyeceği bir ülke bildirirse GÖSTERİLMEZ —
    // aksi hâlde arayüz ham anahtarlar ve yanlış para birimi gösterirdi.
    expect(intersectWithSupported(['TR', 'PL', 'HR', 'XX'])).toEqual(['TR', 'PL', 'HR']);
  });

  it('büyük/küçük harf ve boşluğu tolere eder, tekrarı eler', () => {
    expect(intersectWithSupported([' tr ', 'Pl', 'TR'])).toEqual(['TR', 'PL']);
  });

  it('hiçbir şey bilinmiyorken güvenli yedeğe düşer, BOŞ dönmez', () => {
    // Boş liste = ülke seçici bomboş = kullanıcının hiçbir çıkışı yok.
    expect(getAvailableCountryCodes()).toEqual(COLD_START_FALLBACK);
    expect(getAvailableCountryCodes().length).toBeGreaterThan(0);
  });

  it('diskteki son bilinen listeyi kullanır (çevrimdışı açılış)', async () => {
    store.set('available_countries', JSON.stringify(['TR', 'PL', 'HR']));
    await loadCachedAvailableCountries();
    expect(getAvailableCountryCodes()).toEqual(['TR', 'PL', 'HR']);
  });

  it('bozuk disk kaydı yedeği bozmaz', async () => {
    store.set('available_countries', '{bozuk json');
    await loadCachedAvailableCountries();
    expect(getAvailableCountryCodes()).toEqual(COLD_START_FALLBACK);
  });

  it('diskteki BOŞ liste kabul edilmez', async () => {
    store.set('available_countries', JSON.stringify([]));
    await loadCachedAvailableCountries();
    expect(getAvailableCountryCodes()).toEqual(COLD_START_FALLBACK);
  });

  it('sunucu yanıtını belleğe ve diske yazar', async () => {
    await refreshAvailableCountries(async () => ['TR', 'PL', 'HR', 'HU', 'RO']);
    expect(getAvailableCountryCodes()).toEqual(['TR', 'PL', 'HR', 'HU', 'RO']);
    expect(JSON.parse(store.get('available_countries')!)).toContain('HU');
  });

  it('ağ hatasında EN SON BİLİNEN listede kalır', async () => {
    await refreshAvailableCountries(async () => ['TR', 'PL', 'HR']);
    await refreshAvailableCountries(async () => { throw new Error('ağ yok'); });
    expect(getAvailableCountryCodes()).toEqual(['TR', 'PL', 'HR']);
  });

  it('sunucu BOŞ liste dönerse yok sayılır', async () => {
    // Sunucu tarafı bir arıza (boş veritabanı, yanlış deploy) tüm ülkeleri
    // kapatmamalı; bu, çalışan bir uygulamayı tek yanıtla kullanılamaz yapardı.
    await refreshAvailableCountries(async () => ['TR', 'PL']);
    await refreshAvailableCountries(async () => []);
    expect(getAvailableCountryCodes()).toEqual(['TR', 'PL']);
  });

  it('isCountryAvailable kapı olarak çalışır', async () => {
    await refreshAvailableCountries(async () => ['TR', 'HR']);
    expect(isCountryAvailable('hr')).toBe(true);
    expect(isCountryAvailable('HU')).toBe(false);
    expect(isCountryAvailable(null)).toBe(false);
    expect(isCountryAvailable('')).toBe(false);
  });

  it('paket listesi üst sınırdır ve yeni ülkeleri içerir', () => {
    expect(SUPPORTED_COUNTRY_CODES).toEqual(
      expect.arrayContaining(['TR', 'PL', 'HR', 'HU', 'RO']),
    );
  });
});

/**
 * CİHAZ BÖLGESİ YEDEĞİ.
 *
 * Gerileme koruması: bu yedek yokken GPS'in başarısız olduğu her durumda ülke
 * sabit `TR`ye düşüyordu ve konum iznini reddeden bir Hırvat kullanıcı Türk
 * marketlerini ₺ fiyatlarıyla görüyordu. Üretim veritabanında doğrulandı.
 */
describe('pickRegionCountry', () => {
  beforeEach(() => __resetAvailableCountries([...SUPPORTED_COUNTRY_CODES]));

  it('kullanılabilir ilk bölgeyi seçer', () => {
    expect(pickRegionCountry(['HR'])).toBe('HR');
  });

  it('küçük harf ve boşluğu tolere eder — cihaz bölgesi biçimi garanti değil', () => {
    expect(pickRegionCountry([' hr '])).toBe('HR');
  });

  it('desteklenmeyen ülkeyi atlar, sonraki adaya bakar', () => {
    expect(pickRegionCountry(['US', 'RO'])).toBe('RO');
  });

  it('hiçbiri kullanılamıyorsa null — çağıran mevcut değerinde kalır', () => {
    expect(pickRegionCountry(['US', 'JP'])).toBeNull();
  });

  it('null/undefined/boş girdilerde patlamaz', () => {
    expect(pickRegionCountry([null, undefined, ''])).toBeNull();
  });

  it('kapalı bir ülke bölge sinyaliyle AÇILAMAZ', () => {
    // Sunucu HR'yi kapattıysa cihaz bölgesi onu geri getirmemeli.
    __resetAvailableCountries(['TR', 'PL']);
    expect(pickRegionCountry(['HR'])).toBeNull();
  });
});
