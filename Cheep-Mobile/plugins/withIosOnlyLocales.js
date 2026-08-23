/**
 * `expo.locales` dosyalarındaki iOS'a ÖZEL anahtarları Android kaynaklarından
 * temizler.
 *
 * NEDEN VAR: app.json'daki `expo.locales`, izin metinlerini iOS için
 * `{dil}.lproj/InfoPlist.strings` olarak üretiyor — asıl amacı bu. Ama prebuild
 * AYNI dosyaları Android tarafında da `values-b+{dil}/strings.xml` olarak
 * yazıyor. Bizim locales dosyalarımızın içinde yalnızca
 * `NSLocationWhenInUseUsageDescription` var; bu anahtar iOS'a özgü ve Android'de
 * hiçbir şeye karşılık gelmiyor.
 *
 * Sonuç: Android'de varsayılan dilde (values/strings.xml) karşılığı olmayan bir
 * çeviri oluşuyor ve `lintVitalRelease` bunu ÖLÜMCÜL sayıyor:
 *
 *     Error: "NSLocationWhenInUseUsageDescription" is translated here but not
 *     found in default locale [ExtraTranslation]
 *
 * Yani sürüm derlemesi hiç başlamıyor. Hata, iOS izin metinleri eklendiğinde
 * (2026-08) sessizce girdi ve o tarihten beri Android sürümü alınmadığı için
 * bugüne kadar görünmedi.
 *
 * ÇÖZÜM: lint'i susturmak yerine sebebi kaldırıyoruz — anlamsız kaynakları
 * Android'e hiç koymuyoruz. Dosya tamamen boşalırsa dizinle birlikte siliniyor.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/** Android'de karşılığı olmayan, iOS'a özgü anahtarlar. */
const IOS_ONLY = /^NS[A-Za-z]+UsageDescription$/;

function cleanAndroidLocaleStrings(resDir) {
  if (!fs.existsSync(resDir)) return [];
  const touched = [];

  for (const entry of fs.readdirSync(resDir)) {
    if (!entry.startsWith('values-b+')) continue;
    const file = path.join(resDir, entry, 'strings.xml');
    if (!fs.existsSync(file)) continue;

    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(
      /^[ \t]*<string name="([^"]+)"[\s\S]*?<\/string>[ \t]*\r?\n?/gm,
      (match, name) => (IOS_ONLY.test(name) ? '' : match)
    );
    if (after === before) continue;

    const hasStrings = /<string\b/.test(after);
    if (hasStrings) {
      fs.writeFileSync(file, after);
      touched.push(`${entry}: iOS anahtarları temizlendi`);
    } else {
      // Geriye tek kaynak kalmadı — boş bir dil klasörü tutmanın anlamı yok.
      fs.rmSync(path.join(resDir, entry), { recursive: true, force: true });
      touched.push(`${entry}: tamamen kaldırıldı (Android'e ait kaynak yoktu)`);
    }
  }
  return touched;
}

module.exports = function withIosOnlyLocales(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const resDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );
      const touched = cleanAndroidLocaleStrings(resDir);
      for (const line of touched) {
        // eslint-disable-next-line no-console
        console.log(`[withIosOnlyLocales] ${line}`);
      }
      return cfg;
    },
  ]);
};
