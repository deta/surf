const path = require('path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const { Arch } = require('electron-builder')

module.exports = async function afterPack(context) {
  const ext = {
    darwin: '.app',
    win32: '.exe'
  }[context.electronPlatformName]

  const executableName = context.packager.appInfo.productFilename
  const electronBinaryPath = path.join(context.appOutDir, `${executableName}${ext}`)

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature:
      context.electronPlatformName === 'darwin' && context.arch === Arch.arm64,
    [FuseV1Options.EnableCookieEncryption]: true
  })
}
