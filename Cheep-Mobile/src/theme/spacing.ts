/**
 * 📏 Spacing System
 * 8pt grid system
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 8,        // Fintech: yumuşak köşeler
  md: 12,
  lg: 16,       // Kartlar için standart
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
} as const;

export const layout = {
  // Container padding
  containerPadding: 20,

  // Screen padding (fintech: ferah yatay boşluk)
  screenPadding: 20,

  // Card padding
  cardPadding: 18,

  // Section spacing
  sectionSpacing: 28,

  // Header height
  headerHeight: 56,

  // Tab bar height
  tabBarHeight: 62,

  // FAB size
  fabSize: 58,

  // Input height
  inputHeight: 52,

  // Button height
  buttonHeight: 52,
} as const;

export type SpacingKey = keyof typeof spacing;
export type BorderRadiusKey = keyof typeof borderRadius;

