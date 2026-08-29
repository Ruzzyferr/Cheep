/**
 * 📢 Banner reklam — WEB SÜRÜMÜ: hiçbir şey çizmez.
 *
 * NEDEN AYRI DOSYA: `react-native-google-mobile-ads` NATIVE-ONLY. Web paketi
 * onu görünce `codegenNativeComponent` üzerinden patlıyor ve TÜM paketleme
 * düşüyor:
 *
 *   Web Bundling failed — Importing native-only module
 *   "react-native/Libraries/Utilities/codegenNativeComponent" on web
 *
 * Bu gerileme reklamlar eklenirken oluştu ve SESSİZDİ: `expo start --web`
 * sayfayı beyaz açıyor, tarayıcı konsoluna hiçbir hata düşmüyor, yalnızca
 * Metro günlüğünde görünüyor. Bedeli yalnızca geliştirme değil — App Store
 * ve Play ekran görüntüleri bu web hedefi üzerinden üretiliyor, yani mağaza
 * görselleri de üretilemez hâle gelmişti.
 *
 * Koşullu import ya da `Platform.OS` kontrolü YETMEZ: Metro dinamik import'u
 * da statik olarak çözümlüyor ve modülü yine grafiğe alıyor. Modülün web
 * grafiğine HİÇ girmemesi için platform uzantılı dosya tek doğru çözüm.
 *
 * Web'de reklam göstermemek bilinçli: uygulama bir mobil ürün, web hedefi
 * yalnızca geliştirme ve görsel üretimi için var.
 */
import type { AdSlot } from '../../config/ads';

interface Props {
  slot: AdSlot;
  style?: object;
}

export function CheepBanner(_props: Props) {
  return null;
}
