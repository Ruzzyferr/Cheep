/**
 * 🎨 Cheep Color Palette
 * Minimal, tech-driven design system
 * Inspired by: Apple × Stripe × Linear
 */

export const colors = {
  // Primary Colors - Deep Navy
  primary: {
    main: '#0B1C2D',      // Deep navy
    light: '#162B44',     // Dark slate
    dark: '#050E17',      // Near black
    50: '#F4F7FB',
    100: '#E5E7EB',
    200: '#CBD2D9',
    300: '#9CA3AF',
    400: '#6B7280',
    500: '#0B1C2D',
    600: '#162B44',
    700: '#050E17',
    800: '#030A10',
    900: '#020508',
  },

  // Secondary Colors - Muted Teal (for savings/positive feedback)
  secondary: {
    main: '#14B8A6',      // Muted teal
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

  // Background Colors
  background: {
    default: '#F4F7FB',   // Soft off-white / light gray
    paper: '#FFFFFF',     // Pure white for cards
    card: '#FFFFFF',      // Card background
    input: '#F9FAFB',     // Input background
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
  overlay: 'rgba(11, 28, 45, 0.5)',

  // Transparent
  transparent: 'transparent',

  // Specific UI Elements
  fab: '#0B1C2D',           // Navy FAB
  tabBarActive: '#0B1C2D',
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

