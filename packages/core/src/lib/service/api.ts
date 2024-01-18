/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { getContext, setContext } from 'svelte'

import type {
  Metadata,
} from '@horizon/types'

import log from '@horizon/core/src/lib/utils/log'
import { APIError, NetworkError } from '@horizon/core/src/lib/utils/errors'

const HEADER_SPACE_CLIENT_KEY = 'X-Space-Client'

export const ENDPOINTS = {
  space: '/v0/space',
  auth: '/v0/auth',
  horizons: '/v0/horizons',
  card: '/v0/horizons/card',
  resource: '/v0/horizons/resource',
  metadata: '/v0/metadata',
}

export interface PaginationRequest {
  // the current page
  page: number
  // the maximum number of items on a page
  per_page: number
}

export interface Pagination extends Partial<PaginationRequest> {
  // the total number of items across all pages
  total?: number
  // wether there is more data to fetch
  end?: boolean
}

export type PaginatedResponse<T> = {
  data: T
  pages: Pagination
}

export type Sorting =
  | 'created_at_asc'
  | 'created_at_desc'
  | 'updated_at_asc'
  | 'updated_at_desc'

export class API {
  baseUrl: string
  captureExceptions: boolean

  constructor(baseUrl?: string, captureExceptions?: boolean) {
    this.baseUrl = baseUrl || `${location.origin}/api`
    this.captureExceptions =
      captureExceptions !== undefined ? captureExceptions : true
  }

  static provide = (endpoint?: string) => {
    const api = new API(endpoint)
    setContext('api', api)

    return api
  }

  static use = (): API => {
    return getContext('api')
  }

  buildUrl(path: string, base?: string) {
    return new URL((base || this.baseUrl) + path)
  }

  timeout(time: number) {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), time)
    return controller
  }

  async request({
    method,
    path,
    base,
    payload,
    headers,
    skipAuthRedirect = false,
    pagination,
    timeout = 15000,
    rawPayload = false,
    options,
  }: {
    method: string
    path: string
    base?: string
    payload?: unknown
    headers?: { [key: string]: string }
    skipAuthRedirect?: boolean
    pagination?: Pagination
    timeout?: number
    rawPayload?: boolean
    options?: RequestInit
  }) {
    const url = this.buildUrl(path, base)

    if (pagination) {
      if (pagination.page)
        url.searchParams.set('page', pagination.page.toString())
      if (pagination.per_page)
        url.searchParams.set('per_page', pagination.per_page.toString())
    }

    return fetch(url, {
      method: method,
      // cache: 'no-cache',
      signal: this.timeout(timeout).signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json', // TODO: this might break stuff.?
        [HEADER_SPACE_CLIENT_KEY]: 'bridge',
        ...headers,
      },
      body: rawPayload ? (payload as BodyInit) : JSON.stringify(payload),
      ...options,
    })
      .catch(err => {
        log.error(err)
        if (err instanceof Error) {
          throw new NetworkError({
            cause: err,
          })
        } else {
          throw err
        }
      })
      .then(async response => {
        const contentType = response.headers.get('content-type')
        const isJson =
          contentType && contentType.indexOf('application/json') !== -1

        if (!response.ok) {
          log.error(response)

          if (response.status === 401 && !skipAuthRedirect) {
            log.debug('Unauthorized!')
            window.location.href = '/login'
          }

          if (isJson) {
            const json = await response.json()

            const err = new APIError({
              status: response.status,
              message: response.statusText,
              detail: json.detail as string,
              body: json,
              response,
            })

            throw err
          }

          const err = new APIError({
            status: response.status,
            message: response.statusText,
            response,
          })

          throw err
        }

        return isJson ? response.json() : response.text()
      })
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const url = this.buildUrl(ENDPOINTS.space)
      const response = await fetch(url, {
        method: 'GET',
      })

      if (response.ok) {
        return true
      }

      return false
    } catch (_err) {
      return false
    }
  }

  async logout(): Promise<boolean> {
    const url = this.buildUrl(ENDPOINTS.auth + '/logout')
    const response = await fetch(url, {
      method: 'GET',
    })

    if (response.ok) {
      if (response.redirected) {
        window.location.href = response.url
      } else {
        window.location.href = '/login'
      }

      return true
    }

    return false
  }

  async getMetadata(): Promise<Metadata> {
    const response = await this.request({
      method: 'GET',
      path: ENDPOINTS.metadata,
      skipAuthRedirect: true,
    })

    log.debug(response)

    return response as Metadata
  }

  async setMetadata(metadata: Partial<Metadata>): Promise<Metadata> {
    const response = await this.request({
      method: 'PATCH',
      path: ENDPOINTS.metadata,
      payload: metadata,
    })

    log.debug(response)

    return response.metadata as Metadata
  }
}

export const provideAPI = API.provide
export const useAPI = API.use
