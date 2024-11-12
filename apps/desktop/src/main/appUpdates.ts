import { dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import {
  createUpdatesWindow,
  closeUpdatesWindow,
  sendUpdateErrorStatus,
  sendUpdateProgressStatus
} from './updatesWindow'

autoUpdater.autoDownload = false

let isSilent = false

autoUpdater.on('update-available', async (updateInfo) => {
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
    } catch (e) {
      dialog.showErrorBox('Update Error', `Error while updating the app: ${e}`)
      closeUpdatesWindow()
    }
    await autoUpdater.downloadUpdate()
  }
})

autoUpdater.on('update-not-available', async () => {
  if (!isSilent) {
    await dialog.showMessageBox({
      type: 'info',
      message: 'No Updates Available',
      buttons: ['OK']
    })
  }
})

autoUpdater.on('update-downloaded', async (_1) => {
  closeUpdatesWindow()
  autoUpdater.quitAndInstall(false)
})

autoUpdater.on('error', async (_error, message) => {
  if (!isSilent) {
    closeUpdatesWindow()
    dialog.showErrorBox('Update Error', `Error while updating the app: ${message}`)
  }
})

autoUpdater.on('download-progress', async (progress) => {
  sendUpdateProgressStatus(progress.percent)
})

// Don't call this multiple times.
export async function checkForUpdates(silent = false) {
  try {
    isSilent = silent
    await autoUpdater.checkForUpdates()
  } catch (e) {
    console.error(e)
  } finally {
    isSilent = false
  }
}

export async function checkUpdatesMenuClickHandler(_1: any, _2: any, _3: any) {
  await checkForUpdates(false)
}

export async function silentCheckForUpdates() {
  await checkForUpdates(true)
}
