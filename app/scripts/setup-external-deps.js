const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const { promisify } = require('util')
const _7z = require('7zip-min')

const mkdir = promisify(fs.mkdir)
const exists = promisify(fs.exists)

async function download_file(url, destination, max_redirects = 3) {
  if (max_redirects === 0) {
    throw new Error('too many redirects')
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          resolve(download_file(response.headers.location, destination, max_redirects - 1))
        } else if (response.statusCode === 200) {
          const file_stream = fs.createWriteStream(destination)
          response.pipe(file_stream)
          file_stream.on('finish', () => {
            file_stream.close(() => resolve(`file downloaded successfully to ${destination}`))
          })
        } else {
          reject(
            new Error(
              `failed to download file: server responded with ${response.statusCode}: ${response.statusMessage}`
            )
          )
        }
      })
      .on('error', (err) => {
        reject(new Error(`request failed: ${err.message}`))
      })
  })
}

async function unpack(path, output) {
  return new Promise((fulfilled, rejected) => {
    _7z.unpack(path, output, (err) => {
      if (err) rejected(err)
      else fulfilled(null)
    })
  })
}

async function setup_macos() {
  const base_dir = path.join(process.cwd(), 'external-deps')
  const libtorch_dir = path.join(base_dir, 'libtorch')
  // resolve to the correct libtorch build (arm64:apple silicon, x64:intel)
  const libtorch_url = `https://download.pytorch.org/libtorch/cpu/libtorch-macos-${os.arch()}-2.2.0.zip`
  const temp_zip = './libtorch.zip'

  await mkdir(base_dir, { recursive: true })

  if (!(await exists(libtorch_dir)) || fs.readdirSync(libtorch_dir).length === 0) {
    console.log('downloading libtorch...')
    await download_file(libtorch_url, temp_zip)
    console.log('extracting libtorch...')
    await unpack(temp_zip, base_dir)
    fs.unlinkSync(temp_zip)
  }

  const libomp_dylib_source =
    execSync(`brew --prefix libomp`).toString().trim() + '/lib/libomp.dylib'
  const libomp_dylib_dest = path.join(libtorch_dir, 'lib', 'libomp.dylib')

  // libtorch requires libomp to be in @rpath for some reason
  if (!(await exists(libomp_dylib_dest))) {
    fs.copyFileSync(libomp_dylib_source, libomp_dylib_dest)
    fs.chmodSync(libomp_dylib_dest, 0o755)
  }

  await download_usearch_sqlite(base_dir)
}

async function setup_windows() {
  const base_dir = './external-deps'
  const libtorch_dir = path.join(base_dir, 'libtorch')
  const libtorch_url =
    'https://download.pytorch.org/libtorch/cpu/libtorch-win-shared-with-deps-2.2.0%2Bcpu.zip'
  const temp_zip = './libtorch.zip'

  await mkdir(base_dir, { recursive: true })

  if (!(await exists(libtorch_dir)) || fs.readdirSync(libtorch_dir).length === 0) {
    console.log('downloading libtorch...')
    await download_file(libtorch_url, temp_zip)
    console.log('extracting libtorch...')
    await unpack(temp_zip, base_dir)
    fs.unlinkSync(temp_zip)
  }

  await download_usearch_sqlite(base_dir)
}

async function setup_linux() {
  throw new Error('TODO: not yet implemented')
}

// TODO: this can be a lil better if the CI builds are named properly
async function download_usearch_sqlite(base_dir) {
  let filename
  switch (os.platform()) {
    case 'darwin':
      filename =
        os.arch() === 'arm64' ? 'usearch_sqlite_macos_arm.dylib' : 'usearch_sqlite_macos_x64.dylib'
      break
    case 'win32':
      filename =
        os.arch() === 'x64' ? 'usearch_sqlite_windows_x64.dll' : 'usearch_sqlite_windows_x86.dll'
      break
    case 'linux':
      filename =
        os.arch() === 'arm64' ? 'usearch_sqlite_linux_arm64.so' : 'usearch_sqlite_linux_amd64.so'
      break
    default:
      throw new Error(`unsupported platform: ${os.platform()}`)
  }

  const url = `https://github.com/deta/usearch/releases/latest/download/${filename}`
  const dest = path.join(base_dir, `libusearch_sqlite${path.extname(filename)}`)

  if (!(await exists(dest))) {
    console.log(`downloading ${filename} from ${url}...`)
    await download_file(url, dest)
    console.log(`${filename} downloaded to ${dest}`)

    if (os.platform() === 'darwin') execSync(`xattr -c "${dest}"`)
  }
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
