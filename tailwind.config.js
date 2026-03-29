/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef3f2',
          100: '#fde8e7',
          500: '#e05c4b',
          600: '#c94535',
          700: '#a83629',
        },
      },
    },
  },
  plugins: [],
}

