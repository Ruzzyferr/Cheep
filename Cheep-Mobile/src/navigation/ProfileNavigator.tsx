/**
 * 👤 Profile Navigator
 * Profile stack screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { colors, typography } from '../theme';
import type { ProfileStackParamList } from './types';

const Stack = createStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  const { t } = useTranslation();

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
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false, title: t('screens.profile') }}
      />
    </Stack.Navigator>
  );
}

