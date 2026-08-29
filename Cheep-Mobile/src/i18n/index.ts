import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './locales/tr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import pl from './locales/pl.json';
import sv from './locales/sv.json';
import hr from './locales/hr.json';
import hu from './locales/hu.json';
import ro from './locales/ro.json';

export const SUPPORTED_LANGUAGES = ['tr', 'en', 'de', 'pl', 'sv', 'hr', 'hu', 'ro'] as const;
export type AppLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Dilin KENDİ adı, kendi dilinde.
 *
 * Dil seçicide her seçenek daima kendi dilinde yazılır ("Magyar", "Hrvatski")
 * — aksi hâlde arayüzü anlamayan bir kullanıcı kendi dilini bulamaz, ki dil
 * seçicinin varlık sebebi tam olarak o durumdur. Bu yüzden bu tablo çeviri
 * dosyalarında DEĞİL, dilden bağımsız olarak burada duruyor.
 */
export const LANGUAGE_NATIVE_NAMES: Record<AppLanguage, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  pl: 'Polski',
  sv: 'Svenska',
  hr: 'Hrvatski',
  hu: 'Magyar',
  ro: 'Română',
};

// i18next'in KENDİ kurulum deseni bu; kural `use`'un aynı zamanda adlandırılmış
// bir dışa aktarım olmasına takılıyor ve burada yanlış pozitif üretiyor.
// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    de: { translation: de },
    pl: { translation: pl },
    sv: { translation: sv },
    hr: { translation: hr },
    hu: { translation: hu },
    ro: { translation: ro },
  },
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
