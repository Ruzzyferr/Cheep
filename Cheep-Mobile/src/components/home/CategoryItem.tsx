/**
 * 📁 Category Item
 * Kategori grid item
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {borderRadius, colors, spacing} from '../../theme';

interface CategoryItemProps {
  name: string;
  icon: string; // MaterialCommunityIcons icon name
  isActive?: boolean;
  onPress: () => void;
}

export function CategoryItem({ name, icon, isActive = false, onPress }: CategoryItemProps) {
  // Fallback to 'shape' if icon is invalid
  const iconName = icon && typeof icon === 'string' ? icon : 'shape';
  
  return (
    <TouchableOpacity 
      style={[styles.container, isActive && styles.activeContainer]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      {isActive && <View style={styles.activeIndicator} />}
      <MaterialCommunityIcons 
        name={iconName as any} 
        size={24} 
        color={isActive ? colors.primary.main : colors.text.secondary} 
      />
      <Text style={[styles.text, isActive && styles.activeText]} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '23%', // 4 columns için ~25% minus gap
    padding: spacing.sm,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.xs + 2,
    position: 'relative',
    marginBottom: spacing.xs,
  },

  activeContainer: {
    borderColor: colors.primary.main,
  },

  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.xs,
    right: spacing.xs,
    height: 2,
    backgroundColor: colors.primary.main,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
  },

  text: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  activeText: {
    fontWeight: '600',
    color: colors.primary.main,
  },
});

