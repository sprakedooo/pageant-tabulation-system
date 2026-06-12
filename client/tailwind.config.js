/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf9ec',
          100: '#f9efc9',
          200: '#f2dd8f',
          300: '#eac655',
          400: '#e3b32e',
          500: '#d49a1f',
          600: '#b87818',
          700: '#935717',
          800: '#7a451a',
          900: '#68391b',
        },
        // Official branding: deep maroon panels, ruby accents, champagne background
        royal: '#3a0c10',
        ruby: '#8c1d22',
        champagne: '#f7f0e1',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
