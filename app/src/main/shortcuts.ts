import { globalShortcut, BrowserWindow } from 'electron'

const validShortcuts = [
  // 'Up',
  // 'Down',
  'o', // open overview
  'n', // new horizon
  'w', // close card or horizon
  'g',
  'h',
  ...Array.from(Array(9).keys()).map((idx) => `${idx + 1}`)
]

const sendShortcutToHorizon = (key: string) => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) {
    window.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: key,
      modifiers: ['meta', 'ctrl']
    })
  }
}

export function registerShortcuts() {
  validShortcuts.forEach((shortcut) =>
    globalShortcut.register(`CommandOrControl+${shortcut}`, () => sendShortcutToHorizon(shortcut))
  )
}

export function unregisterShortcuts() {
  validShortcuts.forEach((shortcut) => globalShortcut.unregister(`CommandOrControl+${shortcut}`))
}
