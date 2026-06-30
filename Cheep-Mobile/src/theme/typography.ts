/**
 * 📝 Typography System
 * Font family, sizes, weights, line heights
 */

export const typography = {
  // Font Families
  // Display = Space Grotesk (characterful grotesk, great numerals) for headings
  // and prices. Body stays on the platform System font so inline fontWeight still
  // works everywhere (custom fonts ignore fontWeight).
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
    display: 'SpaceGrotesk_700Bold',
    displaySemibold: 'SpaceGrotesk_600SemiBold',
    displayMedium: 'SpaceGrotesk_500Medium',
  },

  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Text Styles (Predefined combinations)
  styles: {
    // Headers — Space Grotesk display
    h1: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 38,
      letterSpacing: -0.6,
    },
    h2: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 25,
      fontWeight: '700' as const,
      lineHeight: 32,
      letterSpacing: -0.4,
    },
    h3: {
      fontFamily: 'SpaceGrotesk_600SemiBold',
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
      letterSpacing: -0.2,
    },
    h4: {
      fontFamily: 'SpaceGrotesk_600SemiBold',
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
      letterSpacing: -0.2,
    },

    // Body Text
    body1: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    body2: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },

    // Subtitles
    subtitle1: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    subtitle2: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 20,
    },

    // Captions
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },

    // Buttons
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
      letterSpacing: 0.5,
    },

    // Overline (küçük üst yazılar)
    overline: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
    },

    // Price (fiyat gösterimi için) — Space Grotesk, tabular feel
    price: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 22,
      fontWeight: '700' as const,
      lineHeight: 28,
      letterSpacing: -0.3,
    },

    // Price Small (küçük fiyat)
    priceSmall: {
      fontFamily: 'SpaceGrotesk_600SemiBold',
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },

    // Hero number (savings, big stats)
    display: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 44,
      fontWeight: '700' as const,
      lineHeight: 48,
      letterSpacing: -1,
    },
  },
} as const;

export type TypographyStyle = keyof typeof typography.styles;

