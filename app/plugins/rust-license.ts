import { spawnSync } from 'child_process'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
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
    [
      'about',
      'generate',
      '--all-features',
      '--config',
      'about.toml',
      '--output-file',
      outputPath,
      'about.hbs'
    ],
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

  if (!existsSync(outputPath)) {
    throw new Error(`cargo-about did not create output file at ${outputPath}`)
  }

  let content = readFileSync(outputPath, 'utf8')

  const packageRegex = /Name: (.+?)\nVersion: (.+?)\nLicense: (.+?)\n/g
  const insertions: { index: number; content: string }[] = []

  let match: RegExpExecArray | null
  while ((match = packageRegex.exec(content)) !== null) {
    const [fullMatch, name, version, license] = match

    if (isApacheLicense(license)) {
      const noticeContent = findNoticeInCargoRegistry(name, version)
      const insertIndex = match.index + fullMatch.length

      if (noticeContent) {
        const noticeBlock = `\nNOTICE:\n\`\`\`\n${noticeContent}\n\`\`\`\n`
        insertions.push({ index: insertIndex, content: noticeBlock })
      }
    }
  }

  insertions.reverse()
  for (const { index, content: insertContent } of insertions) {
    content = content.slice(0, index) + insertContent + content.slice(index)
  }

  writeFileSync(outputPath, content)
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
