import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { UserConfig } from '@horizon/types'

export type Config = {
  [key: string]: any
}

export type BrowserConfig = {
  adblockerEnabled: boolean
  historySwipeGesture: boolean
}

export interface PermissionDecision {
  [origin: string]: {
    [permission: string]: boolean
  }
}

export type PermissionCache = {
  [sessionId: string]: PermissionDecision
}

const BROWSER_CONFIG_NAME = 'browser.json'
const USER_CONFIG_NAME = 'user.json'
const PERMISSION_CONFIG_NAME = 'permissions.json'

export const getConfig = <T extends Config>(
  configPath: string,
  fileName = 'config.json'
): Partial<T> => {
  try {
    const fullPath = path.join(configPath, fileName)

    if (fs.existsSync(fullPath)) {
      const raw = fs.readFileSync(fullPath, 'utf8')
      const data = JSON.parse(raw)
      return data as T
    } else {
      fs.writeFileSync(fullPath, JSON.stringify({}))
      return {} as T
    }
  } catch (error) {
    console.error('Error reading config file:', error)
    return {} as T
  }
}

export const setConfig = <T extends Config>(
  configPath: string,
  config: T,
  fileName = 'config.json'
) => {
  try {
    const fullPath = path.join(configPath, fileName)
    fs.writeFileSync(fullPath, JSON.stringify(config))
  } catch (error) {
    console.error('Error writing config file:', error)
  }
}

export const getBrowserConfig = () => {
  return getConfig<BrowserConfig>(app.getPath('userData'), BROWSER_CONFIG_NAME)
}

export const setBrowserConfig = (config: BrowserConfig) => {
  setConfig(app.getPath('userData'), config, BROWSER_CONFIG_NAME)
}

let userConfig: UserConfig | null = null

export const getUserConfig = (path?: string) => {
  const storedConfig = getConfig<UserConfig>(path ?? app.getPath('userData'), USER_CONFIG_NAME)

  if (!storedConfig.user_id) {
    storedConfig.user_id = uuidv4()
    storedConfig.defaultBrowser = false
    setUserConfig(storedConfig as UserConfig)
  }

  if (!storedConfig.settings) {
    storedConfig.settings = {
      search_engine: 'google',
      embedding_model: 'english_small',
      tabs_orientation: 'vertical',
      use_semantic_search: false,
      show_annotations_in_oasis: true,
      experimental_mode: false,
      onboarding: {
        completed_welcome: false,
        completed_chat: false,
        completed_stuff: false
      }
    }
    setUserConfig(storedConfig as UserConfig)
  }

  if (storedConfig.settings.onboarding === undefined) {
    storedConfig.settings.onboarding = {
      completed_welcome: false,
      completed_chat: false,
      completed_stuff: false
    }
    setUserConfig(storedConfig as UserConfig)
  }

  if (storedConfig.settings.show_annotations_in_oasis === undefined) {
    storedConfig.settings.show_annotations_in_oasis = true
    setUserConfig(storedConfig as UserConfig)
  }

  if (storedConfig.settings.experimental_mode === undefined) {
    storedConfig.settings.experimental_mode = false
    setUserConfig(storedConfig as UserConfig)
  }

  userConfig = storedConfig as UserConfig
  return userConfig
}

export const setUserConfig = (config: UserConfig) => {
  userConfig = config
  setConfig(app.getPath('userData'), config, USER_CONFIG_NAME)
}

export const updateUserConfigSettings = (settings: Partial<UserConfig['settings']>) => {
  const currentConfig = getUserConfig()
  const newConfig = { ...currentConfig, settings: { ...currentConfig.settings, ...settings } }
  setUserConfig(newConfig)
  return newConfig.settings
}

export const updateUserConfig = (config: Partial<UserConfig>) => {
  const currentConfig = getUserConfig()
  const newConfig = { ...currentConfig, ...config }
  setUserConfig(newConfig)
  return newConfig
}

let inMemoryPermissionConfig: PermissionCache | null = null

export const getPermissionConfig = (): PermissionCache => {
  if (!inMemoryPermissionConfig)
    inMemoryPermissionConfig = getConfig<PermissionCache>(
      app.getPath('userData'),
      PERMISSION_CONFIG_NAME
    ) as PermissionCache
  return inMemoryPermissionConfig
}

export const setPermissionConfig = (config: PermissionCache): void => {
  inMemoryPermissionConfig = config
  setConfig(app.getPath('userData'), config, PERMISSION_CONFIG_NAME)
}

export const updatePermissionConfig = (
  sessionId: string,
  origin: string,
  permission: string,
  decision: boolean
): PermissionCache => {
  const currentConfig = getPermissionConfig()
  if (!currentConfig[sessionId]) currentConfig[sessionId] = {}
  if (!currentConfig[sessionId][origin]) currentConfig[sessionId][origin] = {}
  currentConfig[sessionId][origin][permission] = decision

  setPermissionConfig(currentConfig)
  return currentConfig
}

export const removePermission = (
  sessionId: string,
  origin: string,
  permission: string
): PermissionCache => {
  const currentConfig = getPermissionConfig()

  if (currentConfig[sessionId]?.[origin]?.[permission] !== undefined) {
    delete currentConfig[sessionId][origin][permission]
    if (Object.keys(currentConfig[sessionId][origin]).length === 0)
      delete currentConfig[sessionId][origin]
    if (Object.keys(currentConfig[sessionId]).length === 0) delete currentConfig[sessionId]

    setPermissionConfig(currentConfig)
  }

  return currentConfig
}

export const clearSessionPermissions = (sessionId: string): PermissionCache => {
  const config = getPermissionConfig()
  delete config[sessionId]
  setPermissionConfig(config)
  return config
}

export const clearAllPermissions = (): PermissionCache => {
  setPermissionConfig({})
  return {}
}
