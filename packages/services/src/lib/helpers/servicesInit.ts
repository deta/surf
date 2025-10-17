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
import { provideAI } from '../ai'
import { createDownloadsManager } from '../downloads.svelte'
import { createBrowser } from '../browser'
import { useLogScope } from '@deta/utils'
import { useMessagePortPrimary } from '../messagePort'

export const initServices = () => {
  const log = useLogScope('ServicesInit')
  log.debug('Initializing services...')

  const messagePort = useMessagePortPrimary()
  const config = provideConfig()
  const resourceManager = createResourceManager(config)
  const notebookManager = createNotebookManager(resourceManager, config, messagePort)
  const viewManager = createViewManager(resourceManager)
  const tabsService = createTabsService(viewManager)
  const ai = provideAI(resourceManager, config, true)
  const browser = createBrowser()
  const mentionService = createMentionService(tabsService)
  const downloadsManager = createDownloadsManager()
  const teletypeService = createTeletypeServiceCore()

  const keyboardManager = createKeyboardManager()
  const shortcutsManager = createShortcutManager<ShortcutActions>(keyboardManager, defaultShortcuts)

  log.debug('Services initialized!')

  return {
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
