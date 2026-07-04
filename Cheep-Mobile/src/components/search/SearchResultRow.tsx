// Cheep-Mobile/src/components/search/SearchResultRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProductThumb } from '../product/ProductThumb';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, borderRadius } from '../../theme';
import type { Product } from '../../types';

interface SearchResultRowProps {
  product: Product;
  onAdd: () => void;
  added: boolean;
  onPress: () => void;
}

export function SearchResultRow({ product, onAdd, added, onPress }: SearchResultRowProps) {
  const { formatMoney } = useLocale();
  const prices = (product.store_prices ?? [])
    .map((sp) => parseFloat(sp.price))
    .filter((p) => Number.isFinite(p));
  const lowest = prices.length ? Math.min(...prices) : null;
  const storeCount = product.store_prices?.length ?? 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <ProductThumb imageUrl={product.image_url} categoryName={product.category?.name} iconSize={26} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.meta}>
          {lowest != null && <Text style={styles.price}>{formatMoney(lowest)}</Text>}
          {storeCount > 0 && <Text style={styles.stores}>· {storeCount} market</Text>}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.addBtn, added && styles.addBtnDone]}
        onPress={onAdd}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons name={added ? 'check' : 'add'} size={22} color={added ? colors.background.paper : colors.primary.main} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  info: { flex: 1 },
  name: { ...typography.styles.body2, color: colors.text.primary, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  price: { ...typography.styles.caption, color: colors.primary.main, fontWeight: '700' },
  stores: { ...typography.styles.caption, color: colors.text.secondary },
  addBtn: {
    width: 36, height: 36, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary.main,
    backgroundColor: colors.background.paper,
  },
  addBtnDone: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
});
