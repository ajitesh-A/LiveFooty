/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pitch: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        night: {
          950: '#0a0b0d',
          900: '#0f1114',
          850: '#12141a',
          800: '#14161a',
          750: '#1e2229',
          700: '#1c1f26',
          650: '#273647',
          600: '#242830',
          500: '#2e333d',
        },
        ink: {
          100: '#f4f5f7',
          300: '#c9cdd4',
          500: '#8a8f98',
          600: '#565b64',
          700: '#3d4149',
        },
        danger: {
          500: '#ef4444',
        },
        accent: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
      },
      fontFamily: {
        headline: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '0.75rem',
      },
      fontSize: {
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
}