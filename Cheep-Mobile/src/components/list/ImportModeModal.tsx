/**
 * 🔀 Import Mode Modal
 * Choose how to import from another list: merge (add missing) or replace (overwrite).
 * Two large, clear option cards. Follows the SelectListModal sheet visual language.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';

interface ImportModeModalProps {
  visible: boolean;
  onClose: () => void;
  onChoose: (mode: 'merge' | 'replace') => void;
}

export function ImportModeModal({ visible, onClose, onChoose }: ImportModeModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('list.import_mode.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <OptionCard
              icon="playlist-add"
              title={t('list.import_mode.merge_title')}
              desc={t('list.import_mode.merge_desc')}
              onPress={() => onChoose('merge')}
            />
            <OptionCard
              icon="swap-horiz"
              title={t('list.import_mode.replace_title')}
              desc={t('list.import_mode.replace_desc')}
              onPress={() => onChoose('replace')}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OptionCard({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardIconWrap}>
        <MaterialIcons name={icon} size={24} color={colors.primary.main} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modal: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  title: {
    ...typography.styles.h3,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },

  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeText: {
    fontSize: 24,
    color: colors.text.secondary,
  },

  body: {
    padding: layout.screenPadding,
    gap: spacing.md,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.main,
    backgroundColor: colors.background.paper,
  },

  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  cardText: {
    flex: 1,
  },

  cardTitle: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 2,
  },

  cardDesc: {
    ...typography.styles.caption,
    color: colors.text.secondary,
  },
});
