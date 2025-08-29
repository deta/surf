import { type ShortcutDefinition, ShortcutPriority } from './shortcutsManager'

// Define all available shortcuts in the app
export enum ShortcutActions {
  CLOSE_TAB = 'CLOSE_TAB',
  NEW_TAB = 'NEW_TAB',
  CLOSE_TELETYPE = 'CLOSE_TELETYPE',
  SWITCH_TO_TAB_1 = 'SWITCH_TO_TAB_1',
  SWITCH_TO_TAB_2 = 'SWITCH_TO_TAB_2',
  SWITCH_TO_TAB_3 = 'SWITCH_TO_TAB_3',
  SWITCH_TO_TAB_4 = 'SWITCH_TO_TAB_4',
  SWITCH_TO_TAB_5 = 'SWITCH_TO_TAB_5',
  SWITCH_TO_TAB_6 = 'SWITCH_TO_TAB_6',
  SWITCH_TO_TAB_7 = 'SWITCH_TO_TAB_7',
  SWITCH_TO_TAB_8 = 'SWITCH_TO_TAB_8',
  SWITCH_TO_TAB_9 = 'SWITCH_TO_TAB_9',
  SWITCH_TO_LAST_TAB = 'SWITCH_TO_LAST_TAB',
  TOGGLE_SIDEBAR = 'TOGGLE_SIDEBAR'
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
  },
  [ShortcutActions.SWITCH_TO_TAB_1]: {
    action: ShortcutActions.SWITCH_TO_TAB_1,
    defaultCombo: 'Meta+1',
    description: 'Switch to tab 1',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_2]: {
    action: ShortcutActions.SWITCH_TO_TAB_2,
    defaultCombo: 'Meta+2',
    description: 'Switch to tab 2',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_3]: {
    action: ShortcutActions.SWITCH_TO_TAB_3,
    defaultCombo: 'Meta+3',
    description: 'Switch to tab 3',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_4]: {
    action: ShortcutActions.SWITCH_TO_TAB_4,
    defaultCombo: 'Meta+4',
    description: 'Switch to tab 4',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_5]: {
    action: ShortcutActions.SWITCH_TO_TAB_5,
    defaultCombo: 'Meta+5',
    description: 'Switch to tab 5',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_6]: {
    action: ShortcutActions.SWITCH_TO_TAB_6,
    defaultCombo: 'Meta+6',
    description: 'Switch to tab 6',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_7]: {
    action: ShortcutActions.SWITCH_TO_TAB_7,
    defaultCombo: 'Meta+7',
    description: 'Switch to tab 7',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_8]: {
    action: ShortcutActions.SWITCH_TO_TAB_8,
    defaultCombo: 'Meta+8',
    description: 'Switch to tab 8',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_9]: {
    action: ShortcutActions.SWITCH_TO_TAB_9,
    defaultCombo: 'Meta+9',
    description: 'Switch to tab 9',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_LAST_TAB]: {
    action: ShortcutActions.SWITCH_TO_LAST_TAB,
    defaultCombo: 'Meta+0',
    description: 'Switch to last tab',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.TOGGLE_SIDEBAR]: {
    action: ShortcutActions.TOGGLE_SIDEBAR,
    defaultCombo: 'Meta+e',
    description: 'Toggle Sidebar',
    priority: ShortcutPriority.Normal
  }
} as const
