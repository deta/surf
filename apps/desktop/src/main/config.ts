import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import {
  EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_EXISTING_USERS,
  EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_NEW_USERS,
  type UserConfig,
  type UserStats
} from '@horizon/types'
import { BUILT_IN_MODELS, BuiltInModelIDs, DEFAULT_AI_MODEL } from '@horizon/types/src/ai.types'
import { getRandomBooleanWithProbability } from '@horizon/utils/src/math'

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
const USER_STATS_NAME = 'user_stats.json'
const PERMISSION_CONFIG_NAME = 'permissions.json'
const SEEN_ANNOUNCEMENTS_STATE = 'seen_announcements.json'

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

export const getAnnouncementsState = () => {
  return getConfig(app.getPath('userData'), SEEN_ANNOUNCEMENTS_STATE)
}

export const setAnnouncementsState = (state: any) => {
  setConfig(app.getPath('userData'), state, SEEN_ANNOUNCEMENTS_STATE)
}

let userConfig: UserConfig | null = null
let userStats: UserStats | null = null

export const getUserConfig = (path?: string) => {
  const storedConfig = getConfig<UserConfig>(path ?? app.getPath('userData'), USER_CONFIG_NAME)

  if (!storedConfig.user_id) {
    storedConfig.user_id = uuidv4()
    storedConfig.defaultBrowser = false
    setUserConfig(storedConfig as UserConfig)
  }

  /*
    --- Default settings values for new users ---
  */
  if (!storedConfig.settings) {
    storedConfig.settings = {
      search_engine: 'google',
      embedding_model: 'english_small',
      tabs_orientation: 'vertical',
      app_style: 'light',
      use_semantic_search: false,
      save_to_user_downloads: true,
      show_annotations_in_oasis: true,
      automatic_chat_prompt_generation: true,
      live_spaces: false,
      annotations_sidebar: false,
      homescreen_link_cmdt: false,
      always_include_screenshot_in_chat: false,
      auto_note_similarity_search: false,
      experimental_note_inline_rewrite: false,
      experimental_chat_web_search: false,
      experimental_desktop_embeds: false,
      experimental_context_linking: false,
      experimental_context_linking_sidebar: false,
      experimental_notes_chat_sidebar: getRandomBooleanWithProbability(
        EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_NEW_USERS
      ),
      extensions: false,
      cleanup_filenames: false,
      save_to_active_context: true,
      onboarding: {
        completed_welcome: false,
        completed_welcome_v2: false,
        completed_chat: false,
        completed_stuff: false
      },
      personas: [],
      selected_model: DEFAULT_AI_MODEL,
      model_settings: [],
      vision_image_tagging: false,
      turntable_favicons: true,
      auto_toggle_pip: false,
      show_resource_contexts: false
    }
    setUserConfig(storedConfig as UserConfig)
  }

  let changedConfig = false

  /*
    --- Migration for existing users to new config structure ---
  */
  if (storedConfig.settings.app_style === undefined) {
    storedConfig.settings.app_style = 'light'
    changedConfig = true
  }

  if (storedConfig.settings.personas === undefined) {
    storedConfig.settings.personas = []
    changedConfig = true
  }

  if (storedConfig.settings.onboarding === undefined) {
    storedConfig.settings.onboarding = {
      completed_welcome: false,
      completed_welcome_v2: false,
      completed_chat: false,
      completed_stuff: false
    }
    changedConfig = true
  }

  if (storedConfig.settings.show_annotations_in_oasis === undefined) {
    storedConfig.settings.show_annotations_in_oasis = true
    changedConfig = true
  }

  // Migrate experimental_mode to individual feature flags
  if (storedConfig.settings.experimental_mode) {
    storedConfig.settings.annotations_sidebar = true
    storedConfig.settings.experimental_mode = undefined
    changedConfig = true
  }

  if (storedConfig.settings.annotations_sidebar === undefined) {
    storedConfig.settings.annotations_sidebar = false
    changedConfig = true
  }

  if (storedConfig.settings.live_spaces === undefined) {
    storedConfig.settings.live_spaces = false
    changedConfig = true
  }

  if (storedConfig.settings.automatic_chat_prompt_generation === undefined) {
    storedConfig.settings.automatic_chat_prompt_generation = true
    changedConfig = true
  }

  if (storedConfig.settings.homescreen_link_cmdt === undefined) {
    storedConfig.settings.homescreen_link_cmdt = false
    changedConfig = true
  }

  if (storedConfig.settings.save_to_user_downloads === undefined) {
    storedConfig.settings.save_to_user_downloads = true
    changedConfig = true
  }

  if (storedConfig.settings.always_include_screenshot_in_chat === undefined) {
    storedConfig.settings.always_include_screenshot_in_chat = false
    changedConfig = true
  }

  if (storedConfig.settings.selected_model === undefined) {
    storedConfig.settings.selected_model = DEFAULT_AI_MODEL
  }

  if (
    storedConfig.settings.model_settings === undefined ||
    !Array.isArray(storedConfig.settings.model_settings)
  ) {
    storedConfig.settings.model_settings = []
  }

  if (storedConfig.settings.vision_image_tagging === undefined) {
    storedConfig.settings.vision_image_tagging = false
    changedConfig = true
  }
  if (storedConfig.settings.turntable_favicons === undefined) {
    storedConfig.settings.turntable_favicons = true
    changedConfig = true
  }
  if (storedConfig.settings.auto_toggle_pip === undefined) {
    storedConfig.settings.auto_toggle_pip = false
    changedConfig = true
  }

  if (storedConfig.settings.auto_note_similarity_search === undefined) {
    storedConfig.settings.auto_note_similarity_search = false
    changedConfig = true
  }

  if (storedConfig.settings.experimental_note_inline_rewrite === undefined) {
    storedConfig.settings.experimental_note_inline_rewrite = false
    changedConfig = true
  }

  if (storedConfig.settings.experimental_chat_web_search === undefined) {
    storedConfig.settings.experimental_chat_web_search = false
    changedConfig = true
  }

  if (storedConfig.settings.show_resource_contexts === undefined) {
    storedConfig.settings.show_resource_contexts = false
    changedConfig = true
  }

  if (storedConfig.settings.experimental_context_linking === undefined) {
    storedConfig.settings.experimental_context_linking = false
    changedConfig = true
  }

  if (storedConfig.settings.experimental_context_linking_sidebar === undefined) {
    storedConfig.settings.experimental_context_linking_sidebar = false
    changedConfig = true
  }

  if (storedConfig.settings.extensions === undefined) {
    storedConfig.settings.extensions = false
    changedConfig = true
  }

  if (storedConfig.settings.cleanup_filenames === undefined) {
    storedConfig.settings.cleanup_filenames = false
    changedConfig = true
  }

  if (storedConfig.settings.experimental_desktop_embeds === undefined) {
    storedConfig.settings.experimental_desktop_embeds = false
    changedConfig = true
  }

  if (storedConfig.settings.experimental_notes_chat_sidebar === undefined) {
    storedConfig.settings.experimental_notes_chat_sidebar = getRandomBooleanWithProbability(
      EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_EXISTING_USERS
    )
    changedConfig = true
  }

  if (storedConfig.settings.save_to_active_context === undefined) {
    storedConfig.settings.save_to_active_context = true
    changedConfig = true
  }

  // Workaround to fix the vision flag for the ClaudeSonnet model for existing users who have the model configured
  if (storedConfig.settings.model_settings.length > 0) {
    const configuredModel = storedConfig.settings.model_settings.find(
      (model) => model.id === BuiltInModelIDs.ClaudeSonnet
    )
    if (configuredModel) {
      const builtInModel = BUILT_IN_MODELS.find(
        (model) => model.id === BuiltInModelIDs.ClaudeSonnet
      )
      if (builtInModel && builtInModel.vision !== configuredModel.vision) {
        configuredModel.vision = builtInModel.vision
        changedConfig = true
      }
    }
  }

  if (changedConfig) {
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

export const getUserStats = (path?: string) => {
  const storedConfig = getConfig<UserStats>(path ?? app.getPath('userData'), USER_STATS_NAME)

  const value: UserStats = {
    sessions: [],

    timestamp_last_prompt_set_default_browser: 9999999999999,
    dont_show_prompt_set_default_browser: false,

    timestamp_last_prompt_book_call: 9999999999999,
    dont_show_prompt_book_call: false,

    // Grooves
    global_n_context_switches: 0,
    global_n_contexts_created: 0,

    global_n_saves_to_oasis: 0,
    global_n_open_resource: 0,

    global_n_chat_message_sent: 0,
    global_n_chatted_with_space: 0,

    global_n_use_inline_tools: 0,
    global_n_create_annotation: 0,
    global_n_open_homescreen: 0,
    global_n_update_homescreen: 0,

    ...storedConfig
  }

  // Store if deep different
  if (JSON.stringify(value) !== JSON.stringify(storedConfig)) {
    setUserStats(value, path)
  }

  userStats = value
  return userStats
}

export const setUserStats = (stats: UserStats, path?: string) => {
  userStats = stats
  setConfig(path ?? app.getPath('userData'), stats, USER_STATS_NAME)
}

export const updateUserStats = (stats: Partial<UserStats>) => {
  const current = getUserStats()
  const newStats = { ...current, ...stats }
  setUserStats(newStats as UserStats)
  return newStats
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
