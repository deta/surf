import { contextBridge } from 'electron'
import { AppActivationResponse, createAPI } from '@horizon/api'
import { type UserSettings } from '@horizon/types'

import { IPC_EVENTS_RENDERER } from '@horizon/core/src/lib/service/ipc/events'

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
  updateUserConfigSettings: async (settings: Partial<UserSettings>) => {
    IPC_EVENTS_RENDERER.updateUserConfigSettings.send(settings)
  },
  restartApp: () => {
    IPC_EVENTS_RENDERER.restartApp.send()
  },
  activateAppUsingKey: async (key: string, acceptedTerms: boolean) => {
    const api = createAPI(import.meta.env.P_VITE_API_BASE)

    const res = await api.activateAppUsingKey(key, acceptedTerms)
    if (res.ok && (res.data as AppActivationResponse)) {
      IPC_EVENTS_RENDERER.storeAPIKey.send(res.data.api_key)
    }
    return res
  },

  resendInviteCode: async (email: string) => {
    const api = createAPI(import.meta.env.P_VITE_API_BASE)
    return await api.resendInviteCode(email)
  },

  signup: async (email: string) => {
    const api = createAPI(import.meta.env.P_VITE_API_BASE)
    return await api.signup(email)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('preloadEvents', eventHandlers)
    contextBridge.exposeInMainWorld('presetInviteCode', presetInviteCode)
    contextBridge.exposeInMainWorld('presetEmail', presetEmail)
  } catch (error) {
    console.error(error)
  }
} else {
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
}

export type API = typeof api
export type PreloadEventHandlers = typeof eventHandlers
