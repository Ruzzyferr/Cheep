/**
 * Release imzalama yapılandırmasını android/app/build.gradle'a enjekte eder.
 *
 * NEDEN PLUGIN: `expo prebuild --clean` android/ klasörünü tamamen siler ve
 * şablondan yeniden üretir. Şablonun release bloğu DEBUG anahtarıyla imzalıyor
 * ("Caution! In production, you need to generate your own keystore file").
 * build.gradle'ı elle düzenlersen ilk prebuild'de kaybolur ve fark etmeden
 * debug anahtarıyla imzalanmış bir AAB üretirsin — Play Console bunu reddeder.
 *
 * Plugin her prebuild'de yeniden uygulandığı için o tuzak kapanıyor.
 *
 * Anahtarın kendisi git'te DEĞİL: android/key.properties + keystore dosyası
 * elle konuluyor. Dosya yoksa debug imzasına düşüyoruz, böylece anahtarı
 * olmayan biri de projeyi derleyip çalıştırabiliyor.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const SIGNING_CONFIG = `
        release {
            def keystorePropertiesFile = rootProject.file('key.properties')
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }`;

// Şablondaki release buildType'ın debug anahtarını kullandığı yer.
const TEMPLATE_RELEASE_SIGNING =
  '// Caution! In production, you need to generate your own keystore file.\n' +
  '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
  '            signingConfig signingConfigs.debug';

const OUR_RELEASE_SIGNING =
  '// İmza anahtarı android/key.properties ile geliyor (withReleaseSigning.js).\n' +
  '            // Dosya yoksa debug imzasına düşer — anahtarsız da derlenebilsin diye.\n' +
  "            signingConfig rootProject.file('key.properties').exists() ? signingConfigs.release : signingConfigs.debug";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('withReleaseSigning.js')) {
      return cfg; // zaten uygulanmış
    }

    // 1) signingConfigs bloğuna release ekle (debug bloğunun kapanışından sonra).
    const anchor = "            keyPassword 'android'\n        }\n    }";
    if (!gradle.includes(anchor)) {
      throw new Error(
        'withReleaseSigning: signingConfigs bloğu beklenen biçimde değil. ' +
          'Expo şablonu değişmiş olabilir — plugin güncellenmeli.',
      );
    }
    gradle = gradle.replace(anchor, "            keyPassword 'android'\n        }" + SIGNING_CONFIG);

    // 2) release buildType'ı yeni config'e yönlendir.
    if (!gradle.includes(TEMPLATE_RELEASE_SIGNING)) {
      throw new Error(
        'withReleaseSigning: release buildType imza satırı bulunamadı. ' +
          'Expo şablonu değişmiş olabilir — plugin güncellenmeli.',
      );
    }
    gradle = gradle.replace(TEMPLATE_RELEASE_SIGNING, OUR_RELEASE_SIGNING);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
