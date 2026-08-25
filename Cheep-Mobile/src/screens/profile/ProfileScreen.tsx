/**
 * 👤 Profile Screen
 *
 * TASARIM NOTU (2026-08 yeniden düzen):
 * Eskiden ekran üstten aşağı aynı ağırlıkta beyaz kartlardan oluşuyordu; ~180dp
 * boş beyaz bir başlık, üç beyaz istatistik kutusu, HEP AÇIK duran uzun bir
 * tercih formu ve en altta birbirinin aynısı iki iri çerçeveli buton
 * ("Çıkış Yap" / "Hesabımı Sil"). Sonuç: gözün tutunacağı nokta yok, yıkıcı
 * eylem rutin eylemle aynı ağırlıkta ve ekran bir ayarlar formuna dönüşmüş.
 *
 * Yeni sıra ve gerekçeleri:
 *  1. Koyu yeşil hero başlık — kimlik + istatistik tek bakışta, kutu gürültüsü
 *     yok, markanın rengi ekranın üstüne hâkim.
 *  2. Premium kartı — gövdeye inen İLK öğe; ekrandaki tek koyu yüzey olduğu
 *     için reklam gibi bağırmadan öne çıkar.
 *  3. Tercihlerim — kapalı, tek satır özetli; DOKUNUNCA YERİNDE açılır. Ayrı
 *     ekrana taşımadık: bu tercihler (diyet, alerji, bütçe) karşılaştırma
 *     sonuçlarını doğrudan değiştiriyor, gömülürlerse güncellenmezler.
 *  4. Uygulama menüsü — rutin ayarlar.
 *  5. Hesap eylemleri — kutusuz, tipografik; "Hesabımı Sil" daha küçük ve
 *     kırmızı. Yıkıcı eylem asla birincil buton ağırlığında olmamalı.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  StatusBar,
  Pressable,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useBottomSpacing, useTopSpacing } from '../../hooks/useScreenSpacing';
import { usePremium } from '../../context/PremiumContext';
import { PremiumBadge } from '../../components/premium/PremiumBadge';
import { PremiumCard } from '../../components/premium/PremiumCard';
import { useLocale, COUNTRY_CONFIG } from '../../context/LocaleContext';
import { useLocationAnchor } from '../../context/LocationContext';
import { Card, Button } from '../../components/ui';
import { LocationSheet } from '../../components/location/LocationSheet';
import { listService, profileService, userService } from '../../services';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
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
import { useQueryClient } from '@tanstack/react-query';
import { appAlert } from '../../utils/dialog';

// ─── Preference option lists from onboarding config ───────────────────────────
const HOUSEHOLD_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'household_size')!.options!;
const DIET_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'diet')!.options!;
const AVOID_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'avoid')!.options!;
const ALLERGY_OPTIONS = ONBOARDING_QUESTIONS.find((q) => q.key === 'allergies')!.options!;

// Uygulama sürümünü app config'ten oku (hardcode değil); yoksa makul varsayılan.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** Koyu başlık üzerindeki metin tonları. */
const ON_DARK = '#FFFFFF';
const ON_DARK_MUTED = 'rgba(255,255,255,0.68)';
const ON_DARK_RULE = 'rgba(255,255,255,0.18)';

