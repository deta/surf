import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { mkdirSync } from 'fs'

import { AppActivationResponse, createAPI, createAuthenticatedAPI } from '@deta/api'
import { type UserSettings } from '@deta/types'
import { IPC_EVENTS_RENDERER, SpaceBasicData } from '@deta/services/ipc'

import { getUserConfig } from '../main/config'
import { initBackend } from './helpers/backend'

const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''

const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')

const API_BASE = import.meta.env.P_VITE_API_BASE ?? 'https://deta.space/api'

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
const presetEmail: string = args['presetEmail'] || ''
const presetInviteCode: string = args['presetInviteCode'] || ''

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

  activateAppUsingKey: async (key: string, acceptedTerms: boolean) => {
    const api = createAPI(API_BASE)

    const res = await api.activateAppUsingKey(key, acceptedTerms)
    if (res.ok && (res.data as AppActivationResponse)) {
      // Use the API key to fetch full user data and store it
      const authedAPI = createAuthenticatedAPI(API_BASE, res.data.api_key)
      const user = await authedAPI.getUserData()
      if (!user) {
        console.error('Failed to fetch user data after activation')
        return res
      }

      let anon_id = userConfig.anon_id
      if (user.anon_telemetry) {
        if (!anon_id) {
          anon_id = uuidv4()
        }
      }

      userConfig.api_key = res.data.api_key
      userConfig.user_id = user.id
      userConfig.anon_id = anon_id
      userConfig.anon_telemetry = user.anon_telemetry
      userConfig.email = user.email

      IPC_EVENTS_RENDERER.updateUserConfig.send({
        api_key: userConfig.api_key,
        user_id: userConfig.user_id,
        anon_id: userConfig.anon_id,
        anon_telemetry: userConfig.anon_telemetry,
        email: userConfig.email
      })
    }

    return res
  },

  resendInviteCode: async (email: string) => {
    const api = createAPI(API_BASE)
    return await api.resendInviteCode(email)
  },

  signup: async (email: string, flow?: string) => {
    const api = createAPI(API_BASE)
    return await api.signup(email, flow)
  },

  deanonymizeUser: async () => {
    // Figure out what id to use
    let userId = userConfig.anon_id ?? userConfig.user_id
    if (userId === undefined) {
      console.error('Could not get valid user id... something is misconfigured!')
      return false
    }

    const apiKey = userConfig.api_key
    if (!apiKey) {
      console.error('No API key found, cannot deanonymize user.')
      return false
    }

    const api = createAuthenticatedAPI(API_BASE, apiKey)
    await api.setUserTelemetryId(userId)

    userConfig.anon_telemetry = false
    IPC_EVENTS_RENDERER.updateUserConfig.send({ anon_telemetry: userConfig.anon_telemetry })

    return true
  },

  updateSpacesList: async (data: SpaceBasicData[]) => {
    IPC_EVENTS_RENDERER.updateSpacesList.send(data)
  }
}

const { sffs, resources } = initBackend({ num_worker_threads: 2, num_processor_threads: 1 })

IPC_EVENTS_RENDERER.setSurfBackendHealth.on((_, state) => {
  // @ts-ignore
  sffs.js__backend_set_surf_backend_health(state)
})

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('preloadEvents', eventHandlers)
    contextBridge.exposeInMainWorld('presetInviteCode', presetInviteCode)
    contextBridge.exposeInMainWorld('presetEmail', presetEmail)
    contextBridge.exposeInMainWorld('backend', {
      sffs,
      resources
    })
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
  window.presetInviteCode = presetInviteCode
  // @ts-ignore (define in dts)
  window.presetEmail = presetEmail
  // @ts-ignore (define in dts)
  window.backend = { sffs, resources }
}

export type API = typeof api
export type PreloadEventHandlers = typeof eventHandlers
