import { dialog } from 'electron'
import { isMac, isWindows } from '@horizon/utils'
import { MacUpdater, AppImageUpdater, NsisUpdater } from 'electron-updater'

import { createUpdatesWindow, closeUpdatesWindow, sendUpdateProgressStatus } from './updatesWindow'
import { createAnnouncementsWindow } from './announcementsWindow'

import type { Announcement } from '@horizon/types'
import { AnnouncementsManager } from './announcements'

let isSilent = false

type Updater = MacUpdater | AppImageUpdater | NsisUpdater

const TEST_ANNOUNCEMENTS: Announcement[] = [
  {
    id: '1',
    type: 'security',
    content:
      "## Security Update Required\n\nWe've released an important security patch. Please update your application to version 2.1.0 immediately to protect against recently discovered vulnerabilities.\n\nThis update addresses:\n- Cross-site scripting prevention\n- Authentication improvements\n- Data encryption enhancements",
    createdAt: '2024-12-10T10:00:00Z',
    updatedAt: '2024-12-13T14:30:00Z'
  },
  {
    id: '2',
    type: 'update',
    content:
      "## New Features Released!\n\nWe're excited to announce our latest features:\n- Dark mode support\n- Enhanced search capabilities\n- Performance improvements\n\nCheck out our [documentation](https://deta.surf/privacy) for more details.",
    createdAt: '2024-12-09T15:00:00Z',
    updatedAt: '2024-12-09T15:00:00Z'
  },
  {
    id: '3',
    type: 'info',
    content:
      '## Scheduled Maintenance\n\nOur system will undergo routine maintenance on December 15th, 2024, from 2:00 AM to 4:00 AM UTC. During this time, some services may be intermittently unavailable.',
    createdAt: '2024-12-08T09:00:00Z',
    updatedAt: '2024-12-08T09:00:00Z'
  },
  {
    id: '4',
    type: 'security',
    content:
      '## Account Security Notice\n\nWe recommend enabling two-factor authentication (2FA) for your account. This additional security layer helps protect your data from unauthorized access.\n\nLearn how to enable 2FA in your account settings.',
    createdAt: '2024-12-07T16:45:00Z',
    updatedAt: '2024-12-07T16:45:00Z'
  }
]

// NOTE: by default the updater will use the 'latest' channel
function initializeUpdater(authToken: string, proxyUrl: string, channel?: string): Updater {
  if (!authToken) {
    throw new Error('Auth token is required to check for updates')
  }
  if (!proxyUrl) {
    throw new Error('Proxy URL is required to check for updates')
  }

  let updaterConfig = {
    provider: 'generic',
    url: proxyUrl,
    channel: channel
  }

  let updater: Updater

  if (isMac()) {
    // @ts-ignore
    updater = new MacUpdater(updaterConfig)
  } else if (isWindows()) {
    // @ts-ignore
    updater = new NsisUpdater(updaterConfig)
  } else {
    // @ts-ignore
    updater = new AppImageUpdater(updaterConfig)
  }

  updater.addAuthHeader(`Bearer ${authToken}`)
  updater.autoDownload = false

  /*
   * Uncomment the forceDevUpdateConfig to test dev updates
   * make sure to use the right params in the dev app update yml file
   * when a dev update is downloaded it is cached in the `app.getPath('cache')` directory
   * you'll have to delete the cached dev update to download it again
   */
  // updater.forceDevUpdateConfig = true

  return updater
}

function configureUpdaterEvents(updater: Updater) {
  updater.on('update-available', async (updateInfo) => {
    const userAction = await dialog.showMessageBox({
      type: 'info',
      message: `New Version ${updateInfo.version} Available`,
      checkboxLabel: 'Update And Restart',
      checkboxChecked: true,
      buttons: ['OK']
    })

    if (userAction.checkboxChecked) {
      try {
        createUpdatesWindow()
        await updater.downloadUpdate()
      } catch (e) {
        dialog.showErrorBox('Update Error', `Error while updating the app: ${e}`)
        closeUpdatesWindow()
      }
    }
  })

  updater.on('update-not-available', async () => {
    if (!isSilent) {
      await dialog.showMessageBox({
        type: 'info',
        message: 'No Updates Available',
        buttons: ['OK']
      })
    }
  })

  updater.on('update-downloaded', async () => {
    closeUpdatesWindow()
    updater.quitAndInstall(false)
  })

  updater.on('error', async (_error, message) => {
    if (!isSilent) {
      closeUpdatesWindow()
      dialog.showErrorBox('Update Error', `Error while updating the app: ${message}`)
    }
  })

  updater.on('download-progress', async (progress) => {
    sendUpdateProgressStatus(progress.percent)
  })
}

