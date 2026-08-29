import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * DİL DOSYASI PARİTESİ.
 *
 * i18next eksik bir anahtarı SESSİZCE yedek dile düşürür (burada İngilizce).
 * Yani Hırvatça bir ekranda tek bir cümlenin İngilizce çıkması hiçbir hata
 * üretmez — yalnızca kullanıcı görür. Yeni dil eklerken ya da yeni bir metin
 * yazarken bir dosyayı unutmak bu yüzden çok kolay ve fark edilmesi çok zor.
 *
 * `tr.json` referans: ürün metinleri önce Türkçe yazılıyor.
 */
const DIR = path.join(__dirname, '..', 'locales');
const REFERENCE = 'tr';

type Json = Record<string, unknown>;

function load(lang: string): Json {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${lang}.json`), 'utf-8'));
}

function keysOf(obj: Json, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    out.add(prefix + k);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const nested of keysOf(v as Json, `${prefix}${k}.`)) out.add(nested);
    }
  }
  return out;
}

function flatten(obj: Json, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Json, `${prefix}${k}.`));
    } else if (typeof v === 'string') {
      out[prefix + k] = v;
    }
  }
  return out;
}

const LANGS = fs.readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''))
  .filter((l) => l !== REFERENCE);

const reference = load(REFERENCE);
const refKeys = keysOf(reference);
const refFlat = flatten(reference);

describe('yerelleştirme dosyaları', () => {
  it('referans dil anlamlı sayıda anahtar içeriyor', () => {
    // Glob ya da yol kayarsa aşağıdaki testler boş kümeyle "geçer" görünür.
    expect(refKeys.size).toBeGreaterThan(400);
    expect(LANGS.length).toBeGreaterThan(0);
  });

  it.each(LANGS)('%s: tr.json ile AYNI anahtar kümesine sahip', (lang) => {
    const keys = keysOf(load(lang));
    const missing = [...refKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !refKeys.has(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each(LANGS)('%s: her metnin interpolasyon değişkenleri korunmuş', (lang) => {
    // Bir değişkeni çevirirken düşürmek ya da adını bozmak, kullanıcıya ya
    // eksik bilgi ya da ham `{{count}}` metni gösterir.
    //
    // KURAL, TEKRAR SAYISI DEĞİL KÜME: Türkçe bazı cümlelerde aynı değişkeni
    // iki kez kullanıyor ("{{country}} konumundasın — {{country}} marketlerine
    // geçildi") ama başka dillerde ülke adını iki kez söylemek yapay durur ve
    // çevirmen haklı olarak bir kez kullanıyor. Aranan şey şu: referanstaki
    // her DEĞİŞKEN ADI çeviride EN AZ BİR KEZ geçsin ve çeviri referansta
    // OLMAYAN bir değişken UYDURMASIN (uydurulan değişken hiçbir zaman
    // doldurulmaz, ekranda ham metin olarak kalır).
    const names = (text: string) =>
      new Set((text.match(/\{\{\s*([^}\s]+)\s*\}\}/g) ?? []).map((m) => m.replace(/[{}\s]/g, '')));

    const flat = flatten(load(lang));
    const broken: { key: string; dropped: string[]; invented: string[] }[] = [];
    for (const [key, value] of Object.entries(refFlat)) {
      const expected = names(value);
      const got = names(flat[key] ?? '');
      const dropped = [...expected].filter((n) => !got.has(n));
      const invented = [...got].filter((n) => !expected.has(n));
      if (dropped.length || invented.length) broken.push({ key, dropped, invented });
    }
    expect(broken).toEqual([]);
  });

  /**
   * Boş bırakılması MEŞRU olan anahtarlar.
   *
   * `home.deal_from_suffix` Türkçe'de bir AYRILMA EKİ ("'den" → "Migros'den").
   * Hiçbir başka dilde böyle bir ek yok; oralarda boş string DOĞRU cevaptır.
   * Liste açıkça tutuluyor ki gerçek bir "çevirmeyi unuttum" boşluğu
   * gizlenmesin.
   */
  const INTENTIONALLY_EMPTY = new Set(['home.deal_from_suffix']);

  it.each(LANGS)('%s: hiçbir metin kazara boş bırakılmamış', (lang) => {
    const empty = Object.entries(flatten(load(lang)))
      .filter(([k, v]) => v.trim() === '' && !INTENTIONALLY_EMPTY.has(k))
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });
});
