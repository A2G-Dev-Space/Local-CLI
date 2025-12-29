/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pastel Sky Blue Theme
        samsung: {
          blue: '#5BA4D9',       // Primary pastel blue
          'blue-dark': '#3D8BC4',
          'blue-light': '#87CEEB',
          dark: '#1E3A5F',       // Dark navy for sidebar
          gray: '#6B7B8C',
          'gray-light': '#F8FAFC',
        },
        // Pastel Blue Palette
        pastel: {
          50: '#F0F9FF',   // Lightest - backgrounds
          100: '#E0F2FE',  // Very light blue
          200: '#BAE6FD',  // Light blue
          300: '#7DD3FC',  // Sky blue
          400: '#5BA4D9',  // Primary
          500: '#3D8BC4',  // Darker
          600: '#2980B9',  // Accent
          700: '#1E6091',  // Dark accent
          800: '#1E3A5F',  // Sidebar dark
          900: '#0C1929',  // Darkest
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
