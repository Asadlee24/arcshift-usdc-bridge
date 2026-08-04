// tailwind.config.ts
// Tailwind v3 compatibility config. Note: Tailwind v4 compiles CSS-first via globals.css directives.

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-page': '#F8FAFC',
        'text-primary': '#0F172A',
        'text-muted': '#64748B',
        'text-subtle': '#94A3B8',
        'border-card': '#E2E8F0',
        'arc-blue': '#0066FF',
        'arc-cyan': '#00D4FF',
        'success-green': '#22C55E',
        'warning-amber': '#F59E0B',
        'error-red': '#EF4444',
        'usdc-blue': '#2775CA',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
