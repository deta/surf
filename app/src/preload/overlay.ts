import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import path from 'path'
import http from 'http'

import EventEmitter from 'events'
import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import {
  promises as fsp,
  createReadStream,
  createWriteStream,
  ReadStream,
  WriteStream,
  mkdirSync
} from 'fs'
import { AppActivationResponse, createAPI, createAuthenticatedAPI } from '@deta/api'
import { type UserSettings } from '@deta/types'

import { getUserConfig } from '../main/config'
import { IPC_EVENTS_RENDERER, SpaceBasicData } from '@horizon/core/src/lib/service/ipc/events'

enum ResourceProcessingStateType {
  Pending = 'pending',
  Started = 'started',
  Failed = 'failed',
  Finished = 'finished'
}

enum EventBusMessageType {
  ResourceProcessingMessage = 'ResourceProcessingMessage'
}

type ResourceProcessingState =
  | { type: ResourceProcessingStateType.Pending }
  | { type: ResourceProcessingStateType.Started }
  | { type: ResourceProcessingStateType.Failed; message: string }
  | { type: ResourceProcessingStateType.Finished }

type EventBusMessage = {
  type: EventBusMessageType.ResourceProcessingMessage
  resource_id: string
  status: ResourceProcessingState
}

const APP_PATH = process.argv.find((arg) => arg.startsWith('--appPath='))?.split('=')[1] ?? ''
const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''

const ENABLE_DEBUG_PROXY = process.argv.includes('--enable-debug-proxy')

const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')
const LANGUAGE_SETTING = userConfig.settings?.embedding_model.includes('multi') ? 'multi' : 'en'

const API_BASE = import.meta.env.P_VITE_API_BASE ?? 'https://deta.space/api'
const API_KEY = import.meta.env.P_VITE_API_KEY ?? userConfig.api_key

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
const overlayId: string = args['overlayId'] || ''

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

  getUserConfig: async () => {
    return IPC_EVENTS_RENDERER.getUserConfig.invoke()
  },

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

  updateSpacesList: async (data: SpaceBasicData[]) => {
    IPC_EVENTS_RENDERER.updateSpacesList.send(data)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('preloadEvents', eventHandlers)
    contextBridge.exposeInMainWorld('overlayId', overlayId)
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
  // @ts-ignore (define in dts)
  window.overlayId = overlayId
}

export type API = typeof api
export type PreloadEventHandlers = typeof eventHandlers
