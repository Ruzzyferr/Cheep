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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // GÜVENLİ ALAN: kompozer Android'in gesture çubuğunun ALTINDA kalıyordu —
  // ölçüm, çubuğun giriş alanının üstüne çizildiğini ve altta yalnızca ~9dp
  // boşluk kaldığını gösterdi. Alt inset yoksa da nefes payı bırakılıyor.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
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
            // Devre dışı hâlde eskiden `text.disabled` (#C2CDC6) kullanılıyordu:
            // aynı tondaki daire üzerinde 1,45:1, yani fiilen GÖRÜNMEZ —
            // düğme bozuk sanılıyordu. Artık kapalı olduğu belli ama okunur.
            color={canSend ? colors.background.paper : colors.text.hint}
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
    paddingTop: spacing.sm,
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
    // 48dp: Android'in dokunma hedefi tabanı. 40dp altında kalıyordu.
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  sendButtonActive: {
    backgroundColor: colors.primary.main,
  },
  sendButtonDisabled: {
    // Girdi alanıyla AYNI renk değil: ikisi aynı olunca düğme alanın içinde
    // kayboluyordu. Belirgin biçimde daha koyu bir nötr.
    backgroundColor: colors.border.main,
  },
});
