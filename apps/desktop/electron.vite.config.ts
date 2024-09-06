import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'
import replace from '@rollup/plugin-replace'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import obfuscator from 'rollup-plugin-obfuscator';
// import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  main: {
    envPrefix: 'M_VITE_',
    plugins: [externalizeDepsPlugin(), bytecodePlugin({ removeBundleJS: true })],
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
      }),
      bytecodePlugin({ removeBundleJS: true, chunkAlias: ['horizon'] })
    ],
    build: {
      rollupOptions: {
        input: {
          horizon: resolve(__dirname, 'src/preload/horizon.ts'),
          webview: resolve(__dirname, 'src/preload/webview.ts')
        },
        output: {
          manualChunks(id): string | void {
            if (id.includes('horizon.ts')) return 'horizon'
          }
        },
        plugins: [
          obfuscator({
            global: true,
            options: {}
          })
        ]
      },
      sourcemap: process.env.NODE_ENV === 'development',
      minify: !(process.env.NODE_ENV === 'development')
    }
  },

  renderer: {
    envPrefix: 'R_VITE_',
    plugins: [
      Markdown({ mode: [Mode.MARKDOWN] }),
      svelte()
    ],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          setup: resolve(__dirname, 'src/renderer/setup.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html')
        },
        external: ['html-minifier-terser/dist/htmlminifier.esm.bundle.js'],
        plugins: [
          obfuscator({
            global: true,
            options: {}
          })
        ]
      },
      sourcemap: process.env.NODE_ENV === 'development',
      minify: !(process.env.NODE_ENV === 'development')
    },
    define: {
      'process.env': {},
      'process.platform': JSON.stringify(process.platform)
    }
  }
})
