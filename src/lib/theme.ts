/**
 * RotBlock — "Clean Slate" design tokens.
 * Near-white canvas, one tight sans, black as the only accent.
 */
export const colors = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  ink: '#0D0D10',
  sub: '#5E5E66',
  faint: '#A3A3AB',
  line: '#ECECEA',
  fill: '#F1F1EE', // quiet surfaces, placeholder tiles
  track: '#E2E2DE', // switch "off" track
  accent: '#0D0D10', // blocking actions — black
  onAccent: '#FFFFFF',
  danger: '#C4321F',
};

export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  black: 'InterTight_800ExtraBold',
};

export const radius = { sm: 12, md: 18, lg: 28, pill: 999 };

/** Rough minutes of scrolling each block saves. A deliberate, modest guess. */
export const MINUTES_PER_BLOCK = 1.5;
