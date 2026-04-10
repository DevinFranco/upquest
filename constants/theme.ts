/**
 * UpQuest – Design system tokens
 * Dark-mode-first, motivational health aesthetic.
 */

export const Colors = {
  // Backgrounds
  background:     '#0A0A0F',
  surface:        '#12121A',
  surfaceAlt:     '#1A1A26',
  card:           '#1E1E2E',

  // Brand
  primary:        '#6C63FF',   // Electric violet – action, CTAs
  primaryLight:   '#8B84FF',
  primaryDark:    '#4A42D6',
  accent:         '#00D4AA',   // Teal – success, progress
  accentWarm:     '#FF6B35',   // Orange – energy, workouts
  gold:           '#FFD700',   // Gold – premium, achievements

  // Text
  textPrimary:    '#F0F0FF',
  textSecondary:  '#9090B0',
  textMuted:      '#60607A',
  textInverse:    '#0A0A0F',

  // Semantic
  success:        '#00D4AA',
  warning:        '#FFB547',
  error:          '#FF4D6D',
  info:           '#4DA6FF',

  // Borders
  border:         '#2A2A3E',
  borderLight:    '#3A3A52',

  // Gradients (use as array in LinearGradient)
  gradientPrimary:  ['#6C63FF', '#4A42D6'] as const,
  gradientAccent:   ['#00D4AA', '#0099CC'] as const,
  gradientWarm:     ['#FF6B35', '#FF4D6D'] as const,
  gradientDark:     ['#12121A', '#0A0A0F'] as const,
  gradientPremium:  ['#FFD700', '#FF8C00'] as const,
};

export const Typography = {
  // Font sizes
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 42,

  // Font weights (React Native uses strings)
  regular:    '400' as const,
  medium:     '500' as const,
  semibold:   '600' as const,
  bold:       '700' as const,
  extrabold:  '800' as const,
  black:      '900' as const,

  // Line heights
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
};

export const Radius = {
  sm:   6,
  md:   10,
  lg:   16,
  xl:   24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
};
