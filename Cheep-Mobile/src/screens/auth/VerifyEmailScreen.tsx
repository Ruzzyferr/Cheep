/**
 * ✉️ Verify Email Screen
 * Kayıt sonrası 6 haneli kod ile e-posta doğrulama.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, CodeInput } from '../../components/ui';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, layout } from '../../theme';
import { appAlert } from '../../utils/dialog';

export function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { user, verifyEmail, resendVerification, logout } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const handleVerify = async () => {
    if (code.length !== 6 || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await verifyEmail(code);
      // Başarılı → gate otomatik olarak sonraki adıma (Onboarding) geçer
    } catch (e: any) {
      setError(e?.message || t('auth.code_error'));
      setCode('');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // 6 hane girilince otomatik doğrula
  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification();
      appAlert(t('auth.code_sent_title'), t('auth.code_sent_body'));
    } catch (e: any) {
      appAlert(t('common.error'), e?.message || t('auth.code_send_error'));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={styles.title}>{t('auth.verify_title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.verify_subtitle', { email: user?.email ?? '' })}
        </Text>

        <View style={styles.codeWrap}>
          <CodeInput value={code} onChange={setCode} error={!!error} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={t('auth.verify')}
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== 6}
          fullWidth
          style={styles.verifyButton}
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>{t('auth.no_code')} </Text>
          <Button
            title={resending ? t('auth.sending') : t('auth.resend')}
            onPress={handleResend}
            variant="text"
            disabled={resending}
          />
        </View>

        <TouchableOpacity onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>{t('auth.use_other_account')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  content: {
    flex: 1,
    padding: layout.screenPadding,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    ...typography.styles.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  email: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  codeWrap: {
    marginBottom: spacing.lg,
  },
  error: {
    ...typography.styles.body2,
    color: colors.error.main,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  verifyButton: {
    marginTop: spacing.sm,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },
  logout: {
    marginTop: spacing.xl,
    alignSelf: 'center',
  },
  logoutText: {
    ...typography.styles.body2,
    color: colors.text.hint,
    textDecorationLine: 'underline',
  },
});
