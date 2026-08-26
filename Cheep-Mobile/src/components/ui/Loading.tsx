/**
 * ⏳ Ortak yükleme durumları.
 *
 * Kural — her veri çeken ekran bu üçünü kullanır:
 *   isPending                → iskelet (içerik şekline uygun)
 *   isFetching && !isPending → RefreshBar (üstte ince çizgi, ekran boşalmaz)
 *   isError                  → ErrorState (tekrar dene aksiyonlu)
 *
 * NEDEN VAR: birçok ekranda hiç gösterge yoktu. Anasayfa `loading` state'ini
 * tutuyor ama hiçbir yerde render etmiyordu; Fiyat Farkı, Market Detay,
 * Strateji Detay ve Asistan ekranlarında hiç yoktu. Kullanıcı boş bir kabuğa
 * bakıp uygulamanın donduğunu sanıyordu.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';
import { Skeleton } from './Skeleton';

/** Tam ekran ilk yükleme — iskelet çizmenin anlamlı olmadığı ekranlar için. */
export function ScreenLoader({ label }: { label?: string }) {
    return (
        <View style={styles.screen}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            {label ? <Text style={styles.screenLabel}>{label}</Text> : null}
        </View>
    );
}

/**
 * Arka plan tazelemesi göstergesi.
 *
 * Ekranı BOŞALTMAZ: eski veri görünürken üstte ince bir çizgi belirir. Bayat
 * veriyi gizleyip iskelet göstermek, kullanıcıya zaten sahip olduğu içeriği
 * kaybettirirdi.
 */
export function RefreshBar({ visible }: { visible: boolean }) {
    if (!visible) return null;
    return (
        <View style={styles.refreshBar}>
            <ActivityIndicator size="small" color={colors.primary.main} />
        </View>
    );
}

/** Hata durumu — sessizce boş ekran göstermek yerine ne olduğunu söyler. */
export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
    const { t } = useTranslation();
    return (
        <View style={styles.screen}>
            <MaterialIcons name="cloud-off" size={40} color={colors.text.hint} />
            <Text style={styles.errorText}>{message ?? t('common.error_loading')}</Text>
            {onRetry ? (
                <TouchableOpacity style={styles.retry} onPress={onRetry} activeOpacity={0.8}>
                    <MaterialIcons name="refresh" size={18} color={colors.background.paper} />
                    <Text style={styles.retryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

/** Detay sayfası iskeleti — görsel + başlık + fiyat satırları. */
export function DetailSkeleton() {
    return (
        <View style={{ padding: layout.screenPadding, gap: spacing.md }}>
            <Skeleton height={200} radius={borderRadius.lg} />
            <Skeleton width="70%" height={22} />
            <Skeleton width="45%" height={14} />
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} height={56} radius={borderRadius.md} />
                ))}
            </View>
        </View>
    );
}

/** Kart yığını iskeleti — strateji/karşılaştırma ekranları. */
export function CardSkeleton({ count = 3 }: { count?: number }) {
    return (
        <View style={{ padding: layout.screenPadding, gap: spacing.md }}>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} height={132} radius={borderRadius.lg} />
            ))}
        </View>
    );
}

/** Anasayfa iskeleti — hero, liste kartı, kategori rayı, fırsat rayı. */
export function HomeSkeleton() {
    return (
        <View style={{ paddingHorizontal: layout.screenPadding, gap: spacing.lg }}>
            <Skeleton height={140} radius={borderRadius.xl} />
            <Skeleton height={150} radius={borderRadius.xl} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={{ alignItems: 'center', gap: spacing.xs }}>
                        <Skeleton width={64} height={64} radius={borderRadius.lg} />
                        <Skeleton width={54} height={10} />
                    </View>
                ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {[0, 1].map((i) => (
                    <Skeleton key={i} width={150} height={190} radius={borderRadius.lg} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
    },
    screenLabel: {
        ...typography.styles.body2,
        color: colors.text.secondary,
    },
    refreshBar: {
        paddingVertical: spacing.xs,
        alignItems: 'center',
        backgroundColor: colors.background.paper,
    },
    errorText: {
        ...typography.styles.body2,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    retry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary.main,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    retryText: {
        ...typography.styles.button,
        color: colors.background.paper,
    },
});