export function ProfileScreen({
  navigation,
}: ProfileStackScreenProps<'ProfileMain'>) {
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const { isPremium } = usePremium();
  // Tab bar float: icerigin altina 72 + guvenli alan birakilmazsa son dugme
  // (hesap silme) cubugun arkasinda kalir ve asagi kaydirilamaz.
  const bottomSpacing = useBottomSpacing();
  // headerShown:false — ust guvenli alani ekran kendisi birakmali.
  const topSpacing = useTopSpacing();
  const { t } = useTranslation();
  const { country, formatMoney } = useLocale();
  const { anchor, refresh: refreshAnchor } = useLocationAnchor();
  const currencySymbol = COUNTRY_CONFIG[country]?.symbol ?? COUNTRY_CONFIG.TR.symbol;
  // İstatistikler yüklenene kadar 0/0/0 göstermek "hiç listen yok" gibi
  // okunuyordu ve veri gelince rakamlar zıplıyordu. null = henüz bilmiyoruz.
  const [stats, setStats] = useState<{ active: number; lists: number; items: number } | null>(null);
  /** Hero gradyanının ÖLÇÜLEN boyutu — bkz. header'daki onLayout gerekçesi. */
  const [heroSize, setHeroSize] = useState({ width: 0, height: 0 });

  // ─── Language picker / konum sayfası state ─────────────────────────────────
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // ─── Preferences state ─────────────────────────────────────────────────────
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [householdSize, setHouseholdSize] = useState<string | undefined>(undefined);
  const [diet, setDiet] = useState<string | undefined>(undefined);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [weeklyBudget, setWeeklyBudget] = useState<string>('');
  const [customAllergy, setCustomAllergy] = useState('');
  /**
   * Sunucudan gelen hâlin imzası. "Kaydet" düğmesi ancak bundan saparsak
   * görünür — eskiden hep ekranda durup asıl eylemlerle (premium, çıkış)
   * dikkat için yarışıyordu.
   */
  const [pristine, setPristine] = useState<string | null>(null);

  const formKey = useMemo(
    () =>
      JSON.stringify({
        householdSize: householdSize ?? null,
        diet: diet ?? null,
        avoid: [...avoid].sort(),
        allergies: [...allergies].sort(),
        weeklyBudget: weeklyBudget.trim(),
      }),
    [householdSize, diet, avoid, allergies, weeklyBudget]
  );
  const dirty = pristine !== null && formKey !== pristine;
  /**
   * `formKey`in GÜNCEL değerine bağımlılık eklemeden ulaşmak için ref.
   * Odak efektinin bağımlılıklarına form alanlarını koymak, her tuş vuruşunda
   * profili yeniden çekmek demek olurdu.
   */
  const formKeyRef = React.useRef(formKey);
  formKeyRef.current = formKey;

  // ─── KVKK konum açık-rıza durumu ───────────────────────────────────────────
  const [locConsent, setLocConsent] = useState<LocationConsent>(null);
  // OS konum izni AYRI bir durumdur: kullanıcı rızayı verip sonra sistem
  // ayarlarından izni kaldırabilir (ya da Android izni kendisi geri alabilir).
  // Bunu göstermezsek profil "Açık" derken konum özellikleri sessizce çalışmaz.
  const [osLocationGranted, setOsLocationGranted] = useState<boolean | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  /**
   * Başlık koyu olduğu için durum çubuğu yazıları BEYAZ olmalı. App.tsx global
   * olarak 'dark-content' veriyor; sekme ekranları unmount olmadığından odak
   * girip çıkarken elle geri alıyoruz, yoksa diğer sekmeler beyaz yazıyla kalır.
   */
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle('dark-content');
    }, [])
  );

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
            const nextAvoid = profile.avoid ?? [];
            const nextAllergies = profile.allergies ?? [];
            const nextBudget = profile.weekly_budget != null ? String(profile.weekly_budget) : '';
            setHouseholdSize(profile.household_size ?? undefined);
            setDiet(profile.diet ?? undefined);
            setAvoid(nextAvoid);
            setAllergies(nextAllergies);
            setWeeklyBudget(nextBudget);
            setPristine(
              JSON.stringify({
                householdSize: profile.household_size ?? null,
                diet: profile.diet ?? null,
                avoid: [...nextAvoid].sort(),
                allergies: [...nextAllergies].sort(),
                weeklyBudget: nextBudget.trim(),
              })
            );
          }
        } catch (e) {
          // TABAN ÇİZGİSİNİ YİNE DE KUR.
          //
          // Eskiden burada hiçbir şey yapılmıyordu ve `pristine` `null`
          // kalıyordu. `dirty = pristine !== null && ...` olduğu için Kaydet
          // düğmesi BİR DAHA ASLA çizilmiyordu: kullanıcı diyetini değiştirip
          // fındık alerjisi ekliyor, ortada Kaydet düğmesi olmadığı için
          // otomatik kaydedildiğini varsayıp ekrandan çıkıyordu. Hiçbir şey
          // kaydedilmiyor ve alerjen filtresi hiç uygulanmıyordu — sessiz
          // veri kaybı, üstelik güvenlikle ilgili bir alanda.
          //
          // Sunucudan profil gelmediyse EKRANDAKİ mevcut değerleri taban
          // çizgisi kabul ediyoruz: form yine düzenlenebilir ve kullanıcı bir
          // şey değiştirdiğinde Kaydet çıkar.
          console.warn('Profil alınamadı; yerel değerler taban alınıyor:', e);
          if (alive) setPristine((prev) => prev ?? formKeyRef.current);
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
      appAlert(t('notifications.off_title'), t('notifications.off_body'), [
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
        appAlert(t('profile.location_os_blocked_title'), t('profile.location_os_blocked_body'), [
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
    appAlert(t('profile.logout_title'), t('profile.logout_confirm'), [
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

  /**
   * Hesap silme — Apple App Store Guideline 5.1.1(v) uygulama ICINDEN silme
   * sunulmasini sart kosar. Yikici ve geri alinamaz oldugu icin CIFT onay:
   * once ne silinecegini anlatan uyari, sonra ayri bir son onay.
   */
  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    // Abonelik mağazaya bağlıdır, uygulama hesabına degil: hesabı silmek
    // aboneligi IPTAL ETMEZ. Apple ve Play bu ayrimin kullaniciya soylenmesini
    // bekliyor — soylenmezse kullanici odemeye devam eder ve haklı olarak iade ister.
    const body = isPremium
      ? `${t('profile.delete_account_body')}

${t('profile.delete_account_subscription_note')}`
      : t('profile.delete_account_body');
    appAlert(t('profile.delete_account_title'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.delete_account_continue'),
        style: 'destructive',
        onPress: () => {
          appAlert(
            t('profile.delete_account_confirm_title'),
            t('profile.delete_account_confirm_body'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('profile.delete_account_final'),
                style: 'destructive',
                onPress: async () => {
                  setDeletingAccount(true);
                  try {
                    // Push kaydini ONCE dusur: silme sonrasi token gecersiz olur.
                    try {
                      await unregisterPushToken();
                    } catch {
                      // en iyi caba - basarisiz olursa silmeyi engellemesin
                    }
                    await userService.deleteAccount();
                    await logout();
                  } catch {
                    appAlert(t('common.error'), t('profile.delete_account_error'));
                  } finally {
                    setDeletingAccount(false);
                  }
                },
              },
            ]
          );
        },
      },
    ]);
  };

  const handleAbout = () => {
    appAlert(t('profile.about_title'), t('profile.about_body', { version: APP_VERSION }));
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
      // Diyet/alerjen tercihleri ÜRÜN yanıtlarını değiştiriyor: backend her
      // ürüne profile göre `constraint` (gizli/uyarı) ekliyor. Ürün cache'i
      // geçersizleşmezse kullanıcı tercihini kaydediyor ama listelerde eski
      // uyarıları görmeye devam ediyordu.
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
      setPristine(formKey); // artık temiz: "Kaydet" tekrar gizlenir
      appAlert(t('profile.prefs_saved_title'), t('profile.prefs_saved_body'));
    } catch {
      appAlert(t('common.error'), t('profile.prefs_save_error'));
    } finally {
      setPrefSaving(false);
    }
  };

  /**
   * Kapalı tercih kartındaki tek satır özet. Kullanıcı kartı açmadan neyin
   * kayıtlı olduğunu görebilsin diye; hiçbir şey seçilmemişse yönlendirici bir
   * ipucu döner.
   */
  const prefSummary = useMemo(() => {
    const parts: string[] = [];
    const household = HOUSEHOLD_OPTIONS.find((o) => o.value === householdSize);
    if (household) parts.push(t(household.label));
    const dietOpt = DIET_OPTIONS.find((o) => o.value === diet);
    if (dietOpt) parts.push(t(dietOpt.label));
    if (allergies.length) {
      // Katalogdaki seçenekler çevrilir; kullanıcının elle yazdığı olduğu gibi kalır.
      parts.push(
        allergies
          .map((a) => {
            const known = ALLERGY_OPTIONS.find((o) => o.value === a);
            return known ? t(known.label) : a;
          })
          .join(', ')
      );
    }
    // Para BİÇİMLENDİRİLEREK yazılır. Ham metin birleştirme "2500 ₺" üretiyordu;
    // uygulamanın geri kalanı aynı değeri "₺2.500,00" diye gösteriyor. Aynı
    // ekranda iki farklı para biçimi, özenle yapılmamış izlenimi veriyor —
    // üstelik binlik ayracı olmayan tutar hızlı okumada yanlış anlaşılıyor.
    const budgetNum = Number.parseFloat(weeklyBudget.trim().replace(',', '.'));
    if (Number.isFinite(budgetNum)) parts.push(formatMoney(budgetNum));
    return parts.length ? parts.join(' · ') : t('profile.prefs_empty_hint');
  }, [householdSize, diet, allergies, weeklyBudget, formatMoney, t]);

  return (
    <View style={styles.container}>
      {/* ─── Hero başlık ─────────────────────────────────────────────────── */}
      <View
        style={[styles.header, { paddingTop: topSpacing }]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setHeroSize((prev) =>
            prev.width === width && prev.height === height ? prev : { width, height },
          );
        }}
      >
        {/* Düz koyu yeşil yerine çok hafif dikey geçiş: yüzey "boyanmış" değil
            "aydınlatılmış" duruyor. react-native-svg zaten maskot için var.

            ÖLÇÜLEN PİKSEL BOYUTU KULLANILIYOR, "100%" DEĞİL. react-native-svg'de
            yüzde birimli width/height mutlak konumlu bir kapsayıcıya güvenilir
            çözülmüyor: Android'de SVG kapsayıcıdan KÜÇÜK çiziliyordu (ölçülen
            974×352'ye karşı 1080×~460) ve arkadaki `primary[900]` zemin sağ
            kenar boyunca ve altta L şeklinde bir DİKİŞ olarak açıkta kalıyordu.
            İstatistik satırı bu yüzden avatarın üstündeki yüzeyden görünür
            biçimde daha koyu bir zeminde duruyordu — ekrandaki en göze batan
            kusurdu. Boyut sıfırken hiç çizme; tek karelik yanlış boyutlu bir
            gradyan yanıp sönmesin. */}
        {heroSize.width > 0 && heroSize.height > 0 && (
          <Svg
            style={StyleSheet.absoluteFill}
            width={heroSize.width}
            height={heroSize.height}
          >
            <Defs>
              {/* Başlık bilerek premium kartından AÇIK: kart ekranın en koyu
                  yüzeyi kalsın, yoksa ikisi birbirine karışıyor. */}
              <LinearGradient id="profileHero" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary.main} />
                <Stop offset="1" stopColor={colors.primary.dark} />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={heroSize.width}
              height={heroSize.height}
              fill="url(#profileHero)"
            />
          </Svg>
        )}

        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          </View>
          {/* Rozet yalnızca aboneyse çizilir; değilse hiç yer kaplamaz. */}
          <PremiumBadge size="md" />
        </View>

        {/* İstatistikler başlığın içinde, kutusuz: üç beyaz kart yerine ince
            dikey çizgiyle ayrılmış üç sütun. */}
        <View style={styles.statsRow}>
          <HeroStat value={stats?.active} label={t('profile.stat_active')} />
          <View style={styles.statRule} />
          <HeroStat value={stats?.lists} label={t('profile.stat_lists')} />
          <View style={styles.statRule} />
          <HeroStat value={stats?.items} label={t('profile.stat_items')} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        showsVerticalScrollIndicator={false}
      >
        {/* Abonelik: gövdenin ilk öğesi — en değerli alan. */}
        <View style={styles.premiumWrap}>
          <PremiumCard onPress={() => (navigation as any).navigate('Paywall')} />
        </View>

        {/* ──────────── Tercihlerim (kapalı → yerinde açılır) ────────────
            Üstünde ayrı bir bölüm başlığı YOK: kartın kendi satırı zaten
            "Tercihlerim" diyor, ikisi birden tekrar okunuyordu. */}
        <View style={styles.section}>
          <Card padding="none" variant="elevated">
            <Pressable
              style={styles.prefHeader}
              onPress={() => setPrefsOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: prefsOpen }}
            >
              <View style={styles.prefHeaderIcon}>
                <MaterialIcons name="tune" size={20} color={colors.primary.main} />
              </View>
              <View style={styles.prefHeaderText}>
                <Text style={styles.prefHeaderTitle}>{t('profile.preferences_title')}</Text>
                <Text style={styles.prefHeaderSummary} numberOfLines={1}>
                  {prefLoading ? t('profile.saving') : prefSummary}
                </Text>
              </View>
              <MaterialIcons
                name={prefsOpen ? 'expand-less' : 'expand-more'}
                size={22}
                color={colors.text.hint}
              />
            </Pressable>

            {prefsOpen && (prefLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.primary.main} />
              </View>
            ) : (
              <>
                <Divider />

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
                        onPress={() => setDiet(diet === opt.value ? undefined : opt.value)}
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
                      .filter((a) => !ALLERGY_OPTIONS.some((opt) => opt.value === a))
                      .map((a) => (
                        <ChipButton
                          key={a}
                          label={a}
                          selected
                          onPress={() => setAllergies(allergies.filter((x) => x !== a))}
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
                      accessibilityRole="button"
                      accessibilityLabel={t('profile.add_allergy_placeholder')}
                    >
                      <MaterialIcons name="add" size={18} color={colors.background.paper} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Divider />

                {/* Haftalık bütçe */}
                <View style={styles.prefRow}>
                  <Text style={styles.prefLabel}>
                    {t('profile.pref_weekly_budget', { symbol: currencySymbol })}
                  </Text>
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

                {/* Kaydet — yalnızca gerçekten değişiklik varsa. */}
                {dirty && (
                  <View style={styles.saveBtnWrap}>
                    <Button
                      title={prefSaving ? t('profile.saving') : t('common.save')}
                      onPress={handleSavePreferences}
                      loading={prefSaving}
                      disabled={prefSaving}
                      fullWidth
                    />
                  </View>
                )}
              </>
            ))}
          </Card>
        </View>

        {/* App Section — "Profili Düzenle" / "Favori Marketler" için henüz
            gerçek bir ekran yok (ProfileNavigator'da kayıtlı değil). Kırık
            görünmemeleri için bu menü öğeleri gizlendi; profil düzenleme zaten
            yukarıdaki "Tercihlerim" bölümünden yapılabiliyor. */}
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

        {/* ─── Hesap eylemleri ───────────────────────────────────────────────
            Kutusuz ve tipografik. "Hesabımı Sil" bilerek daha küçük ve kırmızı:
            geri alınamaz bir eylem, çıkış yapmakla aynı ağırlıkta durmamalı. */}
        <View style={styles.accountActions}>
          <Pressable
            onPress={handleLogout}
            style={styles.textAction}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>{t('profile.logout_action')}</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            style={styles.textAction}
            accessibilityRole="button"
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color={colors.error.main} />
            ) : (
              <Text style={styles.deleteText}>{t('profile.delete_account_action')}</Text>
            )}
          </Pressable>

          <Text style={styles.versionLine}>
            {t('profile.version_subtitle', { version: APP_VERSION })}
          </Text>
        </View>
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

