/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Samsung Brand Colors
        samsung: {
          blue: '#1428A0', // Samsung Primary Blue
          'blue-dark': '#0D1B6E',
          'blue-light': '#4169E1',
          dark: '#000000',
          gray: '#767676',
          'gray-light': '#F4F4F4',
        },
        // Nexus Coder Theme (based on Samsung)
        nexus: {
          50: '#f0f4ff',
          100: '#e0e9fe',
          200: '#c7d5fd',
          300: '#a5b8fb',
          400: '#8193f7',
          500: '#6370f0',
          600: '#1428A0', // Primary
          700: '#0D1B6E',
          800: '#0a1454',
          900: '#080f3d',
          950: '#050927',
        },
      },
      fontFamily: {
        sans: [
          'Samsung Sharp Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'sans-serif',
        ],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
