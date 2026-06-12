import { BrowserWindow, shell } from 'electron'
import { useLogScope } from '@deta/utils'
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
import type { AcostaAuthState, FocusSessionState, FocusSessionSummary } from '@deta/types'
import { getUserConfig } from '../config'
import { useAcostaAuth } from './authService'
import { useAcostaContentFilter } from './contentFilter'
import { useAcostaFocusMode } from './focusMode'
import { acostaApiRequest } from './api'

const log = useLogScope('AcostaIPC')

const broadcast = (send: (webContents: Electron.WebContents) => void): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) send(window.webContents)
  }
}

/** Registers all Acosta IPC handlers and state-change broadcasts. */
export function setupAcostaIpc(): void {
  const auth = useAcostaAuth()
  const focusMode = useAcostaFocusMode()
  const contentFilter = useAcostaContentFilter()

  /* --- Auth --- */

  IPC_EVENTS_MAIN.acostaSignIn.handle((_event, { email, password }) => auth.signIn(email, password))
  IPC_EVENTS_MAIN.acostaSignUp.handle((_event, { email, password, displayName }) =>
    auth.signUp(email, password, displayName)
  )
  IPC_EVENTS_MAIN.acostaSignInWithGoogle.handle(() => auth.signInWithGoogle())
  IPC_EVENTS_MAIN.acostaSignOut.handle(() => {
    auth.signOut()
    return true
  })
  IPC_EVENTS_MAIN.acostaGetAuthState.handle(() => auth.getState())
  IPC_EVENTS_MAIN.acostaGetIdToken.handle(() => auth.getIdToken())

  auth.on('auth-state-change', (state: AcostaAuthState) => {
    broadcast((wc) => IPC_EVENTS_MAIN.acostaAuthStateChange.sendToWebContents(wc, state))
  })

  /* --- Content filter --- */

  IPC_EVENTS_MAIN.acostaCheckUrl.handle((_event, url) => contentFilter.checkUrl(url))

  IPC_EVENTS_MAIN.acostaRequestAccess.handle(async (event, { url, reason }) => {
    // The block page lives in web content, so validate the sender before acting.
    const senderUrl = event.sender.getURL()
    const isTrustedSender =
      senderUrl.startsWith('acosta://core/Blocked/') || senderUrl.startsWith('acosta-internal://')
    if (!isTrustedSender) {
      log.warn('Rejected access request from untrusted sender:', senderUrl)
      return { ok: false, error: 'Not allowed.' }
    }

    const response = await acostaApiRequest('POST', '/access-requests', { url, reason })
    if (response.ok) return { ok: true }

    // Endpoint unreachable — fall back to emailing the guardian on file
    const guardianEmail = getUserConfig().settings.acosta.guardian_email
    if (guardianEmail) {
      const subject = encodeURIComponent('Acosta Browse access request')
      const body = encodeURIComponent(
        `Hi,\n\nI'd like access to this site for school work:\n${url}\n\nIt was blocked because: ${reason}\n\nThanks!`
      )
      await shell.openExternal(`mailto:${guardianEmail}?subject=${subject}&body=${body}`)
      return { ok: true }
    }

    return {
      ok: false,
      error: 'Could not send the request. Ask your teacher or parent directly.'
    }
  })

  /* --- Focus mode --- */

  IPC_EVENTS_MAIN.acostaFocusStart.handle((_event, config) => focusMode.start(config))
  IPC_EVENTS_MAIN.acostaFocusStop.handle(() => focusMode.stop())
  IPC_EVENTS_MAIN.acostaFocusGetState.handle(() => focusMode.getState())
  IPC_EVENTS_MAIN.acostaFocusNoteTaken.handle(() => {
    focusMode.recordNoteTaken()
    return true
  })

  focusMode.on('state-change', (state: FocusSessionState) => {
    broadcast((wc) => IPC_EVENTS_MAIN.acostaFocusStateChange.sendToWebContents(wc, state))
  })
  focusMode.on('session-complete', (summary: FocusSessionSummary) => {
    broadcast((wc) => IPC_EVENTS_MAIN.acostaFocusSessionComplete.sendToWebContents(wc, summary))
  })

  /* --- Generic authenticated API proxy (notes sync, study data) --- */

  IPC_EVENTS_MAIN.acostaApiRequest.handle((_event, { method, path, body }) => {
    // Only relative paths into the Acosta API are allowed
    if (!path.startsWith('/') || path.startsWith('//')) {
      return { ok: false, status: 400, data: null }
    }
    return acostaApiRequest(method, path, body)
  })

  log.log('Acosta IPC handlers registered')
}
