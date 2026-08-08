import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 14px rgba(251, 191, 36, 0.32)' },
          '50%': { boxShadow: '0 0 34px rgba(251, 191, 36, 0.72)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
