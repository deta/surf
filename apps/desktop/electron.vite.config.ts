import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { resolve } from 'path'

export default defineConfig({
  main: {
    envPrefix: 'M_VITE_',
    plugins: [externalizeDepsPlugin()]
  },

  preload: {
    envPrefix: 'P_VITE_',
    plugins: [
      svelte(),
      externalizeDepsPlugin({ exclude: ['@horizon/backend'] }),
      cssInjectedByJsPlugin({
        injectCode: (cssCode, options) => {
          return `window.addEventListener('DOMContentLoaded', () => { try{if(typeof document != 'undefined'){var elementStyle = document.createElement('style');elementStyle.appendChild(document.createTextNode(${cssCode}));document.head.appendChild(elementStyle);}}catch(e){console.error('vite-plugin-css-injected-by-js', e);} })`
        }
      })
    ],
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
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          setup: resolve(__dirname, 'src/renderer/setup.html')
        }
      },
      sourcemap: true
    }
  }
})
