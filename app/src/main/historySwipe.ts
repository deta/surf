import trackpad from '@deta/trackpad'
import { getMainWindow } from './mainWindow'
import log from '@deta/utils/src/system/log'
import { getUserConfig, updateUserConfigSettings } from './config'
import { changeMenuItemLabel } from './appMenu'
import { IPC_EVENTS_MAIN } from '@deta/services/src/ipc/events'

let historySwipeGestureEnabled = false

export function getHistorySwipeGestureConfig() {
  return historySwipeGestureEnabled
}

export function setHistorySwipeGestureConfig(state: boolean) {
  historySwipeGestureEnabled = state
  updateUserConfigSettings({ historySwipeGesture: state })
  changeMenuItemLabel(
    'historySwipe',
    historySwipeGestureEnabled ? 'Disable History Swipe Gesture' : 'Enable History Swipe Gesture'
  )
}

export function toggleHistorySwipeGestureConfig() {
  setHistorySwipeGestureConfig(!historySwipeGestureEnabled)
}

export function setupHistorySwipeIpcSenders() {
  setHistorySwipeGestureConfig(getUserConfig().settings.historySwipeGesture || false)

  trackpad.setScrollStartCallback(() => {
    if (!historySwipeGestureEnabled) return
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.trackpadScrollStart.sendToWebContents(window.webContents)
  })

  trackpad.setScrollStopCallback(() => {
    if (!historySwipeGestureEnabled) return
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.trackpadScrollStop.sendToWebContents(window.webContents)
  })
}
