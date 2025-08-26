import { getContext, setContext } from 'svelte'
import { get, writable, type Writable } from 'svelte/store'

import { useLogScope } from '@deta/utils/io'
import type { UserSettings } from '@deta/types'

export class ConfigService {
  settings: Writable<UserSettings>

  log: ReturnType<typeof useLogScope>

  static self: ConfigService

  constructor() {
    this.log = useLogScope('Config')

    // @ts-ignore
    const loaded = window.api.getUserConfigSettings()
    if (!loaded) {
      new Error('User config not found')
    }

    this.log.debug('loaded user config settings', loaded)
    this.settings = writable<UserSettings>(loaded)

    // @ts-ignore
    window.api.onUserConfigSettingsChange((settings) => {
      this.log.debug('user config settings change', settings)
      this.settings.set(settings)
    })
  }

  get settingsValue() {
    return get(this.settings)
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

    // @ts-ignore
    await window.api.updateUserConfigSettings(updatedSettings)
  }

  static provide() {
    const config = new ConfigService()

    setContext('config', config)

    if (!ConfigService.self) ConfigService.self = config

    return config
  }

  static use() {
    if (!ConfigService.self) return getContext<ConfigService>('config')
    return ConfigService.self
  }
}

export const provideConfig = ConfigService.provide
export const useConfig = ConfigService.use
