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
