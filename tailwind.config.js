/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ledger: {
          paper: '#EEF1F0',
          card: '#F7F8F6',
          rule: '#DCE1DE',
          ink: '#1B2A32',
          'ink-muted': '#5F6A66',
          teal: '#2F6F62',
          'teal-light': '#E1F5EE',
          'teal-dark': '#1F4E44',
          red: '#B23A2E',
          'red-light': '#FAECE7',
          brass: '#B8925A',
        },
      },
      fontFamily: {
        sans: ['var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      keyframes: {
        stamp: {
          '0%': { transform: 'scale(2.2) rotate(-14deg)', opacity: '0' },
          '60%': { transform: 'scale(0.95) rotate(-8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
      },
      animation: {
        stamp: 'stamp 0.35s ease-out forwards',
      },
    },
  },
  plugins: [],
};
