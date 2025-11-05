import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { type UserConfig } from '@deta/types'
import { BUILT_IN_MODELS, BuiltInModelIDs, DEFAULT_AI_MODEL } from '@deta/types/src/ai.types'
import { useLogScope } from '@deta/utils'

const log = useLogScope('Config')

export type Config = {
  [key: string]: any
}

export interface PermissionDecision {
  [origin: string]: {
    [permission: string]: boolean
  }
}

export type PermissionCache = {
  [sessionId: string]: PermissionDecision
}

const USER_CONFIG_NAME = 'user.json'
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
    log.error('Error reading config file:', error)
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
    log.error('Error writing config file:', error)
  }
}

export const getAnnouncementsState = () => {
  return getConfig(app.getPath('userData'), SEEN_ANNOUNCEMENTS_STATE)
}

export const setAnnouncementsState = (state: any) => {
  setConfig(app.getPath('userData'), state, SEEN_ANNOUNCEMENTS_STATE)
}

let userConfig: UserConfig | null = null

export const getUserConfig = (path?: string) => {
  const storedConfig = getConfig<UserConfig>(path ?? app.getPath('userData'), USER_CONFIG_NAME)

  /*
    --- Default settings values for new users ---
  */
  if (!storedConfig.settings) {
    storedConfig.settings = {
      search_engine: 'google',
      embedding_model: 'multilingual_small',
      tabs_orientation: 'vertical',
      app_style: 'light',
      use_semantic_search: false,
      save_to_user_downloads: true,
      automatic_chat_prompt_generation: true,
      adblockerEnabled: true,
      historySwipeGesture: false,
      has_seen_hero_screen: false,
      skipped_hero_screen: false,
      annotations_sidebar: false,
      cleanup_filenames: false,
      save_to_active_context: true,
      onboarding: {
        completed_welcome: false,
        completed_welcome_v2: false,
        completed_chat: false,
        completed_stuff: false,
        seen_demo_notebook: false
      },
      selected_model: DEFAULT_AI_MODEL,
      model_settings: [],
      vision_image_tagging: false,
      turntable_favicons: true,
      auto_toggle_pip: false,
      show_resource_contexts: true,
      disable_bookmark_shortcut: false,
      teletype_default_action: 'auto',
      completed_onboarding_examples: [],
      dismissed_onboarding_examples: false,
      acknowledged_editing_resource_files: false,

      /// Deprecated
      homescreen_link_cmdt: false,
      show_annotations_in_oasis: false,
      always_include_screenshot_in_chat: false,
      live_spaces: false,
      experimental_context_linking: false,
      experimental_context_linking_sidebar: false,
      experimental_notes_chat_sidebar: true,
      experimental_notes_chat_input: false,
      experimental_chat_web_search: true,
      experimental_note_inline_rewrite: false,
      auto_note_similarity_search: false,
      tab_bar_visible: true,
      enable_custom_prompts: true
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

  if (storedConfig.settings.onboarding === undefined) {
    storedConfig.settings.onboarding = {
      completed_welcome: false,
      completed_welcome_v2: false,
      completed_chat: false,
      completed_stuff: false,
      seen_demo_notebook: false
    }
    changedConfig = true
  }

  if (storedConfig.settings.adblockerEnabled === undefined) {
    storedConfig.settings.adblockerEnabled = true
    changedConfig = true
  }

  if (storedConfig.settings.historySwipeGesture === undefined) {
    storedConfig.settings.historySwipeGesture = false
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

  if (storedConfig.settings.automatic_chat_prompt_generation === undefined) {
    storedConfig.settings.automatic_chat_prompt_generation = true
    changedConfig = true
  }

  if (storedConfig.settings.save_to_user_downloads === undefined) {
    storedConfig.settings.save_to_user_downloads = true
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
  if (storedConfig.settings.has_seen_hero_screen === undefined) {
    storedConfig.settings.has_seen_hero_screen = false
    changedConfig = true
  }
  if (storedConfig.settings.skipped_hero_screen === undefined) {
    storedConfig.settings.skipped_hero_screen = false
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

  if (storedConfig.settings.cleanup_filenames === undefined) {
    storedConfig.settings.cleanup_filenames = false
    changedConfig = true
  }

  if (storedConfig.settings.save_to_active_context === undefined) {
    storedConfig.settings.save_to_active_context = true
    changedConfig = true
  }

  if (storedConfig.settings.enable_custom_prompts === undefined) {
    storedConfig.settings.enable_custom_prompts = true
    changedConfig = true
  }

  if (storedConfig.settings?.tab_bar_visible === undefined) {
    storedConfig.settings.tab_bar_visible = true
    changedConfig = true
  }

  if (storedConfig.settings?.disable_bookmark_shortcut === undefined) {
    storedConfig.settings.disable_bookmark_shortcut = false
    changedConfig = true
  }

  if (storedConfig.settings?.teletype_default_action === undefined) {
    storedConfig.settings.teletype_default_action = 'auto'
    changedConfig = true
  }

  if (storedConfig.settings?.completed_onboarding_examples === undefined) {
    storedConfig.settings.completed_onboarding_examples = []
    changedConfig = true
  }

  if (storedConfig.settings?.dismissed_onboarding_examples === undefined) {
    storedConfig.settings.dismissed_onboarding_examples = false
    changedConfig = true
  }

  if (storedConfig.settings?.acknowledged_editing_resource_files === undefined) {
    storedConfig.settings.acknowledged_editing_resource_files = false
    changedConfig = true
  }

  // "Migration" for late april settings cleanup
  if (storedConfig.settings.show_annotations_in_oasis === undefined) {
    storedConfig.settings.show_annotations_in_oasis = false
    changedConfig = true
  }
  if (storedConfig.settings.show_annotations_in_oasis === true) {
    storedConfig.settings.show_annotations_in_oasis = false
    changedConfig = true
  }
  if (storedConfig.settings.show_resource_contexts === undefined) {
    storedConfig.settings.show_resource_contexts = true
    changedConfig = true
  }
  if (storedConfig.settings.show_resource_contexts === false) {
    storedConfig.settings.show_resource_contexts = true
    changedConfig = true
  }
  if (storedConfig.settings.always_include_screenshot_in_chat === undefined) {
    storedConfig.settings.always_include_screenshot_in_chat = false
    changedConfig = true
  }
  if (storedConfig.settings.always_include_screenshot_in_chat === true) {
    storedConfig.settings.always_include_screenshot_in_chat = false
    changedConfig = true
  }
  if (storedConfig.settings.live_spaces === undefined) {
    storedConfig.settings.live_spaces = false
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
  if (storedConfig.settings.experimental_notes_chat_sidebar === undefined) {
    storedConfig.settings.experimental_notes_chat_sidebar = true
    changedConfig = true
  }
  if (storedConfig.settings.experimental_chat_web_search === undefined) {
    storedConfig.settings.experimental_chat_web_search = true
    changedConfig = true
  }
  if (storedConfig.settings.experimental_chat_web_search === false) {
    storedConfig.settings.experimental_chat_web_search = true
    changedConfig = true
  }
  if (storedConfig.settings.experimental_note_inline_rewrite === undefined) {
    storedConfig.settings.experimental_note_inline_rewrite = false
    changedConfig = true
  }
  if (storedConfig.settings.auto_note_similarity_search === undefined) {
    storedConfig.settings.auto_note_similarity_search = false
    changedConfig = true
  }
  if (storedConfig.settings.auto_note_similarity_search === true) {
    storedConfig.settings.auto_note_similarity_search = false
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

  if (storedConfig.settings.experimental_notes_chat_input === undefined) {
    storedConfig.settings.experimental_notes_chat_input = false
    changedConfig = true
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
