import { app } from 'electron'
import { execSync } from 'child_process'
import path from 'path'

const isDefaultBrowserWindows = async () => {
  try {
    const httpProgId = execSync(
      'reg query HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice /v ProgId',
      { encoding: 'utf-8' }
    ).toString()

    const httpsProgId = execSync(
      'reg query HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice /v ProgId',
      { encoding: 'utf-8' }
    ).toString()

    const appProgId = 'ea.browser.deta.surf'

    const isHttpDefault = httpProgId.includes(appProgId)
    const isHttpsDefault = httpsProgId.includes(appProgId)

    return isHttpDefault || isHttpsDefault
  } catch (error) {
    console.error('error checking default browser on Windows:', error)
    return false
  }
}

const isDefaultBrowserLinux = async () => {
  return false
}

const isDefaultBrowserMac = async () => {
  const isHttpDefault = app.isDefaultProtocolClient('http')
  const isHttpsDefault = app.isDefaultProtocolClient('https')

  return isHttpDefault || isHttpsDefault
}

export const isDefaultBrowser = async () => {
  switch (getPlatform()) {
    case 'windows':
      return await isDefaultBrowserWindows()
    case 'linux':
      return await isDefaultBrowserLinux()
    case 'mac':
      return await isDefaultBrowserMac()
    default:
      return false
  }
}

export const getPlatform = () => {
  const platform = import.meta.env.PLATFORM

  if (platform === 'darwin') {
    return 'mac'
  }

  if (platform === 'win32') {
    return 'windows'
  }

  return 'linux'
}

export const isPathSafe = (basePath: string, filePath: string): boolean => {
  return path.resolve(basePath, filePath).startsWith(path.resolve(basePath))
}

export const normalizeElectronUserAgent = (current: string): string => {
  return current
    .split(' ')
    .filter((part) => !part.startsWith('Surf/') && !part.startsWith('Electron/'))
    .join(' ')
    .replace(
      process.versions.chrome || '',
      process.versions?.chrome
        ? process.versions.chrome
            .split('.')
            .map((v, idx) => (idx === 0 ? v : '0'))
            .join('.')
        : ''
    )
}

export const firefoxUA = (() => {
  const platformMap = {
    darwin: 'Macintosh; Intel Mac OS X 10.15',
    win32: 'Windows NT 10.0; Win64; x64',
    linux: 'X11; Linux x86_64'
  }
  const platform = platformMap[process.platform] || platformMap.linux
  // estimate the firefox version
  const fxVersion = 91 + Math.floor((Date.now() - 1628553600000) / (4.1 * 7 * 24 * 60 * 60 * 1000))
  return `Mozilla/5.0 (${platform}; rv:${fxVersion}.0) Gecko/20100101 Firefox/${fxVersion}.0`
})()
