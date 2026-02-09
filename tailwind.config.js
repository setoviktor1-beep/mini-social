/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e1e9fe',
          200: '#c8d7fd',
          300: '#a1bbfa',
          400: '#7394f6',
          500: '#4c6def',
          600: '#384edb',
          700: '#2f3ebf',
          800: '#2b359a',
          900: '#28317b',
          950: '#181c4a',
        },
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
