import React from 'react';
import { StyleSheet, View, ScrollView, TextInput, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from '@/components/themed-text';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <View style={styles.headerTop}>
            <ThemedText style={styles.welcomeText}>Merhaba, Ali!</ThemedText>
            <TouchableOpacity style={[styles.notificationButton, { backgroundColor: theme.card }]}>
              <MaterialCommunityIcons name="bell-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
              <View style={styles.searchIconContainer}>
                <MaterialCommunityIcons name="magnify" size={24} color={theme.textSecondary} />
              </View>
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Ürün veya market ara..."
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        </View>

        {/* Active List Card */}
        <View style={styles.section}>
          <View style={[styles.activeListCard, { backgroundColor: theme.card }]}>
            <View style={styles.activeListContent}>
              <ThemedText style={styles.activeListTitle}>Aktif Alışveriş Listeniz</ThemedText>

              <View style={styles.activeListRow}>
                <View style={styles.activeListInfo}>
                  <ThemedText style={[styles.listName, { color: theme.textSecondary }]}>Haftalık İhtiyaçlar</ThemedText>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressLabels}>
                      <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>5/8 ürün bulundu</ThemedText>
                      <ThemedText style={styles.progressPercent}>62%</ThemedText>
                    </View>
                    <View style={[styles.progressBarBg, { backgroundColor: theme.background }]}>
                      <View style={[styles.progressBarFill, { backgroundColor: theme.primary, width: '62%' }]} />
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={[styles.viewButton, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.viewButtonText}>Görüntüle</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Featured Deals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Öne Çıkan Fırsatlar</ThemedText>
            <TouchableOpacity>
              <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>Tümü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsScroll}>
            <DealCard
              image="https://lh3.googleusercontent.com/aida-public/AB6AXuDahZgyykMeigoeK8FUENokpYS269UtxTVZUbpJQAe65swE4ZrHk0N6ymg0JwIUwlzJx-wAw-5MCEVlc4QjT3jdxEXS2V83vp-cowmvpuLexRnJ7DgLDptXm9Zt4asRF_hiyLqNBkF9Vl_eWlsCKIUCIqWt7n2k6OHjGpECGCcr3XMXGUcQDA49ooiyUVII7IHDczBTyw7dOrAmrC6JzhHeNCdVtj54AmIZAwB1OrXI0M0Zb_De3zFFvTYSZPd2p6zHF3MVCVFxWfqr"
              title="Domates Salkım"
              price="39,90₺"
              unit="/kg"
              market="Migros Sanal Market"
              theme={theme}
            />
            <DealCard
              image="https://lh3.googleusercontent.com/aida-public/AB6AXuAYozHsbFYS2voiEbyKlhHfcWWSpiMGaY-Y8QDHs4Mj-SbhflsubsIFbEKNp8CAvlI-OyTpVGDV8D3ptL8rwk4Ppo_TsRQpRff6MLb5Le2ywHasrNrgpbmlqzAecrSYCckMwsO3SNMQvhRWOFp39rQNdtCMRjmpOxJfvygtRprOZHh1lJrA84kT6DY4h7v6A45L2eWfWXrpmsVUrTr25RLJg1xxaz7Gui1ASq-sy93_9oD7ChPULJd15gtZ5iUyUPY_q2iD9nwvk97N"
              title="Sütaş Süt 1L"
              price="34,50₺"
              unit="/adet"
              market="CarrefourSA"
              theme={theme}
            />
            <DealCard
              image="https://lh3.googleusercontent.com/aida-public/AB6AXuDIbLqreB9UWSLznf2QCRFQ_6IkruDn2p2GRr1woojA00gXSooTMP0ibib7eHx2ZHf9UzAtkr5WEZSUwsTtVqOErHQEx-ZmxXIfjd_jGmWU5G2jJyjeWaBshtVNYbkHLTjgbgg9BUWxLPUPg955poukFRh2clB8ETXgX6qpe73SkETQIbEpMjpJC1I1bs5ZciZ1Zme_yrAmOCAqE5T4qXf6YpcnkQ2NWMRTX5T1asq5wejRrYbtCoJ82mMlJbzLDnSLr7-LycOiTzog"
              title="Ülker Çikolatalı Gofret"
              price="4,75₺"
              unit="/adet"
              market="A101"
              theme={theme}
            />
            <DealCard
              image="https://lh3.googleusercontent.com/aida-public/AB6AXuDF4hf0KX4TdaoJg0ysrrhSB1v_8W-NLfgbzDYf7C-Pw4jGZ_SUkZ0t9flw35Xh-Z_SMRiejiDfzgrHfg_qk7hdrxL8RCrCLafbS4YFThfUo0erUtrmpTsKW8hvkQ9C0pdjhF_f3bjwZYhJiQsQe-dmMpRfdPNnF8PEmtICNUuEMDbojDdIbDQvkWtmvGE_ROloM7RNWukBqGdakiOuap6iFhTS_u6KSPnBwBxFTGete_vtDoBLUy7lcSFz9gDlygMbeBdhr38b1Wj3"
              title="Filiz Makarna 500g"
              price="18,25₺"
              unit="/paket"
              market="BİM"
              theme={theme}
            />
          </ScrollView>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { paddingHorizontal: 16, paddingBottom: 12 }]}>Sana Özel Kategoriler</ThemedText>
          <View style={styles.categoriesGrid}>
            <CategoryItem icon="flower-tulip" label="Meyve & Sebze" theme={theme} />
            <CategoryItem icon="egg" label="Süt Ürünleri" theme={theme} />
            <CategoryItem icon="food-steak" label="Et & Tavuk" theme={theme} />
            <CategoryItem icon="bread-slice" label="Fırın" theme={theme} />
            <CategoryItem icon="cookie" label="Atıştırmalıklar" theme={theme} />
            <CategoryItem icon="water" label="İçecekler" theme={theme} />
            <CategoryItem icon="broom" label="Temizlik" theme={theme} />
            <CategoryItem icon="view-grid" label="Tümü" theme={theme} />
          </View>
        </View>

        {/* Nearby Markets */}
        <View style={[styles.section, { paddingBottom: 32 }]}>
          <ThemedText style={[styles.sectionTitle, { paddingHorizontal: 16, paddingBottom: 12 }]}>Yakındaki Marketler</ThemedText>
          <View style={styles.marketsList}>
            <MarketItem
              logo="https://lh3.googleusercontent.com/aida-public/AB6AXuAgG92-e8AaRK1FpFJECTRixvj5mW6hjNaEQnQnSyGFJ9KwKzRcqdUhbYlSeK5Ms3Rx1A_26INMWYlRqlYML66qd7G2713pUA9UORrIjSUfNjYRhWrQuuX3kAUfxwQON1GsPod2MDMESd6MzdZmGTTb93Fjzx-FX1xNHgRueFrW5dRK9fzTpEu7-vZTgkT7ZRhxb0ZiohoUevSMhstIJfVO4UIf7KXKYNk4uFFXQPar7lnCUbpErtxsh7g_PyPEAtyEn4ivycOHWH8u"
              name="Migros Jet"
              distance="0.8 km"
              theme={theme}
            />
            <MarketItem
              logo="https://lh3.googleusercontent.com/aida-public/AB6AXuB9XpWTvOGlLpluFKIYy_C4Qb9VOsU9G6a5fYXzudXhr3x0Mg8E_Nv_LLMtzwY8NU_AR1pa-1s4j5ZSlgDiG6VM4edFsS0EFAGTaGzaX2uyolO_TCpFTqGjWfJsO68kT8rxXobf_uXFq7zHFjlOvz9bYCp_ZuuibeVtaQChV09VSaMuUfwhNYhiyKH3TWjMkCsqvabkHn7kCUZFXWbBi5WkfADg1as40bSo2AkihUysM1OKVEf-LPxkVvlLJaDYhgYnUFz3qQrkLa9_"
              name="A101"
              distance="1.2 km"
              theme={theme}
            />
            <MarketItem
              logo="https://lh3.googleusercontent.com/aida-public/AB6AXuCvMbi9YRA8Y17mv5_4nPcakDjQetBc4ffsW-wQvKbvXlJTqSUOboBfYX8s9BkAacNpmMorFLBvN5pRS_vzsRrT3Hnh6jjJcg4E8JQ4HmK0IjVz7k8k03PJpWTwgLIoSH45czNkGl7UHumRO3-VT_DQD2NRj9_JCDl92UnNcWDK5zksaxROrntABpuUiByGLHC0f-j454cUl3bU-K3qyP4PnPUyZC7opqOW4kEdGWy_OROxvSulHPFvBZrHaKM31bMZkBe0R1ramJiG"
              name="CarrefourSA Mini"
              distance="1.5 km"
              theme={theme}
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Components
const DealCard = ({ image, title, price, unit, market, theme }: any) => (
  <View style={[styles.dealCard, { backgroundColor: theme.card }]}>
    <Image source={{ uri: image }} style={styles.dealImage} resizeMode="cover" />
    <View style={styles.dealContent}>
      <ThemedText style={styles.dealTitle} numberOfLines={1}>{title}</ThemedText>
      <ThemedText style={[styles.dealSubtitle, { color: theme.textSecondary }]}>En Düşük Fiyat</ThemedText>
      <View style={styles.priceRow}>
        <ThemedText style={[styles.dealPrice, { color: theme.primary }]}>{price}</ThemedText>
        <ThemedText style={[styles.dealUnit, { color: theme.textSecondary }]}>{unit}</ThemedText>
      </View>
      <ThemedText style={[styles.marketName, { color: theme.textSecondary }]}>{market}</ThemedText>
    </View>
  </View>
);

