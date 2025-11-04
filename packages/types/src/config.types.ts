import type { Model } from './ai.types'

export type UserConfig = {
  defaultBrowser: boolean
  initialized_tabs: boolean
  settings: UserSettings
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
  disable_bookmark_shortcut: boolean
  acknowledged_editing_resource_files: boolean

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
    seen_demo_notebook: boolean
  }
  sync_base_url?: string
  sync_auth_token?: string
  selected_model: string
  model_settings: Model[]
  vision_image_tagging: boolean
  turntable_favicons: boolean
  auto_toggle_pip: boolean
  enable_custom_prompts: boolean
  tab_bar_visible: boolean
  teletype_default_action: 'auto' | 'always_ask' | 'always_search'
  completed_onboarding_examples: string[]
  dismissed_onboarding_examples: boolean

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

export const EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_EXISTING_USERS = 1
export const EXPERIMENTAL_NOTES_CHAT_SIDEBAR_PROBABILITY_NEW_USERS = 0.5
