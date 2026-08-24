import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './locales/tr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import pl from './locales/pl.json';
import sv from './locales/sv.json';

export const SUPPORTED_LANGUAGES = ['tr', 'en', 'de', 'pl', 'sv'] as const;
export type AppLanguage = typeof SUPPORTED_LANGUAGES[number];

// i18next'in KENDİ kurulum deseni bu; kural `use`'un aynı zamanda adlandırılmış
// bir dışa aktarım olmasına takılıyor ve burada yanlış pozitif üretiyor.
// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en }, de: { translation: de }, pl: { translation: pl }, sv: { translation: sv } },
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
