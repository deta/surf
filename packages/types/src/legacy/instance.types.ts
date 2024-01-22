import type { Micro } from './resources.types'
import type { Release } from './release.types'
import type { Installation } from './installation.types'
import type { Key } from './key.types'

export interface Instance {
  id: string
  app_id: string
  installation: Installation
  release: Release
  alias: string
  secondary_alias: string
  url: string
  legacy_url?: string
  installed_at: string
  updated_at: string
  micros?: Micro[]
  bases?: string[]
  drives?: string[]
  api_keys?: Key[]
  keys?: Key[]
  update: {
    available: boolean
    latest_release_id?: string
  }
  migrated: boolean
  collection_id: string
}

export type LogItemType = 'function'
export interface LogItem {
  event_type: LogItemType
  micro_name: string
  timestamp: string
  msg: string
}

export type EmbedToken = {
  value: string
  expires_at: string
  created_at: string
}

export interface InstanceEmbed {
  domain: string
  token: EmbedToken
}
