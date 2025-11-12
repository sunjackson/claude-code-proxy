/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 黑金主题配色
        'bg-primary': '#000000',
        'bg-secondary': '#0a0a0a',
        'bg-tertiary': '#1a1a1a',
        'accent-primary': '#FFD700',
        'accent-secondary': '#FFA500',
        'text-primary': '#ffffff',
        'text-secondary': '#999999',
        'border-primary': '#1a1a1a',
        'border-secondary': '#333333',
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(90deg, #FFD700 0%, #FFA500 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      },
      boxShadow: {
        'gold': '0 8px 24px rgba(255, 215, 0, 0.2)',
      }
    },
  },
  plugins: [],
}
