/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FCFBF7',
          100: '#FAF7F2',
          200: '#F4EFE6',
          300: '#E8DFC9',
          400: '#D6AC66',
        },
        gold: {
          400: '#E5C07B',
          500: '#D6AC66',
          600: '#B88E43',
          700: '#9E7631',
          800: '#7A5B22',
        },
        burgundy: {
          700: '#7E303B',
          800: '#64242E',
        }
      },
      fontFamily: {
        serif: ['Cinzel', 'Georgia', 'serif'],
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
