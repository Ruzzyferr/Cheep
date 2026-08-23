/**
 * 📐 Ekran kenar boşlukları (güvenli alan + navigasyon çubukları)
 *
 * İki ayrı sorunu tek yerde çözüyor. İkisi de aynı hatadan doğuyor: cihazdan
 * cihaza değişen bir mesafeyi sabit sayıyla tahmin etmek.
 *
 * ALT — Tab bar FLOAT'tır: `position:absolute`, `height:72`,
 * `bottom:insets.bottom` (bkz. TabNavigator). Mutlak konumlu olduğu için React
 * Navigation ekranın altında yer AYIRMAZ; içerik tam yükseklikte çizilir ve son
 * `72 + insets.bottom` piksel çubuğun ARKASINDA kalır. Kaydırılabilir her ekran
 * bu boşluğu kendisi bırakmalı.
 *
 * `useBottomTabBarHeight()` yalnızca açık yüksekliği (72) döndürür, güvenli
 * alanı İÇERMEZ; üstelik sekme dışındaki ekranlarda (Asistan, Paywall, Destek,
 * giriş akışı) hata fırlatır. Buradaki kanca context'i okur: yoksa sekme
 * dışındayızdır ve yalnızca sistem çubuğu payı gerekir.
 *
 * ÜST — `headerShown:false` olan ekranlarda üst güvenli alanı da ekranın
 * kendisi bırakmak zorunda. Sabit `paddingTop: 32` çentikli iPhone'da (güvenli
 * alan 47–59) içeriği Dynamic Island'ın altına sokar, SE'de (20) fazla boşluk
 * bırakır. Header'ı olan ekranlarda buna gerek yok, navigatör hallediyor.
 */

import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

/**
 * Kaydırılabilir içeriğin altına bırakılacak toplam boşluk.
 *
 * @param extra Ekrana özel ek pay — sabit bir alt bar, FAB veya nefes payı.
 *              Varsayılan `spacing.lg`, son öğe çubuğa yapışık durmasın diye.
 */
export function useBottomSpacing(extra: number = spacing.lg): number {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  return (tabBarHeight ?? 0) + insets.bottom + extra;
}

/**
 * Ekranın altına sabitlenen bir öğenin (sticky bar, FAB) `bottom` değeri —
 * yani tab bar'ın hemen üstü. İçerik boşluğundan farklı: burada nefes payı
 * istemeyiz, öğe çubuğa dayansın.
 */
export function useStickyBottomOffset(extra = 0): number {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  return (tabBarHeight ?? 0) + insets.bottom + extra;
}

/**
 * `headerShown:false` ekranlarda üst boşluk: durum çubuğu/çentik + nefes payı.
 *
 * @param extra Güvenli alanın üstüne eklenecek görsel pay.
 */
export function useTopSpacing(extra: number = spacing.md): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}
