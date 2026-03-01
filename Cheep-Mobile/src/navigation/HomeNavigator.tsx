/**
 * 🏠 Home Navigator
 * Home stack screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NewHomeScreen } from '../screens/home/NewHomeScreen';
import { ProductDetailScreen } from '../screens/product/ProductDetailScreen';
import { StoreDetailScreen } from '../screens/store/StoreDetailScreen';
import { CategoryProductsScreen } from '../screens/product/CategoryProductsScreen';
import { PriceDifferenceScreen } from '../screens/product/PriceDifferenceScreen';
import { colors, typography } from '../theme';
import type { HomeStackParamList } from './types';

const Stack = createStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.paper,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          ...typography.styles.h3,
        },
      }}
    >
      <Stack.Screen
        name="HomeMain"
        component={NewHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Ürün Detayı' }}
      />
      <Stack.Screen
        name="StoreDetail"
        component={StoreDetailScreen}
        options={{ title: 'Market Detayı' }}
      />
      <Stack.Screen
        name="CategoryProducts"
        component={CategoryProductsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PriceDifferenceList"
        component={PriceDifferenceScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

