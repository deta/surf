import { ShortcutDefinition, ShortcutPriority } from './shortcutsManager'

// Define all available shortcuts in the app
export enum ShortcutActions {
  CLOSE_TAB = 'CLOSE_TAB',
  NEW_TAB = 'NEW_TAB',
  CLOSE_TELETYPE = 'CLOSE_TELETYPE'
}

// Default shortcut definitions
export const defaultShortcuts: Record<ShortcutActions, ShortcutDefinition<ShortcutActions>> = {
  [ShortcutActions.CLOSE_TAB]: {
    action: ShortcutActions.CLOSE_TAB,
    defaultCombo: 'Meta+W',
    description: 'Close the current tab',
    priority: ShortcutPriority.Low
  },
  [ShortcutActions.NEW_TAB]: {
    action: ShortcutActions.NEW_TAB,
    defaultCombo: 'Meta+T',
    description: 'Create a new tab',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.CLOSE_TELETYPE]: {
    action: ShortcutActions.CLOSE_TELETYPE,
    defaultCombo: 'Escape',
    description: 'Close the current teletype',
    priority: ShortcutPriority.High
  }
  // ... define other shortcuts
} as const