const CategoryItem = ({ icon, label, theme }: any) => (
  <View style={styles.categoryItem}>
    <View style={[styles.categoryIconCircle, { backgroundColor: `${theme.primary}1A` }]}>
      {/* 1A = 10% opacity in hex approx */}
      <MaterialCommunityIcons name={icon as any} size={32} color={theme.primary} />
    </View>
    <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
  </View>
);

const MarketItem = ({ logo, name, distance, theme }: any) => (
  <View style={[styles.marketItem, { backgroundColor: theme.card }]}>
    <Image source={{ uri: logo }} style={styles.marketLogo} resizeMode="contain" />
    <View style={styles.marketInfo}>
      <ThemedText style={styles.marketNameBold}>{name}</ThemedText>
      <ThemedText style={[styles.marketDistance, { color: theme.textSecondary }]}>{distance}</ThemedText>
    </View>
    <TouchableOpacity style={[styles.marketButton, { backgroundColor: `${theme.primary}33` }]}>
      {/* 33 = 20% opacity */}
      <ThemedText style={[styles.marketButtonText, { color: theme.primary }]}>Ürünleri Gör</ThemedText>
    </TouchableOpacity>
  </View>
);


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    height: 48,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  searchContainer: {
    paddingVertical: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 8,
  },
  searchIconContainer: {
    paddingLeft: 16,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Active List
  activeListCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeListContent: {
    padding: 16,
    gap: 12,
  },
  activeListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  activeListRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeListInfo: {
    flex: 1,
    gap: 8,
  },
  listName: {
    fontSize: 16,
  },
  progressContainer: {
    gap: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 14,
  },
  progressPercent: {
    fontSize: 14,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  viewButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Deals
  dealsScroll: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 16, // for shadow
  },
  dealCard: {
    width: 160,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dealImage: {
    width: '100%',
    height: 112,
  },
  dealContent: {
    padding: 12,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  dealSubtitle: {
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  dealPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dealUnit: {
    fontSize: 14,
  },
  marketName: {
    fontSize: 12,
    marginTop: 4,
  },
  // Categories
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '21%', // approx 4 columns
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Markets
  marketsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  marketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  marketLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  marketInfo: {
    flex: 1,
  },
  marketNameBold: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  marketDistance: {
    fontSize: 14,
  },
  marketButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
