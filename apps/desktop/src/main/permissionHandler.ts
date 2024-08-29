import { dialog, systemPreferences } from 'electron'
import os from 'os'

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
      if (os.platform() !== 'darwin') return true

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
      .filter(([key]) => key !== 'requestingUrl')
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
}

export function setupPermissionHandlers(session: Electron.Session) {
  // session.setPermissionCheckHandler((_contents, permission, requestOrigin) => {
  //   console.log('PERMISSION CHECK', permission, requestOrigin);
  //   return true;
  // });

  session.setPermissionRequestHandler(async (_contents, permission, callback, details) => {
    // console.log('PERMISSION REQUEST', permission, details)

    let shortCircuit: boolean | null = null
    switch (permission) {
      // `persistent-storage` isn't a part of the public API for some reason
      //@ts-ignore
      case 'persistent-storage':
      case 'idle-detection':
      case 'fullscreen':
      case 'window-management':
        shortCircuit = true
        break
      // third party storage access, disable it for now
      case 'storage-access':
      case 'top-level-storage-access':
        shortCircuit = false
        break
      // TODO: `geolocation` doesn't work for some reason
      case 'geolocation':
        shortCircuit = false
        break
      // these usually require explicit user-action before they're granted to the page
      // case 'pointerLock':
      // case 'keyboardLock':
    }
    if (shortCircuit != null) {
      callback(shortCircuit)
      return
    }

    const handler = permissionHandlers[permission] || defaultHandler
    let preCheck = handler.preCheck ? await handler.preCheck(details) : true

    const response = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Allow', 'Deny'],
      title: 'Permission Request',
      message: `The application is requesting the following permission: ${permission}`,
      detail: `Origin: ${details.requestingUrl}\n${handler.getDetail(details)}`,
      noLink: true,
      defaultId: 1
    })

    callback(preCheck && response.response === 0)
  })

  // session.setDevicePermissionHandler((details: Electron.DevicePermissionHandlerHandlerDetails) => {
  //   console.log('PERMISSION DEVICE', details);
  //   return false;
  // })
}
