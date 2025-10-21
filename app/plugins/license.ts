import { join } from 'path'
import licensePlugin from 'rollup-plugin-license'
import concat from './concat'
import type { Plugin } from 'vite'
import fs from 'fs'

const createLicenseOutputPath = (process: string) => {
  return join(__dirname, 'out', 'licenses', `dependencies-${process}.txt`)
}

const createDependencyPath = (packageName: string) => {
  return join(__dirname, '..', '..', 'node_modules', packageName, 'package.json')
}

const readAllDependencies = (packageJsonPath: string) => {
  const visited = new Set<string>()
  const dependencies: string[] = []

  const traverse = (path: string) => {
    if (visited.has(path)) return
    visited.add(path)

    const content = fs.readFileSync(path, 'utf-8')
    const pkg = JSON.parse(content)

    if (pkg.name) {
      dependencies.push(path)
    }

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
      ...pkg.optionalDependencies
    }

    for (const depName of Object.keys(allDeps || {})) {
      try {
        const depPath = createDependencyPath(depName)
        traverse(depPath)
      } catch {
        // Ignore missing dependencies
      }
    }
  }

  traverse(packageJsonPath)
  return dependencies
}

export const createLicensePlugin = (process: string) => {
  let additionalDependencies
  if (process === 'main') {
    additionalDependencies = readAllDependencies(join(__dirname, '..', 'package.json'))
  }
  return licensePlugin({
    thirdParty: {
      multipleVersions: false,
      output: {
        file: createLicenseOutputPath(process)
      }
    },
    additionalDependencies
  }) as Plugin
}

export const createConcatLicensesPlugin = () => {
  return concat({
    groupedFiles: [
      {
        files: [
          createLicenseOutputPath('main'),
          createLicenseOutputPath('preload'),
          createLicenseOutputPath('renderer'),
          createLicenseOutputPath('backend'),
          createLicenseOutputPath('backend-server')
        ],
        outputFile: join('assets', 'dependencies.txt')
      }
    ]
  }) as Plugin
}
