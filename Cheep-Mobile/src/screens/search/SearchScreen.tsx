// Cheep-Mobile/src/screens/search/SearchScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { SearchBar } from '../../components/common/SearchBar';
import { SearchResultRow } from '../../components/search/SearchResultRow';
import { productService, listService } from '../../services';
import { useCart } from '../../context/CartContext';
import { getRecentSearches, addRecentSearch } from '../../utils/recentSearches';
import { colors, typography, spacing } from '../../theme';
import type { Product } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';

export function SearchScreen({ navigation }: HomeStackScreenProps<'Search'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { activeList, refresh } = useCart();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const reqId = useRef(0);

  useEffect(() => { getRecentSearches().then(setRecent); }, []);

  // Yazdıkça arama — 250ms debounce + stale istek koruması.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { reqId.current++; setResults([]); setLoading(false); return; }
    setLoading(true);
    const myId = ++reqId.current;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await productService.getProducts({ search: q, limit: 30 });
        if (!cancelled && myId === reqId.current) setResults(data);
      } catch {
        if (!cancelled && myId === reqId.current) setResults([]);
      } finally {
        if (!cancelled && myId === reqId.current) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const handleAdd = useCallback(async (product: Product) => {
    if (addedIds.has(product.id)) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      let listId = activeList?.id;
      if (!listId) {
        const created = await listService.createList({ name: t('list.select_modal.default_new_list_name') });
        listId = created.id;
      }
      await listService.addItem(listId, { product_id: product.id });
      setAddedIds(prev => new Set(prev).add(product.id));
      await refresh();
    } catch {
      // sessizce geç — kullanıcı tekrar deneyebilir
    }
  }, [activeList, refresh, addedIds, t]);

  const runRecent = (term: string) => setQuery(term);

  const onSubmit = () => { if (query.trim()) addRecentSearch(query).then(() => getRecentSearches().then(setRecent)); };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.searchRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.searchBarWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            onSubmit={onSubmit}
            onClear={() => setQuery('')}
          />
        </View>
      </View>

      {query.trim().length === 0 ? (
        <View style={styles.empty}>
          {recent.length > 0 ? (
            <>
              <Text style={styles.emptyLabel}>{t('search.recent')}</Text>
              <View style={styles.chips}>
                {recent.map((r) => (
                  <TouchableOpacity key={r} style={styles.chip} onPress={() => runRecent(r)}>
                    <Text style={styles.chipText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.hint}>{t('search.hint')}</Text>
          )}
        </View>
      ) : loading && results.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary.main} />
      ) : results.length === 0 ? (
        <Text style={styles.hint}>{t('search.no_results', { q: query.trim() })}</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <SearchResultRow
              product={item}
              added={addedIds.has(item.id)}
              onAdd={() => handleAdd(item)}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  back: { paddingHorizontal: spacing.xs },
  backText: { fontSize: 34, lineHeight: 34, color: colors.text.primary },
  searchBarWrap: { flex: 1 },
  list: { flex: 1 },
  empty: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  emptyLabel: { ...typography.styles.body2, color: colors.text.secondary, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, backgroundColor: colors.background.paper, borderWidth: 1, borderColor: colors.border.light },
  chipText: { ...typography.styles.body2, color: colors.text.primary },
  hint: { ...typography.styles.body2, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
