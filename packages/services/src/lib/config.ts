import { getContext, setContext } from 'svelte'
import { get, writable, type Writable } from 'svelte/store'

import { useLogScope } from '@deta/utils/io'
import type { UserConfig, UserSettings } from '@deta/types'

export class ConfigService {
  config: Writable<UserConfig>
  settings: Writable<UserSettings>

  log: ReturnType<typeof useLogScope>

  static self: ConfigService

  constructor() {
    this.log = useLogScope('Config')

    // @ts-ignore
    const userConfig = window.api.getUserConfig()
    if (!userConfig) {
      new Error('User config not found')
    }
    this.config = writable<UserConfig>(userConfig)
    this.settings = writable<UserSettings>(userConfig.settings)

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

  get configValue() {
    return get(this.config)
  }

  getConfig() {
    return get(this.config)
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
