const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.platform === 'darwin') {
  const frameworksPath = path.resolve(
    __dirname,
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
}

if (process.platform === 'linux') {
  process.env.ELECTRON_OZONE_PLATFORM_HINT = 'auto'
}
process.env.TESSDATA_PREFIX = path.resolve(__dirname, '..', 'resources', 'tessdata')
process.env.M_VITE_PRODUCT_NAME = 'Surf-dev'
process.env.RUST_LOG = process.env.RUST_LOG || 'none,backend_server=INFO,backend=DEBUG'

const extraArgsIndex = process.argv.indexOf('--')
const extraArgs = extraArgsIndex !== -1 ? process.argv.slice(extraArgsIndex + 1) : []

const command = 'electron-vite'
const args = ['dev', '-w', ...extraArgs]

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
