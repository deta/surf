import { app } from 'electron'

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
