// XXX: https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/modules/permissions/permission_descriptor.idl

import { dialog } from 'electron'
import {
  getPermissionConfig,
  updatePermissionConfig,
  removePermission,
  clearSessionPermissions,
  clearAllPermissions
} from './config'

interface PermissionRequest {
  type: string
  details: Record<string, any>
}

interface PermissionHandler {
  getName: (req: PermissionRequest) => string
  getMessage: (req: PermissionRequest) => string
}

const handlers: Partial<Record<string, PermissionHandler>> = {
  media: {
    getName: (req) => {
      const types = req.details.mediaTypes || []
      if (types.includes('audio') && types.includes('video')) return 'Camera and Microphone'
      if (types.includes('audio')) return 'Microphone'
      if (types.includes('video')) return 'Camera'
      return 'Media'
    },
    getMessage: (req) => {
      const types = req.details.mediaTypes || []
      if (types.includes('audio') && types.includes('video'))
        return 'This website wants to use your camera and microphone.'
      if (types.includes('audio')) return 'This website wants to use your microphone.'
      if (types.includes('video')) return 'This website wants to use your camera.'
      return 'This website wants to access media devices.'
    }
  },
  geolocation: {
    getName: () => 'Location',
    getMessage: () => 'This website wants to know your location.'
  },
  notifications: {
    getName: () => 'Notifications',
    getMessage: () => 'This website wants to send you notifications.'
  },
  'clipboard-read': {
    getName: () => 'Clipboard',
    getMessage: () => 'This website wants to read from your clipboard.'
  },
  'window-management': {
    getName: () => 'Window Management',
    getMessage: () => 'This website wants to manage browser windows.'
  }
  // TODO: soooooon
  // 'display-capture': {
  //   getName: () => 'Screen Capture',
  //   getMessage: () => 'This website wants to capture your screen content.'
  // },
}

const defaultHandler: PermissionHandler = {
  getName: (req) => prettifyPermissionType(req.type),
  getMessage: (req) => `This website is requesting ${prettifyPermissionType(req.type)} permission.`
}

const getHandler = (type: string): PermissionHandler => {
  return handlers[type] || defaultHandler
}

const getUrlOrigin = (url: string): string | null => {
  try {
    return new URL(url).origin
  } catch (error) {
    return null
  }
}

const prettifyPermissionType = (type: string): string => {
  return type
    .split(/(?=[A-Z])|[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const normalizePermissionType = (req: PermissionRequest): string => {
  switch (req.type) {
    case 'media':
      // TODO: this can be handled in a better way
      const types = req.details.mediaTypes || []
      if (types.includes('audio') && types.includes('video')) return 'media:audio:video'
      if (types.includes('audio')) return 'media:audio'
      if (types.includes('video')) return 'media:video'
    default:
      return req.type
  }
}

const formatWebsiteInfo = (url: string): string => {
  try {
    const { hostname, port } = new URL(url)
    return `${hostname}${port ? ':' + port : ''}`
  } catch (error) {
    return url
  }
}

const shouldShortCircuit = (permission: string): boolean | null => {
  switch (permission) {
    // these are not publicly documented permissions:
    //  `sensors`, `screen-wake-lock`, `persistent-storage`
    case 'sensors':
    case 'screen-wake-lock':
    case 'persistent-storage':
    case 'idle-detection':
    case 'fullscreen':
    case 'clipboard-sanitized-write':
    case 'pointerLock':
    case 'keyboardLock':
      return true
    case 'storage-access':
    case 'top-level-storage-access':
    case 'display-capture':
    case 'openExternal':
    case 'mediaKeySystem':
    case 'midi':
      return false
  }

  return null
}

export function setupPermissionHandlers(session: Electron.Session) {
  const sessionId = session.getStoragePath() || 'default'

  session.setPermissionCheckHandler((_contents, _permission, requestingOrigin, details) => {
    const origin = getUrlOrigin(requestingOrigin)
    if (origin === null) return true

    const request: PermissionRequest = { type: _permission, details }
    const permission = normalizePermissionType(request)

    const config = getPermissionConfig()
    const decision = config[sessionId]?.[requestingOrigin]?.[permission]
    return decision !== undefined ? decision : true
  })

  session.setPermissionRequestHandler(async (_contents, originalPermission, callback, details) => {
    const origin = getUrlOrigin(details.requestingUrl)
    if (origin === null) {
      callback(false)
      return
    }

    const request: PermissionRequest = { type: originalPermission, details }
    const permission = normalizePermissionType(request)
    let shortCircuit = shouldShortCircuit(permission)
    if (shortCircuit !== null) {
      callback(shortCircuit)
      return
    }

    const websiteInfo = formatWebsiteInfo(details.requestingUrl)
    const config = getPermissionConfig()
    const cachedDecision = config[sessionId]?.[origin]?.[permission]

    if (cachedDecision !== undefined) {
      callback(cachedDecision)
      return
    }
    const handler = getHandler(request.type)
    const response = await dialog.showMessageBox({
      type: 'none',
      buttons: ['Allow', 'Deny'],
      defaultId: 1,
      cancelId: 1,
      title: `${handler.getName(request)} Request`,
      message: handler.getMessage(request),
      detail: `${websiteInfo}`
    })

    const decision = response.response === 0
    updatePermissionConfig(sessionId, origin, permission, decision)
    callback(decision)
  })

  return {
    clearSessionPermissions: () => clearSessionPermissions(sessionId),
    removePermission: (origin: string, permission: string) =>
      removePermission(sessionId, origin, permission),
    clearAllPermissions
  }
}
