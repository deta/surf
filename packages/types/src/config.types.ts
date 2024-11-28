export type UserConfig = {
  user_id?: string
  api_key?: string
  email?: string
  anon_id?: string
  anon_telemetry?: boolean
  defaultBrowser: boolean
  initialized_tabs: boolean
  settings: UserSettings
}

export type UserSettings = {
  embedding_model: 'english_small' | 'english_large' | 'multilingual_small' | 'multilingual_large'
  tabs_orientation: 'vertical' | 'horizontal'
  app_style: 'light' | 'dark' // Note intentionally used app_style as "app_theme" would be themes in the future?
  use_semantic_search: boolean
  show_annotations_in_oasis: boolean
  always_include_screenshot_in_chat: boolean
  /** Copy downloaded files to the user's system downloads directory */
  save_to_user_downloads: boolean
  automatic_chat_prompt_generation: boolean
  // Experiments
  go_wild_mode: boolean
  annotations_sidebar: boolean
  live_spaces: boolean
  homescreen: boolean
  homescreen_link_cmdt: boolean
  experimental_browsing_context: boolean
  /**
   * @deprecated use individual feature flags instead
   */
  experimental_mode?: boolean
  search_engine: string
  onboarding: {
    completed_welcome: boolean
    completed_welcome_v2: boolean
    completed_chat: boolean
    completed_stuff: boolean
  }
  personas: string[]
}
