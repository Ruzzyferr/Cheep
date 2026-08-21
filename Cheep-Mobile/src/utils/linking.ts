/**
 * 🔗 Harici bağlantı yardımcıları
 */
import { Linking, Alert } from 'react-native';
import i18n from '../i18n';

/**
 * Harici bir URL'yi (tarayıcı/uygulama) güvenli şekilde açar.
 * Açılamazsa kullanıcıya nazik bir uyarı gösterir.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      // Çoğu http(s) linki desteklenir; yine de güvenli taraf
      await Linking.openURL(url);
    }
  } catch {
    Alert.alert(i18n.t('common.link_failed_title'), i18n.t('common.link_failed_body'));
  }
}
