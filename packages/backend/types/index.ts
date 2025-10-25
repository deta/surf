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
  websearch?: boolean
  surflet?: boolean
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

export class APIKeyMissingError extends Error {
  constructor() {
    super('API key missing')
    this.name = 'APIKeyMissingError'
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIKeyMissingError)
    }
  }
}

export class BadRequestError extends Error {
  constructor(message?: string) {
    super(message || 'Bad request')
    this.name = 'BadRequestError'
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BadRequestError)
    }
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedError)
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
