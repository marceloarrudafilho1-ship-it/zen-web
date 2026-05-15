export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        zen: {
          bg: '#0a0a0b',
          panel: '#111114',
          border: '#1f1f24',
          muted: '#6b6b75',
          text: '#e7e7ea',
          accent: 'rgb(var(--zen-accent-rgb) / <alpha-value>)',
          accent2: 'rgb(var(--zen-accent2-rgb) / <alpha-value>)',
          green: '#4ade80',
          red: '#f87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
