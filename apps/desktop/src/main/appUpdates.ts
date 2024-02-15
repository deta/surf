const { dialog } = require('electron')
import { autoUpdater } from 'electron-updater'

autoUpdater.autoDownload = false
autoUpdater.on('update-available', async (updateInfo) => {
  const userAction = await dialog.showMessageBox({
    type: 'info',
    message: `New Version ${updateInfo.version} Available`,
    checkboxLabel: 'Update And Restart',
    buttons: ['OK']
  })
  if (userAction.checkboxChecked) {
    await autoUpdater.downloadUpdate()
  }
})

autoUpdater.on('update-not-available', async () => {
  await dialog.showMessageBox({
    type: 'info',
    message: 'No Updates Available',
    buttons: ['OK']
  })
})

autoUpdater.on('update-downloaded', async (_1) => {
  await autoUpdater.quitAndInstall(false)
})

autoUpdater.on('error', async (error) => {
  await dialog.showErrorBox('Update Error', `'Error while updating the app: ${error.message}`)
})

// the click calls with (menuItem, browserWindow, event) but we don't need them right now
export async function checkUpdatesMenuClickHandler(_1, _2, _3) {
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    console.error(e)
  }
}
