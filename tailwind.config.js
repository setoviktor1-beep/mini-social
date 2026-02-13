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
        bg: {
          primary: '#0a0a0a',
          secondary: '#1a1a1a',
          tertiary: '#2a2a2a',
          input: '#1e1e1e',
        },
        border: {
          subtle: '#2e2e2e',
          focus: '#4a90d9',
        },
        text: {
          primary: '#e8e8e8',
          secondary: '#8e8e8e',
          tertiary: '#5a5a5a',
        },
        accent: {
          blue: '#0084ff',
          'blue-hover': '#0073e6',
          success: '#00c853',
          warning: '#ff9800',
          error: '#ff3b30',
          purple: '#8b5cf6',
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
