const { spawn } = require('child_process')
const path = require('path')

const external_deps_path = path.resolve(__dirname, '..', 'external-deps')
const sqlite_vss_libs_path = path.resolve(external_deps_path, 'sqlite-vss')
const libtorch_path = path.resolve(external_deps_path, 'libtorch')
const libtorch_libs_path = path.join(libtorch_path, 'lib')

console.log(external_deps_path, sqlite_vss_libs_path, libtorch_path, libtorch_libs_path)

if (process.platform === 'win32') {
  process.env.Path += `;${libtorch_libs_path}`
  process.env.Path += `;${sqlite_vss_libs_path}`
} else {
  // no need to set any variables on macOS/Linux, @rpath should be taking care of that.
  // `LIBS` on windows exists as an alternative, but need to investigate further.
}

process.env.LIBTORCH = libtorch_path

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
