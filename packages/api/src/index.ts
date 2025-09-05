import { UserDataResponse } from './types'

export const ENDPOINTS = {
  app_activations: '/v0/deta-os-auth/activations',
  resend_invite_code: '/v0/deta-os-auth/activation-keys/resend',
  userdata: '/v0/deta-os-auth/userdata',
  userdata_telemetry_id: '/v0/deta-os-auth/userdata/tel-id',
  check_extension: '/v0/deta-os-auth/check-extension',
  extension_installations: '/v0/deta-os-auth/extensions/installations',
  signup: '/v0/deta-os-auth/signup'
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
      let error = new Error(`Request failed: ${res.statusText}`)
      ;(error as any).status = res.status
      throw error
    }

    return res
  }

  async requestRaiseNoError(path: string, options: RequestInit = {}) {
    const res = await this.fetch(`${this.base}${path}`, options)
    return res
  }

  async requestJSON(path: string, options: RequestInit = {}) {
    const res = await this.request(path, {
      method: 'GET',
      ...options
    })

    return res.json()
  }

  async requestJSONWithRetry(path: string, maxRetries: number = 5, options: RequestInit = {}) {
    let retries = 0
    let lastError: Error | null = null

    while (retries <= maxRetries) {
      try {
        const res = await this.request(path, {
          method: 'GET',
          ...options
        })

        return res.json()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (retries === maxRetries) {
          break
        }

        const delay = 100 * Math.pow(2, retries)
        await new Promise((resolve) => setTimeout(resolve, delay))
        retries++
      }
    }
    throw lastError || new Error('Request failed after maximum retries')
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

  async postJSONReturnRes(path: string, data: any, options: RequestInit = {}) {
    const res = await this.requestRaiseNoError(path, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      },
      ...options
    })
    return {
      ok: res.ok,
      status: res.status,
      data: await res.json()
    }
  }

  async activateAppUsingKey(key: string, acceptedTerms: boolean) {
    return await this.postJSONReturnRes(ENDPOINTS.app_activations, {
      key: key,
      accepted_terms: acceptedTerms
    })
  }

  async signup(email: string, flow?: string) {
    return await this.postJSONReturnRes(ENDPOINTS.signup, {
      email: email,
      flow: flow
    })
  }

  async resendInviteCode(email: string) {
    return await this.postJSONReturnRes(ENDPOINTS.resend_invite_code, {
      email: email
    })
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
    return (await this.requestJSONWithRetry(ENDPOINTS.userdata, 5)) as Promise<UserDataResponse>
  }

  async setUserTelemetryId(telemetryId: string) {
    try {
      const res = (await this.postJSON(ENDPOINTS.userdata_telemetry_id, {
        telemetry_id: telemetryId
      })) as Promise<unknown>
      console.warn('DBG patch user tlem id res: ', await res)
    } catch (error) {
      console.error('Error patching user telemetry id:', error)
    }
  }

  async checkIfExtensionIsAllowed(extensionId: string) {
    return await this.postJSONReturnRes(
      ENDPOINTS.check_extension,
      {
        extension_id: extensionId
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )
  }

  async trackInstalledExtension(extensionId: string, installed: boolean) {
    const action = installed ? 'install' : 'uninstall'

    return await this.postJSONReturnRes(
      ENDPOINTS.extension_installations,
      {
        extension_id: extensionId,
        action
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )
  }

  static createAuthenticatedAPI(base: string, apiKey: string) {
    return new AuthenticatedAPI(base, apiKey, window.fetch.bind(window))
  }
}

export const createAPI = (base: string) => API.createAPI(base)
export const createAuthenticatedAPI = (base: string, apiKey: string) =>
  AuthenticatedAPI.createAuthenticatedAPI(base, apiKey)

export * from './types'
