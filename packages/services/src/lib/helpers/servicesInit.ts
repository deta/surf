import { provideConfig } from '../config'
import { createNotebookManager } from '../notebooks'
import { createResourceManager } from '../resources'
import { createMentionService } from '../mentions'
import { createTeletypeServiceCore } from '../teletype'
import { createTabsService } from '../tabs'
import { createViewManager } from '../views'
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
import { useLogScope } from '@deta/utils'

export const initServices = () => {
  const log = useLogScope('ServicesInit')
  log.debug('Initializing services...')

  const telemetry = setupTelemetry()
  const config = provideConfig()
  const resourceManager = createResourceManager(telemetry, config)
  const notebookManager = createNotebookManager(resourceManager, config)
  const viewManager = createViewManager(resourceManager)
  const tabsService = createTabsService(viewManager)
  const browser = createBrowser()
  const ai = provideAI(resourceManager, config, true)
  const mentionService = createMentionService(tabsService)
  const downloadsManager = createDownloadsManager()
  const teletypeService = createTeletypeServiceCore()

  const keyboardManager = createKeyboardManager()
  const shortcutsManager = createShortcutManager<ShortcutActions>(keyboardManager, defaultShortcuts)

  log.debug('Services initialized!')

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
