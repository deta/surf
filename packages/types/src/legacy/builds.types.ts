import type { JobStatus } from './jobs.types'

export interface Build {
  id: string
  status: JobStatus
  tag: string
  app_id: string
  created_at: string
  updated_at: string
}
