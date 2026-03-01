/**
 * 📝 Typography System
 * Font family, sizes, weights, line heights
 */

export const typography = {
  // Font Families - Inter/SF Pro-like
  // Using system fonts that match Inter/SF Pro aesthetic
  fontFamily: {
    regular: 'System', // Inter Regular / SF Pro Regular
    medium: 'System', // Inter Medium / SF Pro Medium
    semibold: 'System', // Inter SemiBold / SF Pro Semibold
    bold: 'System', // Inter Bold / SF Pro Bold
    display: 'System',
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
    // Headers
    h1: {
      fontSize: 30,
      fontWeight: '700' as const,
      lineHeight: 36,
    },
    h2: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    h4: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
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

    // Price (fiyat gösterimi için)
    price: {
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 28,
    },

    // Price Small (küçük fiyat)
    priceSmall: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
  },
} as const;

export type TypographyStyle = keyof typeof typography.styles;

