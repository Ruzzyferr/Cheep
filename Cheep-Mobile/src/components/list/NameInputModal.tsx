/**
 * ✏️ Name Input Modal
 * Tek metin alanlı basit modal — liste adı sorma (klonla) ve yeniden adlandırma için.
 * CreateListModal görsel diliyle tutarlı (blur zemin, ortalı kart).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../ui';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';

interface NameInputModalProps {
  visible: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export function NameInputModal({
  visible,
  title,
  label,
  confirmLabel,
  initialValue = '',
  onClose,
  onSubmit,
}: NameInputModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValue);

  // Modal her açıldığında başlangıç değerini tazele (farklı liste/işlem).
  useEffect(() => {
    if (visible) setName(initialValue);
  }, [visible, initialValue]);

  const trimmed = name.trim();
  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </BlurView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.center}
        >
          <View style={styles.modal}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <MaterialIcons name="edit" size={22} color={colors.primary.main} />
              </View>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.close}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={22} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <Input
                label={label}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submit}
                maxLength={100}
              />
            </View>

            <View style={styles.footer}>
              <Button title={t('common.cancel')} onPress={onClose} variant="outline" style={styles.footerBtn} />
              <Button title={confirmLabel} onPress={submit} disabled={!trimmed} style={styles.footerBtn} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { width: '100%', paddingHorizontal: spacing.lg, alignItems: 'center' },
  modal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius['2xl'],
    ...shadows.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  title: { ...typography.styles.h4, color: colors.text.primary, fontWeight: '700', flex: 1 },
  close: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.input,
  },
  body: { padding: spacing.lg },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.sm,
  },
  footerBtn: { flex: 1 },
});
