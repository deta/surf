import { type UserConfig, type UserStats } from '@deta/types'
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
export declare const getConfig: <T extends Config>(
  configPath: string,
  fileName?: string
) => Partial<T>
export declare const setConfig: <T extends Config>(
  configPath: string,
  config: T,
  fileName?: string
) => void
export declare const getAnnouncementsState: () => Partial<Config>
export declare const setAnnouncementsState: (state: any) => void
export declare const getUserConfig: (path?: string) => UserConfig
export declare const setUserConfig: (config: UserConfig) => void
export declare const updateUserConfigSettings: (settings: Partial<UserConfig['settings']>) => {
  embedding_model: 'english_small' | 'english_large' | 'multilingual_small' | 'multilingual_large'
  tabs_orientation: 'vertical' | 'horizontal'
  app_style: 'light' | 'dark'
  use_semantic_search: boolean
  save_to_user_downloads: boolean
  automatic_chat_prompt_generation: boolean
  adblockerEnabled: boolean
  historySwipeGesture: boolean
  has_seen_hero_screen: boolean
  skipped_hero_screen: boolean
  disable_bookmark_shortcut: boolean
  annotations_sidebar: boolean
  homescreen_link_cmdt: boolean
  cleanup_filenames: boolean
  save_to_active_context: boolean
  search_engine: string
  onboarding: {
    completed_welcome: boolean
    completed_welcome_v2: boolean
    completed_chat: boolean
    completed_stuff: boolean
  }
  personas: string[]
  sync_base_url?: string
  sync_auth_token?: string
  selected_model: string
  model_settings: import('@deta/types').Model[]
  vision_image_tagging: boolean
  turntable_favicons: boolean
  auto_toggle_pip: boolean
  enable_custom_prompts: boolean
  tab_bar_visible: boolean
  show_annotations_in_oasis: boolean
  show_resource_contexts: boolean
  always_include_screenshot_in_chat: boolean
  live_spaces: boolean
  experimental_context_linking: boolean
  experimental_context_linking_sidebar: boolean
  experimental_notes_chat_sidebar: boolean
  experimental_notes_chat_input: boolean
  experimental_chat_web_search: boolean
  experimental_note_inline_rewrite: boolean
  auto_note_similarity_search: boolean
  experimental_mode?: boolean
}
export declare const updateUserConfig: (config: Partial<UserConfig>) => {
  user_id?: string
  api_key?: string
  email?: string
  anon_id?: string
  anon_telemetry?: boolean
  defaultBrowser: boolean
  initialized_tabs: boolean
  settings: import('@deta/types').UserSettings
  activation_timestamp?: number
  show_changelog: boolean
}
export declare const getUserStats: (path?: string) => UserStats
export declare const setUserStats: (stats: UserStats, path?: string) => void
export declare const updateUserStats: (stats: Partial<UserStats>) => {
  sessions: import('@deta/types').UserSession[]
  timestamp_last_prompt_set_default_browser: number
  dont_show_prompt_set_default_browser: boolean
  timestamp_last_prompt_book_call: number
  dont_show_prompt_book_call: boolean
  global_n_context_switches: number
  global_n_contexts_created: number
  global_n_saves_to_oasis: number
  global_n_open_resource: number
  global_n_chat_message_sent: number
  global_n_chatted_with_space: number
  global_n_use_inline_tools: number
  global_n_create_annotation: number
  global_n_open_homescreen: number
  global_n_update_homescreen: number
}
export declare const getPermissionConfig: () => PermissionCache
export declare const setPermissionConfig: (config: PermissionCache) => void
export declare const updatePermissionConfig: (
  sessionId: string,
  origin: string,
  permission: string,
  decision: boolean
) => PermissionCache
export declare const removePermission: (
  sessionId: string,
  origin: string,
  permission: string
) => PermissionCache
export declare const clearSessionPermissions: (sessionId: string) => PermissionCache
export declare const clearAllPermissions: () => PermissionCache
