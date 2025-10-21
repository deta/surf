import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'
import replace from '@rollup/plugin-replace'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { esbuildConsolidatePreloads } from './plugins/merge-chunks'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { createConcatLicensesPlugin, createLicensePlugin } from './plugins/license'
import { createRustLicensePlugin } from './plugins/rust-license'

const IS_DEV = process.env.NODE_ENV === 'development'

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
    plugins: [externalizeDepsPlugin(), createLicensePlugin('main')],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          imageProcessor: resolve(__dirname, 'src/main/workers/imageProcessor.ts')
        }
      }
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform),
      'process.platform': JSON.stringify(process.platform)
    },
    css: cssConfig
  },
  preload: {
    envPrefix: 'P_VITE_',
    plugins: [
      svelte(svelteOptions),
      externalizeDepsPlugin({ exclude: ['@deta/backend'] }),
      esbuildConsolidatePreloads('out/preload'),
      cssInjectedByJsPlugin({
        jsAssetsFilterFunction: (asset) => asset.fileName.endsWith('webcontents.js'),
        injectCode: (cssCode, _options) => {
          return `window.addEventListener('DOMContentLoaded', () => { try{if(typeof document != 'undefined'){var elementStyle = document.createElement('style');elementStyle.id="webview-styles";elementStyle.appendChild(document.createTextNode(${cssCode}));document.head.appendChild(elementStyle);}}catch(e){console.error('vite-plugin-css-injected-by-js', e);} })`
        }
      }),
      replace({
        'doc.documentElement.style': '{}'
      }),
      createLicensePlugin('preload')
    ],
    build: {
      rollupOptions: {
        input: {
          core: resolve(__dirname, 'src/preload/core.ts'),
          webcontents: resolve(__dirname, 'src/preload/webcontents.ts'),
          overlay: resolve(__dirname, 'src/preload/overlay.ts'),
          resource: resolve(__dirname, 'src/preload/resource.ts')
        }
      },
      sourcemap: false,
      minify: true
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform),
      'process.platform': JSON.stringify(process.platform)
    },
    css: cssConfig
  },
  renderer: {
    envPrefix: 'R_VITE_',
    plugins: [
      Markdown({ mode: [Mode.MARKDOWN, Mode.HTML] }),
      svelte(svelteOptions),
      createLicensePlugin('renderer'),
      // needed for gray-matter dependency
      nodePolyfills({
        globals: {
          Buffer: true
        }
      }),
      createRustLicensePlugin('packages/backend', 'dependencies-backend.txt'),
      createRustLicensePlugin('packages/backend-server', 'dependencies-backend-server.txt'),
      createConcatLicensesPlugin()
    ],
    build: {
      sourcemap: false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/Core/core.html'),
          settings: resolve(__dirname, 'src/renderer/Settings/settings.html'),
          pdf: resolve(__dirname, 'src/renderer/PDF/pdf.html'),
          overlay: resolve(__dirname, 'src/renderer/Overlay/overlay.html'),
          resource: resolve(__dirname, 'src/renderer/Resource/resource.html')
        },
        external: [
          'html-minifier-terser/dist/htmlminifier.esm.bundle.js',
          '@internationalized/date'
        ],
        output: {
          format: 'es',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      },
      minify: true
    },
    define: {
      'import.meta.env.PLATFORM': JSON.stringify(process.platform),
      'process.platform': JSON.stringify(process.platform)
    },
    css: cssConfig
  }
})
