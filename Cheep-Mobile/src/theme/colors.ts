/**
 * 🎨 Cheep Color Palette
 * Modern fintech / clean design system
 * Vibrant teal accent · neutral white surfaces · soft elevation
 * Inspired by: Revolut × N26 × Stripe
 */

export const colors = {
  // Primary Colors - Vibrant Teal (brand accent: buttons, FAB, active states, prices)
  primary: {
    main: '#0D9488',      // Teal 600 - güçlü, beyaz üstünde okunur
    light: '#14B8A6',     // Teal 500
    dark: '#0F766E',      // Teal 700 - basılı/koyu durum
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
  },

  // Secondary Colors - Teal aksanın açık tonu (savings/positive vurgular)
  secondary: {
    main: '#14B8A6',      // Teal
    light: '#5EEAD4',
    dark: '#0D9488',
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
  },

  // Background Colors - temiz, nötr
  background: {
    default: '#F6F8FA',   // Çok açık nötr gri zemin
    paper: '#FFFFFF',     // Kartlar için saf beyaz
    card: '#FFFFFF',      // Card background
    input: '#F3F5F7',     // Input background
    // Dark mode
    dark: '#0A0F1A',      // Very dark navy / near-black
    darkPaper: '#0F172A', // Dark card
    darkCard: '#0F172A',
  },

  // Text Colors
  text: {
    primary: '#0F172A',   // Almost black
    secondary: '#64748B', // Slate gray
    disabled: '#CBD5E1',
    hint: '#94A3B8',
    // Dark mode
    darkPrimary: '#F1F5F9', // Soft gray, not pure white
    darkSecondary: '#CBD5E1',
  },

  // Status Colors - Muted and professional
  success: {
    main: '#14B8A6',      // Muted teal
    light: '#5EEAD4',
    dark: '#0D9488',
    bg: '#F0FDFA',        // Very subtle background
  },

  error: {
    main: '#EF4444',      // Red (kept for errors)
    light: '#F87171',
    dark: '#DC2626',
    bg: '#FEF2F2',
  },

  warning: {
    main: '#F59E0B',      // Amber
    light: '#FBBF24',
    dark: '#D97706',
    bg: '#FFFBEB',
  },

  info: {
    main: '#3B82F6',      // Blue
    light: '#60A5FA',
    dark: '#2563EB',
    bg: '#EFF6FF',
  },

  // Border & Divider
  border: {
    main: '#E5E7EB',      // Subtle gray
    light: '#F3F4F6',
    dark: '#D1D5DB',
    // Dark mode
    darkMain: '#1E293B',
  },

  divider: '#E5E7EB',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.45)',

  // Transparent
  transparent: 'transparent',

  // Specific UI Elements
  fab: '#0D9488',           // Teal FAB
  tabBarActive: '#0D9488',
  tabBarInactive: '#94A3B8',
  
  // Store Chips (Market logoları için) - Muted versions
  storeChips: {
    bim: '#6B8E7F',
    migros: '#FF7A00',
    a101: '#00507D',
    sok: '#E31E24',
    carrefoursa: '#0066B2',
  },
} as const;

export type ColorKey = keyof typeof colors;
export type PrimaryColor = keyof typeof colors.primary;
export type SecondaryColor = keyof typeof colors.secondary;

