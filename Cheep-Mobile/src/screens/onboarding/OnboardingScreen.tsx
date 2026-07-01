/**
 * 🐦 Onboarding Screen
 * Animated, mascot-led 5-question wizard (config-driven).
 * Transitions: fade + slide-in via React Native Animated (no extra deps).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLocale, COUNTRY_CONFIG } from '../../context/LocaleContext';
import { profileService } from '../../services';
import { CheepMascot } from '../../components/brand/CheepMascot';
import { Float } from '../../components/anim';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';
import { ONBOARDING_QUESTIONS } from './onboardingConfig';
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';
import { languageStorage } from '../../utils/storage';
import { getCountryCode } from '../../utils/geo';
import type { UserProfile } from '../../types';

// Prepended locale steps (language + country) that precede ONBOARDING_QUESTIONS.
const LOCALE_STEPS = 2;

// ─── Answer types ────────────────────────────────────────────────────────────
type Answers = {
  household_size?: string;
  diet?: string;
  avoid?: string[];
  allergies?: string[];
  weekly_budget?: string;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Single-select chips row */
function SingleOptions({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selected: string | undefined;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={optStyles.row}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[optStyles.chip, active && optStyles.chipActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.75}
          >
            <Text style={[optStyles.chipLabel, active && optStyles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Multi-select chips + optional custom entry */
function MultiOptions({
  options,
  selected,
  onToggle,
  allowCustom,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  allowCustom?: boolean;
}) {
  const [customText, setCustomText] = useState('');

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onToggle(trimmed);
    }
    setCustomText('');
  };

  return (
    <View>
      <View style={optStyles.row}>
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <TouchableOpacity
              key={opt.value}
              style={[optStyles.chip, active && optStyles.chipActive]}
              onPress={() => onToggle(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[optStyles.chipLabel, active && optStyles.chipLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Custom entries not in base options */}
        {selected
          .filter((v) => !options.some((o) => o.value === v))
          .map((v) => (
            <TouchableOpacity
              key={v}
              style={[optStyles.chip, optStyles.chipActive]}
              onPress={() => onToggle(v)}
              activeOpacity={0.75}
            >
              <Text style={[optStyles.chipLabel, optStyles.chipLabelActive]}>
                {v} ✕
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      {allowCustom && (
        <View style={optStyles.customRow}>
          <TextInput
            style={optStyles.customInput}
            value={customText}
            onChangeText={setCustomText}
            placeholder="Sen yaz…"
            placeholderTextColor={colors.text.hint}
            onSubmitEditing={handleAddCustom}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={optStyles.customAddBtn}
            onPress={handleAddCustom}
            activeOpacity={0.8}
          >
            <Text style={optStyles.customAddLabel}>Ekle</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Budget numeric input */
function BudgetInput({
  value,
  onChange,
  symbol,
  unitLabel,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  symbol: string;
  unitLabel: string;
}) {
  return (
    <View style={optStyles.budgetContainer}>
      <View style={optStyles.budgetInputWrap}>
        <Text style={optStyles.currencySymbol}>{symbol}</Text>
        <TextInput
          style={optStyles.budgetInput}
          value={value ?? ''}
          onChangeText={onChange}
          placeholder="0"
          placeholderTextColor={colors.text.hint}
          keyboardType="numeric"
          returnKeyType="done"
        />
        <Text style={optStyles.budgetUnit}>{unitLabel}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const { refreshOnboarding } = useAuth();
  const { t } = useTranslation();
  const { country, setCountry } = useLocale();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [finishing, setFinishing] = useState(false);
  // UI dili seçimi — varsayılan mevcut i18n dili.
  const [language, setLanguage] = useState<string>(i18n.language);

  // Two prepended locale steps, then the existing config-driven questions.
  const total = LOCALE_STEPS + ONBOARDING_QUESTIONS.length;
  const isLangStep = step === 0;
  const isCountryStep = step === 1;
  const questionIndex = step - LOCALE_STEPS;
  const question =
    questionIndex >= 0 ? ONBOARDING_QUESTIONS[questionIndex] : undefined;

  const currencySymbol = COUNTRY_CONFIG[country]?.symbol ?? '₺';

  // Ülke varsayılanını konumdan tespit et (yalnızca ilk girişte, desteklenen ise).
  // getCountryCode desteklenmeyen/izin-yok durumunda null döner → mevcut değer kalır.
  useEffect(() => {
    getCountryCode()
      .then((code) => {
        if (code) return setCountry(code);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Locale selection handlers ─────────────────────────────────────────────
  const handleSelectLanguage = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang); // onboarding'in geri kalanı seçilen dilde render olsun
    languageStorage.save(lang);
  };

  const handleSelectCountry = (code: string) => {
    setCountry(code); // LocaleContext doğrular + saklar (para birimi/format buradan)
  };

  // Animated values for step transition
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateToNextStep = useCallback((callback: () => void) => {
    // Fade out + slide out to left
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      // Reset to right side, then slide in
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  // ── Answer helpers ────────────────────────────────────────────────────────

  const handleSingleSelect = (value: string) => {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.key]: value }));
  };

  const handleMultiToggle = (value: string) => {
    if (!question) return;
    setAnswers((prev) => {
      const current: string[] = (prev[question.key as 'avoid' | 'allergies'] ?? []) as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [question.key]: next };
    });
  };

  const handleBudgetChange = (value: string) => {
    setAnswers((prev) => ({ ...prev, weekly_budget: value }));
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const advance = () => {
    if (step < total - 1) {
      animateToNextStep(() => setStep((s) => s + 1));
    } else {
      finish();
    }
  };

  const skip = () => {
    // Clear the current question's answer and advance (locale steps have no answer)
    if (question) {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[question.key];
        return next;
      });
    }
    if (step < total - 1) {
      animateToNextStep(() => setStep((s) => s + 1));
    } else {
      finish();
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      // Build payload from DEFINED answers only — tanımsız household_size/diet
      // gönderip mevcut profil değerlerini (örn. tekrar onboarding'de) ezmeyiz.
      const payload: Partial<UserProfile> = {
        onboarding_done: true,
        // Dil + ülke tercihini profile de yaz (backend x-country'yi de kullanır).
        language,
        country_code: country,
      };
      if (answers.household_size !== undefined) {
        payload.household_size = answers.household_size;
      }
      if (answers.diet !== undefined) {
        payload.diet = answers.diet;
      }
      if (answers.avoid !== undefined) {
        payload.avoid = answers.avoid;
      }
      if (answers.allergies !== undefined) {
        payload.allergies = answers.allergies;
      }
      // Convert budget string to number if present and non-empty
      if (answers.weekly_budget && answers.weekly_budget !== '') {
        const budgetNum = Number(answers.weekly_budget);
        if (!isNaN(budgetNum)) {
          payload.weekly_budget = budgetNum;
        }
      }

      await profileService.updateProfile(payload);
      await refreshOnboarding(); // flips RootNavigator gate to Main
    } catch (error: any) {
      Alert.alert(
        'Hata',
        error?.message ?? 'Profil kaydedilirken bir hata oluştu. Tekrar deneyin.'
      );
      setFinishing(false);
    }
  };

  // ── Current answer value ──────────────────────────────────────────────────

  const currentSingle = question
    ? (answers[question.key as 'household_size' | 'diet'] as string | undefined)
    : undefined;
  const currentMulti = (question
    ? answers[question.key as 'avoid' | 'allergies'] ?? []
    : []) as string[];
  const currentBudget = answers.weekly_budget;

  // ── Can proceed without selection? ───────────────────────────────────────

  const canProceed = !question
    ? true // locale steps always have a valid default selected
    : question.optional
    ? true
    : question.type === 'single'
    ? !!currentSingle
    : question.type === 'multi'
    ? true // multi is always skippable via "Şimdilik geç"; "Devam" allowed with 0 selections
    : true; // budget always optional

  const isLast = step === total - 1;

  // ── Progress bar width ────────────────────────────────────────────────────

  const progressPct = ((step + 1) / total) * 100;

  // ── Locale-step options + localized header text ──────────────────────────
  const langOptions = SUPPORTED_LANGUAGES.map((code) => ({
    value: code,
    label: t(`languages.${code}`),
  }));
  const countryOptions = Object.keys(COUNTRY_CONFIG).map((code) => ({
    value: code,
    label: t(`countries.${code}`),
  }));

  const headerMascot = isLangStep
    ? t('onboarding.language_subtitle')
    : isCountryStep
    ? t('onboarding.country_subtitle')
    : question?.mascot ?? '';
  const headerTitle = isLangStep
    ? t('onboarding.language_title')
    : isCountryStep
    ? t('onboarding.country_title')
    : question?.title ?? '';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>

        {/* Step counter */}
        <Text style={styles.stepCounter}>
          {step + 1} / {total}
        </Text>

        {/* Mascot */}
        <View style={styles.mascotContainer}>
          <Float>
            <CheepMascot size={88} expression="happy" />
          </Float>
          <Text style={styles.mascotText}>{headerMascot}</Text>
        </View>

        {/* Animated question content */}
        <Animated.View
          style={[
            styles.questionContainer,
            { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
          ]}
        >
          <Text style={styles.questionTitle}>{headerTitle}</Text>

          {/* ── language (step 0) ───────────────────────────────── */}
          {isLangStep && (
            <SingleOptions
              options={langOptions}
              selected={language}
              onSelect={handleSelectLanguage}
            />
          )}

          {/* ── country (step 1) ────────────────────────────────── */}
          {isCountryStep && (
            <SingleOptions
              options={countryOptions}
              selected={country}
              onSelect={handleSelectCountry}
            />
          )}

          {/* ── single ──────────────────────────────────────────── */}
          {question?.type === 'single' && question.options && (
            <SingleOptions
              options={question.options}
              selected={currentSingle}
              onSelect={handleSingleSelect}
            />
          )}

          {/* ── multi ───────────────────────────────────────────── */}
          {question?.type === 'multi' && question.options && (
            <MultiOptions
              options={question.options}
              selected={currentMulti}
              onToggle={handleMultiToggle}
              allowCustom={question.allowCustom}
            />
          )}

          {/* ── budget ──────────────────────────────────────────── */}
          {question?.type === 'budget' && (
            <BudgetInput
              value={currentBudget}
              onChange={handleBudgetChange}
              symbol={currencySymbol}
              unitLabel={t('onboarding.per_week')}
            />
          )}
        </Animated.View>

        {/* Spacer to push buttons to bottom */}
        <View style={styles.spacer} />

        {/* Bottom actions */}
        <View style={styles.actions}>
          {/* Skip always available */}
          <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.7}>
            <Text style={styles.skipLabel}>Şimdilik geç</Text>
          </TouchableOpacity>

          {/* Continue / Finish */}
          <TouchableOpacity
            style={[
              styles.continueBtn,
              !canProceed && styles.continueBtnDisabled,
            ]}
            onPress={advance}
            disabled={!canProceed || finishing}
            activeOpacity={0.85}
          >
            {finishing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.continueLabel}>{isLast ? 'Bitir' : 'Devam'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },

  // Progress
  progressTrack: {
    height: 6,
    backgroundColor: colors.border.main,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
  },

  stepCounter: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    textAlign: 'right',
    marginBottom: spacing.lg,
  },

  // Mascot
  mascotContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  mascotCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  mascotEmoji: {
    fontSize: 44,
  },
  mascotText: {
    ...typography.styles.subtitle1,
    color: colors.primary.main,
    textAlign: 'center',
  },

  // Question
  questionContainer: {
    flex: 0,
  },
  questionTitle: {
    ...typography.styles.h3,
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },

  // Actions
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  skipBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipLabel: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },
  continueBtn: {
    height: layout.buttonHeight,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: colors.border.dark,
  },
  continueLabel: {
    ...typography.styles.button,
    color: '#fff',
  },
});

// ─── Option / chip styles (shared by sub-components) ─────────────────────────

const optStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border.dark,
    backgroundColor: colors.background.paper,
    minWidth: 72,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary[50],
  },
  chipLabel: {
    ...typography.styles.body2,
    color: colors.text.primary,
  },
  chipLabelActive: {
    color: colors.primary.dark,
    fontWeight: '600',
  },

  // Custom entry (allergies)
  customRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  customInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    ...typography.styles.body2,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  customAddBtn: {
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAddLabel: {
    ...typography.styles.subtitle2,
    color: '#fff',
  },

  // Budget
  budgetContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  budgetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.dark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  currencySymbol: {
    ...typography.styles.h3,
    color: colors.primary.main,
  },
  budgetInput: {
    ...typography.styles.h2,
    color: colors.text.primary,
    minWidth: 100,
    textAlign: 'center',
  },
  budgetUnit: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },
});
