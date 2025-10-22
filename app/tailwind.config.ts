import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{svelte,js,ts,jsx,tsx,html}',
    './src/renderer/src/**/*.svelte',
    './src/index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './src/**/*.svelte'
  ],
  darkMode: 'class',

  theme: {
    extend: {
      fontFamily: {
        gambarino: ['Gambarino-Display', 'serif'],
        sn: ['SN Pro', 'sans-serif']
      }
    }
  },

  plugins: []
} as Config
