import trackpad from '@horizon/trackpad'
import { getMainWindow } from './mainWindow'
import log from '@horizon/utils/src/log'
import { getBrowserConfig, setBrowserConfig } from './config'
import { changeMenuItemLabel } from './appMenu'

let historySwipeGestureEnabled = false;

export function getHistorySwipeGestureConfig() {
  return historySwipeGestureEnabled
}

export function setHistorySwipeGestureConfig(state: boolean) {
  historySwipeGestureEnabled = state
  setBrowserConfig({ ...getBrowserConfig(), historySwipeGesture: state })
  changeMenuItemLabel(
    'historySwipe',
    historySwipeGestureEnabled ? 'Disable History Swipe Gesture' : 'Enable History Swipe Gesture'
  )
}

export function toggleHistorySwipeGestureConfig() {
  setHistorySwipeGestureConfig(!historySwipeGestureEnabled)
}

export function setupHistorySwipeIpcSenders() {
  setHistorySwipeGestureConfig(getBrowserConfig().historySwipeGesture || false)

  trackpad.setScrollStartCallback(() => {
    if (!historySwipeGestureEnabled) return
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('trackpad-scroll-start')
  })

  trackpad.setScrollStopCallback(() => {
    if (!historySwipeGestureEnabled) return
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('trackpad-scroll-stop')
  })
}
