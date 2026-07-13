/**
 * 📍 Konum sayfası — Otomatik / Sabit adres seçimi.
 *
 * Hiçbir geocoder sonucu sessizce kabul edilmez: kullanıcı aday listesinden
 * birini seçmeden hiçbir şey kaydedilmez (bkz. validateCandidate akışı).
 * "no_branches" durumunda koordinat UYDURULMAZ — kullanıcı onaylarsa
 * koordinatsız (yalnızca ülke) pin kaydedilir.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationAnchor } from '../../context/LocationContext';
import { searchAddress, validateCandidate, type GeocodeCandidate } from '../../services/geocode.service';
import type { PinnedAnchor } from '../../utils/anchor';
import { Button } from '../ui';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'not_found' }
  | { kind: 'results'; candidates: GeocodeCandidate[] };

// Bir adayın doğrulanması sırasında akış hangi aşamaya girdi.
type ValidationFlow =
  | { kind: 'none' }
  | { kind: 'checking'; label: string }
  | { kind: 'unsupported'; label: string }
  | { kind: 'no_branches'; label: string; pin: PinnedAnchor };

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LocationSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { anchor, pin, unpin } = useLocationAnchor();

  // Sheet her açıldığında mevcut çapaya göre başlasın (önceki kalıntı state sızmasın).
  const [selectedMode, setSelectedMode] = useState<'auto' | 'pinned'>(anchor?.mode ?? 'auto');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ kind: 'idle' });
  const [flow, setFlow] = useState<ValidationFlow>({ kind: 'none' });

  useEffect(() => {
    if (visible) {
      setSelectedMode(anchor?.mode ?? 'auto');
      setQuery('');
      setSearching(false);
      setSearchState({ kind: 'idle' });
      setFlow({ kind: 'none' });
    }
  }, [visible, anchor?.mode]);

  const handleUseAuto = useCallback(async () => {
    await unpin();
    onClose();
  }, [unpin, onClose]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setFlow({ kind: 'none' });
    try {
      const result = await searchAddress(q);
      if (!result.available) {
        setSearchState({ kind: 'unavailable' });
      } else if (result.candidates.length === 0) {
        setSearchState({ kind: 'not_found' });
      } else {
        setSearchState({ kind: 'results', candidates: result.candidates });
      }
    } finally {
      setSearching(false);
    }
  }, [query, searching]);

  const handleSelectCandidate = useCallback(async (c: GeocodeCandidate) => {
    setFlow({ kind: 'checking', label: c.label });
    const v = await validateCandidate(c);
    if (v.status === 'unsupported_country') {
      setFlow({ kind: 'unsupported', label: c.label });
      return;
    }
    if (v.status === 'no_branches') {
      setFlow({ kind: 'no_branches', label: c.label, pin: v.pin });
      return;
    }
    // status === 'ok' — koordinatlı doğrulanmış pin, doğrudan kaydet.
    await pin(v.pin);
    onClose();
  }, [pin, onClose]);

  const handleConfirmNoBranches = useCallback(async () => {
    if (flow.kind !== 'no_branches') return;
    await pin(flow.pin); // coords zaten null — burada asla üretilmez.
    onClose();
  }, [flow, pin, onClose]);

  const candidates = searchState.kind === 'results' ? searchState.candidates : [];
  const checkingLabel = flow.kind === 'checking' ? flow.label : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('location.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
            {/* Mod seçici */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, selectedMode === 'auto' && styles.modeBtnActive]}
                onPress={handleUseAuto}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="my-location"
                  size={16}
                  color={selectedMode === 'auto' ? colors.background.paper : colors.text.secondary}
                />
                <Text style={[styles.modeBtnText, selectedMode === 'auto' && styles.modeBtnTextActive]}>
                  {t('location.mode_auto')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, selectedMode === 'pinned' && styles.modeBtnActive]}
                onPress={() => setSelectedMode('pinned')}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="push-pin"
                  size={16}
                  color={selectedMode === 'pinned' ? colors.background.paper : colors.text.secondary}
                />
                <Text style={[styles.modeBtnText, selectedMode === 'pinned' && styles.modeBtnTextActive]}>
                  {t('location.mode_pinned')}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedMode === 'pinned' && (
              <View style={styles.pinnedSection}>
                {anchor?.mode === 'pinned' && anchor.label && (
                  <Text style={styles.currentPin}>
                    {t('location.chip_pinned', { label: anchor.label })}
                  </Text>
                )}

                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('location.address_placeholder')}
                    placeholderTextColor={colors.text.hint}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    style={[styles.searchBtn, (searching || !query.trim()) && styles.searchBtnDisabled]}
                    onPress={handleSearch}
                    disabled={searching || !query.trim()}
                    activeOpacity={0.8}
                  >
                    {searching ? (
                      <ActivityIndicator size="small" color={colors.background.paper} />
                    ) : (
                      <Text style={styles.searchBtnText}>{t('location.search')}</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {searching && (
                  <Text style={styles.helperText}>{t('location.searching')}</Text>
                )}
                {!searching && searchState.kind === 'unavailable' && (
                  <Text style={styles.errorText}>{t('location.geocoder_unavailable')}</Text>
                )}
                {!searching && searchState.kind === 'not_found' && (
                  <Text style={styles.errorText}>{t('location.not_found')}</Text>
                )}

                {/* Aday listesi — kullanıcı birini seçmeden hiçbir şey kaydedilmez. */}
                {candidates.map((c, i) => {
                  const isChecking = checkingLabel === c.label;
                  return (
                    <View key={`${c.label}-${i}`} style={styles.candidateRow}>
                      <Text style={styles.candidateLabel} numberOfLines={2}>
                        {c.label}
                      </Text>
                      <TouchableOpacity
                        style={styles.useThisBtn}
                        onPress={() => handleSelectCandidate(c)}
                        disabled={flow.kind === 'checking'}
                        activeOpacity={0.8}
                      >
                        {isChecking ? (
                          <ActivityIndicator size="small" color={colors.primary.main} />
                        ) : (
                          <Text style={styles.useThisText}>{t('location.use_this')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {flow.kind === 'unsupported' && (
                  <View style={[styles.warnBox, styles.errorBox]}>
                    <MaterialIcons name="block" size={18} color={colors.error.main} />
                    <Text style={styles.warnText}>{t('location.unsupported_country')}</Text>
                  </View>
                )}

                {flow.kind === 'no_branches' && (
                  <View style={styles.warnBox}>
                    <MaterialIcons name="info-outline" size={18} color={colors.warning.main} />
                    <Text style={styles.warnText}>{t('location.no_branches')}</Text>
                    <View style={styles.warnActions}>
                      <Button
                        title={t('common.cancel')}
                        variant="outline"
                        size="small"
                        onPress={() => setFlow({ kind: 'none' })}
                        style={styles.warnActionBtn}
                      />
                      <Button
                        title={t('common.continue')}
                        size="small"
                        onPress={handleConfirmNoBranches}
                        style={styles.warnActionBtn}
                      />
                    </View>
                  </View>
                )}

                <TouchableOpacity onPress={handleUseAuto} style={styles.backLink}>
                  <Text style={styles.backLinkText}>{t('location.back_to_auto')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    paddingBottom: layout.screenPadding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: { ...typography.styles.h4, color: colors.text.primary, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 20, color: colors.text.secondary },

  body: { paddingHorizontal: layout.screenPadding },

  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.main,
    backgroundColor: colors.background.default,
  },
  modeBtnActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  modeBtnText: { ...typography.styles.body2, color: colors.text.secondary, fontWeight: '600' },
  modeBtnTextActive: { color: colors.background.paper },

  pinnedSection: { marginTop: spacing.lg },

  currentPin: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...typography.styles.body1,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
  },
  searchBtn: {
    minWidth: 76,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { ...typography.styles.button, color: colors.background.paper, fontSize: 14 },

  helperText: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.styles.caption,
    color: colors.error.main,
    marginTop: spacing.sm,
  },

  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  candidateLabel: { flex: 1, ...typography.styles.body2, color: colors.text.primary },
  useThisBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary.main,
    minWidth: 84,
    alignItems: 'center',
  },
  useThisText: { ...typography.styles.caption, color: colors.primary.main, fontWeight: '700' },

  warnBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warning.bg,
    gap: spacing.xs,
  },
  errorBox: { backgroundColor: colors.error.bg },
  warnText: { ...typography.styles.body2, color: colors.text.primary },
  warnActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  warnActionBtn: { flex: 1 },

  backLink: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  backLinkText: { ...typography.styles.body2, color: colors.primary.main, fontWeight: '600' },
});
