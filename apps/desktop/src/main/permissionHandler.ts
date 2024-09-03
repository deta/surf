import { dialog, systemPreferences } from 'electron'
import {
  getPermissionConfig,
  updatePermissionConfig,
  removePermission,
  clearSessionPermissions,
  clearAllPermissions
} from './config'

interface PermissionHandler {
  getDetail: (details: any) => string
  preCheck?: (details: any) => Promise<boolean>
}

const permissionHandlers: Record<string, PermissionHandler> = {
  fileSystem: {
    getDetail: (details: Electron.FilesystemPermissionRequest) =>
      `Path: ${details.filePath || 'Unknown'}
      Access Type: ${details.fileAccessType || 'Unknown'}
      Is Directory: ${details.isDirectory ? 'Yes' : 'No'}`
  },
  media: {
    getDetail: (details: Electron.MediaAccessPermissionRequest) =>
      `Media Types: ${details.mediaTypes?.join(', ') || 'Unknown'}
      Security Origin: ${details.securityOrigin || 'Unknown'}`,
    preCheck: async (details: Electron.MediaAccessPermissionRequest) => {
      if (process.platform !== 'darwin') return true

      let allowAudio = true,
        allowVideo = true
      if (details.mediaTypes?.includes('audio'))
        allowAudio = await systemPreferences.askForMediaAccess('microphone')
      if (details.mediaTypes?.includes('video'))
        allowVideo = await systemPreferences.askForMediaAccess('camera')

      return allowAudio && allowVideo
    }
  },
  openExternal: {
    getDetail: (details: Electron.OpenExternalPermissionRequest) =>
      `External URL: ${details.externalURL || 'Unknown'}`
  }
}

const defaultHandler: PermissionHandler = {
  getDetail: (details: any) =>
    Object.entries(details)
      .filter(([key]) => !['requestingUrl', 'isMainFrame'].includes(key))
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
}

const getUrlOrigin = (url: string): string | undefined => {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.origin
  } catch (error) {
    return undefined
  }
}

export function setupPermissionHandlers(session: Electron.Session) {
  const sessionId = session.getStoragePath() || 'default'

  session.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    const origin = getUrlOrigin(requestingOrigin) // for normalization
    if (!origin) return true

    const config = getPermissionConfig()
    const decision = config[sessionId]?.[requestingOrigin]?.[permission]
    if (decision !== undefined) {
      return decision
    }
    return true
  })

  session.setPermissionRequestHandler(async (_contents, permission, callback, details) => {
    const origin = getUrlOrigin(details.requestingUrl) // for normalization
    if (!origin) {
      callback(false)
      return
    }

    // TODO: short-circ these in `setPermissionCheckHandler` as well
    let shortCircuit: boolean | null = null
    switch (permission) {
      // `persistent-storage` isn't a part of the public API for some reason
      //@ts-ignore
      case 'persistent-storage':
      case 'idle-detection':
      case 'fullscreen':
      case 'clipboard-sanitized-write':
      case 'window-management':
        shortCircuit = true
        break
      case 'storage-access':
      case 'top-level-storage-access':
      case 'geolocation':
        shortCircuit = false
        break
    }
    if (shortCircuit !== null) {
      updatePermissionConfig(sessionId, origin, permission, shortCircuit)
      callback(shortCircuit)
      return
    }

    const config = getPermissionConfig()
    const cachedDecision = config[sessionId]?.[origin]?.[permission]
    if (cachedDecision !== undefined) {
      callback(cachedDecision)
      return
    }

    const handler = permissionHandlers[permission] || defaultHandler
    let preCheck = handler.preCheck ? await handler.preCheck(details) : true

    const response = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Allow', 'Deny'],
      title: 'Permission Request',
      message: `The application is requesting the following permission: ${permission}`,
      detail: `Origin: ${origin}\n${handler.getDetail(details)}`,
      noLink: true,
      defaultId: 1
    })

    const decision = preCheck && response.response === 0
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
