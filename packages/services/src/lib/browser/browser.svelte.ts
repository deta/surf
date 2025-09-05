import { useLogScope } from '@deta/utils/io'

import { Resource, useResourceManager } from '../resources'
import { useViewManager, WebContentsView } from '../views'
import { type CreateTabOptions, type TabItem, useTabs } from '../tabs'
import { formatAIQueryToTitle } from './utils'
import { type MentionItem } from '@deta/editor'
import { type Fn, ResourceTagsBuiltInKeys, ResourceTypes } from '@deta/types'
import { useNotebookManager } from '../notebooks'
import { ViewType } from '../views/types'
import { useMessagePortPrimary } from '../messagePort'
import { isOffline } from '@deta/utils'

export class BrowserService {
  private readonly resourceManager = useResourceManager()
  private readonly viewManager = useViewManager()
  private readonly tabsManager = useTabs()
  private readonly notebookManager = useNotebookManager()
  private readonly messagePort = useMessagePortPrimary()
  private readonly log = useLogScope('BrowserService')

  private _unsubs: Fn[] = []

  static self: BrowserService

  constructor() {
    this.attachListeners()
  }

  attachListeners() {
    this._unsubs.push(
      this.messagePort.openResource.on(async ({ resourceId, target, offline }) => {
        this.openResource(resourceId, { target, offline })
      })
    )
  }

  async createNoteAndRunAIQuery(
    query: string,
    mentions: MentionItem[],
    opts?: {
      target?: 'tab' | 'sidebar'
      notebookId?: string | 'auto'
    }
  ) {
    try {
      const target = opts?.target || 'sidebar'

      this.log.debug(`Triggering ask action in ${target} for query: "${query}"`)

      const note = await this.resourceManager.createResourceNote('', {
        name: formatAIQueryToTitle(query)
      })

      if (opts?.notebookId === 'auto') {
        if (this.tabsManager.activeTabValue?.view.typeValue === ViewType.Notebook) {
          const viewData = this.tabsManager.activeTabValue.view.typeDataValue
          if (viewData.id) {
            opts.notebookId = viewData.id
          } else {
            opts.notebookId = undefined
          }
        } else {
          opts.notebookId = undefined
        }
      }

      if (opts?.notebookId) {
        this.log.debug(`Adding created note to notebook ${opts.notebookId}`)
        await this.notebookManager.addResourcesToNotebook(opts.notebookId, [note.id])
      }

      let view: WebContentsView
      if (target === 'sidebar') {
        if (
          this.tabsManager.activeTabValue?.view.typeValue === ViewType.NotebookHome &&
          this.tabsManager.activeTabIdValue
        ) {
          this.tabsManager.delete(this.tabsManager.activeTabIdValue)
        }

        view = this.viewManager.openResourceInSidebar(note.id)
      } else {
        const tab = await this.tabsManager.changeActiveTabURL(
          `surf://resource/${note.id}?ask=${encodeURIComponent(query)}`
        )

        if (!tab) {
          this.log.error('Failed to change active tab URL')
          return
        }

        view = tab.view
      }

      const webContents = await view.waitForNoteReady()
      if (!webContents) {
        this.log.error('Failed to wait for web contents to be ready')
        return
      }

      await webContents.runNoteQuery(query, mentions)
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }

  async moveSidebarViewToTab() {
    const view = this.viewManager.activeSidebarView
    if (!view) {
      this.log.error('No active sidebar view to move')
      return
    }

    view.preventUnmountingUntilNextMount()
    view.changePermanentlyActive(false)

    this.viewManager.setSidebarState({ open: false, view: null })
    await this.tabsManager.createWithView(view, { active: true })
  }

  async moveTabToSidebar(tab: TabItem) {
    const view = tab.view

    view.preventUnmountingUntilNextMount()
    view.changePermanentlyActive(true)

    await this.tabsManager.delete(tab.id)
    this.viewManager.setSidebarState({ open: true, view })
  }

  async openResourceAsTab(resource: Resource, opts?: Partial<CreateTabOptions>) {
    const url =
      resource.metadata?.sourceURI ??
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value

    if (url) {
      await this.tabsManager.create(url, opts)
    } else {
      await this.tabsManager.createResourceTab(resource.id, opts)
    }
  }

  async openResourceInCurrentTab(resource: Resource) {
    const url =
      resource.metadata?.sourceURI ??
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value

    if (url) {
      await this.tabsManager.changeActiveTabURL(url)
    } else {
      await this.tabsManager.changeActiveTabURL(`surf://resource/${resource.id}`)
    }
  }

  async openResource(
    resourceId: string,
    opts?: { target?: 'tab' | 'tab_background' | 'sidebar'; offline?: boolean }
  ) {
    this.log.debug('Opening resource:', resourceId, opts)

    const resource = await this.resourceManager.getResource(resourceId)
    if (!resource) {
      this.log.error('Resource not found:', resourceId)
      return
    }

    const target = opts?.target ?? 'tab'
    const offline = opts?.offline ?? isOffline()

    if (offline || resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE || !resource.url) {
      if (target === 'sidebar') {
        return this.viewManager.openResourceInSidebar(resource.id)
      } else {
        const tab = await this.tabsManager.createResourceTab(resource.id, {
          active: target === 'tab'
        })

        return tab.view
      }
    } else {
      if (target === 'sidebar') {
        return this.viewManager.openURLInSidebar(resource.url)
      } else {
        const tab = await this.tabsManager.create(resource.url, {
          active: target === 'tab'
        })

        return tab.view
      }
    }
  }

  onDestroy() {
    this._unsubs.forEach((unsub) => unsub())
  }

  static provide() {
    BrowserService.self = new BrowserService()
    return BrowserService.self
  }

  static use() {
    if (!BrowserService.self) {
      BrowserService.self = new BrowserService()
    }

    return BrowserService.self
  }
}

export const createBrowser = () => BrowserService.provide()
export const useBrowser = () => BrowserService.use()
