import type { FocusSessionConfig, FocusSessionState, FocusSessionSummary } from '@deta/types'
import { useLogScope } from '@deta/utils'

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

/**
 * Renderer-side mirror of the focus session state owned by the main process.
 * Components read the reactive `state` and `remainingSeconds`; mutations go
 * through start()/stop() which round-trip over IPC.
 */
export class AcostaFocusService {
  private static instance: AcostaFocusService | null = null

  private log = useLogScope('AcostaFocus')

  state = $state<FocusSessionState>({ ...IDLE_STATE })
  lastSummary = $state<FocusSessionSummary | null>(null)
  remainingSeconds = $state(0)

  private ticker: ReturnType<typeof setInterval> | null = null

  static use(): AcostaFocusService {
    if (!this.instance) {
      this.instance = new AcostaFocusService()
      this.instance.initialize()
    }
    return this.instance
  }

  private initialize(): void {
    window.api.acosta
      .focusGetState()
      .then((state) => {
        if (state) this.applyState(state)
      })
      .catch((err) => this.log.warn('Could not fetch focus state:', err))

    window.api.acosta.onFocusStateChange((state) => this.applyState(state))
    window.api.acosta.onFocusSessionComplete((summary) => {
      this.lastSummary = summary
    })
  }

  async start(config: FocusSessionConfig): Promise<void> {
    const state = await window.api.acosta.focusStart(config)
    if (state) this.applyState(state)
  }

  async stop(): Promise<FocusSessionSummary | null> {
    const summary = await window.api.acosta.focusStop()
    if (summary) this.lastSummary = summary
    return summary ?? null
  }

  dismissSummary(): void {
    this.lastSummary = null
  }

  private applyState(state: FocusSessionState): void {
    this.state = state
    this.updateRemaining()

    if (state.active && !this.ticker) {
      this.ticker = setInterval(() => this.updateRemaining(), 1000)
    } else if (!state.active && this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }
  }

  private updateRemaining(): void {
    this.remainingSeconds = this.state.phaseEndsAt
      ? Math.max(0, Math.round((this.state.phaseEndsAt - Date.now()) / 1000))
      : 0
  }
}

export const useAcostaFocus = (): AcostaFocusService => AcostaFocusService.use()
