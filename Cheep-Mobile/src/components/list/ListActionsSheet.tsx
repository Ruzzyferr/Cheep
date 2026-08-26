/**
 * ⋮ List Actions Sheet
 * Simple bottom-sheet modal for the list detail overflow menu.
 * Follows the SelectListModal overlay pattern (slide-up, rounded top, safe-area).
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';

interface ListActionsSheetProps {
  visible: boolean;
  isActive: boolean;
  onClose: () => void;
  onSetActive: () => void;
  onRename: () => void;
  onClone: () => void;
  onImport: () => void;
  onDelete: () => void;
}

export function ListActionsSheet({
  visible,
  isActive,
  onClose,
  onSetActive,
  onRename,
  onClone,
  onImport,
  onDelete,
}: ListActionsSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Bir aksiyonu çalıştırmadan önce sheet'i kapat (çift-modal çakışmasını önle).
  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.modal, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('list.menu_title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!isActive && (
            <ActionRow
              icon="check-circle-outline"
              label={t('list.set_active')}
              onPress={() => run(onSetActive)}
            />
          )}
          <ActionRow
            icon="edit"
            label={t('list.rename')}
            onPress={() => run(onRename)}
          />
          <ActionRow
            icon="content-copy"
            label={t('list.clone')}
            onPress={() => run(onClone)}
          />
          <ActionRow
            icon="import-export"
            label={t('list.import_from_list')}
            onPress={() => run(onImport)}
          />
          <ActionRow
            icon="delete-outline"
            label={t('list.delete_action')}
            danger
            onPress={() => run(onDelete)}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const tint = danger ? colors.error.main : colors.text.primary;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <MaterialIcons name={icon} size={22} color={tint} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, { color: tint }]}>{label}</Text>
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },

  rowIcon: {
    marginRight: spacing.md,
    width: 24,
    textAlign: 'center',
  },

  rowLabel: {
    ...typography.styles.body1,
    fontWeight: '500',
  },
});
