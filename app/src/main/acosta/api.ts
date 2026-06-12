import { useLogScope } from '@deta/utils'
import { ACOSTA_CONFIG } from './constants'
import { useAcostaAuth } from './authService'

const log = useLogScope('AcostaAPI')

export type AcostaApiResponse<T = unknown> = {
  ok: boolean
  status: number
  data: T | null
}

const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Authenticated client for api.acosta.ai. Every request carries the Firebase
 * ID token as a Bearer token. Failures never throw — callers receive
 * `{ ok: false }` and must degrade gracefully (the browser keeps working
 * without the Acosta platform).
 */
export async function acostaApiRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts?: { timeoutMs?: number }
): Promise<AcostaApiResponse<T>> {
  const token = await useAcostaAuth().getIdToken()
  if (!token) {
    log.warn(`Skipping ${method} ${path} — no auth token available`)
    return { ok: false, status: 401, data: null }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(`${ACOSTA_CONFIG.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    let data: T | null = null
    try {
      data = (await res.json()) as T
    } catch {
      // Non-JSON response body is fine for some endpoints
    }

    if (!res.ok) log.warn(`${method} ${path} returned ${res.status}`)
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    log.warn(`${method} ${path} failed:`, err instanceof Error ? err.message : err)
    return { ok: false, status: 0, data: null }
  } finally {
    clearTimeout(timeout)
  }
}
