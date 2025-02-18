import { contextBridge } from 'electron'
import { AppActivationResponse, createAPI } from '@horizon/api'
import { type UserSettings } from '@horizon/types'

import { IPC_EVENTS_RENDERER } from '@horizon/core/src/lib/service/ipc/events'

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
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}

export type API = typeof api
