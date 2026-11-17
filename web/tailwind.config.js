/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f7ffed',
          100: '#eaf5e3',
          200: '#d9e9d2',
          500: '#347557',
          600: '#116451',
          700: '#0d5142',
          900: '#174d3e',
        },
      },
      fontFamily: { sans: ['Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'], display: ['Annie Use Your Telescope', 'cursive'] },
    },
  },
  plugins: [],
};
