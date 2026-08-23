/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        reel: {
          950: '#0a0906',
          900: '#131109',
          800: '#1c1911',
          700: '#2a2517',
        },
        gold: {
          400: '#e8c766',
          500: '#d4af37',
          600: '#b8912a',
        },
        script: '#e8c766',
        preprod: '#e0925a',
        shoot: '#5aa9e0',
        postprod: '#a55ae0',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
