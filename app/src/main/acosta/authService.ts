import { app, BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import { randomBytes, createHash } from 'crypto'
import { useLogScope } from '@deta/utils'
import type { AcostaAuthState, AcostaUser, AuthResult } from '@deta/types'
import { getConfig, setConfig } from '../config'
import { ACOSTA_CONFIG, IDENTITY_TOOLKIT_URL, SECURE_TOKEN_URL } from './constants'

const log = useLogScope('AcostaAuth')

const AUTH_CONFIG_NAME = 'acosta_auth.json'

/** ID tokens last an hour; refresh a few minutes early so callers never hold a stale one. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

type PersistedSession = {
  refreshToken: string
  user: AcostaUser
}

type FirebaseAuthResponse = {
  idToken: string
  refreshToken: string
  localId: string
  email?: string
  displayName?: string
  photoUrl?: string
  emailVerified?: boolean
  expiresIn?: string
}

const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  EMAIL_NOT_FOUND: 'No account found with that email address.',
  INVALID_PASSWORD: 'Incorrect password. Please try again.',
  INVALID_LOGIN_CREDENTIALS: 'Incorrect email or password. Please try again.',
  EMAIL_EXISTS: 'An account with that email already exists.',
  WEAK_PASSWORD: 'Please choose a stronger password (at least 6 characters).',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Please wait a moment and try again.',
  USER_DISABLED: 'This account has been disabled. Contact your teacher or Acosta support.',
  INVALID_EMAIL: 'That email address does not look right. Please check it.'
}

const friendlyAuthError = (code: string): string => {
  const normalised = code.split(':')[0].trim()
  return (
    FRIENDLY_AUTH_ERRORS[normalised] ?? 'Something went wrong signing you in. Please try again.'
  )
}

/**
 * Firebase authentication for Acosta Browse, owned by the main process.
 *
 * Uses the Firebase Auth REST API rather than the web SDK so the session can
 * live in the main process and be shared with every renderer window over IPC.
 * The refresh token is persisted in the user data directory so students stay
 * signed in across launches.
 */
export class AcostaAuthService extends EventEmitter {
  private static instance: AcostaAuthService | null = null

  private state: AcostaAuthState = { status: 'loading' }
  private refreshToken: string | null = null
  private idToken: string | null = null
  private idTokenExpiresAt = 0
  private refreshInFlight: Promise<string | null> | null = null

  static get(): AcostaAuthService {
    if (!this.instance) this.instance = new AcostaAuthService()
    return this.instance
  }

  getState(): AcostaAuthState {
    return this.state
  }

  get isSignedIn(): boolean {
    return this.state.status === 'signed-in'
  }

  /** Restore a persisted session, refreshing the ID token to validate it. */
  async initialize(): Promise<void> {
    if (ACOSTA_CONFIG.devBypassAuth) {
      log.warn('Dev auth bypass enabled — signing in as a local dev student')
      this.setState({
        status: 'signed-in',
        user: {
          uid: 'dev-student',
          email: 'dev@acosta.ai',
          displayName: 'Dev Student',
          photoURL: null,
          emailVerified: true
        }
      })
      return
    }

    const stored = getConfig<PersistedSession>(app.getPath('userData'), AUTH_CONFIG_NAME)
    if (!stored.refreshToken || !stored.user) {
      this.setState({ status: 'signed-out' })
      return
    }

    this.refreshToken = stored.refreshToken
    const token = await this.getIdToken()
    if (token) {
      this.setState({ status: 'signed-in', user: stored.user })
      // Profile data may have changed elsewhere (e.g. on the web platform)
      this.refreshProfile().catch((err) => log.warn('Profile refresh failed:', err))
    } else {
      // Refresh failed for a non-network reason — the session was revoked.
      // On network failure keep the cached session so the browser still works offline.
      if (this.lastRefreshFailureWasAuth) {
        this.clearPersistedSession()
        this.setState({ status: 'signed-out' })
      } else {
        this.setState({ status: 'signed-in', user: stored.user })
      }
    }
  }

  private lastRefreshFailureWasAuth = false

  /** Returns a valid Firebase ID token, refreshing if needed. Null when signed out/unreachable. */
  async getIdToken(): Promise<string | null> {
    if (ACOSTA_CONFIG.devBypassAuth) return 'dev-token'
    if (!this.refreshToken) return null
    if (this.idToken && Date.now() < this.idTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.idToken
    }

    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshIdToken().finally(() => {
        this.refreshInFlight = null
      })
    }
    return this.refreshInFlight
  }

  private async refreshIdToken(): Promise<string | null> {
    try {
      const res = await fetch(`${SECURE_TOKEN_URL}/token?key=${ACOSTA_CONFIG.firebase.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken ?? ''
        })
      })

      if (!res.ok) {
        this.lastRefreshFailureWasAuth = res.status === 400 || res.status === 401
        log.error('Token refresh failed with status', res.status)
        return null
      }

      const data = (await res.json()) as {
        id_token: string
        refresh_token: string
        expires_in: string
      }

      this.lastRefreshFailureWasAuth = false
      this.idToken = data.id_token
      this.refreshToken = data.refresh_token
      this.idTokenExpiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000
      this.persistSession()
      return this.idToken
    } catch (err) {
      // Network failure — not an auth revocation
      this.lastRefreshFailureWasAuth = false
      log.warn('Token refresh failed (network):', err)
      return null
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    return this.identityToolkitAuth('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true
    })
  }

  async signUp(email: string, password: string, displayName?: string): Promise<AuthResult> {
    const result = await this.identityToolkitAuth('accounts:signUp', {
      email,
      password,
      returnSecureToken: true
    })

    if (result.ok && displayName) {
      try {
        await this.updateProfile({ displayName })
      } catch (err) {
        log.warn('Setting display name after sign up failed:', err)
      }
    }
    return result
  }

  /**
   * Google Sign-In: run the OAuth authorization code + PKCE flow in a popup
   * BrowserWindow, then exchange the Google ID token for a Firebase session.
   */
  async signInWithGoogle(): Promise<AuthResult> {
    try {
      const googleIdToken = await this.runGoogleOAuthFlow()
      if (!googleIdToken) {
        return { ok: false, error: 'Google sign-in was cancelled.' }
      }

      return await this.identityToolkitAuth('accounts:signInWithIdp', {
        postBody: `id_token=${googleIdToken}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true
      })
    } catch (err) {
      log.error('Google sign-in failed:', err)
      return { ok: false, error: 'Google sign-in failed. Please try again.' }
    }
  }

  signOut(): void {
    this.refreshToken = null
    this.idToken = null
    this.idTokenExpiresAt = 0
    this.clearPersistedSession()
    this.setState({ status: 'signed-out' })
  }

  private async identityToolkitAuth(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<AuthResult> {
    try {
      const res = await fetch(
        `${IDENTITY_TOOLKIT_URL}/${endpoint}?key=${ACOSTA_CONFIG.firebase.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      )

      const data = await res.json()

      if (!res.ok) {
        const code = data?.error?.message ?? 'UNKNOWN'
        log.warn(`Auth request ${endpoint} failed:`, code)
        return { ok: false, error: friendlyAuthError(code) }
      }

      const auth = data as FirebaseAuthResponse
      this.refreshToken = auth.refreshToken
      this.idToken = auth.idToken
      this.idTokenExpiresAt = Date.now() + parseInt(auth.expiresIn ?? '3600', 10) * 1000

      const user: AcostaUser = {
        uid: auth.localId,
        email: auth.email ?? '',
        displayName: auth.displayName ?? null,
        photoURL: auth.photoUrl ?? null,
        emailVerified: auth.emailVerified ?? false
      }

      this.setState({ status: 'signed-in', user })
      this.persistSession()
      return { ok: true, user }
    } catch (err) {
      log.error(`Auth request ${endpoint} errored:`, err)
      return {
        ok: false,
        error: 'Could not reach the sign-in service. Check your internet connection.'
      }
    }
  }

  private async updateProfile(update: { displayName?: string }): Promise<void> {
    const idToken = await this.getIdToken()
    if (!idToken) return

    const res = await fetch(
      `${IDENTITY_TOOLKIT_URL}/accounts:update?key=${ACOSTA_CONFIG.firebase.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ...update, returnSecureToken: false })
      }
    )

    if (res.ok && this.state.status === 'signed-in') {
      this.setState({
        status: 'signed-in',
        user: { ...this.state.user, displayName: update.displayName ?? null }
      })
      this.persistSession()
    }
  }

  private async refreshProfile(): Promise<void> {
    const idToken = await this.getIdToken()
    if (!idToken || this.state.status !== 'signed-in') return

    const res = await fetch(
      `${IDENTITY_TOOLKIT_URL}/accounts:lookup?key=${ACOSTA_CONFIG.firebase.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    )
    if (!res.ok) return

    const data = await res.json()
    const account = data?.users?.[0]
    if (!account) return

    const user: AcostaUser = {
      uid: account.localId,
      email: account.email ?? '',
      displayName: account.displayName ?? null,
      photoURL: account.photoUrl ?? null,
      emailVerified: account.emailVerified ?? false
    }
    this.setState({ status: 'signed-in', user })
    this.persistSession()
  }

  private runGoogleOAuthFlow(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const redirectUri = 'http://localhost/oauth-callback'
      const nonce = randomBytes(16).toString('hex')
      const codeVerifier = randomBytes(32).toString('base64url')
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', ACOSTA_CONFIG.google.clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', 'openid email profile')
      authUrl.searchParams.set('nonce', nonce)
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')

      const popup = new BrowserWindow({
        width: 480,
        height: 640,
        title: 'Sign in with Google',
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          partition: 'acosta-google-oauth'
        }
      })

      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
        if (!popup.isDestroyed()) popup.destroy()
      }

      const handleRedirect = async (url: string) => {
        if (!url.startsWith(redirectUri)) return

        const code = new URL(url).searchParams.get('code')
        if (!code) {
          settle(() => resolve(null))
          return
        }

        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: ACOSTA_CONFIG.google.clientId,
              code_verifier: codeVerifier,
              grant_type: 'authorization_code',
              redirect_uri: redirectUri
            })
          })

          if (!tokenRes.ok) {
            settle(() => reject(new Error(`Google token exchange failed: ${tokenRes.status}`)))
            return
          }

          const tokens = (await tokenRes.json()) as { id_token?: string }
          settle(() => resolve(tokens.id_token ?? null))
        } catch (err) {
          settle(() => reject(err))
        }
      }

      popup.webContents.on('will-redirect', (_event, url) => void handleRedirect(url))
      popup.webContents.on('will-navigate', (_event, url) => void handleRedirect(url))
      popup.on('closed', () => settle(() => resolve(null)))

      popup.loadURL(authUrl.toString()).catch((err) => settle(() => reject(err)))
    })
  }

  private setState(state: AcostaAuthState): void {
    this.state = state
    this.emit('auth-state-change', state)
  }

  private persistSession(): void {
    if (this.state.status !== 'signed-in' || !this.refreshToken) return
    setConfig(
      app.getPath('userData'),
      { refreshToken: this.refreshToken, user: this.state.user },
      AUTH_CONFIG_NAME
    )
  }

  private clearPersistedSession(): void {
    setConfig(app.getPath('userData'), {}, AUTH_CONFIG_NAME)
  }
}

export const useAcostaAuth = (): AcostaAuthService => AcostaAuthService.get()
