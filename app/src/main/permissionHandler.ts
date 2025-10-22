// XXX: https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/modules/permissions/permission_descriptor.idl

import { dialog, OpenExternalPermissionRequest } from 'electron'
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
  getDialogBoxType: () => 'warning' | 'info'
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
    },
    getDialogBoxType: () => 'info'
  },
  geolocation: {
    getName: () => 'Location',
    getMessage: () => 'This website wants to know your location.',
    getDialogBoxType: () => 'info'
  },
  notifications: {
    getName: () => 'Notifications',
    getMessage: () => 'This website wants to send you notifications.',
    getDialogBoxType: () => 'info'
  },
  openExternal: {
    getName: () => 'External Application',
    getMessage: () => 'This website wants to open an external application.',
    getDialogBoxType: () => 'warning'
  },
  'clipboard-read': {
    getName: () => 'Clipboard',
    getMessage: () => 'This website wants to read from your clipboard.',
    getDialogBoxType: () => 'info'
  },
  'window-management': {
    getName: () => 'Window Management',
    getMessage: () => 'This website wants to manage browser windows.',
    getDialogBoxType: () => 'info'
  },
  'persistent-storage': {
    getName: () => 'Persistent Storage',
    getMessage: () => 'This website wants to persist its data locally.',
    getDialogBoxType: () => 'info'
  }
  // TODO: soooooon
  // 'display-capture': {
  //   getName: () => 'Screen Capture',
  //   getMessage: () => 'This website wants to capture your screen content.'
  // },
}

const defaultHandler: PermissionHandler = {
  getName: (req) => prettifyPermissionType(req.type),
  getMessage: (req) => `This website is requesting ${prettifyPermissionType(req.type)} permission.`,
  getDialogBoxType: () => 'info'
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
    case 'system-wake-lock':
    case 'idle-detection':
    case 'fullscreen':
    case 'clipboard-sanitized-write':
    case 'mediaKeySystem':
    case 'pointerLock':
    case 'keyboardLock':
      return true
    case 'storage-access':
    case 'top-level-storage-access':
    case 'display-capture':
    case 'midi':
      return false
  }

  return null
}

const allowedExternalProtocol = (
  url: string | undefined
): { valid: boolean; protocol?: string } => {
  if (!url) {
    return { valid: false }
  }
  try {
    const { protocol } = new URL(url)
    switch (protocol) {
      case 'zoomus:':
      case 'slack:':
      case 'spotify:':
      case 'steam:':
      case 'discord:':
      case 'skype:':
      // microsoft teams
      case 'msteams:':
      case 'whatsapp:':
      // telegram
      case 'tg:':
      case 'notion:':
      case 'vscode:':
      case 'mailto:':
      // telephone dialer
      case 'tel:':
      // apple maps
      case 'maps:':
      // google maps
      case 'comgooglemaps:':
      case 'linkedin:':
        return { valid: true, protocol: protocol }
      default:
        return { valid: false }
    }
  } catch (error) {
    return { valid: false }
  }
}

export function setupPermissionHandlers(session: Electron.Session) {
  const sessionId = session.getStoragePath() || 'default'

  session.setPermissionCheckHandler((_contents, _permission, requestingOrigin, details) => {
    const origin = getUrlOrigin(requestingOrigin)
    if (origin === null) return true

    const request: PermissionRequest = { type: _permission, details }
    const permission = normalizePermissionType(request)

    if (permission === 'openExternal') {
      return true
    }
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
    let permission = normalizePermissionType(request)
    let shortCircuit = shouldShortCircuit(permission)
    if (shortCircuit !== null) {
      callback(shortCircuit)
      return
    }

    if (request.type === 'openExternal') {
      const { valid, protocol } = allowedExternalProtocol(
        (details as OpenExternalPermissionRequest).externalURL
      )
      if (!valid) {
        callback(false)
        return
      }
      if (protocol) {
        permission = `${permission}:${protocol}`
      }
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
      type: handler.getDialogBoxType(),
      buttons: ['Allow', 'Deny'],
      defaultId: 1,
      cancelId: 1,
      title: `${handler.getName(request)} Request`,
      message: handler.getMessage(request),
      detail: `${websiteInfo}`,
      checkboxLabel: 'Remember this decision',
      checkboxChecked: false
    })

    const decision = response.response === 0
    if (response.checkboxChecked) updatePermissionConfig(sessionId, origin, permission, decision)
    callback(decision)
  })

  return {
    clearSessionPermissions: () => clearSessionPermissions(sessionId),
    removePermission: (origin: string, permission: string) =>
      removePermission(sessionId, origin, permission),
    clearAllPermissions
  }
}
