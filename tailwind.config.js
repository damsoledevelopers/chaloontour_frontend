/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* ChaloOnTour: dark blue (Chalo/Tour) + red accent (On) */
        primary: {
          50: '#eef4fc',
          100: '#d9e6f7',
          200: '#b8d0ef',
          300: '#8ab0e3',
          400: '#5589d4',
          500: '#336bc4',
          600: '#2654a8',
          700: '#1e4289',
          800: '#1c3a72',
          900: '#1b335f',
          950: '#132042',
        },
        accent: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',
          600: '#c41e3a',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        success: { 500: '#22c55e', 600: '#16a34a' },
        error: { 500: '#ef4444', 600: '#dc2626' },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
};
