/**
 * Release imzalama yapılandırmasını android/app/build.gradle'a enjekte eder ve
 * android/key.properties dosyasını PROJE DIŞINDAKİ kasadan yeniden üretir.
 *
 * NEDEN PLUGIN: `expo prebuild --clean` android/ klasörünü tamamen siler ve
 * şablondan yeniden üretir. Şablonun release bloğu DEBUG anahtarıyla imzalıyor
 * ("Caution! In production, you need to generate your own keystore file").
 * build.gradle'ı elle düzenlersen ilk prebuild'de kaybolur ve fark etmeden
 * debug anahtarıyla imzalanmış bir AAB üretirsin — Play Console bunu reddeder.
 *
 * NEDEN KASA (2026-08): upload keystore'u `android/app/` altında tutuyorduk.
 * Yani sürüm çıkarmanın TEK geri alınamaz sırrı, sürüm çıkarma adımının kendisi
 * tarafından silinen klasörün içinde duruyordu. Bir `--clean` onu götürdü ve
 * geri getirilemedi: keystore'un yedeği yoksa Play'e bir daha güncelleme
 * yükleyemezsin, Google'dan upload anahtarı sıfırlaması istemek gerekir.
 *
 * Belgeye "önce yedekle" yazmak yetmedi — çünkü koruma, onu okumayı hatırlayan
 * kişiye bağlıydı. Artık anahtar silinebilir bir yerde DURMUYOR:
 *
 *     ~/CheepKeys/                     (veya $CHEEP_KEYSTORE_DIR)
 *       cheep-upload.keystore          ← gerçek sır, git'te ve projede değil
 *       signing.properties             ← parolalar + alias
 *
 * Plugin her prebuild'de android/key.properties'i buradan MUTLAK yolla üretir.
 * `--clean` artık yalnızca türetilebilir dosyaları siler; sildiği her şey bir
 * sonraki prebuild'de geri gelir.
 *
 * Kasa yoksa key.properties yazılmaz ve derleme debug imzasına düşer — anahtarı
 * olmayan biri de projeyi derleyip çalıştırabilsin diye. Bu durumda prebuild
 * yüksek sesle uyarır, çünkü sessiz debug imzası en sinsi hata.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');

/** Kasanın yeri. Ortam değişkeniyle taşınabilir (CI, başka makine). */
function vaultDir() {
  return process.env.CHEEP_KEYSTORE_DIR || path.join(os.homedir(), 'CheepKeys');
}

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

/** `key=value` biçimli .properties dosyasını okur. Yoksa null. */
function readProperties(file) {
  if (!fs.existsSync(file)) return null;
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function warn(lines) {
  const bar = '─'.repeat(72);
  console.warn(`\n${bar}\n${lines.join('\n')}\n${bar}\n`);
}

/**
 * android/key.properties'i kasadan üretir.
 *
 * storeFile MUTLAK yol olarak yazılır — Gradle'ın `file()` çağrısı mutlak yolu
 * olduğu gibi kullanır, göreli yolu android/app/ altında arar. Mutlak yol
 * yazmak keystore'un projeye kopyalanmasını gereksiz kılıyor; kopyalanmadığı
 * için de silinemiyor.
 *
 * .properties biçiminde ters bölü kaçış karakteri olduğundan Windows yolları
 * eğik bölüyle yazılır (Gradle Windows'ta da kabul eder).
 */
function withKeyProperties(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = vaultDir();
      const props = readProperties(path.join(dir, 'signing.properties'));
      const target = path.join(cfg.modRequest.platformProjectRoot, 'key.properties');

      if (!props) {
        warn([
          '⚠️  İMZA KASASI BULUNAMADI — release DEBUG anahtarıyla imzalanacak.',
          `   Aranan: ${path.join(dir, 'signing.properties')}`,
          '   Play Console böyle bir AAB\'yi reddeder.',
          '   Kasayı başka makineden kopyala veya CHEEP_KEYSTORE_DIR ayarla.',
        ]);
        // Eski bir key.properties kalmışsa sil: yanlış kasayla imzalanmış
        // sanmaktansa debug imzasına düşüp uyarı görmek yeğdir.
        if (fs.existsSync(target)) fs.rmSync(target);
        return cfg;
      }

      const storeFile = path.resolve(dir, props.storeFile || 'cheep-upload.keystore');
      if (!fs.existsSync(storeFile)) {
        warn([
          '⚠️  KEYSTORE DOSYASI YOK — release DEBUG anahtarıyla imzalanacak.',
          `   signing.properties bunu işaret ediyor: ${storeFile}`,
        ]);
        if (fs.existsSync(target)) fs.rmSync(target);
        return cfg;
      }

      const missing = ['storePassword', 'keyAlias', 'keyPassword'].filter((k) => !props[k]);
      if (missing.length > 0) {
        throw new Error(
          `withReleaseSigning: ${path.join(dir, 'signing.properties')} eksik alan içeriyor: ` +
            missing.join(', '),
        );
      }

      fs.writeFileSync(
        target,
        [
          '# ÜRETİLMİŞ DOSYA — elle düzenleme, her prebuild\'de üzerine yazılır.',
          `# Kaynak: ${path.join(dir, 'signing.properties')} (plugins/withReleaseSigning.js)`,
          `storeFile=${storeFile.replace(/\\/g, '/')}`,
          `storePassword=${props.storePassword}`,
          `keyAlias=${props.keyAlias}`,
          `keyPassword=${props.keyPassword}`,
          '',
        ].join('\n'),
        'utf8',
      );

      console.log(`✓ imza anahtarı kasadan bağlandı: ${storeFile}`);
      return cfg;
    },
  ]);
}

/** Şablonun debug imzasını bizim release config'imizle değiştirir. */
function withSigningGradle(config) {
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
}

module.exports = function withReleaseSigning(config) {
  return withKeyProperties(withSigningGradle(config));
};

module.exports.vaultDir = vaultDir;
module.exports.readProperties = readProperties;
