export type UserConfig = {
  user_id: string
  api_key?: string
  email?: string
  defaultBrowser: boolean
  settings: UserSettings
}

export type UserSettings = {
  embedding_model: 'english_small' | 'english_large' | 'multilingual_small' | 'multilingual_large'
  tabs_orientation: 'vertical' | 'horizontal'
}
