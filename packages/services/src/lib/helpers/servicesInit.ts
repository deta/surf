import { provideConfig } from '../config'
import { createNotebookManager } from '../notebooks'
import { createResourceManager } from '../resources'
import { useTabs } from '../tabs'
import { useViewManager } from '../views'
import {
  createKeyboardManager,
  createShortcutManager,
  defaultShortcuts,
  ShortcutActions
} from '../shortcuts'
import { setupTelemetry } from './telemetry'

export const initServices = () => {
  const telemetry = setupTelemetry()
  const config = provideConfig()
  const viewManager = useViewManager()
  const tabsService = useTabs()
  const resourceManager = createResourceManager(telemetry, config)
  const notebookManager = createNotebookManager(resourceManager, config)

  const keyboardManager = createKeyboardManager()
  const shortcutsManager = createShortcutManager<ShortcutActions>(keyboardManager, defaultShortcuts)

  return {
    telemetry,
    config,
    viewManager,
    tabsService,
    resourceManager,
    notebookManager,
    keyboardManager,
    shortcutsManager
  }
}
