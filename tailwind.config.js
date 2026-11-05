/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: 'rgb(var(--bg-page) / <alpha-value>)',
        card: 'rgb(var(--bg-card) / <alpha-value>)',
        surface: 'rgb(var(--bg-hover) / <alpha-value>)',
        'surface-hover': 'rgb(var(--bg-hover-alt) / <alpha-value>)',
        'accent': 'rgb(var(--accent) / <alpha-value>)',
        'accent-light': 'rgb(var(--accent-light) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--text-tertiary) / <alpha-value>)',
        'border-light': 'rgb(var(--border) / <alpha-value>)',
        'success': 'rgb(var(--positive) / <alpha-value>)',
        'warning': 'rgb(var(--warning) / <alpha-value>)',
        'danger': 'rgb(var(--danger) / <alpha-value>)',
        // Legacy kbl-* classes referenced across dashboards (issue #1).
        // Each maps to an existing semantic CSS token: red=error/danger,
        // amber=warn, green=ok/positive, blue=info/neutral accent.
        'kbl-red': 'rgb(var(--danger) / <alpha-value>)',
        'kbl-amber': 'rgb(var(--warning) / <alpha-value>)',
        'kbl-green': 'rgb(var(--positive) / <alpha-value>)',
        'kbl-blue': 'rgb(var(--accent) / <alpha-value>)',
        'kbl-blue-dark': 'rgb(var(--accent-alt) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'card': 'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
        'sidebar': '1px 0 0 rgb(var(--border))',
      },
      transitionDuration: {
        DEFAULT: '200ms',
        600: '600ms',
      },
      scale: {
        130: '1.3',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-in': 'slideIn 0.25s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2.4s ease-in-out infinite',
        'hero-shimmer': 'heroShimmer 3s ease-in-out infinite',
        'card-enter': 'cardEnter 0.5s ease-out both',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
        heroShimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        cardEnter: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
