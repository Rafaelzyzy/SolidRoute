/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBox: '#2D2D30', // WinBox 4 Panel
        darkerBox: '#1E1E1E', // WinBox 4 Background
        primary: '#00D166', // Modern MikroTik Mint Green
        primaryHover: '#00B859', // Slightly darker for hover
        mkborder: '#3F3F46' // Subtle border for WinBox feel
      }
    },
  },
  plugins: [],
}
