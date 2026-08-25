/**
 * 🛟 Uygulama geneli hata sınırı.
 *
 * NEDEN VAR: uygulamada HİÇBİR hata sınırı yoktu. React'te yakalanmayan bir
 * render hatası tüm ağacı söker; geliştirmede kırmızı ekran görünür ama
 * SÜRÜM derlemesinde öyle bir şey yok. Kullanıcının gördüğü şey boş bir
 * arka plan rengiydi: süreç ayakta, ekran bomboş, hiçbir düğme yok. Tek
 * çıkış uygulamayı zorla kapatmak ve bunu kullanıcının bilmesi gerekiyor.
 *
 * Bu sınır, tek bir bileşenin patlamasını "uygulama kullanılamaz" olmaktan
 * çıkarıp "bu ekran hata verdi, tekrar dene" durumuna indirir.
 *
 * `retry` gerçek bir kurtarma denemesidir: `key` artırılarak alt ağaç
 * KOMPLE yeniden kurulur (aynı bozuk state'le yeniden render edip anında
 * tekrar patlamasın diye).
 *
 * NOT: hata sınırları yalnızca RENDER sırasındaki hataları yakalar — olay
 * yöneticilerindeki ve async kodundaki hataları yakalamaz. Onlar zaten
 * kendi try/catch'lerinde ele alınıyor.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme';

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
    resetKey: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null, resetKey: 0 };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Uzak bir hata toplayıcı yok; en azından cihaz kaydına düşsün ki
        // `adb logcat` / Xcode konsolu ile teşhis edilebilsin.
        console.error('[ErrorBoundary] render hatası:', error, info.componentStack);
    }

    private retry = () => {
        this.setState(s => ({ error: null, resetKey: s.resetKey + 1 }));
    };

    render() {
        if (!this.state.error) {
            return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
        }

        // i18n burada `t` hook'u ile DEĞİL doğrudan örnek üzerinden okunuyor:
        // sınır, sağlayıcıların da patlayabileceği bir noktada çiziliyor.
        const t = i18n.t.bind(i18n);
        return (
            <View style={styles.container}>
                <Text style={styles.emoji}>😞</Text>
                <Text style={styles.title}>{t('common.something_went_wrong')}</Text>
                <Text style={styles.body}>{t('common.crash_body')}</Text>
                <Pressable
                    style={styles.button}
                    onPress={this.retry}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.retry')}
                >
                    <Text style={styles.buttonText}>{t('common.retry')}</Text>
                </Pressable>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: colors.background.default,
    },
    emoji: { fontSize: 48, marginBottom: 16 },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: 8,
    },
    body: {
        fontSize: 15,
        lineHeight: 22,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: 28,
    },
    button: {
        minHeight: 48,
        paddingHorizontal: 28,
        justifyContent: 'center',
        borderRadius: 999,
        backgroundColor: colors.primary.main,
    },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
