/**
 * 💬 MessageBubble
 * Chat message bubble: user (right/teal) vs assistant (left/white)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { shadows } from '../../theme/shadows';

interface MessageBubbleProps {
  role: string;
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  bubbleUser: {
    backgroundColor: colors.primary.main,
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.background.paper,
    borderBottomLeftRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  text: {
    ...typography.styles.body2,
  },
  textUser: {
    color: colors.background.paper,
  },
  textAssistant: {
    color: colors.text.primary,
  },
});
