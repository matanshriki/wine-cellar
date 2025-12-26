/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    /**
     * Custom Screen Breakpoints
     * 
     * Mobile-First Approach:
     * - xs: 475px  - Extra small phones landscape
     * - sm: 640px  - Small tablets & large phones
     * - md: 768px  - Tablets
     * - lg: 1024px - Laptops
     * - xl: 1280px - Desktops
     * 
     * Usage: <div className="xs:flex-row flex-col">
     */
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          50: '#faf5f7',
          100: '#f5ebef',
          200: '#edd7df',
          300: '#e0b7c5',
          400: '#cd8ca1',
          500: '#b9688080',
          600: '#a24c68',
          700: '#883d56',
          800: '#72354a',
          900: '#622f42',
        },
      },
    },
  },
  /**
   * RTL Support Configuration
   * 
   * When document has dir="rtl" attribute (Hebrew language):
   * - TailwindCSS automatically mirrors directional utilities
   * - Example: ml-4 becomes mr-4 in RTL
   * - Example: text-left becomes text-right in RTL
   * - Example: rounded-l becomes rounded-r in RTL
   * 
   * This is handled automatically by the browser and Tailwind's
   * logical property system.
   * 
   * Mobile RTL Considerations:
   * - Navigation menus mirror correctly
   * - Touch targets maintain adequate size
   * - Text alignment switches appropriately
   * - Icons and images flip when needed (via transform: scaleX(-1))
   */
  plugins: [],
};

