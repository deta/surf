const { spawn } = require('child_process')

const extraArgsIndex = process.argv.indexOf('--')
const extraArgs = extraArgsIndex !== -1 ? process.argv.slice(extraArgsIndex + 1) : []

const command = 'cargo-cp-artifact'
const args = [
  '-nc',
  'index.node',
  '--',
  'cargo',
  'build',
  '--message-format=json-render-diagnostics',
  ...extraArgs
]

const env = {
  // RUST_LOG: 'info'
}

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...env }
})

child.on('error', (error) => {
  console.error(`error: ${error.message}`)
  process.exit(1)
})

child.on('close', (code) => {
  console.log(`process exited with code ${code}`)
  process.exit(code)
})
