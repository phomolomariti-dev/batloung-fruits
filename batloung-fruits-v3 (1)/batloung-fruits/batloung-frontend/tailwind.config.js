// Design tokens carried over from the approved Batloung Fruits mockups
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#003820', 'primary-container': '#0f5132', 'on-primary': '#ffffff', 'on-primary-container': '#84c39b',
        'primary-fixed': '#b0f1c7', 'primary-fixed-dim': '#95d4ac', 'surface-tint': '#2d6a48', 'inverse-primary': '#95d4ac',
        secondary: '#006d41', 'secondary-container': '#90f4b7', 'on-secondary-container': '#007144', 'secondary-fixed': '#93f7ba',
        tertiary: '#472a00', 'tertiary-container': '#653e00', 'on-tertiary-container': '#faa213', 'tertiary-fixed': '#ffddb8', 'tertiary-fixed-dim': '#ffb95f',
        error: '#ba1a1a', 'error-container': '#ffdad6', 'on-error-container': '#93000a',
        surface: '#f7f6ef', 'surface-bright': '#fffefa', 'surface-dim': '#e7e6da',
        'surface-container-lowest': '#fffefa', 'surface-container-low': '#f0f1e7', 'surface-container': '#e8ecdf',
        'surface-container-high': '#dfe6d7', 'surface-container-highest': '#d5dfcf', 'surface-variant': '#d5dfcf',
        'on-surface': '#1b2a1e', 'on-surface-variant': '#48554a', outline: '#788478', 'outline-variant': '#cbd3c6',
        'inverse-surface': '#24362a', 'inverse-on-surface': '#edf3e9',
      },
      borderRadius: { DEFAULT: '0.125rem', lg: '0.65rem', xl: '1rem', full: '9999px' },
      fontFamily: { sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
