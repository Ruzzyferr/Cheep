/**
 * 📝 Register Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Input } from '@/src/components';
import { CheepMascot } from '../../components/brand/CheepMascot';
import { FadeInUp } from '../../components/anim';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, layout } from '../../theme';

const hint = (name: any) => <MaterialIcons name={name} size={20} color={colors.text.hint} />;

export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    const newErrors: any = {};

    if (!name) {
      newErrors.name = 'İsim gereklidir';
    } else if (name.length < 2) {
      newErrors.name = 'İsim en az 2 karakter olmalıdır';
    }

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

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Şifreler eşleşmiyor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await register({ name, email, password });
      // Navigation will be handled by AuthContext
    } catch (error: any) {
      Alert.alert(
        'Kayıt Hatası',
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
        <FadeInUp style={styles.header}>
          <View style={styles.brandRow}>
            <CheepMascot size={56} shadow={false} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Hesap oluştur</Text>
              <Text style={styles.subtitle}>Cheep&apos;e katıl, tasarrufa başla</Text>
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={100} style={styles.formContainer}>
          <Input
            label="İsim"
            placeholder="Adınız Soyadınız"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
            autoComplete="name"
            leftIcon={hint('person-outline')}
            required
          />

          <Input
            label="Email"
            placeholder="ornek@email.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={hint('mail-outline')}
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
            leftIcon={hint('lock-outline')}
            required
          />

          <Input
            label="Şifre Tekrar"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry
            autoCapitalize="none"
            leftIcon={hint('lock-outline')}
            required
          />

          <Button
            title="Kayıt Ol"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            style={styles.registerButton}
          />

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Zaten hesabınız var mı? </Text>
            <Button
              title="Giriş Yap"
              onPress={() => navigation.navigate('Login')}
              variant="text"
            />
          </View>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  scrollContent: {
    flexGrow: 1,
    padding: layout.screenPadding,
  },

  header: {
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  title: {
    ...typography.styles.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  subtitle: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },

  formContainer: {
    flex: 1,
  },

  registerButton: {
    marginTop: spacing.lg,
  },

  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },

  loginText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },
});

