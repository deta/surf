import { provideConfig } from '../config'
import { createNotebookManager } from '../notebooks'
import { createResourceManager } from '../resources'
import { createMentionService } from '../mentions'
import { createTeletypeServiceCore } from '../teletype'
import { useTabs } from '../tabs'
import { useViewManager } from '../views'
import {
  createKeyboardManager,
  createShortcutManager,
  defaultShortcuts,
  ShortcutActions
} from '../shortcuts'
import { setupTelemetry } from './telemetry'
import { provideAI } from '../ai'
import { createDownloadsManager } from '../downloads.svelte'
import { createBrowser } from '../browser'

export const initServices = () => {
  const telemetry = setupTelemetry()
  const config = provideConfig()
  const resourceManager = createResourceManager(telemetry, config)
  const notebookManager = createNotebookManager(resourceManager, config)
  const viewManager = useViewManager(resourceManager)
  const tabsService = useTabs()
  const browser = createBrowser()
  const ai = provideAI(resourceManager, config, true)
  const mentionService = createMentionService(tabsService)
  const downloadsManager = createDownloadsManager()
  const teletypeService = createTeletypeServiceCore()

  const keyboardManager = createKeyboardManager()
  const shortcutsManager = createShortcutManager<ShortcutActions>(keyboardManager, defaultShortcuts)

  return {
    telemetry,
    config,
    viewManager,
    tabsService,
    resourceManager,
    notebookManager,
    mentionService,
    teletypeService,
    downloadsManager,
    ai,
    browser,
    keyboardManager,
    shortcutsManager
  }
}
