import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  main: {
    envPrefix: 'M_VITE_',
    plugins: [externalizeDepsPlugin()]
  },

  preload: {
    envPrefix: 'P_VITE_',
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
    envPrefix: 'R_VITE_',
    plugins: [
      svelte(),
      sentryVitePlugin({
        org: 'deta',
        project: 'space-os-early-adopters'
      })
    ],
    build: {
      sourcemap: true
    }
  }
})
