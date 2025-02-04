import { resolve, sep } from 'path'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Markdown({ mode: [Mode.MARKDOWN] }),
    svelte({
      onwarn: (warning, handler) => {
        if (warning.code.toLowerCase().includes('a11y')) return
        handler(warning)
      }
    })
  ],
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/lib/main.ts'),
      name: 'Index',
      // the proper extensions will be added
      fileName: 'index'
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['svelte'],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          svelte: 'Svelte'
        }
      }
    }
  },
  // This is needed to get html-minifier-terser working in the browser context: https://github.com/terser/html-minifier-terser/issues/160#issuecomment-1648837778
  define: {
    'process.env': {},
    'process.platform': JSON.stringify(process.platform)
  },
  resolve: {
    alias: [
      {
        find: '$styles',
        replacement: resolve(__dirname, 'src/lib/styles')
      },
      {
        find: '$service',
        replacement: '@horizon/core/src/lib/service'
      },
      {
        find: '$utils',
        replacement: '@horizon/core/src/lib/utils'
      }
    ]
  }
})
