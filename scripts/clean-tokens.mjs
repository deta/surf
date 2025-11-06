#!/usr/bin/env node

import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const directories = [
  'packages/ui/src/lib/styles',
  'packages/ui/dist/styles',
  'packages/ui/.svelte-kit/__package__/styles'
]

const cleanDuplicateTokens = async () => {
  console.log('🧹 Cleaning duplicate tokens files...')

  for (const dir of directories) {
    try {
      const files = await readdir(dir)
      const duplicatePattern = /^tokens \d+\.css$/
      let removedCount = 0

      for (const file of files) {
        if (duplicatePattern.test(file)) {
          const filePath = join(dir, file)
          await unlink(filePath)
          console.log(`  ✅ Removed: ${file}`)
          removedCount++
        }
      }

      if (removedCount === 0) {
        console.log(`  ✨ No duplicates found in ${dir}`)
      } else {
        console.log(`  🗑️  Removed ${removedCount} duplicates from ${dir}`)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`  ⚠️  Warning: Could not clean ${dir}: ${error.message}`)
      }
    }
  }

  console.log('✨ Cleanup complete!')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanDuplicateTokens().catch(console.error)
}

export { cleanDuplicateTokens }