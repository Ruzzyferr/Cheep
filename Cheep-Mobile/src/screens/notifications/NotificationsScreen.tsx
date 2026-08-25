/**
 * 🔔 Bildirimler — listendeki ürünlerde fiyat düşüşleri.
 *
 * Bu ekran push izninden BAĞIMSIZ çalışır: düşüşler backend'de tespit edilip
 * kaydediliyor, izin yalnızca telefona bildirim düşmesini etkiliyor. İzin
 * vermeyen kullanıcı da buraya girip ucuzlayan ürünleri görür.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
// expo-image: bellek+disk önbelleği ve boyuta göre çözme (bkz. ProductThumb).
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { notificationService, type PriceDropNotification } from '../../services/notification.service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../queries';
import { RefreshBar, ErrorState } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, borderRadius } from '../../theme';
import type { HomeStackScreenProps } from '../../navigation/types';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';

export function NotificationsScreen({ navigation }: HomeStackScreenProps<'Notifications'>) {
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: qk.notifications.all(),
    queryFn: () => notificationService.list(50, 0),
  });
  const items = listQ.data?.items ?? [];
  const loading = listQ.isPending;

  /**
   * Ekran açıldığında hepsini okundu say — kullanıcı listeyi gördü, rozetin
   * inatla durması can sıkıcı olur.
   *
   * Başarıda okunmamış SAYISI da geçersizleşir. Eskiden yalnızca bu ekranın
   * kendi state'i güncelleniyordu; anasayfadaki zil rozeti okundu işaretlemeden
   * haberdar olmuyor ve bir sonraki açılışa kadar duruyordu.
   */
  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.notifications.all() });
      void qc.invalidateQueries({ queryKey: qk.notifications.unreadCount() });
    },
    onError: (e) => {
      // Mutasyonların varsayılan `retry: 0`ı burada bilinçli; ama hatanın
      // SESSİZ kalması değil. Başarısız olursa rozet yanık kalır ve aşağıdaki
      // efekt `items` her değiştiğinde yeniden denemeye çalışırdı.
      console.warn('Bildirimler okundu işaretlenemedi:', e);
    },
  });

  /**
   * Okundu işaretleme EKRAN BAŞINA BİR KEZ denenir.
   *
   * Eskiden koşul yalnızca "okunmamış var mı" idi ve `[items]` bağımlılığıyla
   * çalışıyordu: istek başarısız olursa `read_at` sunucuda değişmiyor, liste
   * her tazelendiğinde koşul yine sağlanıyor ve aynı başarısız mutasyon
   * tekrar tekrar tetikleniyordu.
   */
  const markAttempted = React.useRef(false);
  useEffect(() => {
    if (markAttempted.current) return;
    if (!items.some((i) => !i.read_at)) return;
    if (markAllRead.isPending) return;
    markAttempted.current = true;
    markAllRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const onRefresh = () => {
    void listQ.refetch();
  };

  const renderItem = ({ item }: { item: PriceDropNotification }) => {
    const oldPrice = parseFloat(item.old_price);
    const newPrice = parseFloat(item.new_price);
    const unread = !item.read_at;

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ProductDetail', { productId: item.product.id })}
      >
        <View style={styles.thumbWrap}>
          {item.product.image_url ? (
            <Image
              source={{ uri: item.product.image_url }}
              style={styles.thumb}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : (
            <MaterialIcons name="shopping-basket" size={24} color={colors.text.secondary} />
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {item.product.brand ? `${item.product.brand} ` : ''}
            {item.product.name}
          </Text>
          <Text style={styles.store}>{item.store.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.oldPrice}>{formatMoney(oldPrice)}</Text>
            <MaterialIcons name="arrow-forward" size={14} color={colors.text.secondary} />
            <Text style={styles.newPrice}>{formatMoney(newPrice)}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>-%{Math.round(item.drop_pct)}</Text>
            </View>
          </View>
        </View>

        {unread && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (listQ.isError) {
    return <ErrorState onRetry={onRefresh} />;
  }

  return (
    <>
    <RefreshBar visible={listQ.isFetching && !listQ.isPending && !listQ.isRefetching} />
    <FlatList
      style={styles.container}
      contentContainerStyle={
      items.length === 0
        ? styles.emptyWrap
        : [styles.listContent, { paddingBottom: bottomSpacing }]
    }
      data={items}
      keyExtractor={(i) => String(i.id)}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={listQ.isRefetching} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialIcons name="notifications-none" size={48} color={colors.text.hint} />
          <Text style={styles.emptyTitle}>{t('notifications.empty_title')}</Text>
          <Text style={styles.emptyBody}>{t('notifications.empty_body')}</Text>
        </View>
      }
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  listContent: { padding: spacing.md },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.default },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { borderWidth: 1, borderColor: colors.primary.light },

  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  thumb: { width: 44, height: 44 },

  body: { flex: 1 },
  name: { ...typography.styles.body2, color: colors.text.primary, fontWeight: '600' },
  store: { ...typography.styles.caption, color: colors.text.secondary, marginTop: 2 },

  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs },
  oldPrice: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    textDecorationLine: 'line-through',
  },
  newPrice: { ...typography.styles.body2, color: colors.primary.main, fontWeight: '700' },
  badge: {
    backgroundColor: colors.success.light,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  badgeText: { ...typography.styles.caption, color: colors.success.dark, fontWeight: '700' },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
    marginLeft: spacing.sm,
  },

  empty: { alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: {
    ...typography.styles.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
