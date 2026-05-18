import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
      colors: {
        // Primary brand - deep slate with blue tints
        surface: {
          DEFAULT: '#0f1117',
          50:  '#f8f9fb',
          100: '#f0f2f5',
          200: '#e2e6ed',
          800: '#1a1d27',
          850: '#151720',
          900: '#0f1117',
          950: '#090b10',
        },
        brand: {
          DEFAULT: '#4f8ef7',
          50:  '#eff5ff',
          100: '#dceaff',
          200: '#b3d0ff',
          300: '#7aafff',
          400: '#4f8ef7',
          500: '#2d6ef0',
          600: '#1a52d4',
          700: '#163fab',
          800: '#163388',
          900: '#172d6b',
        },
        accent: {
          green:  '#2dd4a0',
          amber:  '#f59e0b',
          red:    '#f43f5e',
          purple: '#a78bfa',
          cyan:   '#22d3ee',
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'glow':      '0 0 20px rgba(79,142,247,0.15)',
        'glow-sm':   '0 0 10px rgba(79,142,247,0.1)',
        'card':      '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover':'0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)',
        'modal':     '0 20px 60px rgba(0,0,0,0.7)',
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in':    'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':   'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
