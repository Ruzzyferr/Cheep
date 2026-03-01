/**
 * 🔍 Search Bar
 * Search input component
 */

import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onClear?: () => void;
}

import { MaterialIcons } from '@expo/vector-icons';

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Ürün ara...',
  onSubmit,
  onClear,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.hint}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {value.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={onClear}>
          <MaterialIcons name="close" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  searchIcon: {
    marginRight: spacing.sm,
  },

  input: {
    flex: 1,
    ...typography.styles.body1,
    color: colors.text.primary,
  },

  clearButton: {
    padding: spacing.xs,
  },
});

