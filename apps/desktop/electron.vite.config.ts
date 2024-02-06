import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          horizon: resolve(__dirname, 'src/preload/horizon.ts'),
          webview: resolve(__dirname, 'src/preload/webview.ts')
        }
      }
    }
  },

  renderer: {
    plugins: [
      svelte(),
      sentryVitePlugin({
        org: "deta",
        project: "space-os-early-adopters"
      })
    ],
    build: {
      sourcemap: true
    },
  },
})
