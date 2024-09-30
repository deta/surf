import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'
// import { sentryVitePlugin } from '@sentry/vite-plugin'
import replace from '@rollup/plugin-replace'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import obfuscator from 'rollup-plugin-obfuscator'

const disableAllObfuscation =
  process.env.DISABLE_ALL_OBFUSCATION === 'true' || process.env.NODE_ENV === 'development'

export default defineConfig({
  main: {
    envPrefix: 'M_VITE_',
    plugins: [
      externalizeDepsPlugin(),
      ...(!disableAllObfuscation ? [bytecodePlugin({ removeBundleJS: true })] : [])
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform)
    }
  },
  preload: {
    envPrefix: 'P_VITE_',
    plugins: [
      svelte(),
      externalizeDepsPlugin({ exclude: ['@horizon/backend'] }),
      cssInjectedByJsPlugin({
        jsAssetsFilterFunction: (asset) => asset.fileName.endsWith('webview.js'),
        injectCode: (cssCode, _options) => {
          return `window.addEventListener('DOMContentLoaded', () => { try{if(typeof document != 'undefined'){var elementStyle = document.createElement('style');elementStyle.id="webview-styles";elementStyle.appendChild(document.createTextNode(${cssCode}));document.head.appendChild(elementStyle);}}catch(e){console.error('vite-plugin-css-injected-by-js', e);} })`
        }
      }),
      replace({
        'doc.documentElement.style': '{}'
      }),
      ...(!disableAllObfuscation
        ? [bytecodePlugin({ removeBundleJS: true, chunkAlias: ['horizon'] })]
        : [])
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
          ...(!disableAllObfuscation
            ? [
                obfuscator({
                  global: true,
                  options: {}
                })
              ]
            : [])
        ]
      },
      minify: !disableAllObfuscation
    }
  },

  renderer: {
    envPrefix: 'R_VITE_',
    plugins: [
      /*
      sentryVitePlugin({
        org: 'deta',
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false
      }),
      */
      Markdown({ mode: [Mode.MARKDOWN] }),
      svelte()
    ],
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          setup: resolve(__dirname, 'src/renderer/setup.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html')
        },
        external: ['html-minifier-terser/dist/htmlminifier.esm.bundle.js'],
        plugins: [
          ...(!disableAllObfuscation
            ? [
                obfuscator({
                  global: true,
                  options: {}
                })
              ]
            : [])
        ]
      },
      //sourcemap: disableAllObfuscation || process.env.NODE_ENV === 'development',
      minify: !disableAllObfuscation
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform)
    }
  }
})
