/**
 * ⌨️ ChatInputBar
 * Text input + send button for the assistant chat
 */

import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { shadows } from '../../theme/shadows';
import i18n from '../../i18n';

interface ChatInputBarProps {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
}

export function ChatInputBar({ value, onChangeText, onSend, sending, disabled }: ChatInputBarProps) {
  const canSend = !sending && !disabled && value.trim().length > 0;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={i18n.t('assistant.placeholder')}
        placeholderTextColor={colors.text.hint}
        multiline
        maxLength={1000}
        returnKeyType="default"
        editable={!sending && !disabled}
      />
      <TouchableOpacity
        style={[styles.sendButton, canSend ? styles.sendButtonActive : styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={!canSend}
        accessibilityLabel={i18n.t('assistant.send')}
      >
        {sending ? (
          <ActivityIndicator size="small" color={colors.background.paper} />
        ) : (
          <MaterialIcons
            name="send"
            size={20}
            color={canSend ? colors.background.paper : colors.text.disabled}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    ...typography.styles.body2,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  sendButtonActive: {
    backgroundColor: colors.primary.main,
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.input,
  },
});
