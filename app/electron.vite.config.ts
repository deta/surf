import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve, sep } from 'path'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'
// import { sentryVitePlugin } from '@sentry/vite-plugin'
import replace from '@rollup/plugin-replace'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import obfuscator from 'rollup-plugin-obfuscator'
import { createConcatLicensesPlugin, createLicensePlugin } from './plugins/license'
import { esbuildConsolidatePreloads } from './plugins/merge-chunks'

const IS_DEV = process.env.NODE_ENV === 'development'
const disableAllObfuscation = process.env.DISABLE_ALL_OBFUSCATION === 'true' || IS_DEV

// TODO: actually fix the warnings in the code
const silenceWarnings = IS_DEV || process.env.SILENCE_WARNINGS === 'true'

const svelteOptions = silenceWarnings
  ? {
      onwarn: (warning, handler) => {
        if (warning.code.toLowerCase().includes('a11y')) return
        handler(warning)
      }
    }
  : {}

const cssConfig = silenceWarnings
  ? {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api', 'mixed-decls']
        }
      }
    }
  : {
      preprocessorOptions: {
        scss: {}
      }
    }

export default defineConfig({
  main: {
    envPrefix: 'M_VITE_',
    plugins: [
      externalizeDepsPlugin(),
      createLicensePlugin('main'),
      ...(!disableAllObfuscation ? [bytecodePlugin({ removeBundleJS: true })] : [])
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          imageProcessor: resolve(__dirname, 'src/main/workers/imageProcessor.ts')
        }
      }
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform)
    },
    css: cssConfig,
    resolve: {
      alias: [
        {
          find: '$styles',
          replacement: resolve(__dirname, '../../packages/core/src/lib/styles')
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
  },
  preload: {
    envPrefix: 'P_VITE_',
    plugins: [
      svelte(svelteOptions),
      externalizeDepsPlugin({ exclude: ['@deta/backend'] }),
      esbuildConsolidatePreloads('out/preload'),
      cssInjectedByJsPlugin({
        jsAssetsFilterFunction: (asset) => asset.fileName.endsWith('webview.js'),
        injectCode: (cssCode, _options) => {
          return `window.addEventListener('DOMContentLoaded', () => { try{if(typeof document != 'undefined'){var elementStyle = document.createElement('style');elementStyle.id="webview-styles";elementStyle.appendChild(document.createTextNode(${cssCode}));document.head.appendChild(elementStyle);}}catch(e){console.error('vite-plugin-css-injected-by-js', e);} })`
        }
      }),
      replace({
        'doc.documentElement.style': '{}'
      }),
      createLicensePlugin('preload')
      // ...(!disableAllObfuscation
      //   ? [bytecodePlugin({ removeBundleJS: true, chunkAlias: ['horizon'] })]
      //   : [])
    ],
    build: {
      rollupOptions: {
        input: {
          horizon: resolve(__dirname, 'src/preload/horizon.ts'),
          webview: resolve(__dirname, 'src/preload/webview.ts'),
          updates: resolve(__dirname, 'src/preload/updates.ts'),
          announcements: resolve(__dirname, 'src/preload/announcements.ts'),
          setup: resolve(__dirname, 'src/preload/setup.ts'),
          overlay: resolve(__dirname, 'src/preload/overlay.ts')
        },
        external: ['@deta/services/src/ipc'],
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
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform)
    },
    css: cssConfig
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
      Markdown({ mode: [Mode.MARKDOWN, Mode.HTML] }),
      svelte(svelteOptions),
      // createLicensePlugin('renderer'),
      createConcatLicensesPlugin()
    ],
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/Core/core.html'),
          setup: resolve(__dirname, 'src/renderer/Setup/setup.html'),
          settings: resolve(__dirname, 'src/renderer/Settings/settings.html'),
          updates: resolve(__dirname, 'src/renderer/Updates/updates.html'),
          pdf: resolve(__dirname, 'src/renderer/PDF/pdf.html'),
          announcements: resolve(__dirname, 'src/renderer/Announcements/announcements.html'),
          overlay: resolve(__dirname, 'src/renderer/Overlay/overlay.html')
        },
        external: ['html-minifier-terser/dist/htmlminifier.esm.bundle.js'],
        preserveEntrySignatures: 'strict',
        output: {
          preserveModules: true
        },
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
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
      //sourcemap: disableAllObfuscation || process.env.NODE_ENV === 'development',
      minify: !disableAllObfuscation
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform)
    },
    css: cssConfig,
    resolve: {
      alias: [
        {
          find: '$styles',
          replacement: resolve(__dirname, '../../packages/core/src/lib/styles')
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
  }
})
