import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import path from 'path'
import { mkdirSync } from 'fs'

import { type UserSettings } from '@deta/types'

import { getUserConfig } from '../main/config'
import { IPC_EVENTS_RENDERER } from '@deta/services/ipc'

const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''

const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')

mkdirSync(BACKEND_RESOURCES_PATH, { recursive: true })

// TODO: moved to utils?
function parseArguments() {
  const args = {}

  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=')
      args[key] = value || true
    }
  })

  return args
}
const args = parseArguments()

const eventHandlers = {
  onSetupVerificationCode: (callback: (code: string) => void) => {
    return IPC_EVENTS_RENDERER.setupVerificationCode.on((_, code) => {
      try {
        callback(code)
      } catch (error) {
        console.error(error)
      }
    })
  }
}

const api = {
  getUserConfigSettings: () => userConfig.settings,

  getUserConfig: () => userConfig,

  updateUserConfigSettings: async (settings: Partial<UserSettings>) => {
    IPC_EVENTS_RENDERER.updateUserConfigSettings.send(settings)
  },

  onUserConfigSettingsChange: (callback: (settings: UserSettings) => void) => {
    return IPC_EVENTS_RENDERER.userConfigSettingsChange.on((_, settings) => {
      try {
        userConfig.settings = settings
        callback(settings)
      } catch (error) {
        // noop
      }
    })
  },

  restartApp: () => {
    IPC_EVENTS_RENDERER.restartApp.send()
  },

  updateViewBounds: (bounds: Electron.Rectangle) => {
    const searchParams = new URLSearchParams(window.location.search)
    const overlayId = searchParams.get('overlayId')
    if (!overlayId) {
      console.error('No overlayId found in URL search params')
      return
    }

    IPC_EVENTS_RENDERER.updateViewBounds.send({ viewId: overlayId, bounds })
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('preloadEvents', eventHandlers)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.preloadEvents = eventHandlers
  // @ts-ignore (define in dts)
  window.processArgs = parseArguments()
}

export type API = typeof api
export type PreloadEventHandlers = typeof eventHandlers