/** Koyu başlık içindeki kutusuz istatistik sütunu. */
function HeroStat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroStatValue, value === undefined && styles.heroStatLoading]}>
        {value === undefined ? '—' : value}
      </Text>
      <Text style={styles.heroStatLabel} numberOfLines={1}>{label}</Text>
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
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
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

  // ─── Hero başlık ───────────────────────────────────────────────────────────

  header: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
    // Gradient SVG absolute; taşmasın diye kırp.
    overflow: 'hidden',
    backgroundColor: colors.primary[900], // SVG yüklenene kadar zemin
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    ...typography.styles.h4,
    color: ON_DARK,
    fontWeight: '700',
  },

  identityText: { flex: 1, gap: 2 },

  name: {
    ...typography.styles.h4,
    fontSize: 19,
    color: ON_DARK,
    fontWeight: '700',
  },

  email: {
    ...typography.styles.body2,
    fontSize: 13,
    color: ON_DARK_MUTED,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },

  statRule: {
    width: 1,
    height: 28,
    backgroundColor: ON_DARK_RULE,
  },

  heroStat: { flex: 1, alignItems: 'center', gap: 2 },

  heroStatValue: {
    ...typography.styles.h3,
    fontSize: 21,
    lineHeight: 26,
    color: ON_DARK,
    fontWeight: '700',
  },

  heroStatLoading: { opacity: 0.45 },

  heroStatLabel: {
    ...typography.styles.caption,
    fontSize: 11,
    color: ON_DARK_MUTED,
  },

  content: {
    flex: 1,
  },

  premiumWrap: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg },

  section: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },

  sectionTitle: {
    ...typography.styles.overline,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  // ─── Tercihler ─────────────────────────────────────────────────────────────

  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  prefHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  prefHeaderText: { flex: 1 },

  prefHeaderTitle: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '600',
  },

  prefHeaderSummary: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },

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

  // ─── Hesap eylemleri ───────────────────────────────────────────────────────

  accountActions: {
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },

  textAction: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 44, // dokunma hedefi
    justifyContent: 'center',
  },

  logoutText: {
    ...typography.styles.subtitle2,
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '600',
  },

  deleteText: {
    ...typography.styles.caption,
    fontSize: 13,
    color: colors.error.main,
    fontWeight: '500',
  },

  versionLine: {
    ...typography.styles.caption,
    fontSize: 11,
    color: colors.text.hint,
    marginTop: spacing.sm,
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
