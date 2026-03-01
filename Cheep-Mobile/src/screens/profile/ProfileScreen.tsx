/**
 * 👤 Profile Screen
 * User profile and settings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card, Button } from '../../components/ui';
import { colors, typography, spacing, layout } from '../../theme';
import type { ProfileStackScreenProps } from '../../navigation/types';

export function ProfileScreen({
  navigation,
}: ProfileStackScreenProps<'ProfileMain'>) {
  const { user, logout } = useAuth();

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          <Card padding="none">
            <MenuItem
              icon={<MaterialIcons name="edit" size={20} color={colors.text.secondary} />}
              title="Profili Düzenle"
              onPress={() => {
                // TODO: Navigate to edit profile
                console.log('Edit profile');
              }}
            />
            <Divider />
            <MenuItem
              icon={<MaterialIcons name="store" size={20} color={colors.text.secondary} />}
              title="Favori Marketler"
              subtitle="Favori marketlerinizi yönetin"
              onPress={() => {
                // TODO: Navigate to favorite stores
                console.log('Favorite stores');
              }}
            />
          </Card>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama</Text>
          <Card padding="none">
            <MenuItem
              icon={<MaterialIcons name="settings" size={20} color={colors.text.secondary} />}
              title="Ayarlar"
              onPress={() => {
                // TODO: Navigate to settings
                console.log('Settings');
              }}
            />
            <Divider />
            <MenuItem
              icon={<MaterialIcons name="info-outline" size={20} color={colors.text.secondary} />}
              title="Hakkında"
              subtitle="Versiyon 1.0.0"
              onPress={() => {
                // TODO: Navigate to about
                console.log('About');
              }}
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

// Menu Item Component
function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIcon}>{icon}</View>
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
    paddingTop: spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  avatarText: {
    ...typography.styles.h3,
    color: colors.background.paper,
    fontWeight: '700',
  },

  name: {
    ...typography.styles.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },

  email: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },

  content: {
    flex: 1,
  },

  section: {
    padding: layout.screenPadding,
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

  menuIcon: {
    width: 24,
    height: 24,
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
    fontWeight: '500',
  },

  menuSubtitle: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },


  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: spacing.md + 24 + spacing.md, // icon + margin
  },

  bottomSpacing: {
    height: spacing['2xl'],
  },
});

