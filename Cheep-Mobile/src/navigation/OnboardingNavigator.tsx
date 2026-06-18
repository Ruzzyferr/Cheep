/**
 * 🐦 Onboarding Navigator
 * Single-screen stack that hosts the animated mascot wizard.
 * On finish, OnboardingScreen calls profileService.updateProfile + refreshOnboarding
 * which flips RootNavigator to Main automatically.
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';

type OnboardingStackParamList = {
  OnboardingMain: undefined;
};

const Stack = createStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingMain" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}
