const ERROR_CODES_TO_IGNORE = [-3] // -3 is ERR_ABORTED

export interface APIErrorMeta {
  status: number
  message: string
  response: Response
  detail?: string
  body?: { [key: string]: unknown }
}

export class APIError extends Error {
  detail: string
  status: number
  body?: { [key: string]: unknown }

  constructor(meta: APIErrorMeta) {
    super(meta.message)

    this.detail =
      meta.detail ||
      (meta.status ? `Server error ${meta.status || 500}` : 'Unknown server error ocurred')

    this.body = meta.body
    this.status = meta.status
    this.name = 'APIError'
  }
}

export interface NetworkErrorMeta {
  message?: string
  cause?: Error
}

export class NetworkError extends Error {
  constructor(meta: NetworkErrorMeta) {
    const msg = meta.message || meta.cause?.message || 'Unknown network error ocurred'

    super(msg, { cause: meta.cause })

    this.name = 'NetworkError'
  }
}

export const getErrorMessage = (err: unknown, fallback?: string) => {
  if (err instanceof APIError) {
    return err.detail
  } else if (err instanceof NetworkError) {
    return err.message
  } else {
    return fallback || 'Unknown error ocurred'
  }
}

export const parseError = (
  err: unknown
): {
  type: 'api' | 'network' | 'unknown'
  err: APIError | NetworkError | unknown
} => {
  if (err instanceof APIError) {
    return { type: 'api', err }
  } else if (err instanceof NetworkError) {
    return { type: 'network', err }
  } else {
    return { type: 'unknown', err }
  }
}

export const shouldIgnoreWebviewErrorCode = (code: number): boolean => {
  return ERROR_CODES_TO_IGNORE.includes(code)
}
