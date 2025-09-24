import { build } from 'esbuild'
import fs from 'fs/promises'
import path from 'path'
import glob from 'fast-glob'
import type { Plugin } from 'vite'
import JavaScriptObfuscator from 'javascript-obfuscator'
import type { ObfuscatorOptions } from 'javascript-obfuscator'

interface ConsolidateOptions {
  obfuscate?: boolean
  obfuscatorOptions?: ObfuscatorOptions
}

export function esbuildConsolidatePreloads(
  outDir: string,
  options: ConsolidateOptions = {}
): Plugin {
  const { obfuscate = false, obfuscatorOptions = {} } = options

  return {
    name: 'esbuild-consolidate-preloads',
    apply: 'build',
    enforce: 'post',

    async closeBundle() {
      const outAbs = path.resolve(outDir)
      const preloadFiles = await glob('*.js', { cwd: outAbs, absolute: true })
      const chunkDir = path.join(outAbs, 'chunks')

      for (const preloadPath of preloadFiles) {
        const filename = path.basename(preloadPath)
        const tmpOut = preloadPath + '.tmp'
        const tmpMapOut = tmpOut + '.map'
        const mapPath = preloadPath + '.map'

        console.log(`[esbuild-consolidate] bundling ${filename} → ${filename}`)

        // First get all the chunks that are imported by this preload
        const chunkFiles = await glob('chunks/**/*.js', {
          cwd: outAbs,
          absolute: true
        })

        // Read the contents of all chunks
        const chunks = new Map()
        for (const chunkPath of chunkFiles) {
          const relativePath = path.relative(outAbs, chunkPath)
          const content = await fs.readFile(chunkPath, 'utf8')
          // Store both the full path and the relative path for resolution
          chunks.set('./' + relativePath, {
            content,
            dir: path.dirname(chunkPath)
          })
        }

        await build({
          entryPoints: [preloadPath],
          outfile: tmpOut,
          bundle: true,
          format: 'cjs',
          platform: 'node',
          sourcemap: !obfuscate, // Disable sourcemap if obfuscating
          external: ['electron', '@deta/backend', 'electron-chrome-extensions'], // Add other node builtins as needed
          loader: {
            '.js': 'js'
          },
          plugins: [
            {
              name: 'inline-chunks',
              setup(build) {
                // Intercept imports of chunk files and return their content
                // Handle all relative imports
                build.onResolve({ filter: /^\.\.?\/.*/ }, (args) => {
                  // Try to resolve relative to the current file
                  const targetPath = path.resolve(args.resolveDir, args.path)
                  const relativePath = './' + path.relative(outAbs, targetPath)

                  // Check if this is a chunk we know about
                  if (chunks.has(relativePath)) {
                    return { path: relativePath, namespace: 'chunks' }
                  }

                  // If the path contains 'chunks/', try to find a matching chunk
                  if (args.path.includes('chunks/')) {
                    const chunkPath = './' + args.path.replace(/^\.\//, '')
                    if (chunks.has(chunkPath)) {
                      return { path: chunkPath, namespace: 'chunks' }
                    }
                  }

                  // Let esbuild handle other relative imports
                  return null
                })

                build.onLoad({ filter: /.*/, namespace: 'chunks' }, (args) => {
                  const chunk = chunks.get(args.path)
                  if (!chunk) {
                    throw new Error(`Could not find chunk ${args.path}`)
                  }
                  return {
                    contents: chunk.content,
                    loader: 'js',
                    resolveDir: chunk.dir
                  }
                })
              }
            }
          ],
          resolveExtensions: ['.ts', '.js'],
          mainFields: ['module', 'main'],
          banner: {
            js: '/* eslint-disable */'
          }
        })

        // Apply obfuscation if enabled
        if (obfuscate) {
          console.log(`[esbuild-consolidate] obfuscating ${filename}`)

          try {
            const bundledCode = await fs.readFile(tmpOut, 'utf8')

            const obfuscatedResult = JavaScriptObfuscator.obfuscate(bundledCode, {
              compact: true,
              target: 'node', // for preloads
              ...obfuscatorOptions
            })

            await fs.writeFile(tmpOut, obfuscatedResult.getObfuscatedCode())
            console.log(`[esbuild-consolidate] ✅ successfully obfuscated ${filename}`)
          } catch (error) {
            console.warn(
              `[esbuild-consolidate] ⚠️ obfuscation failed for ${filename}, using unobfuscated version`
            )
            console.warn(`[esbuild-consolidate] error:`, error)
          }
        }

        await fs.rename(tmpOut, preloadPath)

        // Only handle sourcemap if it exists
        try {
          if (!obfuscate) {
            await fs.rename(tmpMapOut, mapPath)
          } else {
            // Remove sourcemap file if obfuscating
            await fs.unlink(tmpMapOut).catch(() => {})
          }
        } catch (err) {
          // Sourcemap might not exist, ignore
        }
      }

      try {
        await fs.rm(chunkDir, { recursive: true, force: true })
        console.log(`[esbuild-consolidate] cleaned up ${chunkDir}`)
      } catch (err) {
        console.warn(`[esbuild-consolidate] cleanup failed:`, err)
      }
    }
  }
}
