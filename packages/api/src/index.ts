import { AppActivationResponse, UserDataResponse } from './types'

export const ENDPOINTS = {
  app_activations: '/v0/deta-os-auth/activations',
  userdata: '/v0/deta-os-auth/userdata'
}

export class API {
  base: string
  fetch: typeof fetch

  constructor(base: string, fetchFunc: typeof fetch = fetch) {
    this.base = base
    this.fetch = fetchFunc
  }

  async request(path: string, options: RequestInit = {}) {
    const res = await this.fetch(`${this.base}${path}`, options)

    if (!res.ok) {
      throw new Error(`Request failed: ${res.statusText}`)
    }

    return res
  }

  async requestJSON(path: string, options: RequestInit = {}) {
    const res = await this.request(path, {
      method: 'GET',
      ...options
    })

    return res.json()
  }

  async postJSON(path: string, data: any, options: RequestInit = {}) {
    const res = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      },
      ...options
    })

    if (!res.ok) {
      throw new Error(`Request failed: ${res.statusText}`)
    }

    return res.json()
  }

  async activateAppUsingKey(key: string, acceptedTerms: boolean) {
    try {
      const data = (await this.postJSON(ENDPOINTS.app_activations, {
        key: key,
        accepted_terms: acceptedTerms
      })) as Promise<AppActivationResponse>
      return data
    } catch (error) {
      console.error('Error activating app:', error)
      return null
    }
  }

  static createAPI(base: string) {
    return new API(base, window.fetch.bind(window))
  }
}

export class AuthenticatedAPI extends API {
  private apiKey: string

  constructor(base: string, apiKey: string, fetchFunc: typeof fetch = fetch) {
    super(base, fetchFunc)

    this.apiKey = apiKey
  }

  async request(path: string, options?: RequestInit): Promise<Response> {
    return super.request(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers
      }
    })
  }

  async getUserData() {
    try {
      const data = (await this.requestJSON(ENDPOINTS.userdata)) as Promise<UserDataResponse>
      return data
    } catch (error) {
      console.error('Error getting user data:', error)
      return null
    }
  }

  static createAuthenticatedAPI(base: string, apiKey: string) {
    return new AuthenticatedAPI(base, apiKey, window.fetch.bind(window))
  }
}

export const createAPI = (base: string) => API.createAPI(base)
export const createAuthenticatedAPI = (base: string, apiKey: string) =>
  AuthenticatedAPI.createAuthenticatedAPI(base, apiKey)

export * from './types'
