/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Token-backed palette (RGB triplets → supports opacity + dark mode).
        // Keeps every existing `ledger-*` class working.
        ledger: {
          paper: 'rgb(var(--ledger-paper) / <alpha-value>)',
          card: 'rgb(var(--ledger-card) / <alpha-value>)',
          rule: 'rgb(var(--ledger-rule) / <alpha-value>)',
          ink: 'rgb(var(--ledger-ink) / <alpha-value>)',
          'ink-muted': 'rgb(var(--ledger-ink-muted) / <alpha-value>)',
          teal: 'rgb(var(--ledger-teal) / <alpha-value>)',
          'teal-light': 'rgb(var(--ledger-teal-light) / <alpha-value>)',
          'teal-dark': 'rgb(var(--ledger-teal-dark) / <alpha-value>)',
          red: 'rgb(var(--ledger-red) / <alpha-value>)',
          'red-light': 'rgb(var(--ledger-red-light) / <alpha-value>)',
          brass: 'rgb(var(--ledger-brass) / <alpha-value>)',
        },
        // Semantic aliases
        background: 'rgb(var(--background) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        primary: 'rgb(var(--ledger-teal) / <alpha-value>)',
        'primary-strong': 'rgb(var(--ledger-teal-dark) / <alpha-value>)',
        'primary-soft': 'rgb(var(--ledger-teal-light) / <alpha-value>)',
        danger: 'rgb(var(--ledger-red) / <alpha-value>)',
        'danger-soft': 'rgb(var(--ledger-red-light) / <alpha-value>)',
        accent: 'rgb(var(--ledger-brass) / <alpha-value>)',
        muted: 'rgb(var(--ledger-ink-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      borderRadius: {
        lg: '16px',
        md: '12px',
        sm: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow-color) / 0.04), 0 8px 24px -12px rgb(var(--shadow-color) / 0.18)',
        'card-sm': '0 1px 2px rgb(var(--shadow-color) / 0.06)',
      },
      keyframes: {
        stamp: {
          '0%': { transform: 'scale(2.2) rotate(-14deg)', opacity: '0' },
          '60%': { transform: 'scale(0.95) rotate(-8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
        'toast-in': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        stamp: 'stamp 0.35s ease-out forwards',
        'toast-in': 'toast-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
