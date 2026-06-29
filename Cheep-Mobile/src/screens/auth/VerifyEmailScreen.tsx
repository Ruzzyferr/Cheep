/**
 * ✉️ Verify Email Screen
 * Kayıt sonrası 6 haneli kod ile e-posta doğrulama.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, CodeInput } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, layout } from '../../theme';

export function VerifyEmailScreen() {
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
      setError(e?.message || 'Kod doğrulanamadı. Tekrar deneyin.');
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
      Alert.alert('Kod gönderildi', 'Yeni doğrulama kodu e-posta adresine gönderildi.');
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Kod gönderilemedi. Lütfen tekrar deneyin.');
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

        <Text style={styles.title}>E-postanı doğrula</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.email}>{user?.email}</Text> adresine gönderdiğimiz 6 haneli
          kodu gir.
        </Text>

        <View style={styles.codeWrap}>
          <CodeInput value={code} onChange={setCode} error={!!error} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Doğrula"
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== 6}
          fullWidth
          style={styles.verifyButton}
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Kod gelmedi mi? </Text>
          <Button
            title={resending ? 'Gönderiliyor…' : 'Tekrar gönder'}
            onPress={handleResend}
            variant="text"
            disabled={resending}
          />
        </View>

        <TouchableOpacity onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Farklı bir hesap kullan</Text>
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
