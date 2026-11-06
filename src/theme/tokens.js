/**
 * Design tokens shared by Tailwind (tailwind.config.js) and runtime code.
 * Plain CommonJS so the Tailwind config can require it.
 * Accent: electric lime, chosen for strong contrast on the dark default theme.
 */
const colors = {
  accent: { DEFAULT: '#C6F432', foreground: '#0B0D0E', muted: '#9BC21F' },
  danger: '#FF5A5F',
  warning: '#FFB020',
  success: '#2BD67B',
  // Neutral scale used for surfaces and text in both themes.
  ink: {
    950: '#0B0D0E',
    900: '#121517',
    800: '#1B1F22',
    700: '#2A2F33',
    500: '#6B7378',
    300: '#B7BEC2',
    100: '#EEF1F2',
    50: '#F8FAFA',
  },
};

module.exports = { colors };
