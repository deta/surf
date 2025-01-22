import type { UserStats } from '@horizon/types'
import { isDev, useLogScope } from '@horizon/utils'
// NOTE: Lsp shits itself for reasons, this works tho:
import { CONTENTS, showNotification } from '../components/Core/Notifier/Notification.svelte'

export class UserStatsService {
  static get log(): ReturnType<typeof useLogScope> {
    return useLogScope('UserStats')
  }

  static async getUserStats(): Promise<UserStats | null> {
    const stats = await window.api.getUserStats()
    return stats
  }

  static CHECK_DEFAULT_BROWSER_INTERVAL = isDev ? 1000 : 1000 * 60 * 1
  static checkDefaultBrowserPromptRef: NodeJS.Timer | null = null

  static storeUserStats(stats: UserStats) {
    window.api.updateUserStats(stats)
  }

  static async startSession() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return

    const session = {
      startedAt: Date.now(),
      events: []
    }
    stats.sessions = [...stats.sessions, session]

    UserStatsService.storeUserStats(stats)
  }

  static async endSession() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return

    const session = stats.sessions.at(-1)
    if (!session) return
    session.endedAt = Date.now()
    session.duration = session?.endedAt - session?.startedAt

    UserStatsService.storeUserStats(stats)
  }

  static async getSessions() {
    if (!window) return undefined
    return (await UserStatsService.getUserStats())?.sessions
  }
  static async getTimeSinceSessionStarted() {
    if (!window) return 0
    const sessions = await UserStatsService.getSessions()
    if (!sessions) return 0
    const currSession = sessions.at(-1)
    if (!currSession) return 0
    else return Date.now() - (currSession.startedAt ?? 0)
  }
  static async getSessionsDurationSum() {
    if (!window) return 0
    const sessions = await UserStatsService.getSessions()
    if (!sessions) return 0
    let sum = 0
    for (const session of sessions) {
      sum += session?.duration ?? 0
    }
    return sum
  }

  static async incStat(key: string) {
    if (!window) return
    const stats = await UserStatsService.getUserStats()
    if (!stats) return

    if (!Object.keys(stats).includes(key)) {
      UserStatsService.log.error(`Tried to increment invalid key: ${key}!`)
      return
    }

    // @ts-ignore - this is ok
    stats[key] += 1

    UserStatsService.storeUserStats(stats)
  }

  static async getSetDefaultBrowserLastShownDiff() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return 9999999999999

    return Math.abs(Date.now() - stats.timestamp_last_prompt_set_default_browser)
  }
  static async setSetDefaultBrowserLastShownDiff() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return

    stats.timestamp_last_prompt_set_default_browser = Date.now()
    UserStatsService.storeUserStats(stats)
  }

  static async getDontShowPromptSetDefaultBrowser() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return
    return stats.dont_show_prompt_set_default_browser
  }
  static async setDontShowPromptSetDefaultBrowser(v: boolean) {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return

    stats.dont_show_prompt_set_default_browser = v
    UserStatsService.storeUserStats(stats)
  }

  private static async checkDefaultBrowserPrompt() {
    if (await window.api.isDefaultBrowser()) return
    if ((await UserStatsService.getTimeSinceSessionStarted()) < 1000 * 60 * 2) return

    const stats = await UserStatsService.getUserStats()
    if (!stats) {
      UserStatsService.log.warn('Could not get userStats!')
      return
    }

    let show = false
    const isFirstNotification = stats.timestamp_last_prompt_set_default_browser === 9999999999999
    const lastShownDiff = await UserStatsService.getSetDefaultBrowserLastShownDiff()

    // Total session time > 1h
    const SUM_TIME = ((await UserStatsService.getSessionsDurationSum()) ?? 0) / 1000 / 60
    if (SUM_TIME > 60 * 5 || SUM_TIME > 60 * 3 || SUM_TIME > 60 * 1) {
      if (lastShownDiff > 1000 * 60 * 60) show = true
    }

    if (stats) {
      if (stats.global_n_saves_to_oasis > 20) show = true
      else if (stats.global_n_contexts_created > 8) show = true
      else if (stats.global_n_chatted_with_space > 2) show = true
      else if (stats.global_n_chat_message_sent > 7) show = true
      else if (stats.global_n_use_inline_tools > 4) show = true
      else if (stats.global_n_saves_to_oasis > 20) show = true
      else if (stats.global_n_create_annotation > 4) show = true
      else if (stats.global_n_update_homescreen > 30) show = true

      if (show && lastShownDiff < 1000 * 60 * 60) show = false
    }

    if (!show || (await UserStatsService.getDontShowPromptSetDefaultBrowser())) return

    UserStatsService.setSetDefaultBrowserLastShownDiff()

    const { closeType, submitValue } = await showNotification({
      title: CONTENTS.default_browser.title,
      message: CONTENTS.default_browser.body,
      actions: [
        { type: 'submit', title: 'Set As Default' },
        isFirstNotification
          ? { type: 'reset', kind: 'muted', value: 'not_now', title: `Not Now` }
          : { type: 'reset', kind: 'muted', value: 'never', title: `Don't ask again` }
      ]
    })

    if (closeType === true) {
      window.api.useAsDefaultBrowser() // TODO: allow tracking event & from where it was called
    } else if (closeType === false && submitValue === 'not_now') {
      // noop
    } else if (closeType === false && submitValue === 'never') {
      UserStatsService.setDontShowPromptSetDefaultBrowser(true)
      // TODO: display info
    }
  }

  static startCheckDefaultBrowserInterval() {
    UserStatsService.checkDefaultBrowserPromptRef = setInterval(
      UserStatsService.checkDefaultBrowserPrompt,
      UserStatsService.CHECK_DEFAULT_BROWSER_INTERVAL
    )
  }
  static stopCheckDefaultBrowserInterval() {
    if (UserStatsService.checkDefaultBrowserPromptRef)
      clearInterval(UserStatsService.checkDefaultBrowserPromptRef)
  }
}

/*// NOTE: We don't use svelte context but singletons, as passing this to every other service would be
// super nasty & unecessary. Also this is not mission critical.
export const provideUserStats = () => {}
export const useUserStats = () => {}*/
