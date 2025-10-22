import { app } from 'electron'
import { execSync } from 'child_process'
import path from 'path'
import { promises as fsp } from 'fs'
import mimeTypes from 'mime-types'

export let isAppSetup = false

export const markAppAsSetup = () => {
  isAppSetup = true
}

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

export const normalizeElectronUserAgent = (current: string, isGoogleAccounts: boolean): string => {
  // For Google sign-in pages, we keep the Surf version at the end of the User-Agent
  // to avoid "secure browser" warnings. For everything else, we strip out both
  // Electron and Surf versions.
  const surfVersion =
    current
      .split(' ')
      .find((part) => part.startsWith('Surf/'))
      ?.replace('Surf/', '') || ''

  let result = current
    .split(' ')
    .filter((part) => !part.startsWith('Electron/') && !part.startsWith('Surf/'))
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

  if (isGoogleAccounts && surfVersion) {
    result += ` Surf/${surfVersion}`
  }

  return result
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

export const SettingsWindowEntrypoint = (() => {
  if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}`
  } else {
    return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'Settings', 'settings.html')}`
  }
})()

export const UpdatesWindowEntryPoint = (() => {
  if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/Updates/updates.html`
  } else {
    return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'Updates', 'updates.html')}`
  }
})()

export const PDFViewerEntryPoint = (() => {
  if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/PDF/pdf.html`
  } else {
    return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'PDF', 'pdf.html')}`
  }
})()

export const ResourceViewerEntryPoint = (() => {
  if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/Resource/resource.html`
  } else {
    return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'Resource', 'resource.html')}`
  }
})()

export const OverlayEntryPoint = (() => {
  return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'Overlay', 'overlay.html')}`
  if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/Overlay/overlay.html`
  } else {
    return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'Overlay', 'overlay.html')}`
  }
})()

export const CoreEntryPoint = (() => {
  return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'Core', 'core.html')}`

  if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/Overlay/overlay.html`
  } else {
    return `file://${path.join(app.getAppPath(), 'out', 'renderer', 'Overlay', 'overlay.html')}`
  }
})()

export function checkIfSurfProtocolUrl(url: string): boolean {
  return url.startsWith('surf://') || url.startsWith(ResourceViewerEntryPoint)
}

export async function checkFileExists(path: string) {
  try {
    await fsp.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Get the content type of a file
 * @param filePath - The path to get the content type of
 * @returns The content type of the file
 */
export function getContentType(filePath: string) {
  return mimeTypes.lookup(filePath) || 'text/plain'
}
