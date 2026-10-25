/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#151F35',
        muted: '#60647A',
        cyan: '#06BED3',
        mist: '#EEF3F7',
        line: '#D9DEE5',
        canvas: '#F4F6F9',
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 10px 30px rgba(21, 31, 53, 0.12)',
      },
    },
  },
  plugins: [],
};
