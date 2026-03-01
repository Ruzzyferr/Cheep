"""
Kategori Mapping - Sıfırdan Oluşturuldu
Ürün analizi ile STANDARD_CATEGORIES'teki alt kategorilere eşleştirme
"""

from typing import Dict, List, Optional
import unicodedata
import re

# ============================================
# STANDARD CATEGORIES (Backend'den alındı)
# ============================================

STANDARD_CATEGORIES = {
    'meyve-sebze': {
        'name': 'Meyve & Sebze',
        'subcategories': ['Meyve', 'Sebze', 'Organik Meyve Sebze', 'Kuru Meyve', 'Kuru Sebze', 'Közlenmiş', 'İncir']
    },
    'et-tavuk-balik': {
        'name': 'Et, Tavuk, Balık',
        'subcategories': ['Kırmızı Et', 'Tavuk', 'Hindi', 'Balık', 'Deniz Ürünleri', 'Şarküteri', 'Salam', 'Sucuk', 'Dondurulmuş Et Ürünleri']
    },
    'sut-urunleri': {
        'name': 'Süt Ürünleri',
        'subcategories': ['Süt', 'Peynir', 'Yoğurt', 'Krema ve Kaymak', 'Tereyağı', 'Margarin', 'Ayran', 'Kefir', 'Sütlü Tatlılar', 'Dondurulmuş Süt Ürünleri']
    },
    'kahvaltilik': {
        'name': 'Kahvaltılık',
        'subcategories': ['Reçel', 'Bal', 'Zeytin', 'Tahin & Pekmez', 'Helva', 'Yumurta', 'Kahvaltılık Ezme', 'Kahvaltılık Sos', 'Kahvaltılık Gevrek', 'Müsli & Granola']
    },
    'temel-gida': {
        'name': 'Temel Gıda',
        'subcategories': ['Un', 'Şeker', 'Pirinç', 'Makarna', 'Bulgur', 'Bakliyat', 'Yağ', 'Sirke', 'Baharat', 'Salça', 'Hazır Çorba', 'İrmik', 'Erişte', 'Kakao', 'Kinoa', 'Amarant', 'Hardal', 'Vanilin', 'Chia', 'Otlar', 'Yemek Harçları']
    },
    'atistirmalik': {
        'name': 'Atıştırmalık',
        'subcategories': ['Çikolata', 'Bisküvi', 'Gofret', 'Kuruyemiş', 'Cips', 'Kraker', 'Şekerleme', 'Jelibon', 'Tahıllı Bar']
    },
    'hazir-yemek-donuk': {
        'name': 'Hazır Yemek & Donuk',
        'subcategories': ['Hazır Yemek', 'Dondurulmuş Gıda', 'Pizza', 'Hamburger & Köfte', 'Dondurulmuş Sebze', 'Dondurulmuş Meyve']
    },
    'firin-pastane': {
        'name': 'Fırın & Pastane',
        'subcategories': ['Ekmek', 'Simit', 'Poğaça', 'Börek', 'Pasta', 'Kek', 'Bisküvi', 'Çörek', 'Ramazan Pidesi', 'Kruvasan']
    },
    'icecek': {
        'name': 'İçecek',
        'subcategories': ['Su', 'Meyve Suyu', 'Gazlı İçecek', 'Çay', 'Kahve', 'Enerji İçeceği', 'Bitki Çayı', 'Alkolsüz Bira', 'Boza', 'Malt İçeceği']
    },
    'saglikli-yasam': {
        'name': 'Sağlıklı Yaşam',
        'subcategories': ['Vitamin & Takviye', 'Organik Ürünler', 'Glutensiz', 'Şekersiz', 'İlk Yardım']
    },
    'dondurma': {
        'name': 'Dondurma',
        'subcategories': ['Dondurma', 'Dondurma Çubuk', 'Donuk Tatlı']
    },
    'bebek': {
        'name': 'Bebek',
        'subcategories': ['Bebek Bezi', 'Bebek Maması', 'Bebek Bakım', 'Bebek Bezlenme']
    },
    'pet-shop': {
        'name': 'Pet Shop',
        'subcategories': ['Kedi Maması', 'Köpek Maması', 'Kuş Maması', 'Pet Aksesuar']
    },
    'temizlik': {
        'name': 'Temizlik',
        'subcategories': ['Bulaşık Deterjanı', 'Çamaşır Deterjanı', 'Yumuşatıcı', 'Yüzey Temizleyici', 'Tuvalet Temizleyici', 'Temizlik Malzemeleri', 'Çöp Torbası', 'Eldiven', 'Sünger & Bez', 'Bulaşık Parlatıcı', 'Bulaşık Makinesi Temizleyici', 'Bulaşık Teli', 'Leke Çıkarıcılar', 'Wc Blok', 'Tüy Toplayıcı Rulo', 'Kireç Önleyiciler', 'Kireç Sökücüler', 'Rezervuar Blok', 'Buzdolabı Kokuları', 'Otomatik Oda Kokuları']
    },
    'kisisel-bakim': {
        'name': 'Kişisel Bakım',
        'subcategories': ['Şampuan', 'Sabun', 'Diş Macunu', 'Diş Bakım', 'Deodorant', 'Cilt Bakım', 'Tıraş', 'Güneş Koruyucu', 'Tuvalet Kağıdı', 'Kağıt Havlu', 'Mendil', 'Peçete', 'Ruj', 'Allık', 'Fondöten', 'Maskara', 'Oje', 'Saç Boyaları', 'Ağda', 'Duş Jelleri', 'Kolonya', 'Tampon', 'Günlük Ped', 'Yara Bandı', 'Diş İpi', 'Pamuk', 'Tarak', 'Saç Renk Açıcı', 'Tüy Sarartıcı', 'Vazelin', 'Prezervatif', 'Kürdan', 'Takma Tırnak, Kirpik', 'Kapatıcı', 'Briyantin', 'Saç Fırçası', 'Saç Köpüğü', 'Yüz Serumu', 'Yüz Maskesi', 'Yüz Toniği', 'Duş Jeli', 'Bronzlaştırıcı', 'Maske', 'Emzik']
    },
    'elektronik': {
        'name': 'Elektronik',
        'subcategories': ['Telefon Aksesuarları', 'Bilgisayar', 'Ses Sistemleri', 'Taşınabilir Disk ve USB Bellek', 'Hoparlör', 'Foto & Kamera', 'Mouse', 'Klavye', 'Televizyon', 'Uydu Alıcılar']
    },
    'ev-yasam': {
        'name': 'Ev & Yaşam',
        'subcategories': ['Ev Tekstili', 'Mutfak Gereçleri', 'Banyo', 'Dekorasyon', 'Spor Ekipmanları', 'Pil', 'Ampul', 'Batteri', 'Elektrikli Isıtıcı', 'Terlik', 'Ütü', 'Kablolar', 'Sırt ve Kol Çantaları', 'Cam Sileceği', 'Kombi', 'Bahçe', 'Bahçe Mobilyaları', 'Derin Dondurucu', 'Vantilatörler', 'Hırdavat', 'Güvenlik', 'Mama Sandalyesi', 'Ayakkabı Bakım', 'Ayak Tabanlık', 'Tüp Boya', 'Klimalar', 'Blender', 'Plastik Kovalar', 'Kamping', 'Mikrodalga', 'Termosifon', 'Buzdolabı', 'Garnitür', 'Valizler', 'Masaüstü Gereçleri', 'Mandal']
    },
    'kitap-kirtasiye': {
        'name': 'Kitap & Kırtasiye',
        'subcategories': ['Kitap', 'Kırtasiye', 'Oyuncak', 'Puzzle', 'Eğitim', 'Dosyalama ve Arşivleme', 'Hobi-Eğlence', 'Edebiyat', 'Kalem Çeşitleri', 'Defterler']
    },
    'diger': {
        'name': 'Diğer',
        'subcategories': []
    },
}

