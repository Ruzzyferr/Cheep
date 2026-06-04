/**
 * 📈 PriceTrendCard
 * Bir ürünün fiyat geçmişini bağımlılıksız (View tabanlı) bir bar sparkline ile gösterir.
 * Modern fintech görünüm: yumuşak kart, teal vurgu, en düşük fiyat vurgulanır.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { colors, spacing, borderRadius, typography } from '../../theme';
import type { PriceHistoryResponse } from '../../services/product.service';

interface PriceTrendCardProps {
  history: PriceHistoryResponse | null;
  loading?: boolean;
}

const MAX_BARS = 24;
const CHART_HEIGHT = 72;

function formatPrice(value: number): string {
  return `₺${value.toFixed(2)}`;
}

export function PriceTrendCard({ history, loading }: PriceTrendCardProps) {
  // En çok veri noktası olan market serisini seç
  const series = useMemo(() => {
    if (!history?.series?.length) return null;
    return [...history.series].sort((a, b) => b.points.length - a.points.length)[0];
  }, [history]);

  const bars = useMemo(() => {
    if (!series) return [];
    const points = series.points.slice(-MAX_BARS);
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    return points.map((p) => ({
      price: p.price,
      // 14..CHART_HEIGHT arası normalize (eşit fiyatlarda bile görünür)
      height: 14 + ((p.price - min) / range) * (CHART_HEIGHT - 14),
      isLowest: p.price === min,
    }));
  }, [series]);

  return (
    <Card padding="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialIcons name="show-chart" size={20} color={colors.primary.main} />
          <Text style={styles.title}>Fiyat Geçmişi</Text>
        </View>
        {history?.days ? <Text style={styles.subtitle}>Son {history.days} gün</Text> : null}
      </View>

      {loading ? (
        <Text style={styles.empty}>Yükleniyor…</Text>
      ) : !series || bars.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="timeline" size={28} color={colors.text.hint} />
          <Text style={styles.empty}>Henüz fiyat geçmişi birikmedi</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={[styles.chip, styles.chipLow]}>
              <MaterialIcons name="arrow-downward" size={14} color={colors.primary.dark} />
              <Text style={styles.chipLowText}>
                En düşük {history?.summary.lowest != null ? formatPrice(history.summary.lowest) : '—'}
              </Text>
            </View>
            <View style={[styles.chip, styles.chipHigh]}>
              <MaterialIcons name="arrow-upward" size={14} color={colors.warning.dark} />
              <Text style={styles.chipHighText}>
                En yüksek {history?.summary.highest != null ? formatPrice(history.summary.highest) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.chart} accessibilityLabel="Fiyat geçmişi grafiği">
            {bars.map((bar, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height: bar.height, backgroundColor: bar.isLowest ? colors.primary.main : colors.primary[200] },
                ]}
              />
            ))}
          </View>

          <Text style={styles.footer}>{series.store.name} fiyat seyri</Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.styles.subtitle1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.styles.caption,
    color: colors.text.secondary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  chipLow: {
    backgroundColor: colors.primary[50],
  },
  chipLowText: {
    ...typography.styles.caption,
    fontWeight: '600',
    color: colors.primary.dark,
  },
  chipHigh: {
    backgroundColor: colors.warning.bg,
  },
  chipHighText: {
    ...typography.styles.caption,
    fontWeight: '600',
    color: colors.warning.dark,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 3,
  },
  bar: {
    flex: 1,
    borderRadius: borderRadius.sm,
    minWidth: 4,
  },
  footer: {
    ...typography.styles.caption,
    color: colors.text.hint,
    marginTop: spacing.sm,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  empty: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
