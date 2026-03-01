/**
 * 📋 Lists Navigator
 * Lists stack screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ListsScreen } from '../screens/lists/ListsScreen';
import { ListDetailScreen } from '../screens/lists/ListDetailScreen';
import { CompareResultsScreen } from '../screens/lists/CompareResultsScreen';
import { StrategyDetailScreen } from '../screens/lists/StrategyDetailScreen';
import { colors, typography } from '../theme';
import type { ListsStackParamList } from './types';

const Stack = createStackNavigator<ListsStackParamList>();

export function ListsNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ListsMain"
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
        name="ListsMain"
        component={ListsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ListDetail"
        component={ListDetailScreen}
        options={{ title: 'Liste Detayı' }}
      />
      <Stack.Screen
        name="CompareResults"
        component={CompareResultsScreen}
        options={{ title: 'Karşılaştırma Sonuçları' }}
      />
      <Stack.Screen
        name="StrategyDetail"
        component={StrategyDetailScreen}
        options={{ title: 'Rota Detayı' }}
      />
    </Stack.Navigator>
  );
}

