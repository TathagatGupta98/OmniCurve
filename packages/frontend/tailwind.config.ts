import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0A0A0A',
        'bg-surface': 'rgba(255,255,255,0.04)',
        'bg-surface-2': 'rgba(255,255,255,0.07)',
        border: 'rgba(255,255,255,0.10)',
        'text-primary': '#F2F2F2',
        'text-muted': 'rgba(242,242,242,0.45)',
        'accent-yes': '#22D3A3',
        'accent-no': '#FF4560',
        'accent-data': '#C41230',
        'accent-data-dim': 'rgba(196,18,48,0.15)',
        'grid-line': 'rgba(255,255,255,0.04)',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['"DM Serif Text"', 'serif'],
      },
      backgroundImage: {
        'grid-paper':
          'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-40': '40px 40px',
      },
    },
  },
  plugins: [],
}

export default config
