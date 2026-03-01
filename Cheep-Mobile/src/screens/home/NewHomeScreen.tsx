/**
 * 🏠 New Home Screen
 * Yenilenmiş ana sayfa tasarımı
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { productService, storeService, listService, categoryService } from '../../services';
import { ActiveListCard } from '../../components/home/ActiveListCard';
import { EmptyListCard } from '../../components/home/EmptyListCard';
import { SmartDealCard, StatsCard } from '../../components/home';
import { CategoryItem } from '../../components/home/CategoryItem';
import { NearbyStoreCard } from '../../components/home/NearbyStoreCard';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { Product, Store, ShoppingList } from '../../types';
import type { Category } from '../../services/category.service';
import type { HomeStackScreenProps } from '../../navigation/types';

// Icon mapping for categories (MaterialCommunityIcons uyumlu)
const CATEGORY_ICONS: Record<string, string> = {
  'meyve': 'fruit-grapes',
  'sebze': 'carrot',
  'süt': 'cow',
  'süt ürünleri': 'cow',
  'et': 'food-drumstick',
  'tavuk': 'food-drumstick',
  'fırın': 'bread-slice',
  'pasta': 'cupcake',
  'kahvaltı': 'toast',
  'kahvaltılık': 'egg-fried',
  'atıştırmalık': 'cookie',
  'snack': 'cookie',
  'içecek': 'cup',
  'içecekler': 'cup',
  'icecekler': 'cup',
  'beverage': 'cup',
  'drinks': 'cup',
  'temel gıda': 'silverware-fork-knife',
  'temel': 'silverware-fork-knife',
  'gıda': 'silverware-fork-knife',
  'temizlik': 'broom',
  'default': 'shape',
};

export function NewHomeScreen({ navigation }: HomeStackScreenProps<'HomeMain'>) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<{ min: number; max: number } | null>(null);
  const [savingsPercent, setSavingsPercent] = useState<number | undefined>(undefined);
  const [monthlySavings, setMonthlySavings] = useState<number>(0);
  const [monthlySavingsIncrease, setMonthlySavingsIncrease] = useState<number>(0);
  const [potentialSavings, setPotentialSavings] = useState<number>(0);
  const [listStoreLogos, setListStoreLogos] = useState<string[]>([]);
  const [listStoreNames, setListStoreNames] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lists, products, stores, allCategories] = await Promise.all([
        listService.getLists('active'),
        productService.getProducts({ limit: 100 }), // Daha fazla ürün çekiyoruz fiyat farkı hesaplamak için
        storeService.getStores(),
        categoryService.getParentCategories(),
      ]);

      // Ana sayfada maksimum 7 parent kategori göster (Tümü hariç, toplam 8 kategori olacak)
      const parentCategories = allCategories
        .filter((cat) => cat.parent_id === null)
        .slice(0, 7);

      // Fiyat farkına göre sırala (en büyük fark en üstte)
      const productsWithPriceDifference = products
        .filter((product) => product.store_prices && product.store_prices.length >= 2) // En az 2 fiyat olmalı
        .map((product) => {
          const prices = product.store_prices!.map((sp) => parseFloat(sp.price));
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceDifference = maxPrice - minPrice;
          return {
            ...product,
            priceDifference,
            minPrice,
            maxPrice,
          };
        })
        .sort((a, b) => b.priceDifference - a.priceDifference); // Büyükten küçüğe sırala

      console.log('📊 Data loaded:', {
        lists: lists.length,
        products: products.length,
        productsWithPriceDifference: productsWithPriceDifference.length,
        stores: stores.length,
        allCategories: allCategories.length,
        parentCategories: parentCategories.length,
      });

      const firstActiveList = lists[0] || null;
      setActiveList(firstActiveList);
      setFeaturedProducts(productsWithPriceDifference);
      setNearbyStores(stores);
      setCategories(parentCategories);

      // Aktif liste varsa ve liste öğeleri varsa, fiyat hesaplaması yap
      if (firstActiveList && firstActiveList.list_items && firstActiveList.list_items.length > 0) {
        try {
          // Liste detayını al (list_items ile birlikte)
          const listDetail = await listService.getListById(firstActiveList.id);
          
          // Eğer liste öğeleri varsa, rotaları hesapla
          if (listDetail.list_items && listDetail.list_items.length > 0) {
            const compareResult = await listService.compareList(firstActiveList.id, {
              maxStores: 3,
              includeMissingProducts: true,
            });

            // Tüm rotaların fiyatlarını al
            const routePrices = compareResult.strategies
              .filter(route => route.totalPrice > 0)
              .map(route => route.totalPrice);

            if (routePrices.length > 0) {
              const minPrice = Math.min(...routePrices);
              const maxPrice = Math.max(...routePrices);
              
              setEstimatedPrice({ min: Math.round(minPrice), max: Math.round(maxPrice) });

              // Tasarruf yüzdesini hesapla (en pahalı rota ile en ucuz rota arasındaki fark)
              if (maxPrice > 0) {
                const savings = ((maxPrice - minPrice) / maxPrice) * 100;
                setSavingsPercent(Math.round(savings));
              } else {
                setSavingsPercent(undefined);
              }

              // Potansiyel tasarruf miktarını hesapla
              const potentialSavingsAmount = maxPrice - minPrice;
              setPotentialSavings(Math.round(potentialSavingsAmount));

              // En iyi rotadaki marketlerin logo'larını al
              const bestRoute = compareResult.strategies
                .sort((a, b) => b.score - a.score)[0]; // En yüksek skorlu rota
              
              if (bestRoute && bestRoute.stores.length > 0) {
                // Store isimlerini topla (logolar assets'ten yüklenecek)
                const storeNames: string[] = [];
                const seenStoreIds = new Set<number>();
                
                bestRoute.stores.forEach(storeAllocation => {
                  if (!seenStoreIds.has(storeAllocation.store.id)) {
                    seenStoreIds.add(storeAllocation.store.id);
                    // Store ismini al
                    if (storeAllocation.store.name) {
                      storeNames.push(storeAllocation.store.name);
                    }
                  }
                });
                
                setListStoreNames(storeNames);
              } else {
                // En iyi rota yoksa, tüm ürünlerdeki marketleri topla
                const allStoreIds = new Set<number>();
                listDetail.list_items?.forEach(item => {
                  item.product?.store_prices?.forEach(sp => {
                    if (sp.store_id) {
                      allStoreIds.add(sp.store_id);
                    }
                  });
                });

                const storeNames: string[] = [];
                const seenStoreNames = new Set<string>();
                allStoreIds.forEach(storeId => {
                  const storePrice = listDetail.list_items
                    ?.flatMap(item => item.product?.store_prices || [])
                    .find(sp => sp.store_id === storeId);
                  if (storePrice?.store?.name && !seenStoreNames.has(storePrice.store.name)) {
                    seenStoreNames.add(storePrice.store.name);
                    storeNames.push(storePrice.store.name);
                  }
                });
                
                setListStoreNames(storeNames.slice(0, 5)); // Maksimum 5 market
              }
            } else {
              setEstimatedPrice(null);
              setSavingsPercent(undefined);
              setPotentialSavings(0);
              setListStoreLogos([]);
              setListStoreNames([]);
            }
          } else {
            setEstimatedPrice(null);
            setSavingsPercent(undefined);
            setPotentialSavings(0);
            setListStoreLogos([]);
            setListStoreNames([]);
          }
        } catch (error) {
          console.error('❌ Error calculating list prices:', error);
          setEstimatedPrice(null);
          setSavingsPercent(undefined);
        }
      } else {
        // Liste yoksa veya liste öğeleri yoksa, fiyat bilgilerini temizle
        setEstimatedPrice(null);
        setSavingsPercent(undefined);
        setPotentialSavings(0);
        setListStoreLogos([]);
        setListStoreNames([]);
      }

      // Bu ay içindeki toplam tasarrufu hesapla (tamamlanmış listelerden)
      try {
        const completedLists = await listService.getLists('completed');
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let totalSavings = 0;
        let previousMonthSavings = 0;
        
        for (const list of completedLists) {
          if (list.completed_at) {
            const completedDate = new Date(list.completed_at);
            const listMonth = completedDate.getMonth();
            const listYear = completedDate.getFullYear();
            
            // Bu ay içindeki listeler
            if (listMonth === currentMonth && listYear === currentYear) {
              // Tamamlanmış listelerden tasarruf hesaplamak için compare sonuçlarını al
              try {
                const compareResult = await listService.compareList(list.id, {
                  maxStores: 3,
                  includeMissingProducts: true,
                });
                totalSavings += compareResult.summary.maxSavings || 0;
              } catch (error) {
                // Hata durumunda devam et
                console.warn('Error calculating savings for completed list:', list.id);
              }
            }
            
            // Önceki ay içindeki listeler
            const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            if (listMonth === previousMonth && listYear === previousYear) {
              try {
                const compareResult = await listService.compareList(list.id, {
                  maxStores: 3,
                  includeMissingProducts: true,
                });
                previousMonthSavings += compareResult.summary.maxSavings || 0;
              } catch (error) {
                console.warn('Error calculating savings for previous month list:', list.id);
              }
            }
          }
        }
        
        setMonthlySavings(Math.round(totalSavings));
        setMonthlySavingsIncrease(Math.round(totalSavings - previousMonthSavings));
      } catch (error) {
        console.warn('Error calculating monthly savings:', error);
      }
    } catch (error) {
      console.error('❌ Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getLowestPrice = (product: Product) => {
    if (!product.store_prices?.length) return null;
    const prices = product.store_prices.map((sp) => parseFloat(sp.price));
    return Math.min(...prices).toFixed(2);
  };

  const getStoreName = (product: Product) => {
    if (!product.store_prices?.length) return '';
    const lowestPriceItem = product.store_prices.reduce((prev, curr) =>
      parseFloat(prev.price) < parseFloat(curr.price) ? prev : curr
    );
    return lowestPriceItem.store?.name || '';
  };

  const getPriceDifference = (product: Product & { priceDifference?: number }) => {
    if (product.priceDifference !== undefined) {
      return product.priceDifference;
    }
    if (!product.store_prices?.length || product.store_prices.length < 2) return 0;
    const prices = product.store_prices.map((sp) => parseFloat(sp.price));
    return Math.max(...prices) - Math.min(...prices);
  };

  const getPriceDifferencePercent = (product: Product & { priceDifference?: number; maxPrice?: number }) => {
    if (!product.maxPrice || product.maxPrice === 0) return 0;
    const difference = getPriceDifference(product);
    return Math.round((difference / product.maxPrice) * 100);
  };

  const getCategoryIcon = (categoryName: string): string => {
    // Türkçe locale kullanarak küçük harfe çevir (İ -> i, I -> ı)
    const lowerName = categoryName.toLocaleLowerCase('tr-TR').trim();
    
    // Debug: İçecek kategorisi için özel log
    if (__DEV__ && (lowerName.includes('içecek') || lowerName.includes('icecek'))) {
      console.log('🔍 İçecek kategorisi bulundu:', categoryName, '-> lowerName:', lowerName);
    }
    
    // Önce tam eşleşme kontrol et
    if (CATEGORY_ICONS[lowerName]) {
      if (__DEV__ && (lowerName.includes('içecek') || lowerName.includes('icecek'))) {
        console.log('✅ İkon bulundu (tam eşleşme):', CATEGORY_ICONS[lowerName]);
      }
      return CATEGORY_ICONS[lowerName];
    }
    
    // Türkçe karakterleri normalize et (içecek -> icecek gibi)
    // toLocaleLowerCase('tr-TR') zaten İ -> i yapıyor, ama yine de normalize ediyoruz
    const normalizedName = lowerName
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    
    if (CATEGORY_ICONS[normalizedName]) {
      if (__DEV__ && (normalizedName.includes('icecek'))) {
        console.log('✅ İkon bulundu (normalize eşleşme):', CATEGORY_ICONS[normalizedName]);
      }
      return CATEGORY_ICONS[normalizedName];
    }
    
    // Sonra içerik kontrolü yap (hem orijinal hem normalize edilmiş)
    // Önce normalize edilmiş kategori ismini kontrol et
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
      if (key !== 'default') {
        const normalizedKey = key
          .replace(/ı/g, 'i')
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ş/g, 's')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c');
        
        // Hem orijinal hem normalize edilmiş versiyonları kontrol et
        if (
          lowerName.includes(key) || 
          normalizedName.includes(normalizedKey) ||
          lowerName.includes(normalizedKey) ||
          normalizedName.includes(key)
        ) {
          if (__DEV__ && (lowerName.includes('içecek') || lowerName.includes('icecek'))) {
            console.log('✅ İkon bulundu (içerik eşleşmesi):', icon, 'key:', key);
          }
          return icon;
        }
      }
    }
    
    // Debug için console.log (geliştirme sırasında)
    if (__DEV__) {
      console.log('Category icon not found for:', categoryName, 'using default');
    }
    
    return CATEGORY_ICONS.default;
  };

  return (
    <View style={styles.container}>
      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {/* Sticky Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Cheep</Text>
                <View style={styles.divider} />
                <Text style={styles.subtitle}>Kontrol Paneli</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconButton}>
                  <MaterialCommunityIcons name="magnify" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color={colors.text.secondary} />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        {/* Active List Analysis Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Aktif Liste Analizi</Text>
          {activeList ? (
            <ActiveListCard
              listName={activeList.name}
              foundItems={activeList.list_items?.length || 0}
              totalItems={activeList.list_items?.length || 0}
              estimatedPrice={estimatedPrice || undefined}
              savingsPercent={savingsPercent}
              storeNames={listStoreNames.length > 0 ? listStoreNames : nearbyStores.slice(0, 5).map(s => s.name).filter(Boolean)}
              onPress={() => {
                navigation.dispatch(
                  CommonActions.navigate({
                    name: 'Lists',
                    params: {
                      screen: 'ListDetail',
                      params: { listId: activeList.id },
                    },
                  })
                );
              }}
            />
          ) : (
            <EmptyListCard
              onCreateList={() => {
                navigation.dispatch(
                  CommonActions.navigate({
                    name: 'Lists',
                  })
                );
              }}
            />
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <StatsCard
            icon="savings"
            iconColor={colors.secondary.main}
            label="Bu Ay Tasarruf"
            value={`${monthlySavings.toLocaleString('tr-TR')}₺`}
            badge={monthlySavingsIncrease > 0 ? `+${monthlySavingsIncrease.toLocaleString('tr-TR')}₺` : monthlySavingsIncrease < 0 ? `${monthlySavingsIncrease.toLocaleString('tr-TR')}₺` : potentialSavings > 0 ? `+${potentialSavings}₺ potansiyel` : undefined}
            badgeColor={colors.secondary.main}
          />
          <View style={styles.statsGap} />
          <StatsCard
            icon="analytics"
            iconColor="#F59E0B"
            label="Fiyat Endeksi"
            value="Stabil"
          />
        </View>

        {/* Smart Deals */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Akıllı Fırsatlar</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('PriceDifferenceList')}
            >
              <Text style={styles.seeAllText}>Tümünü İncele</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {featuredProducts.slice(0, 6).map((product) => {
              const price = getLowestPrice(product);
              const storeName = getStoreName(product);
              // Fiyat farkı yüzdesini göster
              const discountPercent = getPriceDifferencePercent(product);
              return (
                <SmartDealCard
                  key={product.id}
                  productName={product.name}
                  price={price || '0.00'}
                  unit={product.store_prices?.[0]?.unit || 'adet'}
                  storeName={storeName}
                  imageUrl={product.image_url || undefined}
                  discountPercent={discountPercent > 0 ? discountPercent : undefined}
                  onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Kategoriler</Text>
          <View style={styles.categoryGrid}>
            {/* Tümü category (special case - en başta) */}
            <CategoryItem
              key={0}
              name="Tümü"
              icon="apps"
              isActive={selectedCategory === 0}
              onPress={() => {
                setSelectedCategory(0);
                navigation.navigate('CategoryProducts', {
                  categoryId: 0,
                  categoryName: 'Tüm Kategoriler',
                });
              }}
            />
            {/* Dynamic categories from API - 7 parent categories (Tümü ile toplam 8) */}
            {categories.slice(0, 7).map((category) => (
              <CategoryItem
                key={category.id}
                name={category.name}
                icon={getCategoryIcon(category.name)}
                isActive={selectedCategory === category.id}
                onPress={() => {
                  setSelectedCategory(category.id);
                  navigation.navigate('CategoryProducts', {
                    categoryId: category.id,
                    categoryName: category.name,
                  });
                }}
              />
            ))}
          </View>
        </View>

        {/* Nearby Stores */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionLabel}>Yakındaki Mağazalar</Text>
          {nearbyStores.length > 0 ? (
            nearbyStores.map((store) => (
              <NearbyStoreCard
                key={store.id}
                storeName={store.name}
                distance={`${(Math.random() * 2 + 0.5).toFixed(1)} km`}
                logoUrl={store.logo_url || undefined}
                onPress={() => navigation.navigate('StoreDetail', { storeId: store.id })}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>Yakında market bulunamadı</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  header: {
    backgroundColor: `${colors.background.paper}F2`, // ~95% opacity
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  headerContent: {
    flexDirection: 'column',
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    minHeight: 44, // Daha iyi dokunma alanı ve ortalama için
    paddingVertical: spacing.xs,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.5,
    color: colors.text.primary,
  },

  divider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border.light,
  },

  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: colors.background.paper,
  },

  content: {
    flex: 1,
  },

  section: {
    padding: layout.screenPadding,
    gap: spacing.sm,
  },

  sectionLabel: {
    ...typography.styles.overline,
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },

  seeAllText: {
    ...typography.styles.body2,
    fontSize: 12,
    fontWeight: '500',
    color: colors.secondary.main,
  },

  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.md,
  },

  statsGap: {
    width: spacing.sm,
  },

  horizontalScroll: {
    paddingRight: layout.screenPadding,
    paddingBottom: spacing.md,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  lastSection: {
    // Padding removed - now handled by ScrollView contentContainerStyle
  },

  emptyText: {
    ...typography.styles.body2,
    color: colors.text.hint,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});

