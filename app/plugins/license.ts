import { join } from 'path'
import licensePlugin from 'rollup-plugin-license'
import concat from './concat'
import type { Plugin } from 'vite'

const createLicenseOutputPath = (process: string) => {
  return join(__dirname, 'out', 'licenses', `dependencies-${process}.txt`)
}

export const createLicensePlugin = (process: string) => {
  return licensePlugin({
    thirdParty: {
      multipleVersions: false,
      output: {
        file: createLicenseOutputPath(process)
      }
    }
  }) as Plugin
}

export const createConcatLicensesPlugin = () => {
  return concat({
    groupedFiles: [
      {
        files: [
          createLicenseOutputPath('main'),
          createLicenseOutputPath('preload'),
          createLicenseOutputPath('renderer')
        ],
        outputFile: join('assets', 'dependencies.txt')
      }
    ]
  }) as Plugin
}
