import type { Action } from './action.types'

export interface EnvironmentVariable {
  name: string
  description: string
  value: string
}

export interface Micro {
  id: string
  name: string
  engine: string
  path: string
  url_version: string
  dependencies: string[]
  presets: {
    env: EnvironmentVariable[]
    api_keys: boolean
  }
  actions: Action[]
}
