// import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import replace from '@rollup/plugin-replace'
import { resolve } from 'path'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'

export default defineConfig({
  main: {
    envPrefix: 'M_VITE_',
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    envPrefix: 'P_VITE_',
    plugins: [
      svelte(),
      externalizeDepsPlugin({ exclude: ['@horizon/backend'] }),

      // Used to inject the styles from the preload script and svelte components into the webviews
      cssInjectedByJsPlugin({
        jsAssetsFilterFunction: (asset) => asset.fileName.endsWith('webview.js'),
        injectCode: (cssCode, _options) => {
          return `window.addEventListener('DOMContentLoaded', () => { try{if(typeof document != 'undefined'){var elementStyle = document.createElement('style');elementStyle.id="webview-styles";elementStyle.appendChild(document.createTextNode(${cssCode}));document.head.appendChild(elementStyle);}}catch(e){console.error('vite-plugin-css-injected-by-js', e);} })`
        }
      }),

      // This is needed to get our tiptap editor working in the preload script as it tries to access the document before it is ready
      replace({
        'doc.documentElement.style': '{}'
      })
    ],
    build: {
      rollupOptions: {
        input: {
          horizon: resolve(__dirname, 'src/preload/horizon.ts'),
          webview: resolve(__dirname, 'src/preload/webview.ts')
        },
        output: {
          // This is needed to prevent rollup from creating a separate chunk for the webview.ts file
          manualChunks(id) {
            if (id.includes('webview.ts')) {
              return 'webview'
            }

            return
          }
        }
      }
    }
  },

  renderer: {
    envPrefix: 'R_VITE_',
    plugins: [
      Markdown({ mode: [Mode.MARKDOWN] }),
      svelte()
      // sentryVitePlugin({
      //   org: 'deta',
      //   project: 'surf-early-adopters'
      // })
    ],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          setup: resolve(__dirname, 'src/renderer/setup.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html')
        }
      },
      sourcemap: true
    }
  }
})
