/*
    Modified version of [rollup-plugin-concat](https://github.com/mdownes/rollup-plugin-concat)

    MIT License

    Copyright (c) 2023 mdownes

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

import fs from 'fs'
import { Plugin } from 'rollup'
import { createFilter } from 'rollup-pluginutils'

export type GroupedFiles = {
  files: string[]
  outputFile: string
}

export type Options = {
  include?: string | string[]
  exclude?: string | string[]
  groupedFiles?: GroupedFiles[]
}

export default function concat(options: Options = {}): Plugin {
  const filter = createFilter(options.include, options.exclude)
  const groupedFiles = options.groupedFiles || []

  return {
    name: 'concat',

    generateBundle() {
      for (const group of groupedFiles) {
        const files = group.files || []
        if (typeof group.outputFile === 'undefined') {
          throw new Error(
            'You must specify an outputFile property for each set of files to be concatenated.'
          )
        }

        let code = ''

        for (const file of files) {
          try {
            if (filter(file)) {
              const content = fs.readFileSync(file, 'utf8')
              code += `${content}\n`
            }
          } catch (err) {
            this.warn(`Error reading file "${file}": ${err}`)
          }
        }

        // Emit the main output file
        this.emitFile({
          type: 'asset',
          fileName: group.outputFile,
          source: code
        })
      }
    }
  }
}
