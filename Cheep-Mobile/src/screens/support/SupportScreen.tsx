/**
 * ✉️ Bize ulaşın — uygulama içi iletişim formu.
 *
 * Giriş ZORUNLU DEĞİL: sorun yaşayan kullanıcı çoğu zaman giriş yapamadığı için
 * yazıyor. Bu yüzden ekran hem profil menüsünden hem giriş/kayıt ekranlarından
 * açılabiliyor ve e-posta alanı elle doldurulabiliyor.
 *
 * Uygulama sürümü, platform ve dil otomatik ekleniyor (support.service) —
 * kullanıcıya "hangi sürümü kullanıyorsun" diye sormak zorunda kalmayalım.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supportService, type SupportTopic } from '../../services/support.service';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useToast } from '../../context/ToastContext';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';

const TOPICS: SupportTopic[] = ['bug', 'price', 'account', 'suggestion', 'other'];

/** Backend ile aynı alt sınır — "olmuyor" kimseye yardımcı olmuyor. */
const MIN_MESSAGE = 10;

export function SupportScreen({ navigation }: any) {
  // Sekme disi ekran: tab bar payi yok ama sistem cubugu payi gerekli.
  const bottomSpacing = useBottomSpacing();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { country } = useLocale();
  const toast = useToast();

  const [email, setEmail] = useState(user?.email ?? '');
  const [topic, setTopic] = useState<SupportTopic>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const messageOk = message.trim().length >= MIN_MESSAGE;
  const canSend = emailOk && messageOk && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await supportService.contact({
        email,
        message,
        topic,
        countryCode: country,
      });
      setSent(true);
    } catch {
      toast.show(t('support.error'));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <MaterialIcons name="check" size={36} color={colors.success.main} />
        </View>
        <Text style={styles.doneTitle}>{t('support.sent_title')}</Text>
        <Text style={styles.doneBody}>{t('support.sent_body')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryBtnText}>{t('common.close')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('support.intro')}</Text>

        <Text style={styles.label}>{t('support.topic')}</Text>
        <View style={styles.topics}>
          {TOPICS.map((tp) => (
            <TouchableOpacity
              key={tp}
              style={[styles.chip, topic === tp && styles.chipActive]}
              onPress={() => setTopic(tp)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, topic === tp && styles.chipTextActive]}>
                {t(`support.topics.${tp}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('support.email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('support.email_placeholder')}
          placeholderTextColor={colors.text.hint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Text style={styles.hint}>{t('support.email_hint')}</Text>

        <Text style={styles.label}>{t('support.message')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={message}
          onChangeText={setMessage}
          placeholder={t('support.message_placeholder')}
          placeholderTextColor={colors.text.hint}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={2000}
        />
        <Text style={styles.counter}>{message.trim().length}/2000</Text>

        <TouchableOpacity
          style={[styles.primaryBtn, !canSend && styles.primaryBtnDisabled]}
          onPress={submit}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('support.send')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background.default },
  content: { padding: spacing.md, paddingBottom: spacing['2xl'] },

  intro: { ...typography.styles.body2, color: colors.text.secondary, marginBottom: spacing.lg },
  label: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  hint: { ...typography.styles.caption, color: colors.text.hint, marginTop: spacing.xs },
  counter: { ...typography.styles.caption, color: colors.text.hint, alignSelf: 'flex-end', marginTop: spacing.xs },

  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.paper,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  chipActive: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  chipText: { ...typography.styles.caption, color: colors.text.secondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  input: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.styles.body2,
    color: colors.text.primary,
  },
  textarea: { minHeight: 140, paddingTop: spacing.sm },

  primaryBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { ...typography.styles.button, color: '#fff' },

  doneWrap: {
    flex: 1,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  doneTitle: { ...typography.styles.h2, color: colors.text.primary, textAlign: 'center' },
  doneBody: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
