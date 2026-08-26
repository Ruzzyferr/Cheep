/**
 * 🚧 Zorunlu güncelleme kapısı.
 *
 * Uygulama açılırken ve her öne geldiğinde sunucudan sürüm politikasını sorar:
 *
 *   `blocked`  → kapatılamayan modal; uygulama kullanılamaz
 *   `optional` → kapatılabilir bilgilendirme (oturum başına bir kez)
 *   `none`     → hiçbir şey
 *
 * KAPI HATA AFFEDER. Sunucuya ulaşılamazsa, eşik boşsa ya da sürüm okunamazsa
 * kilitlenmez — karar mantığı `utils/updateGate.ts` içinde ve testli. Yanlış
 * bir kilit kullanıcıyı uygulamadan tamamen dışarıda bırakır ve elinde
 * yapabileceği hiçbir şey kalmaz.
 *
 * ÇOCUKLARI KALDIRMIYORUZ: blocked durumunda alttaki uygulama render edilmeye
 * devam eder ama üstünde kapatılamayan bir katman durur. Ağacı söküp yerine
 * modal koymak, kullanıcı güncelledikten sonra tüm durumu (giriş, sepet,
 * gezinme) sıfırdan kurmak demekti.
 */
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useAppVersionPolicy } from '../../queries/useAppVersion';
import { decideUpdateGate } from '../../utils/updateGate';
import { CheepMascot } from '../brand/CheepMascot';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: policy } = useAppVersionPolicy();
  const clientVersion = Constants.expoConfig?.version;
  const decision = decideUpdateGate(clientVersion, policy ?? null);

  // Yumuşak uyarı oturum başına bir kez: her odaklanmada modal açmak
  // kullanıcıyı bezdirir ve gerçekten önemli olan zorunlu kilidi de
  // önemsizleştirir.
  const [softDismissed, setSoftDismissed] = useState(false);

  const blocked = decision === 'blocked';
  const soft = decision === 'optional' && !softDismissed;
  const visible = blocked || soft;

  // Zorunlu kilitte donanım geri tuşu modalı kapatmamalı.
  useEffect(() => {
    if (!blocked || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocked]);

  const openStore = () => {
    if (policy?.storeUrl) void Linking.openURL(policy.storeUrl);
  };

  return (
    <>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        // Zorunlu kilitte kapatma isteği yok sayılır (iOS kaydırma, Android geri).
        onRequestClose={() => {
          if (!blocked) setSoftDismissed(true);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <CheepMascot size={72} expression="happy" />

            <Text style={styles.title}>
              {blocked ? t('update.required_title') : t('update.available_title')}
            </Text>

            <Text style={styles.body}>
              {blocked ? t('update.required_body') : t('update.available_body')}
            </Text>

            {policy?.latest ? (
              <Text style={styles.version}>
                {t('update.version_line', { current: clientVersion, latest: policy.latest })}
              </Text>
            ) : null}

            <TouchableOpacity style={styles.primary} onPress={openStore} activeOpacity={0.85}>
              <MaterialIcons name="system-update" size={20} color={colors.background.paper} />
              <Text style={styles.primaryText}>{t('update.action')}</Text>
            </TouchableOpacity>

            {/* "Şimdi değil" YALNIZCA yumuşak uyarıda. Zorunlu kilitte çıkış yok. */}
            {!blocked && (
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => setSoftDismissed(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryText}>{t('update.later')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  title: {
    ...typography.styles.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  body: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  version: {
    ...typography.styles.caption,
    color: colors.text.hint,
    textAlign: 'center',
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  primaryText: {
    ...typography.styles.button,
    color: colors.background.paper,
  },
  secondary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },
});
