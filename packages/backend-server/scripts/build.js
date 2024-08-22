const { spawn } = require('child_process')
const { join } = require('path')

const binDir =
  process.env.RESOURCES_BIN_DIR || join(__dirname, '../../../apps/desktop/resources/bin')
const sourceBin = 'backend-server'
const targetBin = `surf-backend${process.platform === 'win32' ? '.exe' : ''}`
const targetBinPath = join(binDir, targetBin)
const extraArgsIndex = process.argv.indexOf('--')
const extraArgs = extraArgsIndex !== -1 ? process.argv.slice(extraArgsIndex + 1) : []

const command = 'cargo-cp-artifact'
const args = [
  '-nb',
  sourceBin,
  '--',
  'cargo',
  'build',
  '--message-format=json-render-diagnostics',
  ...extraArgs
]

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
  if (code !== 0) {
    console.log('error: build failed')
    process.exit(code)
  }
  console.log(`copying binary to ${targetBinPath}`)
  const fs = require('fs')
  try {
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir)
    }
    fs.copyFileSync(sourceBin, targetBinPath)
  } catch (err) {
    console.error(`error: ${err.message}`)
    process.exit(1)
  }
})
