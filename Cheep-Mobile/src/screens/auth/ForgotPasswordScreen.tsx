/**
 * 🔑 Şifremi Unuttum
 *
 * TEK EKRAN, İKİ ADIM — bilerek. E-posta ve kod ayrı ekranlarda olsaydı,
 * kullanıcı kodu okumak için uygulamadan çıkıp posta kutusuna gittiğinde geri
 * dönüşte yığının neresine düşeceği belirsizleşirdi; burada adım bileşenin
 * kendi durumunda tutuluyor, uygulama arkaplana atılıp geri gelse de yerinde
 * kalıyor.
 *
 * "KOD GÖNDERİLDİ" DEMİYORUZ, "KAYITLIYSA GÖNDERİLDİ" DİYORUZ.
 * Sunucu, adres kayıtlı olmasa da başarı dönüyor (hesap varlığı sızdırmamak
 * için). Arayüzün kesin konuşması bu korumayı hiçe indirirdi: "gönderildi"
 * yazısı, adresin kayıtlı olduğunu söylerdi. Bu yüzden ikinci adıma HER
 * durumda geçiliyor — kayıtsız adres giren biri kod ekranını görür ve kodu
 * asla doğrulayamaz, ki doğru davranış tam olarak budur.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { Button, Input, CodeInput } from '../../components/ui';
import { CheepMascot } from '../../components/brand/CheepMascot';
import { FadeInUp } from '../../components/anim';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services';
import { colors, typography, spacing, layout } from '../../theme';
import { useBottomSpacing, useTopSpacing } from '../../hooks/useScreenSpacing';
import { appAlert } from '../../utils/dialog';
import type { AuthStackScreenProps } from '../../navigation/types';

/** Parola alt sınırı — sunucudaki `resetPasswordSchema` ile AYNI olmak zorunda. */
const MIN_PASSWORD = 6;

export function ForgotPasswordScreen({ navigation, route }: AuthStackScreenProps<'ForgotPassword'>) {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const bottomSpacing = useBottomSpacing();
  const topSpacing = useTopSpacing();

  const [step, setStep] = useState<'email' | 'code'>('email');
  // Giriş ekranında yazılmış adres varsa taşınır: kullanıcı zaten bir kez yazdı.
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});
  const [codeError, setCodeError] = useState<string | null>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email.trim());

  const handleSend = async () => {
    if (!emailValid) {
      setErrors({ email: t('auth.email_invalid') });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setStep('code');
    } catch (e: any) {
      // Buraya yalnızca AĞ/limit hatasıyla düşülür; "hesap yok" hatası yok.
      appAlert(t('common.error'), e?.message || t('auth.generic_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD) next.password = t('auth.password_min');
    if (confirm !== password) next.confirm = t('auth.password_mismatch');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (code.length !== 6) {
      setCodeError(t('auth.code_error'));
      return;
    }

    setCodeError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim(), code, password);
      // Başarılı → sunucu taze token döndü, AuthContext oturumu açtı ve
      // navigasyon kapısı kendiliğinden uygulamaya geçiyor. Burada
      // `navigate` ÇAĞIRMIYORUZ: bu yığın birazdan sökülecek.
    } catch (e: any) {
      setCodeError(e?.message || t('auth.reset_error'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topSpacing, paddingBottom: bottomSpacing },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInUp style={styles.header}>
          <CheepMascot size={80} shadow={false} />
          <Text style={styles.title}>{t('auth.forgot_title')}</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? t('auth.forgot_subtitle')
              : t('auth.forgot_code_subtitle', { email: email.trim() })}
          </Text>
        </FadeInUp>

        <FadeInUp delay={120} style={styles.form}>
          {step === 'email' ? (
            <>
              <Input
                label="Email"
                placeholder="ornek@email.com"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<MaterialIcons name="mail-outline" size={20} color={colors.text.hint} />}
                required
              />
              <Button
                title={t('auth.forgot_send')}
                onPress={handleSend}
                loading={loading}
                fullWidth
                style={styles.primaryBtn}
              />
            </>
          ) : (
            <>
              {/* Sunucu adresin kayıtlı olup olmadığını söylemiyor; bu not
                  kullanıcıya "kod gelmediyse hata sende değil, adres kayıtlı
                  olmayabilir" demenin dürüst yolu. */}
              <Text style={styles.note}>{t('auth.forgot_sent')}</Text>

              <View style={styles.codeWrap}>
                <CodeInput value={code} onChange={setCode} error={!!codeError} />
              </View>

              <Input
                label={t('auth.new_password')}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                leftIcon={<MaterialIcons name="lock-outline" size={20} color={colors.text.hint} />}
                required
              />

              <Input
                label={t('auth.new_password_confirm')}
                placeholder="••••••••"
                value={confirm}
                onChangeText={setConfirm}
                error={errors.confirm}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                leftIcon={<MaterialIcons name="lock-outline" size={20} color={colors.text.hint} />}
                required
              />

              {codeError ? <Text style={styles.error}>{codeError}</Text> : null}

              <Button
                title={t('auth.forgot_submit')}
                onPress={handleReset}
                loading={loading}
                fullWidth
                style={styles.primaryBtn}
              />

              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setCodeError(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>{t('auth.forgot_resend')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>{t('auth.back_to_login')}</Text>
          </TouchableOpacity>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  scrollContent: { flexGrow: 1, padding: layout.screenPadding },
  header: { alignItems: 'center', marginTop: spacing['2xl'], marginBottom: spacing.xl },
  title: {
    ...typography.styles.h2,
    color: colors.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  form: { flex: 1 },
  note: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  codeWrap: { marginBottom: spacing.lg },
  primaryBtn: { marginTop: spacing.lg },
  error: {
    ...typography.styles.body2,
    color: colors.error.main,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  linkRow: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.xs },
  linkText: { ...typography.styles.body2, color: colors.primary.main, fontWeight: '600' },
});
