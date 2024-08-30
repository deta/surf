import type { UserSettings } from '@horizon/types'
import { get, writable, type Writable } from 'svelte/store'
import { useLogScope } from '@horizon/utils'
import { getContext, setContext } from 'svelte'

export class ConfigService {
  settings: Writable<UserSettings>

  log: ReturnType<typeof useLogScope>

  constructor() {
    this.log = useLogScope('Config')

    const loaded = window.api.getUserConfigSettings()
    if (!loaded) {
      new Error('User config not found')
    }

    this.log.debug('loaded user config settings', loaded)
    this.settings = writable<UserSettings>(loaded)

    window.api.onUserConfigSettingsChange((settings) => {
      this.log.debug('user config settings change', settings)
      this.settings.set(settings)
    })
  }

  getSettings() {
    return get(this.settings)
  }

  async updateSettings(settings: Partial<UserSettings>) {
    this.log.debug('update settings', settings)

    const updatedSettings = {
      ...get(this.settings),
      ...settings
    }

    this.settings.set(updatedSettings)

    await window.api.updateUserConfigSettings(updatedSettings)
  }

  static provide() {
    const config = new ConfigService()

    setContext('config', config)

    return config
  }

  static use() {
    return getContext<ConfigService>('config')
  }
}

export const provideConfig = ConfigService.provide
export const useConfig = ConfigService.use
