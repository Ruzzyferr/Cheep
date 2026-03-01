/**
 * 🎯 Deals Navigator
 * Deals stack screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { DealsScreen } from '../screens/deals/DealsScreen';
import { colors, typography } from '../theme';
import type { DealsStackParamList } from './types';

const Stack = createStackNavigator<DealsStackParamList>();

export function DealsNavigator() {
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
        name="DealsMain"
        component={DealsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

