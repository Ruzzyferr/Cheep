/**
 * 🔗 Harici bağlantı yardımcıları
 */
import { Linking, Alert } from 'react-native';

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
    Alert.alert('Bağlantı açılamadı', 'Lütfen daha sonra tekrar deneyin.');
  }
}
