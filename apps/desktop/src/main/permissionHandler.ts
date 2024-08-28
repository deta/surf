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
    // console.log('PERMISSION REQUEST', permission, details);

    // TODO: locatio APIs do not work for some reason
    if (permission === 'geolocation') {
      callback(false)
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

    callback(response.response === 0 && preCheck)
  })

  // session.setDevicePermissionHandler((details: Electron.DevicePermissionHandlerHandlerDetails) => {
  //   console.log('PERMISSION DEVICE', details);
  //   return false;
  // })
}
