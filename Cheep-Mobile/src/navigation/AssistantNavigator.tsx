/**
 * ✨ Assistant Navigator
 * Stack navigator for the assistant chat flow
 * Task 10 will wire this into the tab bar / FAB
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AssistantChatScreen } from '../screens/assistant/AssistantChatScreen';
import { colors, typography } from '../theme';
import type { AssistantStackParamList } from './types';

const Stack = createStackNavigator<AssistantStackParamList>();

export function AssistantNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="AssistantChat"
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
        name="AssistantChat"
        component={AssistantChatScreen}
        options={{ title: '✨ Asistan' }}
      />
    </Stack.Navigator>
  );
}
