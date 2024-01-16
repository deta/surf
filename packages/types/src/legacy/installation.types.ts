import type { JobStatus } from './jobs.types'
export interface Installation {
  id: string
  app_id: string
  is_update: boolean
  release_id: string
  created_at: string
  updated_at: string
  status: JobStatus
}
