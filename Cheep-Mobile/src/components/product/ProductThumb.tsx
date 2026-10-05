/**
 * 🖼️ Product Thumbnail
 *
 * Devlet kataloğunda ürün görseli YOK (telif-güvenli mf- barkodları). Boş bir
 * kutu yerine, ürünün kategorisine göre DISTINCT bir ikonu yumuşak marka-tonlu
 * bir zemin üzerinde gösteririz — kart "bozuk/eksik" değil, tasarlanmış görünür.
 *
 * Parent, boyutlu bir kap (imageContainer) sağlar; bu bileşen onu %100 doldurur.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
// react-native'in `Image`i DEĞİL: o her görseli tam çözünürlükte çözüyor ve
// disk önbelleği yok. Katalog görselleri ~1000px; 96dp'lik bir hücrede
// çözüldüğünde her hücre birkaç MB bellek tutuyor ve 100+ ürün kaydıran
// kullanıcıda jank/OS sonlandırması üretiyordu. Ayrıca ekrana her dönüşte
// yeniden indiriliyordu. `expo-image` zaten bağımlılıktaydı ama hiçbir yerde
// kullanılmıyordu.
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { colors } from '../../theme';

// 5 Eki 2026 — KALDIRILDI: burada devletin CDN'ine (cdn.marketfiyati.org.tr)
// gonderilen SAHTE bir tarayici User-Agent'i vardi. O CDN hotlink korumali ve
// User-Agent'siz istekleri 403'luyor; yani bu baslik bilerek konulmus bir
// ERISIM KONTROLU ATLATMASIYDI. Market FiyatI verisiyle baglantimiz kesildi
// (bkz. docs/VERI-IZINLERI.md), uretimde tek bir urunun bile image_url'i yok,
// dolayisiyla bu kod hem islevsiz hem de hukuki olarak savunulamazdi.
// Gorsel adresi artik OLDUGU GIBI kullanilir; baslik eklenmez.

interface ProductThumbProps {
  imageUrl?: string | null;
  categoryName?: string | null;
  /** Dilden bağımsız kategori anahtarı; ad çevrildiği için simge buna bakar. */
  iconKey?: string | null;
  iconSize?: number;
}

export function ProductThumb({ imageUrl, categoryName, iconKey, iconSize = 34 }: ProductThumbProps) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        // Bellek + disk: aynı görsel ikinci kez indirilmez.
        cachePolicy="memory-disk"
        contentFit="contain"
        // Kısa geçiş, kart "birden zıplamış" gibi görünmesin.
        transition={120}
        // Görsel yüklenemezse (CDN 403 / ölü URL) kap boş kalır; kategori
        // ikonu zaten yalnızca imageUrl YOKKEN çiziliyor.
        recyclingKey={imageUrl}
      />
    );
  }
  return (
    <View style={styles.placeholder}>
      <MaterialCommunityIcons
        name={getCategoryIcon(categoryName, iconKey) as any}
        size={iconSize}
        color={colors.primary[600]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
  },
});
