/**
 * 📭 Empty List Card
 * Aktif liste yoksa gösterilen kart
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import { useTranslation } from 'react-i18next';

interface EmptyListCardProps {
  onCreateList: () => void;
}

export function EmptyListCard({ onCreateList }: EmptyListCardProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('list.active_list')}</Text>
        
        <View style={styles.row}>
          <Text style={styles.message}>{t('list.no_active_list')}</Text>
          
          <TouchableOpacity style={styles.addButton} onPress={onCreateList}>
            <MaterialIcons name="add" size={24} color={colors.background.paper} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
  },

  content: {
    padding: spacing.md,
  },

  title: {
    ...typography.styles.subtitle1,
    fontSize: 18,
    color: colors.text.primary,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },

  message: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    flex: 1,
  },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

