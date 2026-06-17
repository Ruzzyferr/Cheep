/**
 * 👤 Profile Screen
 * User profile, quick stats and settings (premium fintech layout).
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Card, Button } from '../../components/ui';
import { listService } from '../../services';
import { colors, typography, spacing, layout, shadows } from '../../theme';
import type { ProfileStackScreenProps } from '../../navigation/types';

export function ProfileScreen({
  navigation,
}: ProfileStackScreenProps<'ProfileMain'>) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ active: 0, completed: 0, templates: 0 });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const [all, templates] = await Promise.all([
            listService.getLists('all'),
            listService.getTemplates(),
          ]);
          if (!alive) return;
          setStats({
            active: all.filter((l) => l.status === 'active' && !l.is_template).length,
            completed: all.filter((l) => l.status === 'completed').length,
            templates: templates.length,
          });
        } catch {
          /* keep zeros */
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleAbout = () => {
    Alert.alert('Cheep Hakkında', 'Cheep · Sürüm 1.0.0\nTürkiye marketlerinde en uygun fiyatı bul.');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats strip */}
        <View style={styles.statsRow}>
          <StatTile icon="playlist-add-check" value={stats.active} label="Aktif Liste" />
          <StatTile icon="history" value={stats.completed} label="Tamamlanan" />
          <StatTile icon="bookmark-border" value={stats.templates} label="Şablon" />
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          <Card padding="none" variant="elevated">
            <MenuItem
              icon="edit"
              title="Profili Düzenle"
              onPress={() => console.log('Edit profile')}
            />
            <Divider />
            <MenuItem
              icon="store"
              title="Favori Marketler"
              subtitle="Favori marketlerinizi yönetin"
              onPress={() => console.log('Favorite stores')}
            />
          </Card>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama</Text>
          <Card padding="none" variant="elevated">
            <MenuItem
              icon="notifications-none"
              title="Bildirimler"
              subtitle="Fiyat düşüşü uyarıları"
              onPress={() => console.log('Notifications')}
            />
            <Divider />
            <MenuItem
              icon="info-outline"
              title="Hakkında"
              subtitle="Sürüm 1.0.0"
              onPress={handleAbout}
            />
          </Card>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <Button
            title="Çıkış Yap"
            onPress={handleLogout}
            variant="outline"
            fullWidth
          />
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

// Stat tile
function StatTile({
  icon,
  value,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>
        <MaterialIcons name={icon} size={18} color={colors.primary.main} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Menu Item Component
function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.menuIconWrap}>
        <MaterialIcons name={icon} size={20} color={colors.primary.main} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.text.hint} />
    </TouchableOpacity>
  );
}

// Divider Component
function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  header: {
    backgroundColor: colors.background.paper,
    padding: layout.screenPadding,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.fab,
  },

  avatarText: {
    ...typography.styles.h3,
    color: colors.background.paper,
    fontWeight: '700',
  },

  name: {
    ...typography.styles.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
    fontWeight: '700',
  },

  email: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },

  content: {
    flex: 1,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },

  statTile: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },

  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },

  statValue: {
    ...typography.styles.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },

  statLabel: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },

  section: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },

  sectionTitle: {
    ...typography.styles.overline,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  menuContent: {
    flex: 1,
  },

  menuTitle: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '600',
  },

  menuSubtitle: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: spacing.md + 36 + spacing.md,
  },

  bottomSpacing: {
    height: spacing['2xl'],
  },
});
