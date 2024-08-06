const { spawn } = require('child_process')
// const path = require('path')

// TODO: we don't have any use for this
// at the moment.
//
// const external_deps_path = path.resolve(
//   __dirname,
//   '..',
//   '..',
//   '..',
//   'apps',
//   'desktop',
//   'external-deps'
// )

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
