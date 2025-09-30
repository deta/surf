import { type ShortcutDefinition, ShortcutPriority } from './shortcutsManager'

// Define all available shortcuts in the app
export enum ShortcutActions {
  TOGGLE_DEBUG_MODE = 'TOGGLE_DEBUG_MODE',
  CLOSE_TAB = 'CLOSE_TAB',
  NEW_TAB = 'NEW_TAB',
  EDIT_TAB_URL = 'EDIT_TAB_URL',
  REOPEN_CLOSED_TAB = 'REOPEN_CLOSED_TAB',
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
  //SWITCH_TO_LAST_TAB = 'SWITCH_TO_LAST_TAB',
  TOGGLE_SIDEBAR = 'TOGGLE_SIDEBAR',
  TOGGLE_TAB_ORIENTATION = 'TOGGLE_TAB_ORIENTATION',
  INCREASE_PAGE_ZOOM = 'INCREASE_PAGE_ZOOM',
  DECREASE_PAGE_ZOOM = 'DECREASE_PAGE_ZOOM',
  RESET_PAGE_ZOOM = 'RESET_PAGE_ZOOM'
}

// Default shortcut definitions
export const defaultShortcuts: Record<ShortcutActions, ShortcutDefinition<ShortcutActions>> = {
  [ShortcutActions.TOGGLE_DEBUG_MODE]: {
    action: ShortcutActions.TOGGLE_DEBUG_MODE,
    defaultCombo: 'CmdOrCtrl+Shift+D',
    description: 'Toggle Debug Mode',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.CLOSE_TAB]: {
    action: ShortcutActions.CLOSE_TAB,
    defaultCombo: 'CmdOrCtrl+W',
    description: 'Close the current tab',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.NEW_TAB]: {
    action: ShortcutActions.NEW_TAB,
    defaultCombo: 'CmdOrCtrl+T',
    description: 'Create a new tab',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.EDIT_TAB_URL]: {
    action: ShortcutActions.EDIT_TAB_URL,
    defaultCombo: 'CmdOrCtrl+l',
    description: 'Edit Tab URL',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.REOPEN_CLOSED_TAB]: {
    action: ShortcutActions.REOPEN_CLOSED_TAB,
    defaultCombo: 'CmdOrCtrl+Shift+T',
    description: 'Reopen the last closed tab',
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
    defaultCombo: 'CmdOrCtrl+1',
    description: 'Switch to tab 1',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_2]: {
    action: ShortcutActions.SWITCH_TO_TAB_2,
    defaultCombo: 'CmdOrCtrl+2',
    description: 'Switch to tab 2',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_3]: {
    action: ShortcutActions.SWITCH_TO_TAB_3,
    defaultCombo: 'CmdOrCtrl+3',
    description: 'Switch to tab 3',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_4]: {
    action: ShortcutActions.SWITCH_TO_TAB_4,
    defaultCombo: 'CmdOrCtrl+4',
    description: 'Switch to tab 4',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_5]: {
    action: ShortcutActions.SWITCH_TO_TAB_5,
    defaultCombo: 'CmdOrCtrl+5',
    description: 'Switch to tab 5',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_6]: {
    action: ShortcutActions.SWITCH_TO_TAB_6,
    defaultCombo: 'CmdOrCtrl+6',
    description: 'Switch to tab 6',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_7]: {
    action: ShortcutActions.SWITCH_TO_TAB_7,
    defaultCombo: 'CmdOrCtrl+7',
    description: 'Switch to tab 7',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_8]: {
    action: ShortcutActions.SWITCH_TO_TAB_8,
    defaultCombo: 'CmdOrCtrl+8',
    description: 'Switch to tab 8',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.SWITCH_TO_TAB_9]: {
    action: ShortcutActions.SWITCH_TO_TAB_9,
    defaultCombo: 'CmdOrCtrl+9',
    description: 'Switch to tab 9',
    priority: ShortcutPriority.Normal
  },
  //[ShortcutActions.SWITCH_TO_LAST_TAB]: {
  //  action: ShortcutActions.SWITCH_TO_LAST_TAB,
  //  defaultCombo: 'CmdOrCtrl+0',
  //  description: 'Switch to last tab',
  //  priority: ShortcutPriority.Normal
  //},
  [ShortcutActions.TOGGLE_SIDEBAR]: {
    action: ShortcutActions.TOGGLE_SIDEBAR,
    defaultCombo: 'CmdOrCtrl+E',
    description: 'Toggle Sidebar',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.TOGGLE_TAB_ORIENTATION]: {
    action: ShortcutActions.TOGGLE_TAB_ORIENTATION,
    defaultCombo: 'CmdOrCtrl+O',
    description: 'Toggle Tab Orientation (Horizontal/Vertical)',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.INCREASE_PAGE_ZOOM]: {
    action: ShortcutActions.INCREASE_PAGE_ZOOM,
    defaultCombo: 'CmdOrCtrl++',
    description: 'Increase tab Zoom',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.DECREASE_PAGE_ZOOM]: {
    action: ShortcutActions.DECREASE_PAGE_ZOOM,
    defaultCombo: 'CmdOrCtrl+-',
    description: 'Decrease Tab Zoom',
    priority: ShortcutPriority.Normal
  },
  [ShortcutActions.RESET_PAGE_ZOOM]: {
    action: ShortcutActions.RESET_PAGE_ZOOM,
    defaultCombo: 'CmdOrCtrl+0',
    description: 'Reset Tab Zoom',
    priority: ShortcutPriority.Normal
  }
} as const
