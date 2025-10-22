import type { Release } from './release.types'
export interface App {
  id: string
  instance_id: string
  name: string
  alias: string
  bases: string[]
  drives: string[]
  created_at: string
  updated_at: string
  listed: boolean
  placeholder_icon_config: {
    css_background: string
  }
  releases: Release[]
}
