/**
 * 🌳 Root Navigator
 * Main navigation container
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { TabNavigator } from './TabNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { AssistantNavigator } from './AssistantNavigator';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { IntroTourScreen } from '../screens/intro/IntroTourScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading, emailVerified, onboardingDone, introSeen } = useAuth();

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!introSeen ? (
          // İlk açılış: "nasıl kullanılır" tanıtımı (auth'tan önce)
          <Stack.Screen name="Intro" component={IntroTourScreen} />
        ) : !isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !emailVerified ? (
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        ) : !onboardingDone ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Assistant" component={AssistantNavigator} />
            {/* Profil'den tekrar oynatma için (replay) */}
            <Stack.Screen
              name="Intro"
              component={IntroTourScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
  },
});

