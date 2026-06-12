import { ACOSTA_API_BASE_URL } from '@deta/types'

/**
 * Runtime configuration for the Acosta integrations. All values can be
 * overridden at build time via M_VITE_* env vars so dev/staging builds can
 * point at non-production infrastructure.
 */
export const ACOSTA_CONFIG = {
  apiBaseUrl: import.meta.env.M_VITE_ACOSTA_API_URL || ACOSTA_API_BASE_URL,

  firebase: {
    apiKey: import.meta.env.M_VITE_FIREBASE_API_KEY || 'FIREBASE_API_KEY_PLACEHOLDER',
    authDomain: import.meta.env.M_VITE_FIREBASE_AUTH_DOMAIN || 'acosta-ai.firebaseapp.com'
  },

  google: {
    /** OAuth client id used for the Google Sign-In popup flow. */
    clientId: import.meta.env.M_VITE_GOOGLE_OAUTH_CLIENT_ID || 'GOOGLE_OAUTH_CLIENT_ID_PLACEHOLDER'
  },

  /**
   * Development escape hatch: skip the login wall entirely so the browser can
   * be worked on without a configured Firebase project. Never enabled in
   * production builds.
   */
  devBypassAuth: import.meta.env.M_VITE_ACOSTA_DEV_BYPASS_AUTH === 'true'
}

export const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1'
export const SECURE_TOKEN_URL = 'https://securetoken.googleapis.com/v1'
