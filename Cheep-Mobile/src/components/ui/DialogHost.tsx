/**
 * 💬 DialogHost — uygulamanın TEK uyarı/onay kutusu.
 *
 * Uygulama kökünde bir kez mount edilir ve `utils/dialog.ts` köprüsüne kendini
 * kaydeder. Böylece hem bileşenler hem React dışı yardımcılar aynı görsel dili
 * kullanır: kendi tipografimiz, renklerimiz, köşe yarıçapımız ve gerektiğinde
 * maskot. İşletim sisteminin yerel uyarı kutusu hiçbir yerde çıkmaz.
 *
 * Düğme sırası bilinçli: yıkıcı eylem EN ALTTA ve kırmızı, iptal onun üstünde.
 * Yerel modallarda bu sıra platforma göre değişiyor ve kullanıcı yanlış düğmeye
 * basabiliyordu.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheepMascot } from '../brand/CheepMascot';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { registerDialogHandler, type DialogOptions, type DialogButton } from '../../utils/dialog';
import i18n from '../../i18n';

export function DialogHost() {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const insets = useSafeAreaInsets();
  // Kapanış animasyonu sırasında ikinci kez basılmasın diye kilit.
  const closing = useRef(false);

  useEffect(() => {
    registerDialogHandler((o) => {
      closing.current = false;
      setOptions(o);
    });
    return () => registerDialogHandler(null);
  }, []);

  const close = useCallback(() => {
    closing.current = true;
    setOptions(null);
  }, []);

  const press = useCallback(
    (b: DialogButton) => {
      if (closing.current) return;
      close();
      // Kapanışı bekletmeden çalıştır: onPress bir başka diyalog açabilir ve
      // ikisi üst üste binmemeli.
      setTimeout(() => { void b.onPress?.(); }, 0);
    },
    [close]
  );

  if (!options) return null;

  const buttons: DialogButton[] =
    options.buttons && options.buttons.length
      ? options.buttons
      : [{ text: i18n.t('common.ok') }];

  const hasCancel = buttons.some((b) => b.style === 'cancel');
  const dismissable = options.dismissable ?? hasCancel;
  const tone = options.tone ?? 'neutral';

  // Yıkıcı seçenek en altta dursun; iptal onun üstünde.
  const ordered = [...buttons].sort((a, b) => rank(a) - rank(b));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Android geri tuşu: iptal varsa onu çalıştır, yoksa yok say.
        const cancel = buttons.find((b) => b.style === 'cancel');
        if (cancel) press(cancel);
        else if (dismissable) close();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!dismissable) return;
          const cancel = buttons.find((b) => b.style === 'cancel');
          if (cancel) press(cancel);
          else close();
        }}
      >
        {/* İçeriğe dokunmak kapatmasın */}
        <Pressable
          style={[styles.card, { marginBottom: insets.bottom }]}
          onPress={() => {}}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          {options.mascot ? (
            <View style={styles.mascotWrap}>
              <CheepMascot size={84} expression={options.mascot} />
            </View>
          ) : options.icon ? (
            <View style={[styles.iconWrap, tone === 'danger' && styles.iconWrapDanger, tone === 'premium' && styles.iconWrapPremium]}>
              <MaterialIcons
                name={options.icon as any}
                size={26}
                color={tone === 'danger' ? colors.error.main : tone === 'premium' ? colors.accent.main : colors.primary.main}
              />
            </View>
          ) : null}

          <Text style={styles.title}>{options.title}</Text>
          {options.message ? (
            <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageWrap}>
              <Text style={styles.message}>{options.message}</Text>
            </ScrollView>
          ) : null}

          <View style={styles.buttons}>
            {ordered.map((b, i) => (
              <Pressable
                key={`${b.text}-${i}`}
                style={({ pressed }) => [
                  styles.btn,
                  b.style === 'destructive' && styles.btnDestructive,
                  b.style === 'cancel' && styles.btnCancel,
                  !b.style || b.style === 'default' ? styles.btnPrimary : null,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => press(b)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.btnText,
                    b.style === 'destructive' && styles.btnTextDestructive,
                    b.style === 'cancel' && styles.btnTextCancel,
                  ]}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** default/primary üstte, cancel ortada, destructive en altta. */
function rank(b: DialogButton): number {
  if (b.style === 'destructive') return 2;
  if (b.style === 'cancel') return 1;
  return 0;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 33, 27, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius['2xl'],
    padding: spacing.lg,
    ...shadows.md,
  },
  mascotWrap: { alignSelf: 'center', marginBottom: spacing.sm },
  iconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconWrapDanger: { backgroundColor: colors.error.bg },
  iconWrapPremium: { backgroundColor: colors.accent[50] },

  title: { ...typography.styles.h3, color: colors.text.primary, textAlign: 'center' },
  messageScroll: { maxHeight: 320 },
  messageWrap: { paddingTop: spacing.sm },
  message: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  buttons: { marginTop: spacing.lg, gap: spacing.sm },
  btn: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary.main },
  btnCancel: { backgroundColor: colors.background.input },
  btnDestructive: { backgroundColor: colors.error.bg },
  btnPressed: { opacity: 0.85 },
  btnText: { ...typography.styles.button, color: '#FFFFFF' },
  btnTextCancel: { color: colors.text.primary },
  btnTextDestructive: { color: colors.error.main },
});
