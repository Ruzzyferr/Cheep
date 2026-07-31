/**
 * 🔐 Login Screen
 */

import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { CheepMascot } from '../../components/brand/CheepMascot';
import { FadeInUp, Float } from '../../components/anim';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, layout } from '../../theme';

export function LoginScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: any = {};

    if (!email) {
      newErrors.email = 'Email adresi gereklidir';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Geçerli bir email adresi giriniz';
    }

    if (!password) {
      newErrors.password = 'Şifre gereklidir';
    } else if (password.length < 6) {
      newErrors.password = 'Şifre en az 6 karakter olmalıdır';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email, password });
      // Navigation will be handled by AuthContext
    } catch (error: any) {
      Alert.alert(
        'Giriş Hatası',
        error?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.'
      );
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <FadeInUp style={styles.logoContainer}>
          <Float>
            <View style={styles.logoPlaceholder}>
              <CheepMascot size={96} shadow={false} />
            </View>
          </Float>
          <Text style={styles.appName}>Cheep</Text>
          <Text style={styles.tagline}>Akıllı Alışveriş Asistanı</Text>

          {/* Destek — giriş YAPAMAYAN kullanıcının tek ulaşma yolu. */}
          <TouchableOpacity
            style={styles.supportLink}
            onPress={() => (navigation as any).navigate('Support')}
            activeOpacity={0.7}
          >
            <Text style={styles.supportLinkText}>{t('support.auth_link')}</Text>
          </TouchableOpacity>
        </FadeInUp>

        {/* Form */}
        <FadeInUp delay={120} style={styles.formContainer}>
          <Text style={styles.title}>Hoş geldin 👋</Text>
          <Text style={styles.subtitle}>Hesabına giriş yap</Text>

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

          <Input
            label="Şifre"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            leftIcon={<MaterialIcons name="lock-outline" size={20} color={colors.text.hint} />}
            required
          />

          <Button
            title="Giriş Yap"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            style={styles.loginButton}
          />

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Hesabınız yok mu? </Text>
            <Button
              title="Kayıt Ol"
              onPress={() => navigation.navigate('Register')}
              variant="text"
            />
          </View>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  supportLink: { alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  supportLinkText: { fontSize: 13, color: colors.text.secondary, textDecorationLine: 'underline' },
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  scrollContent: {
    flexGrow: 1,
    padding: layout.screenPadding,
  },

  logoContainer: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },

  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },

  appName: {
    ...typography.styles.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  tagline: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },

  formContainer: {
    flex: 1,
  },

  title: {
    ...typography.styles.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  subtitle: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },

  loginButton: {
    marginTop: spacing.lg,
  },

  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },

  registerText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },
});

