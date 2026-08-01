/**
 * Sorgu kapsamı: ülke + dil.
 *
 * Her query key'in parçası. Aynı istek TR/PL'de farklı katalog, tr/en'de
 * farklı kategori adları döndürür; kapsam key'de olmasa ülke değiştiren
 * kullanıcı bir önceki ülkenin cache'ini görürdü.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../context/LocaleContext';
import type { Scope } from './keys';

export function useScope(): Scope {
    const { country } = useLocale();
    const { i18n } = useTranslation();
    const lang = i18n.language || 'tr';
    return useMemo(() => ({ country, lang }), [country, lang]);
}
