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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Card, Button } from '../../components/ui';
import { listService, profileService } from '../../services';
import { colors, typography, spacing, layout, shadows } from '../../theme';
import type { ProfileStackScreenProps } from '../../navigation/types';
import type { UserProfile } from '../../types';
import { ONBOARDING_QUESTIONS } from '../onboarding/onboardingConfig';

// ─── Preference option lists from onboarding config ───────────────────────────
const HOUSEHOLD_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'household_size')!.options!;
const DIET_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'diet')!.options!;
const AVOID_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'avoid')!.options!;
const ALLERGY_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'allergies')!.options!;

// Uygulama sürümünü app config'ten oku (hardcode değil); yoksa makul varsayılan.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export function ProfileScreen({
  navigation,
}: ProfileStackScreenProps<'ProfileMain'>) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ active: 0, completed: 0, templates: 0 });

  // ─── Preferences state ─────────────────────────────────────────────────────
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [householdSize, setHouseholdSize] = useState<string | undefined>(undefined);
  const [diet, setDiet] = useState<string | undefined>(undefined);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [weeklyBudget, setWeeklyBudget] = useState<string>('');
  const [customAllergy, setCustomAllergy] = useState('');

  // ─── Load profile + stats on focus ─────────────────────────────────────────
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

      // Load preferences
      setPrefLoading(true);
      (async () => {
        try {
          const profile = await profileService.getProfile();
          if (!alive) return;
          if (profile) {
            setHouseholdSize(profile.household_size ?? undefined);
            setDiet(profile.diet ?? undefined);
            setAvoid(profile.avoid ?? []);
            setAllergies(profile.allergies ?? []);
            setWeeklyBudget(profile.weekly_budget != null ? String(profile.weekly_budget) : '');
          }
        } catch {
          /* keep previous values */
        } finally {
          if (alive) setPrefLoading(false);
        }
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────
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
    Alert.alert('Cheep Hakkında', `Cheep · Sürüm ${APP_VERSION}\nTürkiye marketlerinde en uygun fiyatı bul.`);
  };

  const toggleMulti = (arr: string[], setArr: (v: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const handleAddCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (!trimmed) return;
    if (!allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
    }
    setCustomAllergy('');
  };

  const handleSavePreferences = async () => {
    setPrefSaving(true);
    try {
      const budgetRaw = weeklyBudget.trim();
      const budgetNum = budgetRaw && !isNaN(Number(budgetRaw)) ? Number(budgetRaw) : null;
      const patch: Partial<UserProfile> = {
        onboarding_done: true, // never flip back
        household_size: householdSize ?? null,
        diet: diet ?? null,
        avoid: avoid,
        allergies: allergies,
        weekly_budget: budgetNum,
      };
      await profileService.updateProfile(patch);
      Alert.alert('Kaydedildi', 'Tercihleriniz güncellendi.');
    } catch {
      Alert.alert('Hata', 'Tercihler kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setPrefSaving(false);
    }
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

        {/* ──────────── Tercihlerim ──────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tercihlerim</Text>

          {prefLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary.main} />
            </View>
          ) : (
            <Card padding="none" variant="elevated">
              {/* Hane büyüklüğü */}
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Hane büyüklüğü</Text>
                <View style={styles.chipRow}>
                  {HOUSEHOLD_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={opt.label}
                      selected={householdSize === opt.value}
                      onPress={() =>
                        setHouseholdSize(householdSize === opt.value ? undefined : opt.value)
                      }
                    />
                  ))}
                </View>
              </View>

              <Divider />

              {/* Beslenme tarzı */}
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Beslenme tarzı</Text>
                <View style={styles.chipRow}>
                  {DIET_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={opt.label}
                      selected={diet === opt.value}
                      onPress={() =>
                        setDiet(diet === opt.value ? undefined : opt.value)
                      }
                    />
                  ))}
                </View>
              </View>

              <Divider />

              {/* Kaçınılanlar */}
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Kaçınılanlar</Text>
                <View style={styles.chipRow}>
                  {AVOID_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={opt.label}
                      selected={avoid.includes(opt.value)}
                      onPress={() => toggleMulti(avoid, setAvoid, opt.value)}
                    />
                  ))}
                </View>
              </View>

              <Divider />

              {/* Alerji/intolerans */}
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Alerji / İntolerans</Text>
                <View style={styles.chipRow}>
                  {ALLERGY_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={opt.label}
                      selected={allergies.includes(opt.value)}
                      onPress={() => toggleMulti(allergies, setAllergies, opt.value)}
                    />
                  ))}
                  {/* Custom allergies added by user */}
                  {allergies
                    .filter(
                      (a) => !ALLERGY_OPTIONS.some((opt) => opt.value === a)
                    )
                    .map((a) => (
                      <ChipButton
                        key={a}
                        label={a}
                        selected
                        onPress={() =>
                          setAllergies(allergies.filter((x) => x !== a))
                        }
                      />
                    ))}
                </View>
                {/* Custom allergy input */}
                <View style={styles.customInputRow}>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Başka alerji ekle…"
                    placeholderTextColor={colors.text.hint}
                    value={customAllergy}
                    onChangeText={setCustomAllergy}
                    onSubmitEditing={handleAddCustomAllergy}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddCustomAllergy}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="add" size={18} color={colors.background.paper} />
                  </TouchableOpacity>
                </View>
              </View>

              <Divider />

              {/* Haftalık bütçe */}
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Haftalık bütçe (₺)</Text>
                <TextInput
                  style={styles.budgetInput}
                  placeholder="Örn: 1500"
                  placeholderTextColor={colors.text.hint}
                  value={weeklyBudget}
                  onChangeText={setWeeklyBudget}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>

              {/* Save button */}
              <View style={styles.saveBtnWrap}>
                <Button
                  title={prefSaving ? 'Kaydediliyor…' : 'Kaydet'}
                  onPress={handleSavePreferences}
                  fullWidth
                />
              </View>
            </Card>
          )}
        </View>

        {/* Account Section — "Profili Düzenle" / "Favori Marketler" için henüz
            gerçek bir ekran yok (ProfileNavigator'da kayıtlı değil). Kırık
            görünmemeleri için bu menü öğeleri gizlendi; profil düzenleme zaten
            yukarıdaki "Tercihlerim" bölümünden yapılabiliyor. */}

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
              subtitle={`Sürüm ${APP_VERSION}`}
              onPress={handleAbout}
            />
            <Divider />
            <MenuItem
              icon="help-outline"
              title="Nasıl kullanılır"
              subtitle="Tanıtım turunu yeniden izle"
              onPress={() =>
                // Intro, root stack'te (replay modu); navigate üst navigatöre yükselir
                (navigation as any).navigate('Intro', { replay: true })
              }
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

// ─── Sub-components ──────────────────────────────────────────────────────────

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

// Chip selector button (single and multi)
function ChipButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
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

  // ─── Preferences ───────────────────────────────────────────────────────────

  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  prefRow: {
    padding: spacing.md,
  },

  prefLabel: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.main,
    backgroundColor: colors.background.default,
  },

  chipSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },

  chipText: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  chipTextSelected: {
    color: colors.background.paper,
    fontWeight: '700',
  },

  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },

  customInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    ...typography.styles.body2,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
  },

  addButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },

  budgetInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    ...typography.styles.body1,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
  },

  saveBtnWrap: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },

  // ─── Menu ──────────────────────────────────────────────────────────────────

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
