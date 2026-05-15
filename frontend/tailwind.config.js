/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /** RGB triplets in --color-desk-* (see index.css) so `/20` opacity modifiers work */
        desk: {
          canvas: 'rgb(var(--color-desk-canvas) / <alpha-value>)',
          sidebar: 'rgb(var(--color-desk-sidebar) / <alpha-value>)',
          panel: 'rgb(var(--color-desk-panel) / <alpha-value>)',
          elevated: 'rgb(var(--color-desk-elevated) / <alpha-value>)',
          border: 'rgb(var(--color-desk-border) / <alpha-value>)',
          muted: 'rgb(var(--color-desk-muted) / <alpha-value>)',
          subtle: 'rgb(var(--color-desk-subtle) / <alpha-value>)',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
