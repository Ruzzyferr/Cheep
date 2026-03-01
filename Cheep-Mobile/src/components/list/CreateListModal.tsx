/**
 * 📋 Create List Modal
 * Modal to create a new shopping list
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { listService } from '../../services';
import { Button, Input } from '../ui';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';

interface CreateListModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hasActiveList?: boolean;
}

export function CreateListModal({
  visible,
  onClose,
  onSuccess,
  hasActiveList = false,
}: CreateListModalProps) {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Lütfen liste adı girin');
      return;
    }

    try {
      setLoading(true);
      await listService.createList({
        name: name.trim(),
        budget: budget ? parseFloat(budget) : undefined,
      });
      
      // Reset form
      setName('');
      setBudget('');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Create list error:', error);
      const errorMessage = error?.response?.data?.message || 'Liste oluşturulurken bir hata oluştu';
      Alert.alert('Hata', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setBudget('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <BlurView
          intensity={30}
          tint="light"
          style={StyleSheet.absoluteFill}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
        </BlurView>
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="add-shopping-cart" size={24} color={colors.primary.main} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.title}>Yeni Liste Oluştur</Text>
                  <Text style={styles.subtitle}>Alışveriş listenizi oluşturun</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleClose} 
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView 
              style={styles.content}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {hasActiveList && (
                <View style={styles.warningBox}>
                  <MaterialIcons name="info-outline" size={20} color={colors.warning.dark} />
                  <Text style={styles.warningText}>
                    Aktif listeniz var. Yeni liste oluşturulduğunda eski liste otomatik olarak tamamlanacaktır.
                  </Text>
                </View>
              )}

              <View style={styles.inputSection}>
                <Input
                  label="Liste Adı"
                  placeholder="Örn: Haftalık Alışveriş"
                  value={name}
                  onChangeText={setName}
                  required
                  autoFocus
                  containerStyle={styles.input}
                />

                <Input
                  label="Bütçe (Opsiyonel)"
                  placeholder="Örn: 500"
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="numeric"
                  containerStyle={styles.input}
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Button
                title="İptal"
                onPress={handleClose}
                variant="outline"
                disabled={loading}
                style={styles.cancelButton}
              />
              <Button
                title="Oluştur"
                onPress={handleCreate}
                loading={loading}
                disabled={loading || !name.trim()}
                style={styles.createButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContainer: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modal: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius['2xl'],
    width: '100%',
    ...shadows.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    maxHeight: 600,
    minHeight: 400,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.paper,
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    ...typography.styles.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
    fontWeight: '700',
  },

  subtitle: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    fontSize: 13,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.input,
  },

  content: {
    flexShrink: 1,
    flexGrow: 1,
  },

  scrollContent: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },

  inputSection: {
    marginTop: spacing.sm,
  },

  input: {
    marginBottom: spacing.lg,
  },

  footer: {
    flexDirection: 'row',
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.paper,
  },

  cancelButton: {
    flex: 1,
    marginRight: spacing.sm,
  },

  createButton: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning.bg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.warning.light,
  },

  warningText: {
    ...typography.styles.body2,
    color: colors.warning.dark,
    lineHeight: 20,
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 13,
  },
});

