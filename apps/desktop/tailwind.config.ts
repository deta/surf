import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{svelte,js,ts,jsx,tsx}',
    './src/renderer/src/**/*.svelte',
    './src/index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './src/**/*.svelte'
  ],

  theme: {
    extend: {}
  },

  plugins: []
} as Config
