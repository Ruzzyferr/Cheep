/**
 * ThreadListSheet
 * Bottom-sheet modal listing past chat threads with delete + new chat actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { assistantService } from '../../services/assistant.service';
import type { ChatThread } from '../../services/assistant.service';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import i18n from '../../i18n';

// ============================================================
// Helpers
// ============================================================

function formatRelative(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return i18n.t('time.just_now');
  if (diffMin < 60) return i18n.t('time.minutes_ago', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return i18n.t('time.hours_ago', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return i18n.t('time.days_ago', { n: diffD });
  const diffW = Math.floor(diffD / 7);
  return i18n.t('time.weeks_ago', { n: diffW });
}

// ============================================================
// Props
// ============================================================

interface ThreadListSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectThread: (id: number) => void;
  onNewChat: () => void;
  activeThreadId?: number | null;
}

// ============================================================
// Component
// ============================================================

export function ThreadListSheet({
  visible,
  onClose,
  onSelectThread,
  onNewChat,
  activeThreadId,
}: ThreadListSheetProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await assistantService.listThreads();
      setThreads(data);
    } catch (err) {
      console.error('listThreads error:', err);
      Alert.alert('Hata', i18n.t('assistant.history_error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load threads whenever sheet opens
  useEffect(() => {
    if (visible) {
      loadThreads();
    }
  }, [visible, loadThreads]);

  const handleSelect = useCallback(
    (id: number) => {
      onSelectThread(id);
      onClose();
    },
    [onSelectThread, onClose]
  );

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Sohbeti sil', i18n.t('assistant.delete_confirm'), [
        { text: i18n.t('common.dismiss'), style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(id);
              await assistantService.deleteThread(id);
              setThreads((prev) => prev.filter((t) => t.id !== id));
            } catch (err) {
              console.error('deleteThread error:', err);
              Alert.alert('Hata', 'Sohbet silinemedi.');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]);
    },
    []
  );

  const handleNewChat = useCallback(() => {
    onNewChat();
    onClose();
  }, [onNewChat, onClose]);

  const renderThread = useCallback(
    ({ item }: { item: ChatThread }) => {
      const isActive = item.id === activeThreadId;
      return (
        <TouchableOpacity
          style={[styles.row, isActive && styles.rowActive]}
          onPress={() => handleSelect(item.id)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="chat-bubble-outline"
            size={20}
            color={isActive ? colors.primary.main : colors.text.secondary}
            style={styles.rowIcon}
          />
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, isActive && styles.rowTitleActive]} numberOfLines={1}>
              {item.title ?? 'Yeni sohbet'}
            </Text>
            <Text style={styles.rowDate}>{formatRelative(item.updated_at)}</Text>
          </View>
          {deleting === item.id ? (
            <ActivityIndicator size="small" color={colors.error?.main ?? '#EF4444'} />
          ) : (
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={styles.deleteButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Sohbeti sil"
            >
              <MaterialIcons name="delete-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [deleting, activeThreadId, handleSelect, handleDelete]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{i18n.t('assistant.history_title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Kapat">
              <MaterialIcons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* New chat action */}
          <TouchableOpacity style={styles.newChatRow} onPress={handleNewChat} activeOpacity={0.7}>
            <MaterialIcons name="add" size={22} color={colors.primary.main} />
            <Text style={styles.newChatText}>Yeni sohbet</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Thread list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
            </View>
          ) : (
            <FlatList
              data={threads}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderThread}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="history" size={40} color={colors.text.disabled ?? colors.text.secondary} />
                  <Text style={styles.emptyText}>{i18n.t('assistant.history_empty')}</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '75%',
    paddingBottom: layout.screenPadding,
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
  newChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  newChatText: {
    ...typography.styles.body1,
    color: colors.primary.main,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: layout.screenPadding,
  },
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  rowActive: {
    backgroundColor: colors.primary['50'],
    marginHorizontal: -layout.screenPadding,
    paddingHorizontal: layout.screenPadding,
    borderRadius: borderRadius.md,
  },
  rowIcon: {
    marginRight: spacing.sm,
  },
  rowInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '500',
  },
  rowTitleActive: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  rowDate: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    gap: spacing.md,
  },
  emptyText: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },
});
