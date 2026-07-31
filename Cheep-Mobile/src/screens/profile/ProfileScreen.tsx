/**
 * 👤 Profile Screen
 * User profile, quick stats and settings (premium fintech layout).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLocale, COUNTRY_CONFIG } from '../../context/LocaleContext';
import { useLocationAnchor } from '../../context/LocationContext';
import { Card, Button } from '../../components/ui';
import { LocationSheet } from '../../components/location/LocationSheet';
import { listService, profileService, userService } from '../../services';
import { colors, typography, spacing, layout, shadows, borderRadius } from '../../theme';
import type { ProfileStackScreenProps } from '../../navigation/types';
import type { UserProfile } from '../../types';
import { ONBOARDING_QUESTIONS } from '../onboarding/onboardingConfig';
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';
import { languageStorage, type LocationConsent } from '../../utils/storage';
import {
  getNotificationStatus,
  ensureNotificationsReady,
  unregisterPushToken,
} from '../../utils/notificationGate';
import { getLocationConsent, promptLocationConsent, revokeLocationConsent } from '../../utils/consent';

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
  const { t } = useTranslation();
  const { country } = useLocale();
  const { anchor, refresh: refreshAnchor } = useLocationAnchor();
  const currencySymbol = COUNTRY_CONFIG[country]?.symbol ?? COUNTRY_CONFIG.TR.symbol;
  const [stats, setStats] = useState({ active: 0, lists: 0, items: 0 });

  // ─── Language picker / konum sayfası state ─────────────────────────────────
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // ─── Preferences state ─────────────────────────────────────────────────────
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [householdSize, setHouseholdSize] = useState<string | undefined>(undefined);
  const [diet, setDiet] = useState<string | undefined>(undefined);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [weeklyBudget, setWeeklyBudget] = useState<string>('');
  const [customAllergy, setCustomAllergy] = useState('');

  // ─── KVKK konum açık-rıza durumu ───────────────────────────────────────────
  const [locConsent, setLocConsent] = useState<LocationConsent>(null);
  // OS konum izni AYRI bir durumdur: kullanıcı rızayı verip sonra sistem
  // ayarlarından izni kaldırabilir (ya da Android izni kendisi geri alabilir).
  // Bunu göstermezsek profil "Açık" derken konum özellikleri sessizce çalışmaz.
  const [osLocationGranted, setOsLocationGranted] = useState<boolean | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  // ─── Load profile + stats on focus ─────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        try {
          const all = await listService.getLists();
          if (!alive) return;
          setStats({
            active: all.filter((l) => l.status === 'active').length,
            lists: all.length,
            items: all.reduce((sum, l) => sum + (l.list_items?.length ?? 0), 0),
          });
        } catch {
          /* keep zeros */
        }
      })();

      // KVKK rızası + OS izni — ikisi de okunur (ekranda ayrı ayrı yansıtılır).
      (async () => {
        const c = await getLocationConsent();
        if (alive) setLocConsent(c);
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          if (alive) setOsLocationGranted(perm.status === 'granted');
        } catch {
          if (alive) setOsLocationGranted(null);
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
  // KVKK: konum açık-rızasını aç/geri al (ilgili kişi hakkı — ayarlardan yönetim).

  // Bildirim durumunu SORMADAN oku (ekran açıldığında).
  useEffect(() => {
    void getNotificationStatus().then((st) => setNotifGranted(st.osGranted));
  }, []);

  /**
   * Bildirim anahtarı. Açma yolu izin kapısını çalıştırır (gerekçe → sistem modalı).
   * KAPATMA yolu sistem iznini geri ALAMAZ — OS buna izin vermiyor — ama sunucudaki
   * push token'ı siler, yani bildirim gelmez. Kullanıcıyı yanıltmamak için bunu
   * metinde söylüyoruz ve tam kapatma için ayarlara yönlendiriyoruz.
   */
  const handleToggleNotifications = useCallback(async () => {
    const st = await getNotificationStatus();
    if (st.osGranted) {
      await unregisterPushToken();
      setNotifGranted(false);
      Alert.alert(t('notifications.off_title'), t('notifications.off_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.open_settings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await ensureNotificationsReady();
    const after = await getNotificationStatus();
    setNotifGranted(after.osGranted);
  }, [t]);

  const handleToggleLocationConsent = useCallback(async () => {
    const current = await getLocationConsent();
    if (current === 'granted') {
      await revokeLocationConsent(); // rıza + saklanan koordinat silinir
      setLocConsent('denied');
      // KVKK/GDPR: rıza geri alındığı ANDA yayınlanan çapa da koordinatsız olmalı.
      // refresh() olmasaydı bellekteki anchor eski koordinatı + eşleşen ülkeyi
      // taşımaya devam eder, shouldFilterByDistance() hâlâ true döner ve bir
      // sonraki karşılaştırma isteği userLocation'ı YİNE gönderirdi — üstelik bu
      // ekran "konum işlenmiyor" yazarken. (Depo zaten temiz; refresh() onu okuyup
      // gerçeği yayınlar. Aksi halde durum ancak soğuk açılışta/ön plana gelişte
      // kendini toparlıyordu.)
      //
      // SESSİZ olmak ZORUNDA: düz refresh() otomatik modda ETKİLEŞİMLİ izin kapısını
      // (runLocationGate) çalıştırır ve kapı, rıza 'granted' olmadığı için KVKK
      // açık-rıza istemini AÇAR — yani kullanıcı konumu kapatır kapatmaz "tekrar
      // açalım mı?" diye sorulur. Kabul ederse rıza geri açılır, aynı geçiş GPS'i
      // okur ve çapa yeniden koordinat kazanır; ekran ise hâlâ "konum işlenmiyor"
      // der. Reddetse bile bu bir rıza karanlık-deseni olur (KVKK m.7 / GDPR
      // Art. 7(3): geri alma, verme kadar kolay olmalı). silent:true kapıyı —
      // ve YALNIZCA kapıyı — atlar; çapa yine depodan okunup koordinatsız yayınlanır
      // (getUserLocation() 'denied' rızada sormadan null döner).
      await refreshAnchor({ silent: true });
      return;
    }

    // AÇMA yolu: kullanıcının açık talebi → istem 'denied' olsa bile gösterilir.
    // (ensureLocationConsent burada kullanılamaz: 'denied' ise sormadan false döner
    //  ve rıza bir daha asla açılamazdı.)
    const ok = await promptLocationConsent();
    setLocConsent(ok ? 'granted' : 'denied');
    if (!ok) return;

    // Rıza tek başına yetmez — OS izni de gerekir. Kalıcı reddedilmişse
    // (canAskAgain=false) sistem istemi bir daha çıkmaz; kullanıcıyı Ayarlar'a al.
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      setOsLocationGranted(perm.status === 'granted');
      if (perm.status !== 'granted' && !perm.canAskAgain) {
        Alert.alert(t('profile.location_os_blocked_title'), t('profile.location_os_blocked_body'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.open_settings'), onPress: () => Linking.openSettings() },
        ]);
      }
    } catch {
      setOsLocationGranted(null);
    }

    // Rıza (ve varsa OS izni) yeniden verildi → çapayı HEMEN tazele: konum artık
    // işlenebilir, kullanıcı bir sonraki soğuk açılışı beklemesin. Ülke yazımı
    // yine tek sahibinden (LocationProvider) geçer — burada setCountry çağrılmaz.
    //
    // Burada da SESSİZ: rıza istemini ve OS izin modalını bu ekran YUKARIDA zaten
    // kendisi gösterdi. Düz refresh() izin kapısını çalıştırır, kapı da (OS izni
    // verilmediyse) önce kendi gerekçe diyaloğunu, ardından İKİNCİ bir sistem izin
    // modalını açardı — kullanıcının az önce cevapladığı istemlerin üstüne üstüne.
    // silent:true kapıyı atlar; rıza + OS izni gerçekten verildiyse getUserLocation()
    // GPS'i normal şekilde okur ve koordinatlı çapa yayınlanır.
    await refreshAnchor({ silent: true });
  }, [t, refreshAnchor]);

  const handleLogout = () => {
    Alert.alert(t('profile.logout_title'), t('profile.logout_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout_action'),
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleAbout = () => {
    Alert.alert(t('profile.about_title'), t('profile.about_body', { version: APP_VERSION }));
  };

  // ─── Language / Country handlers ───────────────────────────────────────────
  const handleSelectLanguage = async (lang: string) => {
    setLangPickerOpen(false);
    i18n.changeLanguage(lang); // useTranslation() abonesi ekranları anında yeniden render eder
    await languageStorage.save(lang);
    try {
      await userService.updatePreferences({ language: lang });
    } catch (error) {
      console.error('Dil tercihi /users/me üzerinden kaydedilemedi:', error);
    }
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
      Alert.alert(t('profile.prefs_saved_title'), t('profile.prefs_saved_body'));
    } catch {
      Alert.alert(t('common.error'), t('profile.prefs_save_error'));
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
          <StatTile icon="playlist-add-check" value={stats.active} label={t('profile.stat_active')} />
          <StatTile icon="format-list-bulleted" value={stats.lists} label={t('profile.stat_lists')} />
          <StatTile icon="shopping-basket" value={stats.items} label={t('profile.stat_items')} />
        </View>

        {/* ──────────── Tercihlerim ──────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.preferences_title')}</Text>

          {prefLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary.main} />
            </View>
          ) : (
            <Card padding="none" variant="elevated">
              {/* Hane büyüklüğü */}
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('profile.pref_household_size')}</Text>
                <View style={styles.chipRow}>
                  {HOUSEHOLD_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={t(opt.label)}
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
                <Text style={styles.prefLabel}>{t('profile.pref_diet')}</Text>
                <View style={styles.chipRow}>
                  {DIET_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={t(opt.label)}
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
                <Text style={styles.prefLabel}>{t('profile.pref_avoid')}</Text>
                <View style={styles.chipRow}>
                  {AVOID_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={t(opt.label)}
                      selected={avoid.includes(opt.value)}
                      onPress={() => toggleMulti(avoid, setAvoid, opt.value)}
                    />
                  ))}
                </View>
              </View>

              <Divider />

              {/* Alerji/intolerans */}
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('profile.pref_allergies')}</Text>
                <View style={styles.chipRow}>
                  {ALLERGY_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      label={t(opt.label)}
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
                    placeholder={t('profile.add_allergy_placeholder')}
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
                <Text style={styles.prefLabel}>{t('profile.pref_weekly_budget', { symbol: currencySymbol })}</Text>
                <TextInput
                  style={styles.budgetInput}
                  placeholder={t('profile.weekly_budget_placeholder')}
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
                  title={prefSaving ? t('profile.saving') : t('common.save')}
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
          <Text style={styles.sectionTitle}>{t('profile.app_section_title')}</Text>
          <Card padding="none" variant="elevated">
            <MenuItem
              icon="translate"
              title={t('profile.language')}
              subtitle={t(`languages.${i18n.language}`)}
              onPress={() => setLangPickerOpen(true)}
            />
            <Divider />
            <MenuItem
              icon="public"
              title={t('profile.country')}
              subtitle={
                anchor?.mode === 'pinned' && anchor.label
                  ? t('location.chip_pinned', { label: anchor.label })
                  : t(`countries.${country}`)
              }
              onPress={() => setLocationSheetOpen(true)}
            />
            <Divider />
            <MenuItem
              icon="notifications-none"
              title={t('profile.notifications')}
              subtitle={
                notifGranted === null
                  ? t('profile.notifications_subtitle')
                  : notifGranted
                    ? t('profile.notifications_on')
                    : t('profile.notifications_off')
              }
              onPress={handleToggleNotifications}
            />
            <Divider />
            <MenuItem
              icon="info-outline"
              title={t('profile.about')}
              subtitle={t('profile.version_subtitle', { version: APP_VERSION })}
              onPress={handleAbout}
            />
            <Divider />
            <MenuItem
              icon="help-outline"
              title={t('profile.how_to_use')}
              subtitle={t('profile.replay_intro')}
              onPress={() =>
                // Intro, root stack'te (replay modu); navigate üst navigatöre yükselir
                (navigation as any).navigate('Intro', { replay: true })
              }
            />
            <Divider />
            <MenuItem
              icon="location-on"
              title={t('profile.location_consent')}
              subtitle={
                locConsent !== 'granted'
                  ? t('profile.location_consent_off')
                  : osLocationGranted === false
                    ? t('profile.location_consent_on_os_off')
                    : t('profile.location_consent_on')
              }
              onPress={handleToggleLocationConsent}
            />
            <Divider />
            <MenuItem
              icon="mail-outline"
              title={t('support.menu_title')}
              subtitle={t('support.menu_subtitle')}
              onPress={() => (navigation as any).navigate('Support')}
            />
          </Card>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <Button
            title={t('profile.logout_action')}
            onPress={handleLogout}
            variant="outline"
            fullWidth
          />
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Language picker */}
      <OptionPickerModal
        visible={langPickerOpen}
        title={t('profile.language')}
        options={SUPPORTED_LANGUAGES.map((code) => ({ value: code, label: t(`languages.${code}`) }))}
        selectedValue={i18n.language}
        onSelect={handleSelectLanguage}
        onClose={() => setLangPickerOpen(false)}
      />

      {/* Konum sayfası — ülke satırı artık burayı açar; ülke değişimi tek sahibi
          LocationProvider'dır (setCountry + userService.updatePreferences orada). */}
      <LocationSheet visible={locationSheetOpen} onClose={() => setLocationSheetOpen(false)} />
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

// Option Picker Modal — dil / ülke seçimi için hafif, mevcut bottom-sheet
// desenini (SelectListModal ile aynı stil) kullanan basit liste modalı.
function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  // Alt sistem gezinme çubuğu için güvenli alan inset'i — dropdown içeriği
  // 3-tuşlu/gesture çubuğunun altında kalmasın.
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerModal, { paddingBottom: layout.screenPadding + insets.bottom }]}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.pickerClose}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.pickerRow}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerRowLabel}>{opt.label}</Text>
              {opt.value === selectedValue && (
                <MaterialIcons name="check" size={20} color={colors.primary.main} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
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

  // ─── Option picker modal ────────────────────────────────────────────────────

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  pickerModal: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    // paddingBottom inline verilir (layout.screenPadding + güvenli alan inset'i).
  },

  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  pickerTitle: {
    ...typography.styles.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },

  pickerClose: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pickerCloseText: {
    fontSize: 20,
    color: colors.text.secondary,
  },

  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  pickerRowLabel: {
    ...typography.styles.body1,
    color: colors.text.primary,
  },
});
