import { resolve } from 'path'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import dts from 'vite-plugin-dts'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    dts({
      include: ['src/lib'],
      tsconfigPath: './tsconfig.json',
      beforeWriteFile: (filePath, content) => {
        // Add Svelte component type for .svelte.d.ts files
        if (filePath.endsWith('.svelte.d.ts')) {
          content = content.replace(
            'declare const _default',
            'declare const _default: import("svelte").ComponentType'
          )
        }
        return { filePath, content }
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
  }
})