# ============================================
# HELPER FUNCTIONS
# ============================================

TURKISH_CHAR_MAP = str.maketrans({
    'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g',
    'ç': 'c', 'Ç': 'c', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u',
    'â': 'a', 'Â': 'a', 'ê': 'e', 'Ê': 'e',
})


def normalize_text(text: str) -> str:
    """Metni normalize et (küçük harf, Türkçe karakterleri düzelt)"""
    if not text:
        return ""
    normalized = unicodedata.normalize('NFKD', text)
    normalized = ''.join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.translate(TURKISH_CHAR_MAP)
    normalized = normalized.lower()
    normalized = re.sub(r'[^a-z0-9\s]+', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized


def find_best_subcategory(raw_category: str, product_name: str = "") -> Optional[str]:
    """
    Raw kategori adına göre en uygun alt kategoriyi bul
    
    Args:
        raw_category: Market'ten gelen ham kategori adı (örn: "Patates, Soğan, Sarımsak")
        product_name: Ürün adı (opsiyonel, daha iyi eşleştirme için)
    
    Returns:
        En uygun alt kategori adı veya None
    """
    if not raw_category:
        return None
    
    raw_normalized = normalize_text(raw_category)
    product_normalized = normalize_text(product_name)
    
    best_match = None
    best_score = 0
    
    # Tüm alt kategorileri kontrol et
    for main_slug, main_info in STANDARD_CATEGORIES.items():
        subcategories = main_info.get('subcategories', [])
        
        for subcat in subcategories:
            subcat_normalized = normalize_text(subcat)
            score = 0
            
            # 1. Tam eşleşme (en yüksek skor)
            if subcat_normalized == raw_normalized:
                return subcat  # Direkt döndür
            
            # 2. Alt kategori kelimesi raw kategori içinde var mı?
            # ⚠️ DİKKAT: Yanlış eşleştirmeleri önle (örn: "Meyveli Sakızlar" → "Meyve" değil "Şekerleme")
            if subcat_normalized in raw_normalized:
                # Eğer raw kategori "meyveli" gibi bir kelime içeriyorsa, "meyve" ile eşleştirme yapma
                false_positive_patterns = {
                    'meyve': ['meyveli', 'meyve aromali', 'meyve pestili', 'meyve bar', 'meyve suyu', 'meyveli sakizlar', 'meyveli sakiz'],
                    'sut': ['sutlu', 'sut aromali', 'sutlu tatlilar'],
                }
                
                skip_this_match = False
                for keyword, patterns in false_positive_patterns.items():
                    if subcat_normalized == keyword:
                        for pattern in patterns:
                            if pattern in raw_normalized:
                                skip_this_match = True
                                break
                        if skip_this_match:
                            break
                
                if not skip_this_match:
                    score += 10
                    # Kelime uzunluğuna göre bonus
                    score += len(subcat_normalized) / 10
            
            # 3. Raw kategori kelimesi alt kategori içinde var mı?
            if raw_normalized in subcat_normalized:
                score += 5
            
            # 4. Kelime bazlı eşleşme
            raw_words = raw_normalized.split()
            subcat_words = subcat_normalized.split()
            
            # Ortak kelimeler
            common_words = set(raw_words) & set(subcat_words)
            if common_words:
                # Çok kısa kelimeleri atla (2 karakterden kısa)
                meaningful_words = [w for w in common_words if len(w) > 2]
                
                # Yanlış eşleştirmeleri önle: "meyveli sakizlar" ile "meyve" ortak kelimesi var ama eşleştirme yapma
                false_positive_words = {
                    'meyve': ['meyveli', 'meyve aromali', 'meyve pestili', 'meyve bar', 'meyve suyu', 'meyveli sakizlar', 'meyveli sakiz'],
                    'sut': ['sutlu', 'sut aromali', 'sutlu tatlilar'],
                }
                
                skip_word_match = False
                for keyword, patterns in false_positive_words.items():
                    if keyword in meaningful_words:
                        for pattern in patterns:
                            if pattern in raw_normalized:
                                skip_word_match = True
                                break
                        if skip_word_match:
                            break
                
                if not skip_word_match:
                    score += len(meaningful_words) * 3
            
            # 5. Ürün adında alt kategori kelimesi var mı?
            # ⚠️ DİKKAT: Sadece anlamlı eşleşmeler için (meyve aromalı ürünler meyve değildir!)
            if product_name:
                # Yanlış eşleştirmeleri önle
                false_positives = {
                    'meyve': ['meyveli', 'meyve aromali', 'meyve pestili', 'meyve bar', 'meyve suyu'],
                    'sut': ['sutlu', 'sut aromali'],
                }
                
                # Eğer ürün adında yanlış pozitif kelimeler varsa, eşleştirme yapma
                skip_match = False
                for keyword, false_positive_list in false_positives.items():
                    if subcat_normalized == keyword:
                        for fp in false_positive_list:
                            if fp in product_normalized:
                                skip_match = True
                                break
                        if skip_match:
                            break
                
                if not skip_match and subcat_normalized in product_normalized:
                    score += 2
            
            if score > best_score:
                best_score = score
                best_match = subcat
    
    # Minimum skor threshold
    if best_score >= 5:
        return best_match
    
    return None


def get_main_category_for_subcategory(subcategory: str) -> Optional[str]:
    """Alt kategori için ana kategoriyi bul"""
    for main_slug, main_info in STANDARD_CATEGORIES.items():
        if subcategory in main_info.get('subcategories', []):
            return main_info['name']
    return None


# ============================================
# CATEGORY MAPPING (Ürün analizi ile oluşturulacak)
# ============================================

CATEGORY_TO_SUBCATEGORY: Dict[str, str] = {
    'Acı Sos': 'Diğer',
    'Ahşap Yüzey Temizleyiciler': 'Yüzey Temizleyici',
    'Airfryer ve Fritöz': 'Diğer',
    'Aktif Yaşam Ürünleri': 'Un',
    'Alkolsüz Malt İçecek': 'Su',
    'Allık': 'Allık',
    'Amarant': 'Amarant',
    'Ampul ve Aydınlatma': 'Ampul',
    'Anaokulu Kreş Malzemeleri': 'Diğer',
    'Antep Fıstığı': 'Diğer',
    'Apiterapi & Propolis': 'Diğer',
    'Arap Sabunu': 'Sabun',
    'Aroma Şurupları': 'Su',
    'Aseton': 'Diğer',
    'Ateş Yakma ve Metal Parlatıcı': 'Diğer',
    'Ayak Bakımı': 'Diğer',
    'Ayak Kremi': 'Diğer',
    'Ayak Tabanlık': 'Ayak Tabanlık',
    'Ayakkabı': 'Ayakkabı Bakım',
    'Ayakkabı Bakım': 'Ayakkabı Bakım',
    'Ayakkabı Bakımı': 'Ayakkabı Bakım',
    'Ayran': 'Ayran',
    'Ayçicek Yağı': 'Yağ',
    'Ayıklanmış Sebzeler': 'Sebze',
    'Ağda': 'Ağda',
    'Ağda Bandı': 'Ağda',
    'Ağda Bezi': 'Ağda',
    'Ağda Makinesi': 'Ağda',
    'Ağda Malzemeleri': 'Ağda',
    'Ağda Sonrası Ürünler': 'Ağda',
    'Ağız Bakım Suyu': 'Su',
    'Badem': 'Diğer',
    'Baharat': 'Baharat',
    'Bahçe': 'Bahçe',
    'Bahçe Mobilyaları': 'Bahçe Mobilyaları',
    'Bakla': 'Diğer',
    'Bakım': 'Bebek Bakım',
    'Baldo Pirinç': 'Pirinç',
    'Ballar': 'Bal',
    'Balık': 'Balık',
    'Banyo Köpüğü': 'Banyo',
    'Banyo Sabunu': 'Banyo',
    'Banyo Set ve Aksesuarları': 'Banyo',
    'Bar ve Gofret': 'Gofret',  # Atıştırmalık alt kategorisi
    'Barbekü Sos': 'Diğer',
    'Barbunya': 'Un',
    'Bardak Poşet Çay': 'Çay',
    'Barlar': 'Diğer',
    'Baton Kek': 'Kek',
    'Battal': 'Diğer',
    'Bebek Arabası': 'Diğer',
    'Bebek Atıştırmalık': 'Diğer',
    'Bebek Ağız ve Diş Bakım': 'Diş Bakım',
    'Bebek Bakım': 'Bebek Bakım',
    'Bebek Bakım Gereçleri': 'Bebek Bakım',
    'Bebek Bakım Örtüsü': 'Bebek Bakım',
    'Bebek Banyo Süngeri': 'Banyo',
    'Bebek Beslenme Gereçleri': 'Diğer',
    'Bebek Bezi': 'Bebek Bezi',
    'Bebek Bezleri': 'Bebek Bezi',
    'Bebek Bisküvileri': 'Bisküvi',
    'Bebek Bulaşık Deterjanı': 'Bulaşık Deterjanı',
    'Bebek Ek Gıdalar': 'Diğer',
    'Bebek Giyim': 'Diğer',
    'Bebek Güneş Kremi': 'Güneş Koruyucu',  # Kişisel Bakım alt kategorisi
    'Bebek Islak Havlu': 'Diğer',
    'Bebek Kremi': 'Bebek Bakım',
    'Bebek Kulak Çubuğu': 'Diğer',
    'Bebek Maması': 'Bebek Maması',
    'Bebek Sabunu': 'Sabun',
    'Bebek Saç Kremi': 'Diğer',
    'Bebek Sıvı Çamaşır Deterjanı': 'Çamaşır Deterjanı',
    'Bebek Temizleme Pamuğu': 'Diğer',
    'Bebek Toz Çamaşır Deterjanı': 'Çamaşır Deterjanı',
    'Bebek Yatağı': 'Diğer',
    'Bebek Yağı': 'Yağ',
    'Bebek Yemek Gereçleri': 'Diğer',
    'Bebek ve Çocuk Giyim': 'Diğer',
    'Bebek Çamaşır Yumuşatıcı': 'Yumuşatıcı',
    'Bebek Çamaşır Yumuşatıcısı': 'Yumuşatıcı',
    'Bebek Çamaşırı Deterjanları': 'Diğer',
    'Bebek İçeceği': 'Diğer',
    'Bebek Şampuanı': 'Şampuan',
    'Beyaz Peynir': 'Peynir',
    'Beyaz Çikolata': 'Çikolata',
    'Beyazlatıcılar': 'Diğer',
    'Biber Salçası': 'Salça',
    'Biber Turşusu': 'Su',
    'Biberli Yeşil Zeytin': 'Zeytin',
    'Biberon': 'Diğer',
    'Bilgisayar ve Tablet Aksesuarları': 'Bilgisayar',
    'Bisiklet ve Aksesuarları': 'Su',
    'Bitki Çayı': 'Bitki Çayı',
    'Bitkisel Bakım Yağı': 'Yağ',
    'Bitter Çikolata': 'Çikolata',
    'Blender': 'Blender',
    'Boyalar ve Resim Malzemeleri': 'Diğer',
    'Boza': 'Boza',
    'Briyantin': 'Briyantin',
    'Bronzlaştırıcı': 'Bronzlaştırıcı',
    'Bulaşık Altlığı': 'Diğer',
    'Bulaşık Makinası Tuzu': 'Diğer',
    'Bulaşık Makinesi': 'Bulaşık Makinesi Temizleyici',
    'Bulaşık Makinesi Deterjanları': 'Bulaşık Makinesi Temizleyici',
    'Bulaşık Makinesi Kokusu': 'Su',
    'Bulaşık Makinesi Parlatıcısı': 'Bulaşık Makinesi Temizleyici',
    'Bulaşık Makinesi Tableti': 'Bulaşık Makinesi Temizleyici',
    'Bulaşık Makinesi Temizleyici': 'Bulaşık Makinesi Temizleyici',
    'Bulaşık Makinesi Tuzu': 'Bulaşık Makinesi Temizleyici',
    'Bulaşık Parlatıcı': 'Bulaşık Parlatıcı',
    'Bulaşık Süngeri': 'Sünger & Bez',  # Temizlik alt kategorisi
    'Bulaşık Teli': 'Bulaşık Teli',
    'Bulaşık Yıkama Ürünleri': 'Bulaşık Deterjanı',  # Temizlik alt kategorisi
    'Bulyon': 'Diğer',
    'Burun Bandı': 'Un',
    'Buzdolabı': 'Buzdolabı',
    'Buzdolabı Kokuları': 'Buzdolabı Kokuları',
    'Buğday': 'Diğer',
    'Büyük': 'Diğer',
    'Büyüme Küpü': 'Diğer',
    'Cam Bezi': 'Diğer',
    'Cam Temizleyiciler': 'Diğer',
    'Cep Telefonu Aksesuarları': 'Su',
    'Ceviz': 'Diğer',
    'Chia': 'Chia',
    'Cımbız': 'Diğer',
    'Dana': 'Diğer',
    'Dana Eti': 'Diğer',
    'Dana Füme': 'Diğer',
    'Dana Jambon': 'Diğer',
    'Dana Kavurma': 'Diğer',
    'Dana Pastırma': 'Diğer',
    'Dana Salam': 'Salam',
    'Dana Sosis': 'Diğer',
    'Dana Sucuk': 'Sucuk',
    'Defterler': 'Defterler',
    'Demlik Poşet Çay': 'Çay',
    'Deniz Üretim Balıkları': 'Balık',
    'Derin Dondurucu': 'Derin Dondurucu',
    'Deterjan Setleri': 'Diğer',
    'Devam Sütü': 'Süt',
    'Diğer Dondurulmuş Gıdalar': 'Dondurulmuş Gıda',
    'Diğer Et Şarküteri': 'Şarküteri',
    'Diğer Jambon': 'Diğer',
    'Diğer Kuru Meyveler': 'Kuru Meyve',
    'Diğer Oyun ve Oyuncaklar': 'Oyuncak',
    'Diğer Pastırma': 'Diğer',
    'Diğer Sakızlar': 'Diğer',
    'Diğer Salam': 'Salam',
    'Diğer Sağlık Ürünleri': 'Diğer',  # Genel kategori
    'Diş Fırçası': 'Diş Macunu',
    'Diş Macunları': 'Un',
    'Diş Macunu': 'Diş Macunu',
    'Diş Parlatıcı, Beyazlatma': 'Diğer',
    'Diş İpi': 'Diş İpi',
    'Domates Salçası': 'Salça',
    'Domates Ürünleri': 'Un',
    'Donanım': 'Diğer',
    'Dondurulmuş Deniz Ürünleri': 'Deniz Ürünleri',
    'Dondurulmuş Et': 'Dondurulmuş Et Ürünleri',
    'Dondurulmuş Hamur Ürünleri': 'Un',
    'Dondurulmuş Kırmızı Et': 'Kırmızı Et',
    'Dondurulmuş Midye': 'Diğer',
    'Dondurulmuş Patates': 'Diğer',
    'Dondurulmuş Pizza': 'Pizza',
    'Dondurulmuş Sebze': 'Dondurulmuş Sebze',
    'Dondurulmuş Tatlı': 'Diğer',
    'Dosyalama ve Arşivleme': 'Dosyalama ve Arşivleme',
    'Doğranmış, Ayıklanmış Sebzeler': 'Sebze',
    'Draje Şeker': 'Şekerleme',  # Atıştırmalık alt kategorisi (Pastil, draje şekerler)
    'Dudak Kremi': 'Diğer',
    'Duş Jeli': 'Duş Jeli',
    'Duş Jelleri': 'Duş Jelleri',
    'Dökme Çay': 'Çay',
    'Edebiyat': 'Edebiyat',
    'Egzotik Meyveler': 'Meyve',
    'Egzotik Sebzeler': 'Sebze',
    'El Bakım Ürünleri': 'Cilt Bakım',  # Kişisel Bakım alt kategorisi
    'El ve Vücut Kremi': 'Diğer',
    'El, Yüz Sabunu': 'Sabun',
    'Elbise Askısı': 'Diğer',
    'Eldiven': 'Eldiven',
    'Elektrikli Diş Fırçaları': 'Diğer',
    'Elektrikli Isıtıcı': 'Elektrikli Isıtıcı',
    'Elektrikli Scooter': 'Diğer',
    'Emzik': 'Emzik',
    'Enerji İçeceği': 'Enerji İçeceği',
    'Erişte': 'Erişte',
    'Erkek Deodorant': 'Deodorant',
    'Erkek Parfüm': 'Kek',
    'Erkek Saç Boyası': 'Kek',
    'Eski Kaşar': 'Diğer',
    'Esmer Şeker': 'Şeker',
    'Etli Mezeler': 'Diğer',
    'Ev Tekstili': 'Ev Tekstili',
    'Eyeliner, Göz Kalemi': 'Diğer',
    'Ezine Peyniri': 'Peynir',
    'Ezmeler': 'Diğer',
    'Eğitim': 'Eğitim',
    'Fasulye': 'Su',
    'Filtre Kahve': 'Kahve',
    'Fondöten': 'Fondöten',
    'Form Bisküvi': 'Bisküvi',
    'Form Çayı': 'Çay',
    'Foto & Kamera': 'Foto & Kamera',
    'Fındık': 'Diğer',
    'Fındık Ezmesi': 'Diğer',
    'Fındık Yağı': 'Yağ',
    'Fırın': 'Diğer',
    'Fıstık': 'Diğer',
    'Fıstık Ezmesi': 'Diğer',
    'Galeta Unu': 'Un',
    'Galeta, Grissini ve Gevrek': 'Diğer',
    'Garnitür': 'Garnitür',
    'Gazete ve Dergi': 'Diğer',
    'Gazoz': 'Diğer',
    'Geleneksel Sütlü Tatlılar': 'Çikolata',  # Atıştırmalık alt kategorisi
    'Giyim': 'Diğer',
    'Glutensiz  Ürünler': 'Glutensiz',
    'Granola': 'Müsli & Granola',
    'Granül Kahve': 'Kahve',
    'Göz Farı': 'Diğer',
    'Göz Makyaj Temizleyici': 'Diğer',
    'Göz Makyajı Ürünleri': 'Maskara',  # Kişisel Bakım alt kategorisi (Maskara, göz farı, vb.)
    'Göğüs Koruyucular': 'Diğer',
    'Güneş Kremi ve Losyonu': 'Güneş Koruyucu',  # Kişisel Bakım alt kategorisi
    'Güneş Kremi, Losyonu': 'Güneş Koruyucu',  # Kişisel Bakım alt kategorisi
    'Güneş Sonrası Ürünler': 'Güneş Koruyucu',  # Kişisel Bakım alt kategorisi
    'Güneş Yağı': 'Yağ',
    'Günlük Ped': 'Günlük Ped',  # Kişisel Bakım alt kategorisi
    'Günlük Süt': 'Süt',
    'Güvenlik': 'Güvenlik',
    'Halı Şampuanları': 'Şampuan',
    'Hamile Ve Emziren Anne Besin': 'Diğer',
    'Hardal': 'Hardal',
    'Hasta Bakım Ürünleri': 'İlk Yardım',  # Sağlıklı Yaşam alt kategorisi
    'Hasta Bezi': 'Diğer',
    'Hava Temizleme Makinası': 'Diğer',
    'Havuz ve Su Sporları': 'Su',
    'Hazır Deniz Ürünleri': 'Deniz Ürünleri',
    'Hazır Kahve': 'Kahve',
    'Hazır Yemekler': 'Hazır Yemek',
    'Hazır Ürünler': 'Un',
    'Haşere  Öldürücü Makineler, Likitleri': 'Diğer',
    'Haşlanmış': 'Diğer',
    'Helva': 'Helva',
    'Hindi': 'Hindi',
    'Hindi Füme': 'Hindi',
    'Hindi Jambon': 'Hindi',
    'Hindi Salam': 'Hindi',
    'Hindi Sosis': 'Hindi',
    'Hindi Sucuk': 'Hindi',
    'Hobi-Eğlence': 'Hobi-Eğlence',
    'Hoparlör': 'Hoparlör',
    'Hurma': 'Diğer',
    'Hırdavat': 'Hırdavat',
    'Hırdavat, Aydınlatma': 'Hırdavat',
    'Islak Mendil': 'Mendil',
    'Isı Bandı': 'Diğer',
    'Jel Bulaşık Deterjanı': 'Bulaşık Deterjanı',
    'Jel Çamaşır Suyu': 'Su',
    'Jumbo': 'Diğer',
    'Kablolar': 'Kablolar',
    'Kablolar, Çoklu Priz ve Aksesuar': 'Kablolar',
    'Kabuklu Fıstık': 'Diğer',
    'Kabuklu Kuruyemiş': 'Kuruyemiş',
    'Kadın Deodorant': 'Deodorant',
    'Kadın Parfüm': 'Diğer',
    'Kadın Tıraş Bıçakları': 'Tıraş',
    'Kadın Tıraş Ürünleri': 'Tıraş',
    'Kahvaltılık Gevrek': 'Kahvaltılık Gevrek',
    'Kahvaltılık Sos': 'Kahvaltılık Sos',
    'Kahve': 'Kahve',
    'Kahve Filtresi': 'Kahve',
    'Kahve Kreması': 'Kahve',
    'Kahve Makinesi': 'Kahve',
    'Kahve Şurubu': 'Kahve',
    'Kahveler, Kakaolar Dökme': 'Kahve',
    'Kaju': 'Diğer',
    'Kakao, Fındık Kremaları': 'Kakao',
    'Kalem Çeşitleri': 'Kalem Çeşitleri',
    'Kalemtıraş, Silgi, Düzeltici': 'Tıraş',
    'Kamera': 'Foto & Kamera',
    'Kamping': 'Kamping',
    'Kanola Yağı': 'Yağ',
    'Kap Dondurma': 'Dondurma',
    'Kapatıcı': 'Kapatıcı',
    'Kaplamalı Bisküvi': 'Bisküvi',
    'Kapsül Kahve': 'Kahve',
    'Karpuz ve Kavun': 'Un',
    'Karışık Kuruyemiş': 'Kuruyemiş',
    'Karışık Turşu': 'Su',
    'Kase Margarin': 'Margarin',
    'Katkılı Bulgur': 'Bulgur',
    'Katı Sabun': 'Sabun',
    'Kavanoz Mama': 'Diğer',
    'Kavun ve Karpuz': 'Un',
    'Kavurma': 'Diğer',
    'Kayganlaştırıcı': 'Diğer',
    'Kayganlaştırıcı Jel': 'Diğer',
    'Kaymak': 'Krema ve Kaymak',
    'Kaymaklı Yoğurt': 'Yoğurt',
    'Kayısı': 'Diğer',
    'Kağıt Havlular': 'Kağıt Havlu',
    'Kağıt Mendil': 'Mendil',
    'Kaşar Peynir': 'Peynir',
    'Kaşık Maması': 'Diğer',
    'Kedi Bakım Ürünleri': 'Tüy Toplayıcı Rulo',  # Temizlik alt kategorisi (tüy toplama rulosu, vb.)
    'Kedi Kumu': 'Diğer',
    'Kedi Maması': 'Kedi Maması',
    'Kedi Ödül Maması': 'Kedi Maması',
    'Kefir': 'Kefir',
    'Kek': 'Kek',
    'Kek ve Kruvasan': 'Kruvasan',
    'Kepekli Pirinç': 'Pirinç',
    'Keten Tohumu': 'Diğer',
    'Ketçap': 'Diğer',
    'Keçi Peyniri': 'Peynir',
    'Kinoa': 'Kinoa',
    'Kireç Sökücüler': 'Kireç Sökücüler',
    'Kireç Önleyici': 'Kireç Önleyiciler',
    'Kireç Önleyiciler': 'Kireç Önleyiciler',
    'Kitap': 'Kitap',
    'Klasik Diş Fırçaları': 'Diğer',
    'Klasik Çamaşır Suyu': 'Su',
    'Klasik Çamaşır Yumuşatıcıları': 'Yumuşatıcı',
    'Klavye': 'Klavye',
    'Klimalar': 'Klimalar',
    'Kokteyl Yeşil Zeytin': 'Zeytin',
    'Kokulu Mum, Jel, Tütsü': 'Su',
    'Kola': 'Çikolata',
    'Kolonya': 'Kolonya',
    'Kolonyalar': 'Kolonya',
    'Kombi': 'Kombi',
    'Kondisyon Aletleri': 'Diğer',
    'Konsantre Çamaşır Yumuşatıcıları': 'Yumuşatıcı',
    'Konserve Bezelye': 'Diğer',
    'Konserve Deniz Ürünleri': 'Deniz Ürünleri',
    'Konserve Fasulye': 'Su',
    'Konserve Hindi': 'Hindi',
    'Konserve Mantar': 'Diğer',
    'Konserve Mısır': 'Diğer',
    'Konserve Sebze': 'Sebze',
    'Koyun Peyniri': 'Peynir',
    'Kraker': 'Kraker',
    'Krem Peynir': 'Peynir',
    'Krem Çikolata': 'Çikolata',
    'Krema': 'Krema ve Kaymak',
    'Krema ve Sos': 'Diğer',
    'Krema, Ezmeler': 'Diğer',
    'Kremalı Bisküviler': 'Bisküvi',
    'Kruvasan': 'Kruvasan',
    'Kulak Çubuğu': 'Diğer',
    'Kullan At Tıraş Bıçakları': 'Tıraş',
    'Kullan At Tıraş Bıçağı': 'Tıraş',
    'Kullan At Ürünler': 'Un',
    'Kuru Et': 'Diğer',
    'Kuru Üzüm': 'Diğer',
    'Kuru Şampuan': 'Şampuan',
    'Kurutma Makinesi': 'Diğer',
    'Kuruyemiş Bar': 'Kuruyemiş',
    'Kutlama Ürünleri': 'Dekorasyon',  # Ev & Yaşam alt kategorisi (doğum günü mumları, süslemeler, vb.)
    'Kuzu': 'Diğer',
    'Kuzu Eti': 'Diğer',
    'Kuzu Füme': 'Diğer',
    'Kuş Aksesuarları': 'Su',
    'Kuş Yemi': 'Diğer',
    'Köftelik Bulgur': 'Bulgur',
    'Köpek Aksesuarları': 'Su',
    'Köpek Bakım Ürünleri': 'Tüy Toplayıcı Rulo',  # Temizlik alt kategorisi (tüy toplama rulosu, şampuan, vb.) - ürün adına göre akıllı eşleştirme yapılacak
    'Köpek Maması': 'Köpek Maması',
    'Köpek Ödül Maması': 'Köpek Maması',
    'Közlenmiş': 'Közlenmiş',
    'Külot Bebek Bezi': 'Bebek Bezi',
    'Külot Bez': 'Diğer',
    'Küp Şeker': 'Şeker',
    'Kürdan': 'Kürdan',
    'Kırmızı Et Diğer': 'Kırmızı Et',
    'Kırmızı Mercimek': 'Diğer',
    'Kırık Pirinç': 'Pirinç',
    'Laktozsuz Süt': 'Süt',
    'Lavabo Açıcı': 'Diğer',
    'Lavabo Açıcılar': 'Diğer',
    'Lavabo Pompası': 'Diğer',
    'Leblebi': 'Diğer',
    'Leke Çıkarıcılar': 'Leke Çıkarıcılar',
    'Lezzetlendirici Sos': 'Diğer',
    'Lif, Sünger, Setler': 'Sünger & Bez',  # Temizlik alt kategorisi
    'Likid Temizleyiciler': 'Diğer',
    'Limon Sosu': 'Su',
    'Limonata': 'Diğer',
    'Lokum': 'Diğer',
    'Maden Suyu': 'Su',
    'Makarna': 'Makarna',
    'Makarna Sosu': 'Salça',  # Temel Gıda alt kategorisi (makarna sosları salça kategorisinde)
    'Makyaj Bakımı': 'Diğer',
    'Makyaj Bazı': 'Diğer',
    'Makyaj Seti': 'Diğer',
    'Makyaj Temizleme Mendili': 'Mendil',
    'Makyaj Temizleme Pamuğu': 'Diğer',
    'Makyaj Temizleme Suyu': 'Su',
    'Makyaj Temizleyici': 'Diğer',
    'Makyaj Çantası': 'Diğer',
    'Malt İçeceği': 'Malt İçeceği',
    'Mama Sandalyesi': 'Mama Sandalyesi',
    'Mandal': 'Mandal',
    'Mangal Ürünleri': 'Diğer',  # Ev & Yaşam kategorisi (mangal kömürü, vb.)
    'Manikür Pedikür': 'Diğer',
    'Mantar': 'Diğer',
    'Mantı,Yufka,Tarhana': 'Diğer',
    'Masaüstü Gereçleri': 'Masaüstü Gereçleri',
    'Maskara': 'Maskara',
    'Maske': 'Maske',
    'Mayonez': 'Diğer',
    'Mevsim Balıkları': 'Balık',
    'Mevsim Sebzeleri': 'Sebze',
    'Meyve Bar': 'Tahıllı Bar',  # Atıştırmalık alt kategorisi
    'Meyve Pestili': 'Tahıllı Bar',  # Atıştırmalık alt kategorisi
    'Meyve Suyu': 'Meyve Suyu',
    'Meyveli Maden Suyu': 'Meyve Suyu',  # İçecek alt kategorisi
    'Meyveli Sakızlar': 'Şekerleme',  # Atıştırmalık alt kategorisi
    'Meyveli Yoğurt': 'Yoğurt',
    'Mikrodalga': 'Mikrodalga',
    'Mikrofiber Bez': 'Diğer',
    'Mini': 'Diğer',
    'Mini Kek': 'Kek',
    'Mop, Paspas ve Yedekleri': 'Diğer',
    'Mouse': 'Mouse',
    'Multipack Dondurma': 'Dondurma',
    'Mutfak Aletleri': 'Diğer',
    'Mutfak Robotu': 'Diğer',
    'Mutfak Temizleyicileri': 'Diğer',
    'Mutfak ve Banyo Temizleyiciler': 'Banyo',
    'Mutfak Ürünleri': 'Mutfak Gereçleri',  # Ev & Yaşam alt kategorisi
    'Müsli': 'Müsli & Granola',
    'Mısır': 'Diğer',
    'Mısır Cipsi': 'Cips',
    'Mısır Gevreği': 'Diğer',
    'Mısır Unu': 'Un',
    'Naneli Sakızlar': 'Şekerleme',  # Atıştırmalık alt kategorisi
    'Nar Ekşisi': 'Diğer',
    'Narenciye': 'Diğer',
    'Nemlendirici Krem': 'Diğer',
    'Nohut': 'Diğer',
    'Nohut Cipsi': 'Cips',
    'Oda Kokusu': 'Su',
    'Oda Kokusu ve Koku Gidericiler': 'Su',
    'Oje': 'Oje',
    'Organik Saç Bakım': 'Diğer',
    'Organik yumurta': 'Yumurta',
    'Organik Ürünler': 'Organik Ürünler',
    'Orta': 'Diğer',
    'Osmancık Pirinç': 'Pirinç',
    'Otlar': 'Otlar',
    'Otlar, Yeşillikler': 'Otlar',
    'Oto Lastikleri': 'Diğer',
    'Otomatik Oda Kokuları': 'Otomatik Oda Kokuları',
    'Oyuncak ve Oyunlar': 'Oyuncak',
    'Paket Margarin': 'Margarin',
    'Paketli Deniz Ürünleri': 'Deniz Ürünleri',
    'Paketli Ekmekler': 'Ekmek',
    'Paketli Kurabiyeler': 'Diğer',
    'Paketli Sandviç': 'Diğer',
    'Pamuk': 'Pamuk',
    'Pamuklar': 'Pamuk',
    'Parlatıcı, Temizleyici': 'Diğer',
    'Pastalar': 'Pasta',
    'Pastörize ve Çiğ Süt': 'Süt',
    'Pastırma': 'Diğer',
    'Patates Cipsi': 'Cips',
    'Patates, Soğan ve Sarımsak': 'Diğer',
    'Patates, Soğan, Sarımsak': 'Diğer',
    'Pekmez': 'Tahin & Pekmez',
    'Petibör Bisküvi': 'Bisküvi',
    'Peçete': 'Peçete',
    'Pilavlık Bulgur': 'Bulgur',
    'Pilavlık Pirinç': 'Pirinç',
    'Piliç': 'Tavuk',  # Et, Tavuk, Balık alt kategorisi
    'Piliç Füme': 'Tavuk',
    'Piliç Jambon': 'Tavuk',
    'Piliç Sosis': 'Tavuk',
    'Piliç Sucuk': 'Sucuk',  # Şarküteri alt kategorisi
    'Pişik Kremi': 'Diğer',
    'Pişmeye Hazır Kırmızı Et': 'Kırmızı Et',
    'Plaj Çantası': 'Diğer',
    'Plastik Kovalar': 'Plastik Kovalar',
    'Poşet Çaylar': 'Çay',
    'Prezervatif': 'Prezervatif',
    'Prezervatifler': 'Prezervatif',
    'Puding': 'Sütlü Tatlılar',
    'Puzzle': 'Puzzle',
    'Quark Peyniri': 'Peynir',
    'Ramazan Pidesi': 'Ramazan Pidesi',
    'Renk Koruyucu Mendil': 'Mendil',
    'Renkli Saç Boyası': 'Diğer',
    'Rezervuar Blok': 'Rezervuar Blok',
    'Reçel': 'Reçel',
    'Riviera Zeytinyağı': 'Zeytin',
    'Ruj': 'Ruj',
    'Sade Maden Suyu': 'Su',
    'Sade Un': 'Un',
    'Sade Yoğurt': 'Yoğurt',
    'Sakatat': 'Diğer',
    'Salam': 'Salam',
    'Salata Malzemeleri': 'Diğer',
    'Salatalar ve Ezmeler': 'Diğer',
    'Salatalık Turşusu': 'Su',
    'Sarma Şeker': 'Şeker',
    'Sarı Mercimek': 'Diğer',
    'Saç Boyaları': 'Saç Boyaları',
    'Saç Boyama Seti': 'Diğer',
    'Saç Fırçası': 'Saç Fırçası',
    'Saç Jölesi': 'Diğer',
    'Saç Kremi': 'Diğer',
    'Saç Köpüğü': 'Saç Köpüğü',
    'Saç Onarıcı ve Güçlendirici': 'Diğer',
    'Saç Onarıcılar': 'Diğer',
    'Saç Renk Açıcı': 'Saç Renk Açıcı',
    'Saç Spreyi': 'Diğer',
    'Sağlık Ürünleri': 'Un',
    'Sert Meyveler': 'Meyve',
    'Set Boya': 'Diğer',
    'Seyahat Aksesuarları': 'Su',
    'Simit, Poğaça, Börek': 'Poğaça',
    'Sinek Kovucu': 'Diğer',
    'Sirke': 'Sirke',
    'Siyah Zeytin': 'Zeytin',
    'Siyah Zeytin Ezmesi': 'Zeytin',
    'Siyah Çay': 'Çay',
    'Sosis': 'Diğer',
    'Soslu Fıstık': 'Diğer',
    'Soslu Kuruyemiş': 'Kuruyemiş',
    'Soslu Mısır': 'Diğer',
    'Soya Sosu': 'Su',
    'Soğuk Kahve': 'Kahve',
    'Soğuk Çay': 'Çay',
    'Sporcu Takviyeleri': 'Diğer',
    'Sporcu İçecekleri': 'Diğer',
    'Sprey Oda Kokuları': 'Otomatik Oda Kokuları',
    'Su': 'Su',
    'Su Isıtıcı-Kettle': 'Su',
    'Sucuk': 'Sucuk',
    'Suluk ve Matara': 'Su',
    'Süpürge': 'Su',
    'Süt Tozu': 'Süt',
    # 'Sütlü Tatlılar' için özel işleme yapılacak (ürün adına göre)
    'Sütlü Çikolata': 'Çikolata',
    'Süzme Peynir': 'Peynir',
    'Süzme, Çeşnili Yoğurt': 'Yoğurt',
    'Sıcak Çikolata ve Salep': 'Çikolata',
    'Sıcak Çikolata, Salep ve Boza': 'Çikolata',
    'Sırt ve Kol Çantaları': 'Sırt ve Kol Çantaları',
    'Sıvı Bulaşık Deterjanı': 'Bulaşık Deterjanı',
    'Sıvı Sabun': 'Sabun',
    'Sıvı Yüzey Temizleyiciler': 'Yüzey Temizleyici',
    'Sıvı Çamaşır Deterjanları': 'Çamaşır Deterjanı',
    'Sıvı Çamaşır Deterjanı': 'Çamaşır Deterjanı',
    'Sızma Zeytinyağı': 'Zeytin',
    'Tablet': 'Diğer',
    'Tahin': 'Tahin & Pekmez',
    'Tahıllı Bar': 'Tahıllı Bar',
    'Tahıllı Bisküvi': 'Bisküvi',
    'Takma Tırnak, Kirpik': 'Takma Tırnak, Kirpik',
    'Takviye Edici Gıda': 'Diğer',
    'Tampon': 'Tampon',
    'Tarak': 'Tarak',
    'Tatlandırıcılar & Tatlandırıcılı Ürünler': 'Şekersiz',  # Sağlıklı Yaşam alt kategorisi
    'Tatlı Çörekler': 'Çörek',
    'Tatlı&Tuzlu Kurabiyeler': 'Diğer',
    'Taze Ekmekler': 'Ekmek',
    'Taze Kaşar': 'Diğer',
    'Taşınabilir Disk ve USB Bellek': 'Taşınabilir Disk ve USB Bellek',
    'Tek Dondurma': 'Dondurma',
    'Televizyon': 'Televizyon',
    'Televizyon Aksesuarı': 'Televizyon',
    'Televizyon Askı Aparatı': 'Televizyon',
    'Temizlik Bezleri': 'Diğer',
    'Temizlik Fırçası': 'Diğer',
    'Temizlik Havlusu': 'Su',
    'Temizlik Seti': 'Diğer',
    'Tereyağ': 'Yağ',
    'Tereyağı': 'Tereyağı',
    'Terlik': 'Terlik',
    'Termosifon': 'Termosifon',
    'Toka': 'Diğer',
    'Ton Balığı': 'Bal',
    'Tonik': 'Diğer',
    'Tonik Suyu': 'Su',
    'Tost Makinesi': 'Diğer',
    'Toz Deterjan': 'Diğer',
    'Toz Çamaşır Deterjanları': 'Çamaşır Deterjanı',
    'Toz İçecek': 'Diğer',
    'Toz Şeker': 'Şeker',
    'Tropik Meyveler': 'Meyve',
    'Tulum Peynir': 'Peynir',
    'Tulum Peyniri': 'Peynir',
    'Tuvalet Kağıtları': 'Tuvalet Kağıdı',
    'Tuvalet Kokusu': 'Su',
    'Tuvalet Temizleyicisi': 'Tuvalet Temizleyici',
    'Tuz': 'Diğer',
    'Tül Beyazlatıcılar': 'Diğer',
    'Tüp Boya': 'Tüp Boya',
    'Türk Kahvesi': 'Kahve',
    'Tüy Dökücü Krem': 'Diğer',
    'Tüy Dökücü Ürünler': 'Ağda',  # Kişisel Bakım alt kategorisi
    'Tüy Sarartıcı': 'Tüy Sarartıcı',
    'Tüy Toplayıcı Rulo': 'Tüy Toplayıcı Rulo',
    'Tıraş Bıçağı': 'Tıraş',
    'Tıraş Jeli': 'Tıraş',
    'Tıraş Kolonyası': 'Tıraş',
    'Tıraş Kremi': 'Tıraş',
    'Tıraş Köpükleri': 'Tıraş',
    'Tıraş Köpüğü': 'Tıraş',
    'Tıraş Losyonu': 'Tıraş',
    'Tıraş Makinaları': 'Tıraş',
    'Tıraş Makineleri': 'Tıraş',
    'Tıraş Sabunu': 'Tıraş',
    'Tıraş Sonrası Ürünler': 'Tıraş',
    'Ultra Ped': 'Diğer',
    'Ultra Pedler': 'Diğer',
    'Un Karışımı': 'Un',
    'Uydu Alıcılar': 'Uydu Alıcılar',
    'Uzun Ömürlü Süt': 'Süt',
    'Valizler': 'Valizler',
    'Vantilatörler': 'Vantilatörler',
    'Vazelin': 'Vazelin',
    'Vücut Bakım Ürünleri': 'Cilt Bakım',  # Kişisel Bakım alt kategorisi
    'Vücut Losyonu': 'Diğer',
    'Vücut Spreyi': 'Diğer',
    'Vücut Sıkılaştırıcı': 'Diğer',
    'Vücut Yağı': 'Yağ',
    'Wax': 'Diğer',
    'Wc Blok': 'Wc Blok',
    'Yabancı Yöresel Peynir': 'Peynir',
    'Yapışkanlı Askı': 'Diğer',
    'Yapıştırıcı ve Etiketler': 'Diğer',
    'Yara Bandı': 'Yara Bandı',
    'Yarı Set Boya': 'Diğer',
    'Yağ Çözücü': 'Yağ',
    'Yaşlanma Karşıtı Krem': 'Diğer',
    'Yedek Sıvı Sabun': 'Sabun',
    'Yedek Tıraş Bıçakları': 'Tıraş',
    'Yemek Harçları': 'Yemek Harçları',
    'Yer Bezi': 'Diğer',
    'Yerli Yöresel Peynir': 'Peynir',
    'Yetiştirme Kiti': 'Diğer',
    'Yeşil Mercimek': 'Diğer',
    'Yeşil Zeytin': 'Zeytin',
    'Yeşil Zeytin Ezmesi': 'Zeytin',
    'Yeşillikler': 'Diğer',
    'Yoğurt Mayası': 'Yoğurt',
    'Yumurta': 'Yumurta',
    'Yumuşak Meyveler': 'Meyve',
    'Yumuşak Şeker,Marşmelov': 'Şekerleme',  # Atıştırmalık alt kategorisi
    'Yöresel Peynir': 'Peynir',
    'Yüz Bakım Ürünleri': 'Cilt Bakım',  # Kişisel Bakım alt kategorisi
    'Yüz Maskesi': 'Yüz Maskesi',
    'Yüz Serumu': 'Yüz Serumu',
    'Yüz Temizleme Jelleri, Kremleri': 'Diğer',
    'Yüz Toniği': 'Yüz Toniği',
    'Yüzey Temizleyicileri': 'Yüzey Temizleyici',
    'Yüzey Temizlik Havlusu': 'Su',
    'Zeytin Ezmeleri': 'Zeytin',
    'Zeytinyağlı Mezeler': 'Zeytin',
    'Çam Balı': 'Bal',
    'Çamaşır Kokuları': 'Diğer',
    'Çamaşır Kurutmalık': 'Diğer',
    'Çamaşır Makinesi': 'Diğer',
    'Çamaşır Makinesi Tableti': 'Çamaşır Deterjanı',
    'Çamaşır Suyu': 'Su',
    'Çamaşır Yumuşatıcıları': 'Yumuşatıcı',
    'Çamaşır ve Kirli Sepeti': 'Diğer',
    'Çamaşır İpi': 'Diğer',
    'Çay Makinesi': 'Çay',
    'Çekirdek': 'Diğer',
    'Çekirdek Kahve': 'Kahve',
    'Çicek Balı': 'Bal',
    'Çikolata Bar': 'Çikolata',
    'Çizik Yeşil Zeytin': 'Zeytin',
    'Çiğköfte': 'Diğer',
    'Çocuk Diş Bakımı': 'Diş Bakım',
    'Çocuk Diş Fırçası': 'Diğer',
    'Çocuk Diş Macunu': 'Diş Macunu',
    'Çorba': 'Hazır Çorba',
    'Çöp Poşeti': 'Çöp Torbası',
    'Özel Bakliyat': 'Bakliyat',
    'Özel Bal': 'Bal',
    'Özel Beslenme Yoğurtları': 'Yoğurt',
    'Özel Beslenme Ürünleri': 'Şekersiz',  # Sağlıklı Yaşam alt kategorisi (Tatlandırıcılar için)
    'Özel Paketler': 'Diğer',
    'Özel Salata Sosu': 'Su',
    'Özel Sıvı Yağ': 'Yağ',
    'Özel Turşu': 'Su',
    'Özel Yeşil Zeytin': 'Zeytin',
    'Özel Zeytinyağı': 'Zeytin',
    'Ütü': 'Ütü',
    'Ütü Masası': 'Ütü',
    'Ütü Masası Kılıfı ve Askısı': 'Ütü',
    'Üçgen & Burger Peynir': 'Peynir',
    'Üçgen Peynir': 'Peynir',
    'İlk Yardım': 'İlk Yardım',
    'İncir': 'İncir',
    'İnek Peyniri': 'Peynir',
    'İthal Bisküvi': 'Bisküvi',
    'İthal Cips': 'Cips',
    'İthal Kek': 'Kek',
    'İthal Peynir': 'Peynir',
    'İthal Pirinç': 'Pirinç',
    'İthal Şeker': 'Şeker',
    'Şalgam Suyu': 'Su',
    'Şampuan': 'Şampuan',
    'Şarj Aleti ve Şarj Kablosu': 'Su',
    'Şekersiz Sakızlar': 'Şekersiz',
    'Şerbetli Tatlı': 'Diğer',
}


def normalize_category_name(raw_category: str, product_name: str = "") -> str:
    """
    Raw kategori adını standart alt kategoriye çevir
    
    Args:
        raw_category: Market'ten gelen ham kategori adı
        product_name: Ürün adı (opsiyonel)
    
    Returns:
        Standart alt kategori adı
    """
    if not raw_category:
        return 'Diğer'
    
    # Özel durumlar: Ürün adına göre akıllı eşleştirme
    product_normalized = normalize_text(product_name) if product_name else ""
    
    # "Sütlü Tatlılar" için özel mantık
    if raw_category == 'Sütlü Tatlılar':
        # Eğer ürün adında "helva" geçiyorsa → Helva (Kahvaltılık)
        if 'helva' in product_normalized:
            return 'Helva'
        # Diğer sütlü tatlılar (kazandibi, tavuk göğsü, profiterol, sütlaç, muhallebi, vs.) → Sütlü Tatlılar (Süt Ürünleri)
        return 'Sütlü Tatlılar'
    
    # "Meyveli Maden Suyu" için özel mantık - ürün adına göre daha akıllı eşleştirme
    if raw_category == 'Meyveli Maden Suyu':
        # Eğer ürün adında "frutti", "meyve suyu", "ice tea" gibi kelimeler varsa → Meyve Suyu
        if any(word in product_normalized for word in ['frutti', 'meyve suyu', 'ice tea', 'sparkling']):
            return 'Meyve Suyu'
        # Diğer meyveli maden suları → Meyve Suyu
        return 'Meyve Suyu'
    
    # "Özel Beslenme Ürünleri" için özel mantık - ürün adına göre akıllı eşleştirme
    if raw_category == 'Özel Beslenme Ürünleri':
        # Tatlandırıcılar → Şekersiz
        if any(word in product_normalized for word in ['tatlandirici', 'tatlandırıcı', 'stevia', 'huxol', 'takita']):
            return 'Şekersiz'
        # Bakliyat (organik mercimek, nohut, vb.) → Bakliyat
        if any(word in product_normalized for word in ['mercimek', 'nohut', 'fasulye', 'barbunya', 'bakliyat']):
            return 'Bakliyat'
        # Diğer özel beslenme ürünleri → Şekersiz (varsayılan)
        return 'Şekersiz'
    
    # "Kedi Bakım Ürünleri" ve "Köpek Bakım Ürünleri" için özel mantık
    if raw_category in ['Kedi Bakım Ürünleri', 'Köpek Bakım Ürünleri']:
        # Tüy toplama rulosu → Tüy Toplayıcı Rulo
        if any(word in product_normalized for word in ['tuy toplama', 'tüy toplama', 'tuy toplayici', 'tüy toplayıcı', 'rulo']):
            return 'Tüy Toplayıcı Rulo'
        # Şampuan → Diğer (Pet Shop kategorisi yok, şimdilik Diğer)
        if 'sampuan' in product_normalized or 'sampon' in product_normalized:
            return 'Diğer'
        # Diğer pet bakım ürünleri → Diğer
        return 'Diğer'
    
    # Önce mapping'de var mı kontrol et
    if raw_category in CATEGORY_TO_SUBCATEGORY:
        return CATEGORY_TO_SUBCATEGORY[raw_category]
    
    # Mapping'de yoksa, akıllı eşleştirme yap
    best_subcat = find_best_subcategory(raw_category, product_name)
    
    if best_subcat:
        # Mapping'e ekle (cache)
        CATEGORY_TO_SUBCATEGORY[raw_category] = best_subcat
        return best_subcat
    
    # Eşleşme bulunamadı, 'Diğer' döndür
    return 'Diğer'

