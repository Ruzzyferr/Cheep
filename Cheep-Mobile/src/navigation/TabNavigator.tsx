/**
 * 📱 Tab Navigator
 * Bottom tab navigation
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeNavigator } from './HomeNavigator';
import { ListsNavigator } from './ListsNavigator';
import { DealsNavigator } from './DealsNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { CartProvider, useCart } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';
import { colors, spacing, shadows } from '../theme';
import type { TabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <CartProvider>
      <ToastProvider>
        <TabNavigatorInner />
      </ToastProvider>
    </CartProvider>
  );
}

function TabNavigatorInner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { count } = useCart();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary.main,
          tabBarInactiveTintColor: colors.text.secondary,
          tabBarStyle: {
            backgroundColor: colors.background.paper,
            borderTopWidth: 1,
            borderTopColor: colors.border.light,
            height: 72,
            paddingBottom: spacing.xs,
            paddingTop: spacing.xs,
            paddingHorizontal: 0,
            position: 'absolute',
            bottom: insets.bottom, // Sistem çubuğunun üstüne yerleştir
            left: 0,
            right: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginTop: spacing.xs / 2,
          },
          tabBarItemStyle: {
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm, // Tüm öğeler için eşit yatay padding
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeNavigator}
          options={{
            tabBarLabel: t('tabs.home'),
            tabBarIcon: ({ color }) => (
              <MaterialIcons
                name="home"
                size={24}
                color={color}
              />
            ),
            tabBarItemStyle: {
              paddingVertical: spacing.xs,
              paddingLeft: spacing.lg,
              paddingRight: spacing.xs, // Listelerim'e yakın
            },
          }}
        />
        <Tab.Screen
          name="Lists"
          component={ListsNavigator}
          options={{
            tabBarLabel: t('tabs.lists'),
            // Aktif listedeki ürün sayısını rozet olarak göster — kullanıcı
            // Listelerim'e girmeden sepetinde kaç ürün olduğunu görür.
            tabBarBadge: count > 0 ? count : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.primary.main,
              color: colors.background.paper,
              fontSize: 10,
              fontWeight: '700',
            },
            tabBarIcon: ({ color }) => (
              <MaterialIcons
                name="list-alt"
                size={24}
                color={color}
              />
            ),
            tabBarItemStyle: {
              paddingVertical: spacing.xs,
              paddingLeft: spacing.xs, // Ana Sayfa'ya yakın
              paddingRight: spacing.lg, // FAB'a uzak
            },
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              // Reset Lists stack to ListsMain when tab is pressed
              // This ensures user always sees the list screen with tabs, not a detail screen
              const state = navigation.getState();
              const listsTabState = state.routes.find(r => r.name === 'Lists')?.state;
              if (listsTabState && listsTabState.routes && listsTabState.routes.length > 1) {
                // Reset to ListsMain if we're on a nested screen
                navigation.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Lists',
                      state: {
                        routes: [{ name: 'ListsMain' }],
                        index: 0,
                      },
                    },
                  ],
                });
              }
            },
          })}
        />
        <Tab.Screen
          name="Deals"
          component={DealsNavigator}
          options={{
            tabBarLabel: t('tabs.deals'),
            tabBarIcon: ({ color }) => (
              <MaterialIcons
                name="sell"
                size={24}
                color={color}
              />
            ),
            tabBarItemStyle: {
              paddingVertical: spacing.xs,
              paddingLeft: spacing.lg, // FAB'a uzak
              paddingRight: spacing.xs, // Profil'e yakın
            },
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileNavigator}
          options={{
            tabBarLabel: t('tabs.profile'),
            tabBarIcon: ({ color }) => (
              <MaterialIcons
                name="person"
                size={24}
                color={color}
              />
            ),
            tabBarItemStyle: {
              paddingVertical: spacing.xs,
              paddingLeft: spacing.xs, // Fırsatlar'a yakın
              paddingRight: spacing.lg,
            },
          }}
        />
      </Tab.Navigator>
      <TabFAB />
      {/* Sistem navbar'ının arkasını beyaz yapmak için */}
      <View 
        style={[
          styles.safeAreaBackground,
          { height: insets.bottom }
        ]} 
      />
    </View>
  );
}

// FAB Button Component (HTML'deki gibi ortada)
// Asistan, tab'ların üstündeki bir root-stack route'u. Tab navigasyonunu root
// stack ile compose ederek 'Assistant'a tip güvenli şekilde gidebiliriz.
type TabFABNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  StackNavigationProp<RootStackParamList>
>;

function TabFAB() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<TabFABNavigationProp>();

  const handlePress = () => {
    // Navigate to the Assistant screen (a full-screen root stack route above the tabs)
    navigation.navigate('Assistant');
  };

  return (
    <View
      style={[
        styles.fabContainer,
        { bottom: insets.bottom + 16 } // Tab bar içinde ortalamak için: (72 - 40) / 2 = 16
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.fabButton}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <MaterialIcons name="auto-awesome" size={20} color={colors.background.paper} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fabContainer: {
    position: 'absolute',
    // bottom değeri dinamik olarak ayarlanıyor (TabFAB içinde)
    left: '50%',
    width: 48, // FAB butonu için daha küçük alan
    height: 48,
    marginLeft: -24, // -translate-x-1/2
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    width: 40,
    height: 40,
    borderRadius: 12, // Daha küçük border radius
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background.paper,
    ...shadows.md, // Daha küçük shadow
  },
  safeAreaBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.paper,
    zIndex: 0,
  },
});

