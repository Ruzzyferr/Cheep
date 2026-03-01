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
  sm: 4,
  md: 6,        // Reduced from 8 - less rounded
  lg: 8,        // Reduced from 12
  xl: 12,       // Reduced from 16
  '2xl': 16,    // Reduced from 24
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
  containerPadding: 16,
  
  // Screen padding
  screenPadding: 16,
  
  // Card padding
  cardPadding: 16,
  
  // Section spacing
  sectionSpacing: 24,
  
  // Header height
  headerHeight: 56,
  
  // Tab bar height
  tabBarHeight: 60,
  
  // FAB size
  fabSize: 56,
  
  // Input height
  inputHeight: 48,
  
  // Button height
  buttonHeight: 48,
} as const;

export type SpacingKey = keyof typeof spacing;
export type BorderRadiusKey = keyof typeof borderRadius;

