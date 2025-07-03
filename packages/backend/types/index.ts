export type Provider = 'open-ai' | 'anthropic' | { custom: string }

export type Model =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o3-mini'
  | 'claude-3-7-sonnet-latest'
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-5-haiku-latest'
  | 'gemini-2.0-flash'
  | {
      custom: {
        name: string
        provider: Provider
        max_tokens: number
        vision: boolean
      }
    }

export type MessageRole = 'system' | 'assistant' | 'user'

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type Message = {
  role: MessageRole
  content: MessageContent[]
}

export interface CreateChatCompletionOptions {
  messages: Message[]
  model: Model
  custom_key?: string
  response_format?: string
}

export interface ChatMessageOptions {
  query: string
  chat_id: string
  model: Model
  custom_key?: string
  limit?: number
  rag_only?: boolean
  resource_ids?: string[]
  inline_images?: string[]
  general?: boolean
  app_creation?: boolean
}

export interface NoteMessageOptions {
  query: string
  note_resource_id: string
  model: Model
  custom_key?: string
  limit?: number
  resource_ids?: string[]
  inline_images?: string[]
  general?: boolean
}

export interface QueryResourcesOptions {
  query: string
  model: Model
  custom_key?: string
  sql_query?: string
  embedding_query?: string
  embedding_distance_threshold?: number
}

export interface CreateAppOptions {
  query: string
  model: Model
  custom_key?: string
  inline_images?: string[]
}

export type QuotaUsageType =
  | 'daily_input_tokens'
  | 'daily_output_tokens'
  | 'monthly_input_tokens'
  | 'monthly_output_tokens'
  | 'monthly_vision_requests'

export type QuotaTier = 'premium' | 'premium_vision' | 'standard'

export interface Quota {
  tier: QuotaTier
  usage_type: QuotaUsageType
  used: number
  total: number
  updated_at: string // ISO 8601 datetime string
  resets_at: string // ISO 8601 datetime string
}

export interface QuotasResponse {
  quotas: Quota[]
}

export class QuotaDepletedError extends Error {
  constructor(public quotas: Quota[]) {
    super('LLM Quota Depleted')
    this.name = 'QuotaDepletedError'
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QuotaDepletedError)
    }
  }
}

export class TooManyRequestsError extends Error {
  constructor() {
    super('Too many requests')
    this.name = 'TooManyRequestsError'
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TooManyRequestsError)
    }
  }
}

export class BadRequestError extends Error {
  constructor() {
    super('Bad request')
    this.name = 'BadRequestError'
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BadRequestError)
    }
  }
}

export interface App {
  id: string
  app_type: string
  content: string
  created_at: string
  updated_at: string
  name?: string
  icon?: string
  meta?: string
}
