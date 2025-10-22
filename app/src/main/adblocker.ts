import { ElectronBlocker } from '@ghostery/adblocker-electron'
import fetch from 'cross-fetch'
import { session } from 'electron'
import { changeMenuItemLabel } from './appMenu'
import { getUserConfig, updateUserConfigSettings } from './config'
import { ipcSenders } from './ipcHandlers'
import { getWebRequestManager } from './webRequestManager'

let blocker: ElectronBlocker | null = null

let removeBeforeRequest: (() => void) | null = null
let removeHeadersReceived: (() => void) | null = null

export async function setupAdblocker() {
  // blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
  //   path: join(app.getPath('userData'), 'adblocker.bin'),
  //   read: fs.readFile,
  //   write: fs.writeFile
  // })
  // TODO: caching might be the cause
  blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch)
}

export function initAdblocker(partition: string) {
  if (!blocker) return

  // Get initial state
  const config = getUserConfig()
  const isEnabled = config.settings.adblockerEnabled ?? false

  setAdblockerState(partition, isEnabled)
}

export function setAdblockerState(partition: string, state: boolean): void {
  if (!blocker) return

  const webRequestManager = getWebRequestManager()
  const targetSession = session.fromPartition(partition)

  if (state) {
    if (!blocker.isBlockingEnabled(targetSession)) {
      blocker.enableBlockingInSession(targetSession, false)
      removeBeforeRequest = webRequestManager.addBeforeRequest(
        targetSession,
        blocker.onBeforeRequest
      )
      removeHeadersReceived = webRequestManager.addHeadersReceived(
        targetSession,
        blocker.onHeadersReceived
      )
    }
  } else {
    if (blocker.isBlockingEnabled(targetSession)) {
      blocker.disableBlockingInSession(targetSession)
      if (removeBeforeRequest) removeBeforeRequest()
      if (removeHeadersReceived) removeHeadersReceived()
      removeBeforeRequest = null
      removeHeadersReceived = null
    }
  }
  // Store state
  updateUserConfigSettings({ adblockerEnabled: state })

  // Notify renderer
  ipcSenders.adBlockChanged(partition, state)

  // Modify menu item status
  changeMenuItemLabel('adblocker', state ? 'Disable Adblocker' : 'Enable Adblocker')
}

export function getAdblockerState(partition: string): boolean {
  if (!blocker) return false
  const isEnabled = blocker.isBlockingEnabled(session.fromPartition(partition))

  const config = getUserConfig()
  const stored = config.settings.adblockerEnabled ?? false

  if (stored !== isEnabled) {
    setAdblockerState(partition, isEnabled)
  }

  return isEnabled
}

export function toggleAdblocker(partition: string): boolean {
  const isEnabled = getAdblockerState(partition)
  const newState = !isEnabled

  setAdblockerState(partition, newState)

  return newState
}

export function getAdblocker(): ElectronBlocker | null {
  return blocker
}
