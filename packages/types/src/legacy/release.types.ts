import type { AppAction } from './appActions.types'
import type { PromotionDiscoveryData } from './promotion.types'
import type { Micro } from './resources.types'
import type { Revision } from './revision.types'

export type Channel = 'development' | 'experimental' | 'production'

export interface Discovery extends Omit<PromotionDiscoveryData, 'works_with'> {
  content?: string
  listed: boolean
  listed_url: string
  canonical_url?: string // Not present for /discovery endpoints
  stats: {
    total_installs: number
    release_installs: number
  }
  works_with_releases?: Release[]
  media?: string[]
}

export interface Release {
  id: string
  app_id: string
  version: string
  name: string
  app_name: string
  author: string
  short_description: string
  icon_url: string
  placeholder_icon_config?: {
    css_background: string
  }
  channel: Channel
  revision?: Revision
  release_alias: string
  released_at: string
  latest: boolean
  listed: boolean
  orphan: boolean
  notes?: string
  micros?: Micro[]
  discovery: Discovery
  app_actions?: AppAction[]
}

export type DiscoverySort = 'published' | 'total_installs' | 'release_installs'
export type DiscoveryFilter = 'featured' | 'top_picks' | 'all'
