/**
 * 🏪 Store Logo Utility
 * Market logolarını assets klasöründen yükler
 */

// Market isimlerini asset dosyalarına map eden fonksiyon
export function getStoreLogoAsset(storeName: string | null | undefined): any {
  if (!storeName) return null;

  // Market ismini normalize et (küçük harf, boşlukları kaldır, özel karakterleri temizle)
  const normalizedName = storeName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');

  // Market isimlerine göre asset dosyalarını eşleştir
  const logoMap: Record<string, any> = {
    'migros': require('../../assets/images/TurkiyeCompanies/M-Migros.png'),
    'carrefour': require('../../assets/images/TurkiyeCompanies/carrefour.png'),
    'carrefoursa': require('../../assets/images/TurkiyeCompanies/carrefour.png'),
    'a101': null, // Henüz asset yok
    'sok': null, // Henüz asset yok
    'bim': null, // Henüz asset yok
  };

  // Tam eşleşme kontrolü
  if (logoMap[normalizedName]) {
    return logoMap[normalizedName];
  }

  // Kısmi eşleşme kontrolü
  for (const [key, asset] of Object.entries(logoMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return asset;
    }
  }

  return null;
}

// Market ismini logo asset'ine çevir (string olarak)
export function getStoreLogoSource(storeName: string | null | undefined): { uri?: string; source?: any } | null {
  const asset = getStoreLogoAsset(storeName);
  
  if (asset) {
    return { source: asset };
  }
  
  return null;
}


