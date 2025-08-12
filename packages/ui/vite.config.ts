import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        dev: process.env.NODE_ENV !== 'production'
      },
      preprocess: vitePreprocess()
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: [
        'svelte',
        'svelte/internal',
        'svelte/store',
        '@deta/icons',
        '@deta/types',
        '@deta/utils',
        /^@svelte-plugins\//
      ]
    },
    target: 'esnext',
    sourcemap: true,
    // Ensure we preserve tree-shaking hints
    minify: false,
    modulePreload: {
      polyfill: false
    }
  }
})
