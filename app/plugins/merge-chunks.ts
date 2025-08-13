import { build } from 'esbuild'
import fs from 'fs/promises'
import path from 'path'
import glob from 'fast-glob'
import type { Plugin } from 'vite'

export function esbuildConsolidatePreloads(outDir: string): Plugin {
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

        await build({
          entryPoints: [preloadPath],
          outfile: tmpOut,
          bundle: true,
          format: 'cjs',
          platform: 'node',
          sourcemap: true,
          external: ['electron', '@deta/backend'] // Add other node builtins as needed
        })

        await fs.rename(tmpOut, preloadPath)
        await fs.rename(tmpMapOut, mapPath)
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
