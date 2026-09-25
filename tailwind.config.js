/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chamber: {
          black: '#161513',
          dark: '#0c0b0a',
          gold: '#f0d397',
          goldDark: '#dec48c',
          goldDeep: '#d2b985',
          accent: '#fd4700',
          accentDark: '#d63b00',
          cream: '#fdfbf5',
        }
      },
      fontFamily: {
        serifBrand: ['Cinzel', 'Georgia', 'serif'],
        body: ['"Open Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        chamber: '0 4px 14px -2px rgba(22,21,19,0.25)',
      }
    },
  },
  plugins: [],
}
