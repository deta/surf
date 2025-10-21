import { spawnSync } from 'child_process'
import { join } from 'path'
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs'
import type { Plugin } from 'vite'

const NOTICE_FILE_VARIATIONS = [
  'NOTICE',
  'NOTICE.txt',
  'NOTICE.md',
  'Notice',
  'notice',
  'notice.txt',
  'notice.md'
]

const isApacheLicense = (license: string): boolean => {
  if (!license) return false
  const normalized = license.toLowerCase()
  return normalized.includes('apache')
}

const findNoticeInCargoRegistry = (packageName: string, version: string): string | null => {
  const cargoHome = process.env.CARGO_HOME || join(process.env.HOME || '', '.cargo')
  const registryPath = join(cargoHome, 'registry', 'src')

  try {
    if (!existsSync(registryPath)) {
      console.warn(`Registry path does not exist: ${registryPath}`)
      return null
    }

    const registries = readdirSync(registryPath)

    for (const registry of registries) {
      const packageDir = join(registryPath, registry, `${packageName}-${version}`)

      if (existsSync(packageDir)) {
        for (const noticeFile of NOTICE_FILE_VARIATIONS) {
          const noticePath = join(packageDir, noticeFile)
          if (existsSync(noticePath)) {
            console.log(`Found NOTICE file for ${packageName}@${version}: ${noticePath}`)
            return readFileSync(noticePath, 'utf8')
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Could not search cargo registry for NOTICE file: ${error}`)
  }

  return null
}

interface UsedBy {
  name: string
  version: string
  license: string
  repository?: string
  description?: string
  authors: string[]
}

interface License {
  id: string
  name: string
  text: string
  source_path?: string
  used_by: UsedBy[]
}

const generateCargoLicenseFile = (cargoTomlPath: string, outputPath: string) => {
  const absoluteCargoPath = join(process.cwd(), '..', cargoTomlPath)
  console.log(
    `Generating cargo license file for ${cargoTomlPath} at ${outputPath} (absolute path: ${absoluteCargoPath})`
  )

  const templatePath = join(absoluteCargoPath, 'about.hbs')
  if (!existsSync(templatePath)) {
    throw new Error(
      `Template file not found at ${templatePath}. Please create an about.hbs file in your Cargo project root.`
    )
  }

  const configPath = join(absoluteCargoPath, 'about.toml')
  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Please create an about.toml file in your Cargo project root.`
    )
  }

  const result = spawnSync(
    'cargo',
    ['about', 'generate', '--all-features', '--config', 'about.toml', 'about.hbs'],
    {
      cwd: absoluteCargoPath,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:${process.env.HOME}/.cargo/bin`
      }
    }
  )

  if (result.error) {
    throw new Error(`Failed to generate license info: ${result.error}`)
  }

  if (result.status !== 0) {
    throw new Error(
      `cargo-about failed with status ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    )
  }

  console.log(`Cargo about generated license info successfully`)

  const licenses: License[] = JSON.parse(result.stdout)
  let output = ''

  for (const license of licenses) {
    for (const pkg of license.used_by) {
      output += `Name: ${pkg.name}\n`
      output += `Version: ${pkg.version}\n`
      output += `License: ${pkg.license || 'Unknown'}\n`

      if (pkg.description) {
        output += `Description: ${pkg.description}\n`
      }

      if (pkg.repository) {
        output += `Repository: ${pkg.repository}\n`
      }

      if (pkg.authors && pkg.authors.length > 0) {
        output += `Authors: ${pkg.authors.join(', ')}\n`
      }

      // we need this for NOTICE files for Apache
      if (isApacheLicense(pkg.license)) {
        const noticeContent = findNoticeInCargoRegistry(pkg.name, pkg.version)
        if (noticeContent) {
          output += '\nNOTICE:\n```\n'
          output += noticeContent
          output += '\n```\n'
        } else {
          output += '\nNOTICE: Not found in package (Apache license may require NOTICE file)\n'
        }
      }

      if (license.text) {
        output += `\nLicense Text (${license.name}):\n`
        output += '```\n'
        output += license.text
        output += '\n```\n'
      }

      output += '\n---\n\n'
    }
  }

  writeFileSync(outputPath, output)
  console.log(`License file written to ${outputPath}`)
}

export const createRustLicensePlugin = (cargoTomlPath: string, outputName: string) => {
  const outputPath = join(process.cwd(), 'plugins', 'out', 'licenses', outputName)

  return {
    name: 'vite-plugin-rust-license',
    generateBundle() {
      try {
        console.log(`Generating Rust license info for ${cargoTomlPath}...`)
        this.info(`Generating Rust license info for ${cargoTomlPath}...`)
        generateCargoLicenseFile(cargoTomlPath, outputPath)
      } catch (error) {
        this.warn(`Failed to generate Rust license info: ${error}`)
        console.error(error)
      }
    }
  } as Plugin
}
