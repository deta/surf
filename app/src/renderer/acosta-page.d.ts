import type { AcostaAuthState, FocusSessionState, UserConfig } from '@deta/types'

/**
 * Minimal bridge exposed by the webcontents preload to Acosta internal pages
 * served over acosta://core/ (block page, new tab page).
 */
declare global {
  interface Window {
    acostaPage?: {
      requestAccess: (url: string, reason: string) => Promise<{ ok: boolean; error?: string }>
      getAuthState: () => Promise<AcostaAuthState>
      getUserConfig: () => Promise<UserConfig>
      getFocusState: () => Promise<FocusSessionState>
      apiRequest: (
        method: 'GET' | 'POST',
        path: string,
        body?: unknown
      ) => Promise<{ ok: boolean; status: number; data: unknown }>
    }
  }
}

export {}