export function getAnnouncements(): Announcement[] {
  try {
    return AppUpdater.getInstance().getAnnouncements()
  } catch (e) {
    console.error(e)
    return []
  }
}

export async function checkForUpdates(silent = false) {
  try {
    isSilent = silent
    await AppUpdater.getInstance().checkForUpdatesAndNotify(silent)
  } catch (e) {
    console.error(e)
  } finally {
    isSilent = false
  }
}

export async function checkUpdatesMenuClickHandler() {
  await AppUpdater.getInstance().checkForUpdatesAndNotify(false)
}

export async function silentCheckForUpdates() {
  await AppUpdater.getInstance().checkForUpdatesAndNotify(true)
}

export interface AppUpdaterConfig {
  authToken: string
  proxyUrl: string
  currentAppVersion: string
  channel?: string
  announcementsUrl?: string
  showTestAnnouncements?: boolean
}

// a Singleton to handle app updates
export class AppUpdater {
  private static instance: AppUpdater | null = null
  private authToken: string
  private currentAppVersion: string
  private updater: Updater | null = null

  private announcementsUrl: string | undefined
  private announcementsInterval: NodeJS.Timeout | null = null // every 2 hours
  private announcementsManager: AnnouncementsManager
  private showTestAnnouncements: boolean

  private constructor(config: AppUpdaterConfig) {
    this.authToken = config.authToken
    this.announcementsUrl = config.announcementsUrl
    this.currentAppVersion = config.currentAppVersion
    this.announcementsManager = AnnouncementsManager.getInstance()
    this.showTestAnnouncements = config.showTestAnnouncements || false

    this.fetchAnnouncements().catch(console.error)
    if (this.announcementsUrl) {
      this.announcementsInterval = setInterval(
        () => {
          this.fetchAnnouncements().catch(console.error)
        },
        2000 * 60 * 60 * 2
      ) // 2 hours
    }

    try {
      this.updater = initializeUpdater(config.authToken, config.proxyUrl, config.channel)
      configureUpdaterEvents(this.updater)
    } catch (e) {
      console.error(e)
    }
  }

  private async fetchAnnouncements(): Promise<void> {
    if (this.showTestAnnouncements) {
      this.announcementsManager.setAnnouncements(TEST_ANNOUNCEMENTS)
    } else {
      if (!this.announcementsUrl) {
        return
      }

      try {
        const response = await fetch(this.announcementsUrl, {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            'X-Surf-App-Version': this.currentAppVersion
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to get announcements, got http status: ${response.status}`)
        }

        const data = await response.json()
        if (Array.isArray(data)) {
          this.announcementsManager.setAnnouncements(data)
        } else {
          console.error('Announcements data is not an array:', data)
        }
      } catch (error) {
        console.error('Error fetching announcements:', error)
      }
    }
    const visibleAnnouncements = this.announcementsManager.getVisibleAnnouncements(false)
    if (visibleAnnouncements.length > 0) {
      createAnnouncementsWindow()
    }
  }

  public static initialize(config: AppUpdaterConfig): void {
    if (!AppUpdater.instance) {
      AppUpdater.instance = new AppUpdater(config)
    }
  }

  public static getInstance(): AppUpdater {
    if (!AppUpdater.instance) {
      throw new Error('AppUpdater has not been initialized. Call initialize() first.')
    }
    return AppUpdater.instance
  }

  public async checkForUpdatesAndNotify(silent = false) {
    isSilent = silent
    await this.updater?.checkForUpdates()
  }

  public getAnnouncements() {
    return this.announcementsManager.getVisibleAnnouncements(!this.showTestAnnouncements)
  }

  public static destroy(): void {
    if (AppUpdater.instance?.announcementsInterval) {
      clearInterval(AppUpdater.instance.announcementsInterval)
      AnnouncementsManager.destroy()
    }
    AppUpdater.instance = null
  }
}
