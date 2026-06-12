import { app } from 'electron'
import { useLogScope } from '@deta/utils'
import { ACOSTA_UPDATES_URL } from '@deta/types'

const log = useLogScope('AcostaUpdater')

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // every 4 hours

/**
 * Auto updates from the Acosta release feed (generic provider, matching the
 * `publish` block in the electron-builder config). Updates download in the
 * background and install on quit.
 */
export async function setupAutoUpdater(): Promise<void> {
  if (!app.isPackaged) {
    log.log('Skipping auto updater in development')
    return
  }

  try {
    const { autoUpdater } = await import('electron-updater')

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: import.meta.env.M_VITE_APP_UPDATES_PROXY_URL || ACOSTA_UPDATES_URL
    })
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => log.log('Update available:', info.version))
    autoUpdater.on('update-downloaded', (info) =>
      log.log('Update downloaded, will install on quit:', info.version)
    )
    autoUpdater.on('error', (err) => log.warn('Auto update error:', err.message))

    await autoUpdater.checkForUpdates()
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((err) => log.warn('Update check failed:', err))
    }, CHECK_INTERVAL_MS)
  } catch (err) {
    log.warn('Auto updater unavailable:', err)
  }
}
