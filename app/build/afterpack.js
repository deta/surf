const path = require('path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const { Arch } = require('electron-builder')

module.exports = async function afterPack(context) {
  const ext = {
    linux: '',
    darwin: '.app',
    win32: '.exe'
  }[context.electronPlatformName]

  let executableName = context.packager.appInfo.productName
  if (context.electronPlatformName === 'linux') {
    // for linux builds, for some unknown reason, the executable built is always lowercased
    // and DOES NOT respect the productName from the electron builder config file
    // so we have to manually correct the binary path to match the path that exists in the filesystem
    executableName = 'desktop'
    if (process.env.BUILD_TAG) {
      // the build tag is appended to the executable name, so we have to remove it
      const buildTagSuffix = `-${process.env.BUILD_TAG}`
      if (executableName.endsWith(buildTagSuffix)) {
        executableName = executableName.slice(0, -buildTagSuffix.length)
      }
    }
    executableName = executableName.toLowerCase().split(' ')[0]
  }
  const electronBinaryPath = path.join(context.appOutDir, `${executableName}${ext}`)

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature:
      context.electronPlatformName === 'darwin' && context.arch === Arch.arm64,
    [FuseV1Options.EnableCookieEncryption]: true
  })
}
