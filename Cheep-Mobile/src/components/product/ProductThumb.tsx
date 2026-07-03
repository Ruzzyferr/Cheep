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
import { View, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { colors } from '../../theme';

// Devletin CDN'i (cdn.marketfiyati.org.tr) hotlink korumalı: tarayıcı User-Agent'ı
// olmayan istekleri 403'ler. RN Image'e bu header'ı geçince görsel yüklenir.
const IMG_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};

interface ProductThumbProps {
  imageUrl?: string | null;
  categoryName?: string | null;
  iconSize?: number;
}

export function ProductThumb({ imageUrl, categoryName, iconSize = 34 }: ProductThumbProps) {
  if (imageUrl) {
    return <Image source={{ uri: imageUrl, headers: IMG_HEADERS }} style={styles.image} />;
  }
  return (
    <View style={styles.placeholder}>
      <MaterialCommunityIcons
        name={getCategoryIcon(categoryName) as any}
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
