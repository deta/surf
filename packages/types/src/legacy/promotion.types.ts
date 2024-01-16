import type { Release } from './release.types'
import type { JobStatus } from './jobs.types'

export type PromotionPayload = {
  revision_id: string
  app_id: string
  version?: string
  release_notes?: string
  discovery_list?: boolean
  channel: string
}

export interface PromotionDiscoveryData {
  app_name?: string
  title?: string
  tagline?: string
  theme_color?: string
  git?: string
  homepage?: string
  open_code?: boolean
  content_raw?: string
  ported_from?: string
  works_with?: string[]
}

export type Promotion = {
  id: string
  status: JobStatus
  release: Release
}
