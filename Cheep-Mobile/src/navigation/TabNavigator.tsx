/**
 * 📱 Tab Navigator
 * Bottom tab navigation
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listService } from '../services';
import { setShouldOpenCreateModalFromFAB } from '../utils/fabState';
import { HomeNavigator } from './HomeNavigator';
import { ListsNavigator } from './ListsNavigator';
import { DealsNavigator } from './DealsNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { colors, spacing, shadows, borderRadius, typography } from '../theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

// Wrapper component to capture tab navigation ref
function HomeNavigatorWithRef() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  
  useEffect(() => {
    // Store tab navigation ref in global for FAB access
    (global as any).__tabNavigationRef = navigation;
  }, [navigation]);
  
  return <HomeNavigator />;
}

export function TabNavigator() {
  const insets = useSafeAreaInsets();
  
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
          component={HomeNavigatorWithRef}
          options={{
            tabBarLabel: 'Ana Sayfa',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name={focused ? "home" : "home"} 
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
            tabBarLabel: 'Listelerim',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name={focused ? "list-alt" : "list-alt"} 
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
            tabBarLabel: 'Fırsatlar',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name={focused ? "sell" : "sell"} 
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
            tabBarLabel: 'Profil',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name={focused ? "person" : "person"} 
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
function TabFAB() {
  const insets = useSafeAreaInsets();
  
  const handlePress = async () => {
    try {
      // Get tab navigation ref from global
      const tabNavigation = (global as any).__tabNavigationRef as BottomTabNavigationProp<TabParamList> | undefined;
      
      if (!tabNavigation) {
        console.error('Tab navigator not found');
        return;
      }
      
      // Check if there's an active list
      const activeLists = await listService.getLists('active');
      const activeList = activeLists.find((l) => l.status === 'active' && !l.is_template);
      
      if (activeList) {
        // Aktif liste varsa → Liste detay sayfasına git
        tabNavigation.dispatch(
          CommonActions.navigate({
            name: 'Lists',
            params: {
              screen: 'ListDetail',
              params: { listId: activeList.id },
            },
          })
        );
      } else {
        // Aktif liste yoksa → Yeni liste oluştur
        // Set global flag and navigate to Lists tab
        // ListsScreen will check this flag when focused
        setShouldOpenCreateModalFromFAB(true);
        tabNavigation.navigate('Lists');
      }
    } catch (error) {
      console.error('Error checking active lists:', error);
      // On error, navigate to Home screen
      const tabNavigation = (global as any).__tabNavigationRef as BottomTabNavigationProp<TabParamList> | undefined;
      if (tabNavigation) {
        tabNavigation.navigate('Home');
      }
    }
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
        <MaterialIcons name="add" size={20} color={colors.background.paper} />
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

