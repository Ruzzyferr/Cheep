/**
 * 🔢 CodeInput
 * 6 haneli doğrulama kodu girişi (otomatik ilerleme + yapıştırma desteği).
 */
import React, { useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { colors, spacing } from '../../theme';

interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
  error?: boolean;
}

export function CodeInput({
  length = 6,
  value,
  onChange,
  autoFocus = true,
  error = false,
}: CodeInputProps) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const chars = value.split('');

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '');

    // Silme
    if (!digits) {
      const next = value.split('');
      next[index] = '';
      onChange(next.join('').slice(0, length));
      return;
    }

    // Yapıştırma (birden fazla rakam)
    if (digits.length > 1) {
      const combined = (value.slice(0, index) + digits).slice(0, length);
      onChange(combined);
      const focusIndex = Math.min(combined.length, length - 1);
      inputs.current[focusIndex]?.focus();
      return;
    }

    // Tek rakam
    const next = value.split('');
    next[index] = digits;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !chars[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const next = value.split('');
      next[index - 1] = '';
      onChange(next.join(''));
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            inputs.current[i] = r;
          }}
          style={[
            styles.box,
            !!chars[i] && styles.boxFilled,
            error && styles.boxError,
          ]}
          value={chars[i] || ''}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={i === 0 ? length : 1}
          autoFocus={autoFocus && i === 0}
          textAlign="center"
          returnKeyType="done"
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border.main,
    backgroundColor: colors.background.input,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  boxFilled: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary[50],
  },
  boxError: {
    borderColor: colors.error.main,
    backgroundColor: colors.error.bg,
  },
});
