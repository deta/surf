import { Model } from './ai.types'

export type UserConfig = {
  user_id?: string
  api_key?: string
  email?: string
  anon_id?: string
  anon_telemetry?: boolean
  defaultBrowser: boolean
  initialized_tabs: boolean
  settings: UserSettings
  activation_timestamp?: number
  show_changelog: boolean
}

export type UserSettings = {
  embedding_model: 'english_small' | 'english_large' | 'multilingual_small' | 'multilingual_large'
  tabs_orientation: 'vertical' | 'horizontal'
  app_style: 'light' | 'dark' // Note intentionally used app_style as "app_theme" would be themes in the future?
  use_semantic_search: boolean
  save_to_user_downloads: boolean
  automatic_chat_prompt_generation: boolean
  adblockerEnabled: boolean
  historySwipeGesture: boolean
  has_seen_hero_screen: boolean
  skipped_hero_screen: boolean

  // Experiments
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
  model_settings: Model[]
  vision_image_tagging: boolean
  turntable_favicons: boolean
  auto_toggle_pip: boolean
  enable_custom_prompts: boolean
  tab_bar_visible: boolean

  /**
   * @deprecated use individual feature flags instead
   * these only remain for typescript LSP
   */
  show_annotations_in_oasis: boolean
  /** @deprecated */
  show_resource_contexts: boolean
  /** @deprecated */
  always_include_screenshot_in_chat: boolean
  /** @deprecated */
  live_spaces: boolean
  /** @deprecated */
  experimental_context_linking: boolean
  /** @deprecated */
  experimental_context_linking_sidebar: boolean
  /** @deprecated */
  experimental_notes_chat_sidebar: boolean
  experimental_notes_chat_input: boolean
  /** @deprecated */
  experimental_chat_web_search: boolean
  /** @deprecated */
  experimental_note_inline_rewrite: boolean
  /** @deprecated */
  auto_note_similarity_search: boolean

  experimental_mode?: boolean
}

interface UserSession {
  startedAt: number
  endedAt?: number
  duration?: number
  events: unknown[]
}
export type UserStats = {
  // General App usage
  sessions: UserSession[]

  // Prompt default browser
  timestamp_last_prompt_set_default_browser: number
  dont_show_prompt_set_default_browser: boolean

  // Prompt book call
  timestamp_last_prompt_book_call: number
  dont_show_prompt_book_call: boolean

  // Grooves
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

export const EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_EXISTING_USERS = 1
export const EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_NEW_USERS = 0.5
