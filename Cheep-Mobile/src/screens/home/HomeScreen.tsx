/**
 * 🏠 Home Screen
 * Main screen with products and categories
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { productService, storeService } from '../../services';
import { ProductCard } from '../../components/product/ProductCard';
import { StoreChip } from '../../components/store/StoreChip';
import { SearchBar } from '../../components/common/SearchBar';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing, layout } from '../../theme';
import type { Product, Store } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';

export function HomeScreen({ navigation }: HomeStackScreenProps<'HomeMain'>) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, storesData] = await Promise.all([
        productService.getProducts({ limit: 20 }),
        storeService.getStores(),
      ]);
      setProducts(productsData);
      setStores(storesData);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const results = await productService.searchProducts(searchQuery);
      setProducts(results);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadData();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Cheep</Text>
          {user?.name && (
            <Text style={styles.userName}>{user.name}</Text>
          )}
        </View>

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={handleSearch}
          onClear={handleClearSearch}
        />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {/* Stores Section */}
        {stores.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Marketler</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {stores.map((store) => (
                <StoreChip
                  key={store.id}
                  storeName={store.name}
                  onPress={() =>
                    navigation.navigate('StoreDetail', { storeId: store.id })
                  }
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ürünler</Text>
            {searchQuery && (
              <Text style={styles.resultCount}>
                {products.length} sonuç
              </Text>
            )}
          </View>

          {loading ? (
            <View style={styles.loading}>
              <Text>Yükleniyor...</Text>
            </View>
          ) : products.length > 0 ? (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() =>
                    navigation.navigate('ProductDetail', { productId: item.id })
                  }
                  showStore
                />
              )}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              scrollEnabled={false}
            />
          ) : (
            <EmptyState
              title="Ürün bulunamadı"
              description={
                searchQuery
                  ? 'Aramanızla eşleşen ürün bulunamadı'
                  : 'Henüz ürün bulunmuyor'
              }
            />
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
    backgroundColor: colors.background.paper,
    padding: layout.screenPadding,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  headerTitle: {
    ...typography.styles.h2,
    color: colors.text.primary,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  userName: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  content: {
    flex: 1,
  },

  section: {
    padding: layout.screenPadding,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  sectionTitle: {
    ...typography.styles.h3,
    color: colors.text.primary,
  },

  resultCount: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },

  productRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  loading: {
    padding: spacing.xl,
    alignItems: 'center',
  },
});

