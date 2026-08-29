/**
 * 🎨 Cheep Color Palette — "Fresh Market"
 * Light, editorial, premium-grocery system.
 * Cream paper · deep forest green (brand) · warm clementine accent · mascot mint.
 *
 * Token NAMES are preserved from the previous theme so every screen picks up the
 * new look automatically; semantics: `primary`=forest (brand/CTA), `secondary`=
 * mint-green (positive/savings), `accent`=clementine (warm highlights/deals).
 */

export const colors = {
  // Primary — Forest green (brand, CTAs, active states)
  primary: {
    main: '#1F6F4A',
    light: '#2E9E78',
    dark: '#16513A',
    50: '#ECF6F0',
    100: '#D2EBDD',
    200: '#A9D8BF',
    300: '#7FC4A1',
    400: '#54B083',
    500: '#2E9E78',
    600: '#1F6F4A',
    700: '#16513A',
    800: '#0F3A29',
    900: '#0A2A1E',
  },

  // Secondary — Mascot mint (positive / savings, soft fills)
  secondary: {
    main: '#2E9E78',
    light: '#57C99A',
    dark: '#1F6F4A',
    50: '#EAF7F0',
    100: '#D5EFE2',
    200: '#AEE0C8',
    300: '#86D0AD',
    400: '#57C99A',
    500: '#2E9E78',
    600: '#1F6F4A',
    700: '#16513A',
  },

  // Accent — Clementine (warm highlights, deals, savings emphasis)
  accent: {
    main: '#F0682B',
    light: '#F89B6F',
    dark: '#C8521E',
    50: '#FDEEE6',
    100: '#FAD8C6',
    200: '#F6B89C',
    300: '#F39872',
    400: '#F0682B',
    500: '#D85B22',
    600: '#C8521E',
    /**
     * accent.main METİN OLARAK KULLANILMAZ — krem zeminde 2,99:1 veriyor,
     * yani WCAG AA'nın 4,5:1 tabanının ve büyük metnin 3:1 tabanının bile
     * altında. Bağlantılar ("Tümü", "Tümünü incele") bu yüzden okunması zor
     * çıkıyordu. Dolgu olarak F0682B doğru ve marka rengi; metin için bu
     * koyu ton kullanılmalı (krem 4,87:1 · beyaz 5,09:1).
     */
    text: '#C2440E',
  },

  // Backgrounds — warm cream paper
  background: {
    default: '#FBFAF6',   // cream canvas
    paper: '#FFFFFF',     // cards
    card: '#FFFFFF',
    input: '#F3F1EA',     // warm input
    // Dark mode (kept for later)
    dark: '#10140F',
    darkPaper: '#171C15',
    darkCard: '#171C15',
  },

  // Text — warm ink
  text: {
    primary: '#14211B',   // ink
    secondary: '#5B6B62', // warm gray-green
    disabled: '#C2CDC6',
    // ERİŞİLEBİLİRLİK: eskiden '#93A29A' idi ve beyaz üzerinde yalnızca
    // 2,67:1 veriyordu — WCAG AA'nın 4,5:1 tabanının çok altında. Dekoratif
    // olsa mesele değildi ama bu token GERÇEK VERİ taşıyor: fırsat
    // kartındaki üstü çizili ESKİ FİYAT, ürün kartındaki market alt
    // etiketleri, fiyat tazeliği. Bir indirim iddiasının dayandığı sayının
    // okunamaması erişilebilirlikten önce bir güven sorunu.
    // '#6B7A72' beyazda 4,51:1 — hâlâ görsel olarak "ikincil", ama okunur.
    hint: '#6B7A72',
    darkPrimary: '#F2F5F0',
    darkSecondary: '#C2CDC6',
  },

  // Status
  success: {
    main: '#1F8E5A',
    light: '#57C99A',
    dark: '#16693F',
    bg: '#E8F6EE',
  },
  error: {
    main: '#E5484D',
    light: '#F0787C',
    dark: '#C13438',
    bg: '#FCEDED',
  },
  warning: {
    main: '#D98324',
    light: '#EBA94E',
    dark: '#A9631A',
    bg: '#FBEFD9',
  },
  info: {
    main: '#3B82F6',
    light: '#60A5FA',
    dark: '#2563EB',
    bg: '#EFF6FF',
  },

  // Border & Divider — warm neutrals
  border: {
    main: '#E7E3D8',
    light: '#F0EDE4',
    dark: '#D8D3C6',
    darkMain: '#26301F',
  },
  divider: '#E7E3D8',

  overlay: 'rgba(20, 33, 27, 0.45)',
  transparent: 'transparent',

  // Brand tokens (mascot + canvas) — for illustrative surfaces
  brand: {
    forest: '#1F6F4A',
    mint: '#57C99A',
    mintSoft: '#E8F7EF',
    cream: '#FBFAF6',
    clementine: '#F0682B',
    lilac: '#C9B8E8',
    lilacSoft: '#EFEAF8',
    ink: '#14211B',
  },

  // Specific UI elements
  fab: '#1F6F4A',
  tabBarActive: '#1F6F4A',
  tabBarInactive: '#6B7A72',  // bkz. text.hint — AA icin koyulastirildi

  // Store brand colors
  // Market rozeti arka-plan renkleri.
  //
  // TELİFLİ LOGO KULLANILMIYOR (bkz. utils/storeLogo.ts) — rozet, markanın baş
  // harfi + markanın bilinen kurumsal rengi. Renk, markayı tanımaya yarayan
  // olgusal bir nitelik; logo değil.
  //
  // Eskiden yalnızca 5 Türk zinciri vardı ve geri kalan HER market aynı
  // `primary.main` rengine düşüyordu: Polonya kullanıcısı Biedronka, Lidl,
  // Żabka ve Auchan'ı birbirinden RENKLE ayırt edemiyordu.
  storeChips: {
    // Türkiye
    bim: '#6B8E7F',
    migros: '#FF7A00',
    a101: '#00507D',
    sok: '#E31E24',
    carrefoursa: '#0066B2',
    // Polonya
    biedronka: '#E30613',
    zabka: '#00A54F',
    dino: '#0F7C3F',
    // Çok ülkeli zincirler
    auchan: '#D2001C',
    lidl: '#0050AA',
    kaufland: '#E10915',
    spar: '#009A3D',
    tesco: '#00539F',
    aldi: '#00B0EA',
    penny: '#D51130',
    // Hırvatistan
    konzum: '#C8102E',
    plodine: '#E4002B',
    tommy: '#008C45',
    // Romanya
    megaimage: '#005CA9',
    profi: '#E2001A',
  },
} as const;

export type ColorKey = keyof typeof colors;
export type PrimaryColor = keyof typeof colors.primary;
export type SecondaryColor = keyof typeof colors.secondary;
