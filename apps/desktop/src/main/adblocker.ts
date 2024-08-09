import { ElectronBlocker } from '@cliqz/adblocker-electron'
import fetch from 'cross-fetch'
import { session } from 'electron'
import { changeMenuItemLabel } from './appMenu'
import { getBrowserConfig, setBrowserConfig } from './config'
import { ipcSenders } from './ipcHandlers'

let blocker: ElectronBlocker | undefined

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
  const config = getBrowserConfig()
  const isEnabled = config.adblockerEnabled ?? false

  setAdblockerState(partition, isEnabled)
}

export function setAdblockerState(partition: string, state: boolean): void {
  if (!blocker) return

  const targetSession = session.fromPartition(partition)
  if (state) {
    !blocker.isBlockingEnabled(targetSession) && blocker.enableBlockingInSession(targetSession)
  } else {
    blocker.isBlockingEnabled(targetSession) && blocker.disableBlockingInSession(targetSession)
  }

  // Store state
  setBrowserConfig({ adblockerEnabled: state })

  // Notify renderer
  ipcSenders.adBlockChanged(partition, state)

  // Modify menu item status
  changeMenuItemLabel('adblocker', state ? 'Disable Adblocker' : 'Enable Adblocker')
}

export function getAdblockerState(partition: string): boolean {
  if (!blocker) return false
  const isEnabled = blocker.isBlockingEnabled(session.fromPartition(partition))

  const config = getBrowserConfig()
  const stored = config.adblockerEnabled ?? false

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
