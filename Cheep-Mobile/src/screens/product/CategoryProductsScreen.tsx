/**
 * 📂 Category Products Screen
 * Kategori bazlı ürün listesi - En ucuz 3 market gösterir
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { productService, categoryService, listService } from '../../services';
import { ProductGridCard } from '../../components/product/ProductGridCard';
import { CategoryChip } from '../../components/common/CategoryChip';
import { colors, typography, spacing, layout } from '../../theme';
import type { Product } from '../../types';
import type { Category } from '../../services/category.service';
import type { HomeStackScreenProps } from '../../navigation/types';

export function CategoryProductsScreen({
  navigation,
  route,
}: HomeStackScreenProps<'CategoryProducts'>) {
  const { categoryId, categoryName } = route.params;
  
  const [selectedCategory, setSelectedCategory] = useState<number>(categoryId);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // FlatList scroll kontrolü için ref
  const flatListRef = React.useRef<FlatList>(null);

  // Scroll'u en üste götür
  const scrollToTop = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadSubcategories();
    loadProducts();
    // Kategori değiştiğinde scroll'u en üste götür
    scrollToTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  useEffect(() => {
    // Alt kategori değiştiğinde (null dahil) ürünleri yükle
    loadProducts();
    // Scroll'u en üste götür
    scrollToTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubcategory]);

  const loadCategories = async () => {
    try {
      const parentCategories = await categoryService.getParentCategories();
      setCategories(parentCategories);
    } catch (error) {
      console.error('❌ Load categories error:', error);
    }
  };

  const loadSubcategories = async () => {
    try {
      const subs = await categoryService.getSubcategories(selectedCategory);
      setSubcategories(subs);
      setSelectedSubcategory(null); // Reset subcategory selection
    } catch (error) {
      console.error('❌ Load subcategories error:', error);
      setSubcategories([]);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const categoryIdToUse = selectedSubcategory || selectedCategory;
      
      // 🔥 Parent kategori veya "Tümü" seçiliyse daha yüksek limit
      const isParentOrAll = selectedSubcategory === null || selectedSubcategory === 0;
      const limit = isParentOrAll ? 300 : 100;  // Parent/Tümü: 300, Alt kategori: 100
      
      const params: any = {
        limit: limit,
      };
      
      // Eğer "Tüm Kategoriler" (id=0) DEĞİLSE, category_id parametresi ekle
      if (categoryIdToUse !== 0) {
        params.category_id = categoryIdToUse;
      }
      
      console.log('🔍 Loading products with params:', params, '(Parent/Tümü:', isParentOrAll, ')');
      const productsData = await productService.getProducts(params);
      setProducts(productsData);
      console.log('📦 Products loaded:', productsData.length, 'for category:', categoryIdToUse);
    } catch (error) {
      console.error('❌ Load products error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCategories(), loadSubcategories(), loadProducts()]);
    setRefreshing(false);
  };

  const getTopThreePrices = (product: Product) => {
    if (!product.store_prices || product.store_prices.length === 0) {
      return [];
    }

    // Sort by price ascending
    const sortedPrices = [...product.store_prices]
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      .slice(0, 3);

    return sortedPrices.map((sp) => ({
      storeName: sp.store?.name || 'Bilinmeyen Market',
      price: parseFloat(sp.price).toFixed(2),
    }));
  };

  const getCurrentCategoryName = () => {
    if (selectedCategory === 0) {
      return 'Tüm Kategoriler';
    }
    const category = categories.find((c) => c.id === selectedCategory);
    return category?.name || categoryName;
  };

  const handleAddToCart = async (product: Product) => {
    try {
      // Aktif listeyi bul
      const activeLists = await listService.getLists('active');
      const activeList = activeLists.find((list) => !list.is_template);

      if (!activeList) {
        Alert.alert(
          'Aktif Liste Yok',
          'Ürünü eklemek için önce bir alışveriş listesi oluşturmalısınız.',
          [
            { text: 'Tamam', style: 'cancel' },
            {
              text: 'Liste Oluştur',
              onPress: () => {
                // Lists tab'ına git
                navigation.dispatch(
                  CommonActions.navigate({
                    name: 'Lists',
                  })
                );
              },
            },
          ]
        );
        return;
      }

      // Ürünü aktif listeye ekle
      await listService.addItem(activeList.id, {
        product_id: product.id,
        quantity: 1,
        unit: product.store_prices?.[0]?.unit || 'adet',
      });

      Alert.alert('Başarılı', `${product.name} aktif listenize eklendi`);
    } catch (error: any) {
      console.error('Add to cart error:', error);
      const errorMessage = error?.response?.data?.message || 'Ürün eklenirken bir hata oluştu';
      Alert.alert('Hata', errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backButton, { marginRight: spacing.sm }]}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getCurrentCategoryName()}</Text>
        </View>

        {/* Main Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          <CategoryChip
            label="Tüm Kategoriler"
            isActive={selectedCategory === 0}
            onPress={() => {
              setSelectedCategory(0);
              setSelectedSubcategory(null);
            }}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              isActive={selectedCategory === category.id}
              onPress={() => setSelectedCategory(category.id)}
            />
          ))}
        </ScrollView>

        {/* Subcategories */}
        {subcategories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcategoriesScroll}
          >
            <CategoryChip
              label="Tümü"
              isActive={selectedSubcategory === null}
              onPress={() => setSelectedSubcategory(null)}
            />
            {subcategories.map((subcategory) => (
              <CategoryChip
                key={subcategory.id}
                label={subcategory.name}
                isActive={selectedSubcategory === subcategory.id}
                onPress={() => setSelectedSubcategory(subcategory.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Products Grid */}
      <FlatList
        ref={flatListRef}
        data={products}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
        renderItem={({ item }) => {
          const topThreePrices = getTopThreePrices(item);
          return (
            <View style={styles.gridItem}>
              <ProductGridCard
                productName={item.name}
                categoryName={item.category?.name}
                imageUrl={item.image_url || undefined}
                topThreePrices={topThreePrices}
                onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                onAddToCart={() => handleAddToCart(item)}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Bu kategoride ürün bulunamadı</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  header: {
    backgroundColor: `${colors.background.paper}CC`,
    paddingTop: spacing.xl,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    ...typography.styles.h4,
    fontSize: 18,
    color: colors.text.primary,
    flex: 1,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  categoriesScroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },

  subcategoriesScroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },

  gridContainer: {
    padding: layout.screenPadding,
    paddingBottom: spacing['3xl'],
  },

  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  gridItem: {
    width: '48%',
  },

  emptyContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },

  emptyText: {
    ...typography.styles.body2,
    color: colors.text.hint,
  },
});

