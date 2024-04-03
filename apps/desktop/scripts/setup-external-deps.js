const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const { promisify } = require('util')
const _7z = require('7zip-min')

const mkdir = promisify(fs.mkdir)
const exists = promisify(fs.exists)

async function download_file(url, dest) {
  const file = fs.createWriteStream(dest)
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        response.pipe(file)
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err))
      })
    file.on('finish', () => file.close(resolve))
    file.on('error', (err) => {
      fs.unlink(dest, () => reject(err))
    })
  })
}

async function setup_macos() {
  const base_dir = './external-deps'
  const libtorch_dir = path.join(base_dir, 'libtorch')
  // resolve to the correct libtorch build (arm64:apple silicon, x64:intel)
  const libtorch_url = `https://download.pytorch.org/libtorch/cpu/libtorch-macos-${os.arch()}-2.2.0.zip`
  const temp_zip = './libtorch.zip'

  await mkdir(base_dir, { recursive: true })

  if (!(await exists(libtorch_dir)) || fs.readdirSync(libtorch_dir).length === 0) {
    console.log('downloading libtorch...')
    await download_file(libtorch_url, temp_zip)
    console.log('extracting libtorch...')
    _7z.unpack(temp_zip, base_dir, (err) => {
      if (err) console.error('extraction error:', err)
      else console.log('extraction complete')
      fs.unlinkSync(temp_zip)
    })
  }

  const libomp_dylib_source =
    execSync(`brew --prefix libomp`).toString().trim() + '/lib/libomp.dylib'
  const libomp_dylib_dest = path.join(libtorch_dir, 'lib', 'libomp.dylib')

  // libtorch requires libomp to be in @rpath for some reason
  if (!(await exists(libomp_dylib_dest))) {
    fs.copyFileSync(libomp_dylib_source, libomp_dylib_dest)
    fs.chmodSync(libomp_dylib_dest, 0o755)
  }
}

async function setup_windows() {
  const base_dir = './external-deps'
  const libtorch_dir = path.join(base_dir, 'libtorch')
  const libtorch_url =
    'https://download.pytorch.org/libtorch/cpu/libtorch-win-shared-with-deps-2.2.0%2Bcpu.zip'
  const temp_zip = './libtorch.zip'

  await mkdir(base_dir, { recursive: true })

  if (!(await exists(libtorch_dir)) || fs.readdirSync(libtorch_dir).length === 0) {
    console.log('downloading libtorch for Windows...')
    await download_file(libtorch_url, temp_zip)
    console.log('extracting libtorch...')
    _7z.unpack(temp_zip, base_dir, (err) => {
      if (err) console.error('extraction error:', err)
      else console.log('extraction complete')
      fs.unlinkSync(temp_zip)
    })
  }
}

async function setup_linux() {
  throw new Error('TODO: not yet implemented')
}

async function setup_dependencies() {
  switch (os.platform()) {
    case 'darwin':
      await setup_macos()
      break
    case 'win32':
      await setup_windows()
      break
    case 'linux':
      await setup_linux()
      break
    default:
      throw new Error(`unsupported platform: ${os.platform()}`)
  }
}

setup_dependencies().catch((error) => {
  console.error(error)
  process.exit(1)
})
