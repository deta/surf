/**
 * Renderer-side access to the Acosta auth token.
 *
 * Every AI request is routed through the Acosta proxy, which authenticates
 * with the student's Firebase ID token as the bearer key. The token lives in
 * the main process; this helper fetches it over IPC with a short cache to
 * avoid chatty round-trips during streaming bursts.
 */

const TOKEN_CACHE_TTL_MS = 30_000

let cachedToken: { token: string; fetchedAt: number } | null = null

export async function getAcostaIdToken(): Promise<string | undefined> {
  try {
    if (cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_CACHE_TTL_MS) {
      return cachedToken.token
    }

    // Not every renderer surface carries the acosta preload API (e.g. PDF
    // viewer) — degrade to an unauthenticated call rather than crashing.
    const acostaApi = window.api?.acosta
    if (!acostaApi?.getIdToken) return undefined

    const token = await acostaApi.getIdToken()
    if (!token) return undefined

    cachedToken = { token, fetchedAt: Date.now() }
    return token
  } catch {
    return undefined
  }
}

export function clearAcostaTokenCache(): void {
  cachedToken = null
}
