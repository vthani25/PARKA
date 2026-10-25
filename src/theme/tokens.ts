// Colors and sizes. Screens use these, never hardcoded values.
// Contrast: red and pine on white are about 7.8:1; white on either is about 7.8:1.
// pine on pineTint is 6.4:1, so use it for large or bold text only.

export const colors = {
  red: '#9b2425', // alerts, overdue, destructive
  pine: '#375a41', // buttons, headings, selected
  background: '#FAF7F2',
  card: '#FFFFFF',
  text: '#242422',
  pineTint: '#E3EBE6',
  white: '#FFFFFF',
  muted: '#4A4A46', // secondary text, 8.9:1 on white
  black: '#000000',
} as const;

export const fonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
} as const;

/** Base text sizes in dp, multiplied by the person's text size setting. */
export const textSizes = {
  small: 18,
  body: 21,
  large: 26,
  heading: 30,
  title: 38,
  clock: 72,
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Minimum touch target (accessibility rule: at least 56 dp). */
export const TOUCH_TARGET = 56;
export const BUTTON_HEIGHT = 68;
export const RADIUS = 14;
/** Ignore repeated taps within this many ms (tremor). */
export const REPEAT_TAP_MS = 400;
