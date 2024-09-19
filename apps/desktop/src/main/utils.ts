import { app } from 'electron'
import path from 'path'

export const isDefaultBrowser = () => {
  const isHttp = app.isDefaultProtocolClient('http')
  const isHttps = app.isDefaultProtocolClient('https')

  // TODO: we are registering ourselves for both but when checking only ones seems to be set, needs more investigation
  return isHttp || isHttps
}

export const getPlatform = () => {
  const platform = process.platform

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
