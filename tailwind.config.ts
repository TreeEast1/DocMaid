import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#112132',
        mist: '#e7edf2',
        accent: '#0f766e',
        sand: '#f5efe6'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        panel: '0 18px 40px rgba(17, 33, 50, 0.14)'
      }
    }
  },
  plugins: []
} satisfies Config;
