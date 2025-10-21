import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'
// import { sentryVitePlugin } from '@sentry/vite-plugin'
import replace from '@rollup/plugin-replace'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import obfuscator from 'rollup-plugin-obfuscator'
// import { createConcatLicensesPlugin, createLicensePlugin } from './plugins/license'
import { esbuildConsolidatePreloads } from './plugins/merge-chunks'
import { ObfuscatorOptions } from 'javascript-obfuscator'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { createConcatLicensesPlugin, createLicensePlugin } from './plugins/license'
import { createRustLicensePlugin } from './plugins/rust-license'

const IS_DEV = process.env.NODE_ENV === 'development'
const disableBytecode = process.env.DISABLE_BYTECODE === 'true' || IS_DEV
const disableRendererObfuscation = process.env.DISABLE_RENDERER_OBFUSCATION === 'true' || IS_DEV
const disablePreloadObfuscation = process.env.DISABLE_PRELOAD_OBFUSCATION === 'true' || IS_DEV

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

const customObfuscator = (options?: Partial<ObfuscatorOptions>) => {
  const plugin = obfuscator({
    global: true,
    options: {
      compact: true,
      target: 'browser',
      ...options
    }
  })

  const originalRenderChunk = plugin.renderChunk

  plugin.renderChunk = function (code, chunk) {
    console.log(`🔍 Attempting to obfuscate: ${chunk.fileName}`)
    try {
      // @ts-ignore
      const result = originalRenderChunk.call(this, code, chunk)
      console.log(`✅ Successfully obfuscated: ${chunk.fileName}`)
      return result
    } catch (error: any) {
      console.warn(`⚠️Obfuscation failed for ${chunk.fileName}, skipping...`)
      console.warn(`📝 Error: ${error}`)
      console.warn(`🔄 Returning original code unchanged`)
      return {
        code: code,
        map: null
      }
    }
  }

  return plugin
}

export default defineConfig({
  main: {
    envPrefix: 'M_VITE_',
    plugins: [
      externalizeDepsPlugin(),
      createLicensePlugin('main'),
      ...(!disableBytecode ? [bytecodePlugin({ removeBundleJS: true })] : [])
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
      esbuildConsolidatePreloads('out/preload', {
        obfuscate: !disablePreloadObfuscation
      }),
      cssInjectedByJsPlugin({
        jsAssetsFilterFunction: (asset) => asset.fileName.endsWith('webcontents.js'),
        injectCode: (cssCode, _options) => {
          return `window.addEventListener('DOMContentLoaded', () => { try{if(typeof document != 'undefined'){var elementStyle = document.createElement('style');elementStyle.id="webview-styles";elementStyle.appendChild(document.createTextNode(${cssCode}));document.head.appendChild(elementStyle);}}catch(e){console.error('vite-plugin-css-injected-by-js', e);} })`
        }
      }),
      replace({
        'doc.documentElement.style': '{}'
      }),
      createLicensePlugin('preload'),
      ...(!disableBytecode
        ? [bytecodePlugin({ removeBundleJS: true, chunkAlias: ['horizon'] })]
        : [])
    ],
    build: {
      rollupOptions: {
        input: {
          core: resolve(__dirname, 'src/preload/core.ts'),
          webcontents: resolve(__dirname, 'src/preload/webcontents.ts'),
          updates: resolve(__dirname, 'src/preload/updates.ts'),
          announcements: resolve(__dirname, 'src/preload/announcements.ts'),
          setup: resolve(__dirname, 'src/preload/setup.ts'),
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
          setup: resolve(__dirname, 'src/renderer/Setup/setup.html'),
          settings: resolve(__dirname, 'src/renderer/Settings/settings.html'),
          updates: resolve(__dirname, 'src/renderer/Updates/updates.html'),
          pdf: resolve(__dirname, 'src/renderer/PDF/pdf.html'),
          announcements: resolve(__dirname, 'src/renderer/Announcements/announcements.html'),
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
        },
        plugins: [...(!disableRendererObfuscation ? [customObfuscator()] : [])]
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
