/**
 * 🛍️ Product Detail Screen
 * Product information and price comparison
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { productService, categoryService, affiliateService } from '../../services';
import { useQuery } from '@tanstack/react-query';
import { useProduct, useScope, qk, STALE } from '../../queries';
import { DetailSkeleton, ErrorState , Card, Button } from '../../components/ui';
import { PriceTrendCard } from '../../components/product/PriceTrendCard';
import { ProductThumb } from '../../components/product/ProductThumb';
import { SelectListModal } from '../../components/list/SelectListModal';
import { getStoreTint, getStoreInitial } from '../../utils/storeLogo';
import { openExternalUrl } from '../../utils/linking';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import type { StorePrice } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';
import type { Category } from '../../services/category.service';
import { useTranslation } from 'react-i18next';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';

export function ProductDetailScreen({
  route,
  navigation,
}: HomeStackScreenProps<'ProductDetail'>) {
  const { t } = useTranslation();
  const { productId } = route.params;
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const { formatMoney } = useLocale();
  const scope = useScope();
  const [openingStore, setOpeningStore] = useState(false);
  const [showListModal, setShowListModal] = useState(false);

  // Üç ayrı sorgu: ürün, kategori (üst bilgisi için) ve fiyat geçmişi.
  // Eskiden hepsi tek bir useEffect içinde `alive` bayrağıyla elle
  // yönetiliyordu; React Query iptal ve yarış durumlarını kendi çözüyor.
  const productQ = useProduct(productId);
  const product = productQ.data ?? null;
  const loading = productQ.isPending;

  const categoryQ = useQuery({
    queryKey: qk.categories.subcategories(scope, product?.category_id ?? 0),
    queryFn: () => categoryService.getCategoryById(product!.category_id as number),
    enabled: Boolean(product?.category_id),
    staleTime: STALE.static,
  });
  const categoryWithParent = (categoryQ.data as Category | undefined) ?? null;

  const historyQ = useQuery({
    queryKey: qk.products.history(scope, productId, 90),
    queryFn: () => productService.getPriceHistory(productId, 90),
    staleTime: STALE.catalog,
  });
  const priceHistory = historyQ.data ?? null;
  const historyLoading = historyQ.isPending;
  const historyError = historyQ.isError;

  /** Ürünün fiyatları, ucuzdan pahalıya. */
  const prices: StorePrice[] = useMemo(() => {
    const list = product?.store_prices ?? [];
    return [...list].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  }, [product]);

  /** En ucuz / en pahalı / ortalama ve tasarruf yüzdesi. */
  const priceStats = useMemo(() => {
    if (prices.length === 0) return null;
    const values = prices.map((p) => parseFloat(p.price));
    const cheapest = prices[0];
    const mostExpensive = prices[prices.length - 1];
    const averagePrice = values.reduce((sum, p) => sum + p, 0) / values.length;
    const priceDifference = parseFloat(mostExpensive.price) - parseFloat(cheapest.price);
    const savingsPercentage =
      parseFloat(mostExpensive.price) > 0
        ? (priceDifference / parseFloat(mostExpensive.price)) * 100
        : 0;
    return { cheapest, mostExpensive, averagePrice, priceDifference, savingsPercentage };
  }, [prices]);

  if (loading) {
    // Boş bir spinner yerine sayfanın şeklini gösteren iskelet: kullanıcı ne
    // geleceğini görür ve sayfa yerleşimi zıplamaz.
    return <DetailSkeleton />;
  }

  if (productQ.isError) {
    return <ErrorState onRetry={() => productQ.refetch()} />;
  }

  if (!product) {
    return (
      <View style={styles.error}>
        <Text>{t('product.not_found')}</Text>
      </View>
    );
  }

  // "mf-..." bizim resmi-API çapraz-mağaza anahtarımızdır (gerçek EAN değil) —
  // kullanıcıya "Barkod" olarak GÖSTERİLMEZ. Yalnızca gerçek barkodlar gösterilir.
  const showRealBarcode = !!product.ean_barcode && !product.ean_barcode.startsWith('mf-');

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomSpacing }]}
      >
        {/* Product Image — görsel yoksa kategori-ikonlu placeholder */}
        <View style={styles.imageContainer}>
          <ProductThumb imageUrl={product.image_url} categoryName={product.category?.name} iconSize={56} />
        </View>

      {/* Product Info */}
      <View style={styles.content}>
        {product.brand && <Text style={styles.brand}>{product.brand}</Text>}
        <Text style={styles.name}>{product.name}</Text>
        {product.category && (
          <Text style={styles.category}>{product.category.name}</Text>
        )}

        {/* Price Statistics */}
        {priceStats && prices.length > 1 && (
          <Card padding="md" variant="elevated" style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('product.cheapest_label')}</Text>
                <Text style={[styles.statValue, styles.cheapestPrice]}>
                  {formatMoney(parseFloat(priceStats.cheapest?.price || '0'))}
                </Text>
                {priceStats.cheapest?.store && (
                  <Text style={styles.statStore}>{priceStats.cheapest.store.name}</Text>
                )}
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('product.most_expensive')}</Text>
                <Text style={[styles.statValue, styles.expensivePrice]}>
                  {formatMoney(parseFloat(priceStats.mostExpensive?.price || '0'))}
                </Text>
                {priceStats.mostExpensive?.store && (
                  <Text style={styles.statStore}>{priceStats.mostExpensive.store.name}</Text>
                )}
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('product.difference')}</Text>
                <Text style={[styles.statValue, styles.differencePrice]}>
                  {formatMoney(priceStats.priceDifference)}
                </Text>
                <Text style={styles.savingsPercent}>
                  {t('product.saving_pct', { pct: priceStats.savingsPercentage.toFixed(0) })}
                </Text>
              </View>
            </View>
            <View style={styles.avgPriceRow}>
              <Text style={styles.avgPriceLabel}>{t('product.average_price')}</Text>
              <Text style={styles.avgPriceValue}>
                {formatMoney(priceStats.averagePrice)}
              </Text>
            </View>
          </Card>
        )}

        {/* Price Comparison */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('product.store_prices')}</Text>
          {prices.length > 0 && (
            <Text style={styles.priceCount}>{prices.length} market</Text>
          )}
        </View>
        {prices.length > 0 ? (
          prices.map((storePrice, index) => {
            const isCheapest = priceStats?.cheapest?.id === storePrice.id;
            const priceValue = parseFloat(storePrice.price);
            const savings = priceStats?.mostExpensive
              ? ((parseFloat(priceStats.mostExpensive.price) - priceValue) / parseFloat(priceStats.mostExpensive.price)) * 100
              : 0;

            return (
              <TouchableOpacity
                key={storePrice.id}
                onPress={() => {
                  if (storePrice.store?.id) {
                    navigation.navigate('StoreDetail', { storeId: storePrice.store.id });
                  }
                }}
                activeOpacity={0.7}
              >
                <Card padding="md" style={[styles.priceCard, isCheapest && styles.cheapestCard]}>
                  <View style={styles.priceCardContent}>
                    <View style={styles.storeSection}>
                      <View
                        style={[
                          styles.storeLogoPlaceholder,
                          { backgroundColor: getStoreTint(storePrice.store?.name) },
                        ]}
                      >
                        <Text style={styles.storeLogoInitial}>
                          {getStoreInitial(storePrice.store?.name)}
                        </Text>
                      </View>
                      <View style={styles.storeInfo}>
                        <Text style={styles.storeName}>
                          {storePrice.store?.name || 'Market'}
                        </Text>
                        <Text style={styles.unit}>{storePrice.unit}</Text>
                        {storePrice.last_updated_at && (
                          <Text style={styles.updateDate}>
                            {new Date(storePrice.last_updated_at).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.priceSection}>
                      {isCheapest && (
                        <View style={styles.bestDealBadge}>
                          <MaterialIcons name="local-offer" size={16} color={colors.secondary.main} />
                          <Text style={styles.bestDealText}>{t('product.best')}</Text>
                        </View>
                      )}
                      <Text style={[styles.price, isCheapest && styles.cheapestPriceText]}>
                        {formatMoney(priceValue)}
                      </Text>
                      {savings > 0 && !isCheapest && (
                        <Text style={styles.savingsBadge}>
                          %{savings.toFixed(0)} tasarruf
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        ) : (
          <Card padding="lg" variant="outlined">
            <View style={styles.noPriceContainer}>
              <MaterialIcons name="info-outline" size={48} color={colors.text.hint} />
              <Text style={styles.noPrice}>{t('product.no_price_info')}</Text>
              <Text style={styles.noPriceSubtext}>{t('product.no_price_info_desc')}</Text>
            </View>
          </Card>
        )}

        {/* Yasal: kaynak + bilgilendirme amaçlı disclaimer (6502 / Reklam Kurulu uyumu) */}
        {prices.length > 0 && (
          <View style={styles.disclaimerBox}>
            <MaterialIcons name="info-outline" size={14} color={colors.text.hint} />
            <Text style={styles.disclaimerText}>
              {t('product.price_disclaimer')}
            </Text>
          </View>
        )}

        {/* Affiliate: en ucuz markette al */}
        {priceStats?.cheapest?.store?.id ? (
          <Button
            title={t('product.buy_cheapest', { store: priceStats.cheapest.store.name })}
            onPress={async () => {
              const store = priceStats.cheapest!.store!;
              setOpeningStore(true);
              try {
                const res = await affiliateService.trackClick({
                  storeId: store.id,
                  productId,
                  context: 'product',
                });
                await openExternalUrl(res.url);
              } catch {
                // openExternalUrl kendi uyarısını gösterir
              } finally {
                setOpeningStore(false);
              }
            }}
            loading={openingStore}
            fullWidth
            style={styles.buyButton}
            icon={
              <MaterialIcons
                name="open-in-new"
                size={18}
                color={colors.background.paper}
                style={styles.buyButtonIcon}
              />
            }
          />
        ) : null}

        {/* Price History Trend */}
        <View style={styles.detailsSection}>
          <PriceTrendCard history={priceHistory} loading={historyLoading} error={historyError} />
        </View>

        {/* Product Details */}
        {(showRealBarcode || product.category || categoryWithParent) && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>{t('product.info')}</Text>
            <Card padding="md" variant="outlined">
              {showRealBarcode && (
                <View style={styles.detailRow}>
                  <MaterialIcons name="qr-code" size={20} color={colors.text.secondary} />
                  <Text style={styles.detailLabel}>Barkod:</Text>
                  <Text style={styles.detailValue}>{product.ean_barcode}</Text>
                </View>
              )}
              {(categoryWithParent || product.category) && (
                <View style={styles.detailRow}>
                  <MaterialIcons name="category" size={20} color={colors.text.secondary} />
                  <Text style={styles.detailLabel}>Kategori:</Text>
                  <View style={styles.categoryValue}>
                    {categoryWithParent?.parent && (
                      <>
                        <Text style={styles.detailValue}>{categoryWithParent.parent.name}</Text>
                        <MaterialIcons name="chevron-right" size={16} color={colors.text.secondary} style={styles.categorySeparator} />
                      </>
                    )}
                    <Text style={styles.detailValue}>
                      {categoryWithParent?.name || product.category?.name || 'Bilinmiyor'}
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          </View>
        )}

        <Button
          title="Listeye Ekle"
          onPress={() => setShowListModal(true)}
          fullWidth
          style={styles.addButton}
        />
        </View>
      </ScrollView>

      <SelectListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        onSelect={(listId) => {
          // Product added successfully
          console.log('Product added to list:', listId);
        }}
        productId={productId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backBtn: {
    position: 'absolute',
    left: layout.screenPadding,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: colors.background.paper,
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },

  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderText: {
    fontSize: 100,
  },

  content: {
    padding: layout.screenPadding,
  },

  brand: {
    ...typography.styles.overline,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  name: {
    ...typography.styles.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  category: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  sectionTitle: {
    ...typography.styles.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },

  priceCount: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
  },

  statsCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.background.paper,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statLabel: {
    ...typography.styles.caption,
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  statValue: {
    ...typography.styles.h4,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },

  // RENK HIYERARSISI — ekranda TEK bir "cevap" olmali.
  //
  // Eskiden EN UCUZ ve FARK'in ikisi de YESILDI, yani hangisinin cevap oldugu
  // renkten okunamiyordu; EN PAHALI ise paletin hicbir yerinde bulunmayan saf
  // bir ALARM KIRMIZISIYLA (#EF4444) yaziliyordu. Rakip bir marketin fiyati
  // bir hata durumu degil. Artik: en ucuz = marka yesili (tek vurgu), en
  // pahali = notr, fark = ikincil yesil ve daha kucuk.
  cheapestPrice: {
    color: colors.primary.main,
  },

  expensivePrice: {
    color: colors.text.secondary,
  },

  differencePrice: {
    // EN UCUZ'dan bir kademe ASAGIDA: tek vurgu onda kalsin.
    color: colors.text.secondary,
    fontSize: 16,
  },

  statStore: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.text.hint,
    textAlign: 'center',
  },

  savingsPercent: {
    ...typography.styles.caption,
    fontSize: 10,
    // secondary.main (#2E9E78) DEĞİL: beyaz üzerinde 3,34:1 ve bu 10sp'lik
    // bir metin — WCAG AA 4,5:1 istiyor. Üstelik taşıdığı bilgi ürünün
    // vaadinin ta kendisi ("%11 tasarruf"); okunamaması kabul edilemez.
    // primary.main 6,12:1 veriyor ve marka yeşilinin ta kendisi.
    color: colors.primary.main,
    fontWeight: '600',
  },

  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },

  avgPriceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  avgPriceLabel: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },

  avgPriceValue: {
    ...typography.styles.h4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },

  priceCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background.card,
  },

  cheapestCard: {
    borderWidth: 2,
    borderColor: colors.secondary.main,
    backgroundColor: `${colors.secondary.main}08`,
  },

  priceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  storeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  storeLogo: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.background.input,
    resizeMode: 'contain',
  },

  storeLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.background.input,
    justifyContent: 'center',
    alignItems: 'center',
  },

  storeLogoInitial: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    fontWeight: '700',
  },

  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 14,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: colors.text.secondary,
  },

  storeInfo: {
    flex: 1,
  },

  storeName: {
    ...typography.styles.body1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },

  unit: {
    ...typography.styles.caption,
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },

  updateDate: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.text.hint,
  },

  priceSection: {
    alignItems: 'flex-end',
  },

  bestDealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.secondary.main}15`,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },

  bestDealText: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary.main,
    marginLeft: 2,
  },

  price: {
    ...typography.styles.h3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },

  cheapestPriceText: {
    color: colors.secondary.main,
  },

  savingsBadge: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.secondary.main,
    fontWeight: '600',
    backgroundColor: `${colors.secondary.main}15`,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },

  noPriceContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },

  noPrice: {
    ...typography.styles.body1,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: '600',
  },

  noPriceSubtext: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.hint,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  detailsSection: {
    marginTop: spacing.lg,
  },

  buyButton: {
    marginTop: spacing.md,
  },

  buyButtonIcon: {
    marginRight: spacing.xs,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  detailLabel: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },

  detailValue: {
    ...typography.styles.body1,
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },

  categoryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },

  categorySeparator: {
    marginHorizontal: spacing.xs,
  },

  addButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },

  scrollContent: {
  },
});

