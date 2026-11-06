/** @type {import('tailwindcss').Config} */
const { colors } = require('./src/theme/tokens');

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily: {},
      borderRadius: { xl: '16px', '2xl': '24px' },
    },
  },
  plugins: [],
};
