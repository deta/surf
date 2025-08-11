import { CreateTabEventTrigger, type UserStats } from '@deta/types'
import { isDev, useLogScope } from '@deta/utils'
// NOTE: Lsp shits itself for reasons, this works tho:
import { CONTENTS, showNotification } from '../components/Core/Notifier/Notification.svelte'
import { DesktopManager } from './desktop'
import { get } from 'svelte/store'
import { useTabsManager } from './tabs'

export class UserStatsService {
  static get log(): ReturnType<typeof useLogScope> {
    return useLogScope('UserStats')
  }

  static async getUserStats(): Promise<UserStats | null> {
    const stats = await window.api.getUserStats()
    return stats
  }

  static CHECK_NOTIFY_INTERVAL = isDev ? 1000 : 1000 * 60 * 1
  static checkUserNotifyRef: NodeJS.Timeout | null = null
  static isShowingNotification = false

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

  // Returns the max "streak" of having any session in a day.
  static async getNDaysInARowSession(): Promise<number> {
    if (!window) return 0
    const sessions = await UserStatsService.getSessions()
    if (!sessions || !sessions.length) return 0

    // Sort sessions by startedAt to validate endedAt
    const sortedSessions = [...sessions].sort((a, b) => a.startedAt - b.startedAt)

    // Create a Map to store days with sessions
    const daysWithSessions = new Map<string, boolean>()

    sortedSessions.forEach((session, index) => {
      // Skip sessions with invalid endedAt (if there's a later session)
      if (session.endedAt === undefined && index < sortedSessions.length - 1) return

      const startDate = new Date(session.startedAt)
      const endDate = session.endedAt ? new Date(session.endedAt) : new Date()

      let currentDate = new Date(startDate)
      currentDate.setHours(0, 0, 0, 0)

      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)

      // Add each day between start and end
      while (currentDate <= endDateTime) {
        daysWithSessions.set(currentDate.toISOString().split('T')[0], true)
        currentDate.setDate(currentDate.getDate() + 1)
      }
    })

    // Convert to sorted array of dates
    const dates = [...daysWithSessions.keys()].sort()

    let maxStreak = 1
    let currentStreak = 1

    // Calculate streaks
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1])
      const currDate = new Date(dates[i])

      const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)

      if (dayDiff === 1) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 1
      }
    }

    return maxStreak
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
    if (
      !isDev &&
      ((await UserStatsService.getDontShowPromptSetDefaultBrowser()) ||
        (await UserStatsService.getTimeSinceSessionStarted()) < 1000 * 60 * 2)
    )
      return

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

    if (!show || UserStatsService.isShowingNotification) return
    UserStatsService.isShowingNotification = true

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
    UserStatsService.isShowingNotification = false

    if (closeType === true) {
      window.api.useAsDefaultBrowser() // TODO: allow tracking event & from where it was called
    } else if (closeType === false && submitValue === 'not_now') {
      // noop
    } else if (closeType === false && submitValue === 'never') {
      UserStatsService.setDontShowPromptSetDefaultBrowser(true)
      // TODO: display info
    }
  }

  static async getBookCallPromptLastShownDiff() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return 9999999999999

    return Math.abs(Date.now() - stats.timestamp_last_prompt_book_call)
  }
  static async setBookCallPromptLastShownDiff() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return

    stats.timestamp_last_prompt_book_call = Date.now()
    UserStatsService.storeUserStats(stats)
  }
  static async getDontShowBookCallPrompt() {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return
    return stats.dont_show_prompt_book_call
  }
  static async setDontShowBookCallPrompt(v: boolean) {
    const stats = await UserStatsService.getUserStats()
    if (!stats) return

    stats.dont_show_prompt_book_call = v
    UserStatsService.storeUserStats(stats)
  }

  private static async checkUserCallPrompt() {
    if (
      !isDev &&
      ((await UserStatsService.getDontShowBookCallPrompt()) ||
        (await UserStatsService.getTimeSinceSessionStarted()) < 1000 * 60 * 2)
    )
      return

    const stats = await UserStatsService.getUserStats()
    if (!stats) {
      UserStatsService.log.warn('Could not get userStats!')
      return
    }

    let show = false
    const isFirstNotification = stats.timestamp_last_prompt_book_call === 9999999999999
    const lastShownDiff = await UserStatsService.getBookCallPromptLastShownDiff()

    if (stats) {
      if (stats.global_n_saves_to_oasis >= 20) show = true

      if (show && lastShownDiff < 1000 * 60 * 60 * 3) show = false
    }

    if (!DesktopManager.self) {
      this.log.warn('DesktopManager doesnt not exist! This shouldnt happen!')
      return
    }

    const desktopsData = await DesktopManager.self.getAllDesktopsData()
    const customDesktopsN = desktopsData
      .map((desktop) => {
        if (desktop?.background_image !== undefined) {
          const bgData = desktop.background_image
          if (bgData?.resourceId !== undefined && bgData?.resourceId !== null) {
            return desktop
          }
        }
        return undefined
      })
      .filter((e) => e !== undefined).length

    if (customDesktopsN < 1) return

    //   use the product 3 days in a row
    const maxStreak = await UserStatsService.getNDaysInARowSession()
    if (maxStreak < 3) return

    if (!show || UserStatsService.isShowingNotification) return
    UserStatsService.isShowingNotification = true

    UserStatsService.setBookCallPromptLastShownDiff()

    const { closeType, submitValue } = await showNotification({
      title: CONTENTS.book_call.title,
      message: CONTENTS.book_call.body,
      actions: [
        { type: 'submit', title: 'Schedule a call' },
        isFirstNotification
          ? { type: 'reset', kind: 'muted', value: 'not_now', title: `Not Now` }
          : { type: 'reset', kind: 'muted', value: 'never', title: `Don't ask again` }
      ]
    })
    UserStatsService.isShowingNotification = false

    if (closeType === true) {
      const tabs = useTabsManager()
      if (!tabs) {
        this.log.error('Tabs manager not found! This shouldnt happen!')
        return
      }
      tabs.addPageTab('https://deta.surf/meet', {
        active: true,
        index: 0,
        placeAtEnd: false,

        trigger: CreateTabEventTrigger.System
      })
      UserStatsService.setDontShowBookCallPrompt(true)
    } else if (closeType === false && submitValue === 'not_now') {
      // noop
    } else if (closeType === false && submitValue === 'never') {
      UserStatsService.setDontShowBookCallPrompt(true)
    }
  }

  static startCheckNotifyUserInterval() {
    UserStatsService.checkUserNotifyRef = setInterval(() => {
      UserStatsService.checkDefaultBrowserPrompt()
      UserStatsService.checkUserCallPrompt()
    }, UserStatsService.CHECK_NOTIFY_INTERVAL)
    UserStatsService.checkUserCallPrompt()
  }
  static stopCheckNotifyUserInterval() {
    if (UserStatsService.checkUserNotifyRef) clearInterval(UserStatsService.checkUserNotifyRef)
  }
}

/*// NOTE: We don't use svelte context but singletons, as passing this to every other service would be
// super nasty & unecessary. Also this is not mission critical.
export const provideUserStats = () => {}
export const useUserStats = () => {}*/
