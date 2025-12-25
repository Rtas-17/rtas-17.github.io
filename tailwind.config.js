/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0f1c', // Very dark blue/slate
        surface: '#111827', // Slightly lighter for cards
        border: '#1f2937',
        primary: {
          DEFAULT: '#10b981', // Emerald 500
          hover: '#059669',
          glow: 'rgba(16, 185, 129, 0.2)',
        },
        text: {
          main: '#f3f4f6',
          muted: '#9ca3af',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        arabic: ['"Noto Naskh Arabic"', 'serif'], // or Cairo
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
