import { EventEmitter } from 'events'
import { useLogScope } from '@deta/utils'
import type {
  BlockVerdict,
  FocusSessionConfig,
  FocusSessionState,
  FocusSessionSummary
} from '@deta/types'
import { acostaApiRequest } from './api'

const log = useLogScope('AcostaFocusMode')

const IDLE_STATE: FocusSessionState = {
  active: false,
  config: null,
  phase: 'focus',
  phaseEndsAt: null,
  startedAt: null,
  pagesVisited: 0,
  blockedAttempts: 0,
  notesTaken: 0
}

/** Hosts that stay reachable during focus sessions (auth, Acosta platform). */
const FOCUS_ALWAYS_ALLOWED = new Set([
  'acosta.ai',
  'api.acosta.ai',
  'platform.acosta-ai.com',
  'heyacosta.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com'
])

/**
 * Focus session state machine, owned by the main process so allowlist
 * enforcement happens at the network layer regardless of which window or tab
 * triggers a navigation.
 *
 * Emits: 'state-change' (FocusSessionState), 'session-complete' (FocusSessionSummary)
 */
export class AcostaFocusMode extends EventEmitter {
  private static instance: AcostaFocusMode | null = null

  private state: FocusSessionState = { ...IDLE_STATE }
  private phaseTimer: NodeJS.Timeout | null = null
  private allowedHosts = new Set<string>()

  static get(): AcostaFocusMode {
    if (!this.instance) this.instance = new AcostaFocusMode()
    return this.instance
  }

  getState(): FocusSessionState {
    return { ...this.state }
  }

  get isActive(): boolean {
    return this.state.active
  }

  start(config: FocusSessionConfig): FocusSessionState {
    if (this.state.active) this.stop()

    this.allowedHosts = new Set(config.allowlist.map(normalizeHost).filter(Boolean))

    this.state = {
      active: true,
      config,
      phase: 'focus',
      startedAt: Date.now(),
      phaseEndsAt: Date.now() + config.focusMinutes * 60_000,
      pagesVisited: 0,
      blockedAttempts: 0,
      notesTaken: 0
    }

    this.schedulePhaseEnd()
    this.emitState()
    log.log(`Focus session started: ${config.subject} — ${config.task}`)
    return this.getState()
  }

  /** Ends the session and reports the summary. Returns null if no session was running. */
  stop(): FocusSessionSummary | null {
    if (!this.state.active || !this.state.config || !this.state.startedAt) return null

    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer)
      this.phaseTimer = null
    }

    const endedAt = Date.now()
    const summary: FocusSessionSummary = {
      subject: this.state.config.subject,
      task: this.state.config.task,
      startedAt: this.state.startedAt,
      endedAt,
      focusedSeconds: Math.round((endedAt - this.state.startedAt) / 1000),
      pagesVisited: this.state.pagesVisited,
      blockedAttempts: this.state.blockedAttempts,
      notesTaken: this.state.notesTaken
    }

    this.state = { ...IDLE_STATE }
    this.allowedHosts.clear()
    this.emitState()
    this.emit('session-complete', summary)

    // Persist to study history; failure is non-fatal (offline studying is fine)
    acostaApiRequest('POST', '/study-sessions', summary).then((res) => {
      if (!res.ok) log.warn('Saving study session to Acosta failed (continuing)')
    })

    log.log('Focus session ended:', summary)
    return summary
  }

  /** Allowlist verdict for a host. Only blocks during the focus phase. */
  checkUrl(host: string): BlockVerdict {
    if (!this.state.active || this.state.phase !== 'focus') return { blocked: false }

    const normalized = host.toLowerCase().replace(/^www\./, '')
    if (isHostAllowed(normalized, FOCUS_ALWAYS_ALLOWED)) return { blocked: false }
    if (isHostAllowed(normalized, this.allowedHosts)) return { blocked: false }

    this.state.blockedAttempts += 1
    this.emitState()

    const task = this.state.config?.task ?? 'your current task'
    return {
      blocked: true,
      source: 'focus-mode',
      reason: `You're in a focus session right now — stay with “${task}”. This site isn't on your session allowlist.`
    }
  }

  recordPageVisit(): void {
    if (!this.state.active) return
    this.state.pagesVisited += 1
    this.emitState()
  }

  recordNoteTaken(): void {
    if (!this.state.active) return
    this.state.notesTaken += 1
    this.emitState()
  }

  private schedulePhaseEnd(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer)
    if (!this.state.phaseEndsAt) return

    const delay = Math.max(0, this.state.phaseEndsAt - Date.now())
    this.phaseTimer = setTimeout(() => this.advancePhase(), delay)
  }

  private advancePhase(): void {
    if (!this.state.active || !this.state.config) return

    if (this.state.phase === 'focus') {
      this.state.phase = 'break'
      this.state.phaseEndsAt = Date.now() + this.state.config.breakMinutes * 60_000
      log.log('Focus phase complete — starting break')
    } else {
      this.state.phase = 'focus'
      this.state.phaseEndsAt = Date.now() + this.state.config.focusMinutes * 60_000
      log.log('Break over — back to focus')
    }

    this.schedulePhaseEnd()
    this.emitState()
  }

  private emitState(): void {
    this.emit('state-change', this.getState())
  }
}

const normalizeHost = (host: string): string =>
  host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')

function isHostAllowed(host: string, allowed: Set<string>): boolean {
  let current = host
  while (current.includes('.')) {
    if (allowed.has(current)) return true
    current = current.slice(current.indexOf('.') + 1)
  }
  return false
}

export const useAcostaFocusMode = (): AcostaFocusMode => AcostaFocusMode.get()
