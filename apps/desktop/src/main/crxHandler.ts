import { nativeImage } from 'electron'
import path from 'path'
import { readFile } from 'fs/promises'
import { useLogScope } from '@horizon/utils'

const log = useLogScope('crxHandler')

enum ResizeType {
  Up = 0,
  Down = 1,
  Any = 2
}

function matchSize(
  object: { [key: string]: string },
  size: number,
  resizeType: ResizeType = ResizeType.Up
): string | undefined {
  const sizes = Object.keys(object)
    .map((key) => parseInt(key, 10))
    .filter((value) => !isNaN(value))
    .sort((a, b) => a - b)

  if (sizes.length === 0) return undefined

  let matchedSize: number | undefined

  if (resizeType === ResizeType.Up) {
    matchedSize = sizes.find((value) => value >= size)
    if (!matchedSize) matchedSize = sizes[sizes.length - 1]
  } else if (resizeType === ResizeType.Down) {
    matchedSize = sizes
      .slice()
      .reverse()
      .find((value) => value <= size)
    if (!matchedSize) matchedSize = sizes[0]
  } else {
    // ResizeType.Any
    let minDiff = Infinity
    for (const value of sizes) {
      const diff = Math.abs(value - size)
      if (diff < minDiff) {
        minDiff = diff
        matchedSize = value
      }
    }
  }

  return matchedSize ? object[matchedSize.toString()] : undefined
}

async function loadIconFromPath(
  basePath: string,
  iconPath: string
): Promise<Electron.NativeImage | undefined> {
  try {
    const fullPath = path.join(basePath, iconPath)
    const iconData = await readFile(fullPath)
    return nativeImage.createFromBuffer(iconData)
  } catch (error) {
    log.debug('Failed to load icon from path:', iconPath, error)
    return undefined
  }
}

async function tryLoadIcon(
  extensionPath: string,
  iconSource: string | { [key: string]: string } | undefined,
  size: number,
  resizeType: ResizeType
): Promise<Electron.NativeImage | undefined> {
  if (!iconSource) return undefined

  if (typeof iconSource === 'string') {
    return await loadIconFromPath(extensionPath, iconSource)
  }

  const matchedPath = matchSize(iconSource, size, resizeType)
  if (matchedPath) {
    return await loadIconFromPath(extensionPath, matchedPath)
  }

  return undefined
}

export async function handleCrxRequest(
  session: Electron.Session,
  requestUrl: string
): Promise<GlobalResponse> {
  try {
    const url = new URL(requestUrl)
    const { hostname: requestType } = url

    if (requestType !== 'extension-icon') {
      log.debug('crx: invalid request type', requestType)
      return new Response(null, { status: 400 })
    }

    const fragments = url.pathname.split('/')
    const extensionId = fragments[1]
    const imageSize = parseInt(fragments[2], 10)
    const resizeType = parseInt(fragments[3], 10) || ResizeType.Up

    const extension = session.getExtension(extensionId)
    if (!extension) {
      log.debug('crx: extension not found', extensionId)
      return new Response(null, { status: 404 })
    }

    // Get manifest and icon details
    const manifestPath = path.join(extension.path, 'manifest.json')
    const manifestContent = await readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(manifestContent)

    // Handle both manifest v2 and v3
    const browserAction =
      manifest.manifest_version === 3 ? manifest.action : manifest.browser_action

    let iconImage: Electron.NativeImage | undefined

    // Try loading icon from different sources in order of preference
    const iconSources = [
      // 1. Browser action default icon
      browserAction?.default_icon,
      // 2. Manifest icons
      manifest.icons,
      // 3. Browser action default_icons (legacy format)
      browserAction?.default_icons
    ]

    for (const source of iconSources) {
      iconImage = await tryLoadIcon(extension.path, source, imageSize, resizeType)
      if (iconImage && !iconImage.isEmpty()) {
        break
      }
    }

    // If no icon was found, try to use a default icon from the extension root
    if (!iconImage || iconImage.isEmpty()) {
      const defaultIconPaths = ['icon.png', 'icon128.png', 'icon48.png', 'icon16.png']
      for (const iconPath of defaultIconPaths) {
        iconImage = await loadIconFromPath(extension.path, iconPath)
        if (iconImage && !iconImage.isEmpty()) {
          break
        }
      }
    }

    // If still no icon found, return 404
    if (!iconImage || iconImage.isEmpty()) {
      log.debug('crx: no valid icon found for', extensionId)
      return new Response(null, { status: 404 })
    }

    // Resize the icon if necessary
    if (imageSize > 0) {
      iconImage = iconImage.resize({ width: imageSize, height: imageSize })
    }

    return new Response(iconImage.toPNG(), {
      status: 200,
      headers: {
        'Content-Type': 'image/png'
      }
    })
  } catch (error) {
    log.error('crx: request handler error:', error)
    return new Response(null, { status: 500 })
  }
}
