const { spawn } = require('child_process')
const path = require('path')

// would've been cool if we could somehow get the root horizon folder instead.
// this must be maintained whenever we do a relevant change.
// const libtorch_path = path.resolve(__dirname, '../../../apps/desktop/external-deps/libtorch');
// const libtorch_path = "C:\\Users\\null\\Downloads\\libtorch-win-shared-with-deps-2.2.0+cpu\\libtorch";
// const libtorch_path = "C:\\Users\\null\\workspace\\horizon\\apps\\desktop\\external-deps\\libtorch";
const external_deps_path = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'apps',
  'desktop',
  'external-deps'
)
const sqlite_vss_path = path.resolve(external_deps_path, 'sqlite-vss')
const libtorch_path = path.resolve(external_deps_path, 'libtorch')
const libtorch_libs_path = path.join(libtorch_path, 'lib')

if (process.platform === 'win32') {
  process.env.Path += `;${libtorch_libs_path}`
} else {
  // mb use DYLD_LIBRARY_PATH instead on macOS?
  process.env.LD_LIBRARY_PATH = `${libtorch_libs_path}:${process.env.LD_LIBRARY_PATH || ''}`
}

process.env.LIBTORCH = libtorch_path

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
