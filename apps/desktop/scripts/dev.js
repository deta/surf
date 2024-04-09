const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const external_deps_path = path.resolve(__dirname, '..', 'external-deps')
const libtorch_path = path.resolve(external_deps_path, 'libtorch')
const libtorch_libs_path = path.join(libtorch_path, 'lib')

if (process.platform === 'win32') {
  process.env.Path += `;${libtorch_libs_path}`
} else {
  process.env.LD_LIBRARY_PATH = `${libtorch_libs_path}:${process.env.LD_LIBRARY_PATH || ''}`
}

let usearch_path = path.join(external_deps_path, 'libusearch_sqlite')
switch (process.platform) {
  case 'win32':
    usearch_path += '.dll'
    break
  case 'darwin':
    usearch_path += '.dylib'
    break
  case 'linux':
    usearch_path += '.so'
    break
  default:
    throw new Error(`unsupported platform: ${process.platform}`)
}

if (process.platform === 'darwin') {
  const frameworksPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'node_modules',
    'electron',
    'dist',
    'Electron.app',
    'Contents',
    'Frameworks'
  )

  if (!fs.existsSync(frameworksPath)) {
    console.error('`Frameworks` directory not found:', frameworksPath)
    process.exit(1)
  }

  fs.readdirSync(libtorch_libs_path).forEach((file) => {
    const src = path.join(libtorch_libs_path, file)
    const dest = path.join(frameworksPath, file)
    fs.copyFileSync(src, dest)
  })

  const usearchDest = path.join(frameworksPath, path.basename(usearch_path))
  fs.copyFileSync(usearch_path, usearchDest)
}

process.env.TESSDATA_PREFIX = path.resolve(__dirname, '..', 'resources', 'tessdata')
process.env.LIBTORCH = libtorch_path
process.env.HORIZON_LIBUSEARCH_SQLITE = usearch_path
process.env.M_VITE_PRODUCT_NAME = 'Horizon-dev'

const extraArgsIndex = process.argv.indexOf('--')
const extraArgs = extraArgsIndex !== -1 ? process.argv.slice(extraArgsIndex + 1) : []

const command = 'electron-vite'
const args = ['dev', ...extraArgs]

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env
})

child.on('error', (error) => {
  console.error(`error: ${error.message}`)
})

child.on('close', (code) => {
  console.log(`process exited with code ${code}`)
})
