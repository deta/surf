const path = require('path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const { Arch } = require('electron-builder')

module.exports = async function afterPack(context) {
  const ext = {
    linux: '',
    darwin: '.app',
    win32: '.exe'
  }[context.electronPlatformName]

  let executableName = context.packager.appInfo.productFilename
  if (context.electronPlatformName === 'linux') executableName = executableName.toLowerCase()
  const electronBinaryPath = path.join(context.appOutDir, `${executableName}${ext}`)

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature:
      context.electronPlatformName === 'darwin' && context.arch === Arch.arm64,
    [FuseV1Options.EnableCookieEncryption]: true
  })
}
