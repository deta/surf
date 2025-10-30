import {
  EventEmitterBase,
  getHostname,
  isDev,
  parseUrlIntoCanonical,
  type ScopedLogger,
  useDebounce,
  useLogScope
} from '@deta/utils'
import { KVStore, useKVTable } from '../kv'
import { type Fn } from '@deta/types'
import { useViewManager, WebContentsView, ViewManager } from '../views'
import { derived, get, writable, type Readable } from 'svelte/store'
import { ViewManagerEmitterNames, ViewType, WebContentsViewEmitterNames } from '../views/types'
import { spawnBoxSmoke } from '@deta/ui'
import {
  type TabItemEmitterEvents,
  type KVTabItem,
  TabItemEmitterNames,
  type CreateTabOptions,
  TabsServiceEmitterNames,
  type TabsServiceEmitterEvents
} from './tabs.types'
import { ResourceManager, useResourceManager } from '../resources'
import { tick } from 'svelte'

/**
 * 表示浏览器窗口中的单个标签页。每个 TabItem 都与一个显示实际网页内容的 WebContentsView 相关联。
 * TabItem 管理浏览器标签页的生命周期和状态，包括其标题、视图数据和在标签栏中的位置。
 */
export class TabItem extends EventEmitterBase<TabItemEmitterEvents> {
  manager: TabsService
  private log: ScopedLogger

  id: string
  index: number
  title: Readable<string>
  createdAt: Date
  updatedAt: Date
  view: WebContentsView
  pinned = $state<boolean>(false)

  stateIndicator = $state<'none' | 'success'>('none')

  private unsubs: Fn[] = []

  constructor(manager: TabsService, view: WebContentsView, data: KVTabItem) {
    super()
    this.log = useLogScope('TabItem')
    this.manager = manager

    this.id = data.id
    this.index = data.index
    this.createdAt = new Date(data.createdAt)
    this.updatedAt = new Date(data.updatedAt)
    this.view = view
    this.pinned = data.pinned ?? false

    this.title = derived(this.view.title, (title) => title)

    this.unsubs.push(
      view.on(WebContentsViewEmitterNames.DATA_CHANGED, (data) => {
        this.debouncedUpdate({
          title: data.title,
          view: data
        })
      })
    )
  }

  /**
   * 获取当前标签页的标题值
   */
  get titleValue() {
    return get(this.title)
  }

  /**
   * 获取当前标签页的完整数据值，用于持久化存储
   */
  get dataValue(): KVTabItem {
    return {
      id: this.id,
      index: this.index,
      title: this.view.titleValue,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      view: this.view.dataValue,
      pinned: this.pinned
    }
  }

  /**
   * 更新标签页的状态和数据
   * @param data 要更新的标签页部分数据
   */
  async update(data: Partial<KVTabItem>) {
    this.id = data.id ?? this.id
    this.index = data.index ?? this.index
    this.createdAt = data.createdAt ? new Date(data.createdAt) : this.createdAt
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : this.updatedAt
    this.pinned = data.pinned ?? this.pinned

    this.log.debug(`更新标签页 ${this.id} 数据:`, data)

    this.manager.update(this.id, this.dataValue)

    this.emit(TabItemEmitterNames.UPDATE, this)
  }

  /**
   * 防抖更新方法，避免频繁更新
   */
  debouncedUpdate = useDebounce((data: Partial<KVTabItem>) => {
    this.log.debug(`标签页 ${this.id} 的防抖更新:`, data)
    this.update(data)
  }, 200)

  /**
   * 复制当前标签页的 URL
   */
  copyURL() {
    this.view.copyURL()

    let currState = this.stateIndicator
    this.stateIndicator = 'success'
    setTimeout(() => {
      this.stateIndicator = currState
    }, 2000)
  }

  /**
   * 固定标签页
   */
  pin() {
    this.manager.pinTab(this.id)
  }

  /**
   * 取消固定标签页
   */
  unpin() {
    this.manager.unpinTab(this.id)
  }

  /**
   * 销毁标签页时调用，清理资源
   */
  onDestroy() {
    this.unsubs.forEach((unsub) => unsub())

    this.emit(TabItemEmitterNames.DESTROY, this.id)
  }
}

/**
 * 管理已关闭标签页的类，用于实现标签页恢复功能
 */
class ClosedTabs {
  // 最大保存的关闭标签页数量
  private MAX_CLOSED_TABS = 96
  private closedTabs: KVTabItem[] = []

  /**
   * 添加标签页到已关闭列表的开头
   * @param tab 要添加的标签页数据
   */
  push(tab: KVTabItem) {
    this.closedTabs.unshift(tab)
    if (this.closedTabs.length > this.MAX_CLOSED_TABS) this.closedTabs.pop()
  }

  /**
   * 从已关闭列表中移除并返回最近关闭的标签页
   */
  pop(): KVTabItem | undefined {
    return this.closedTabs.shift()
  }

  /**
   * 获取所有已关闭的标签页列表
   */
  get tabs() {
    return this.closedTabs
  }
}

/**
 * 浏览器标签页管理的核心服务。处理标签页的创建、删除、激活和持久化。
 * 该服务维护所有标签页的状态，管理它们的顺序，并与 ViewManager 协调处理
 * 与每个标签页关联的实际网页内容视图。
 *
 * 功能特点：
 * - 标签页生命周期管理（创建、删除、更新）
 * - 使用 KV 存储持久化标签页状态
 * - 标签页激活和焦点处理
 * - 跟踪每个标签页的历史记录
 */
export class TabsService extends EventEmitterBase<TabsServiceEmitterEvents> {
  private log: ScopedLogger
  private viewManager: ViewManager
  private resourceManager: ResourceManager
  private kv: KVStore<KVTabItem>
  private closedTabs: ClosedTabs

  private _lastTabIndex = -1
  private unsubs: Fn[] = []
  private newTabView: WebContentsView | null = null

  ready: Promise<void>

  tabs = $state<TabItem[]>([])
  activeTabId = $state<string | null>(null)
  activatedTabs = $state<string[]>([])

  activeTab: TabItem | null

  /**
   * 遗留的 store，用于确保 contextManager 正常工作
   * @deprecated 请使用 activeTab 替代
   */
  activeTabStore = writable<TabItem | null>(null)

  static self: TabsService

  /**
   * 获取所有标签页的当前值
   */
  get tabsValue(): TabItem[] {
    return this.tabs
  }

  /**
   * 获取当前活动标签页的 ID
   */
  get activeTabIdValue(): string | null {
    return this.activeTabId
  }

  /**
   * 获取当前活动的标签页对象
   */
  get activeTabValue(): TabItem | null {
    return this.activeTab
  }

  /**
   * 获取已激活标签页的 ID 列表
   */
  get activatedTabsValue(): string[] {
    return this.activatedTabs
  }

  /**
   * 获取当前活动标签页在列表中的索引位置
   */
  get activeTabIndex(): number {
    return this.tabs.findIndex((e) => e.id === this.activeTabId)
  }

  constructor(viewManager?: ViewManager) {
    super()

    console.log('tabs', this.tabs)

    this.log = useLogScope('TabsService')
    this.viewManager = viewManager ?? useViewManager()
    this.resourceManager = useResourceManager()
    this.kv = useKVTable<KVTabItem>('tabs')
    this.closedTabs = new ClosedTabs()

    this.ready = this.kv.ready

    // 派生的活动标签页状态，当 activeTabId 改变时自动更新
    this.activeTab = $derived.by(() => {
      const activeId = this.activeTabId
      if (!activeId) {
        this.activeTabStore.set(null)
        return null
      }

      const tab = this.tabs.find((t) => t.id === activeId)
      if (!tab) {
        this.log.warn(`未找到 ID 为 "${activeId}" 的活动标签页`)
        this.activeTabStore.set(null)
        return null
      }

      this.log.debug('当前活动标签页:', tab.id)
      this.activeTabStore.set(tab)
      return tab
    })

    this.init()

    $inspect(this.tabs)
    $inspect(this.activeTab)

    if (isDev) {
      // @ts-ignore
      window.tabs = this
    }
  }

  /**
   * 初始化标签页服务
   */
  private async init() {
    const initialTabs = await this.list()
    this.log.debug('使用标签页初始化 TabsService:', initialTabs)
    this.tabs = initialTabs

    if (initialTabs.length > 0) {
      // 设置最后一个标签页为活动状态
      this.setActiveTab(initialTabs[initialTabs.length - 1].id)
    } else {
      this.activeTabId = null
    }

    this.prepareNewTabPage()
  }

  /**
   * 预加载新标签页视图，优化用户体验
   */
  private async prepareNewTabPage() {
    try {
      this.log.debug('准备新标签页页面')
      this.newTabView = await this.viewManager.create({ url: 'surf://surf/notebook' }, true)
      await this.newTabView.preloadWebContents({ activate: false })
    } catch (error) {
      this.log.error('准备新标签页页面时出错:', error)
    }
  }

  /**
   * 获取最后一个标签页的索引值
   */
  private async getLastTabIndex(): Promise<number> {
    if (this._lastTabIndex >= 0) {
      return this._lastTabIndex
    }

    const items = await this.kv.all()
    if (items.length === 0) {
      this._lastTabIndex = 0
      return this._lastTabIndex
    }

    this._lastTabIndex = Math.max(...items.map((item) => item.index))
    return this._lastTabIndex
  }

  /**
   * 将 KVTabItem 数据转换为 TabItem 对象
   * @param item 从 KV 存储获取的标签页数据
   */
  private itemToTabItem(item: KVTabItem): TabItem | null {
    const view = this.viewManager.create(item.view)
    if (!view) {
      this.log.warn(`未找到 ID 为 "${item.id}" 的标签页对应的视图`)
      return null
    }

    return new TabItem(this, view, item)
  }

  /**
   * 获取所有标签页列表
   */
  async list(): Promise<TabItem[]> {
    this.log.trace('列出所有标签页')

    const raw = await this.kv.all()
    if (raw.length === 0) {
      this.log.debug('未找到标签页')
      return []
    }

    const tabs = raw
      .map((item) => this.itemToTabItem(item))
      .filter((item) => item !== null)
      .sort((a, b) => a.index - b.index) as TabItem[]

    return tabs
  }

  /**
   * 创建新的浏览器标签页
   * 该方法将：
   * 1. 为指定 URL 创建新的 WebContentsView
   * 2. 生成唯一的标签页 ID 和索引
   * 3. 将标签页数据持久化到存储中
   * 4. 如果在选项中指定，则激活该标签页
   *
   * @param url 要在新标签页中加载的 URL
   * @param opts 标签页创建选项，如是否立即激活
   */
  async create(url: string, opts: Partial<CreateTabOptions> = {}): Promise<TabItem> {
    const options = {
      active: true,
      activate: false,
      ...opts
    } as CreateTabOptions

    if (url === 'surf-internal://core/Core/core.html') {
      this.log.warn('尝试直接打开核心 URL，这是不允许的。')
      throw new Error('无法直接打开核心 URL')
    }

    const view = await this.viewManager.create({ url })

    if (options.selectionHighlight) {
      view.highlightSelection(options.selectionHighlight)
    }

    this.log.debug('创建新标签页与视图:', view, '选项:', options)

    // 智能定位：如果活动标签页是固定的，将新标签页放在末尾
    let newIndex: number
    const activeTab = this.activeTab
    if (activeTab && activeTab.pinned) {
      // 放在所有标签页的末尾
      newIndex = this.tabs.length
    } else {
      newIndex = this.activeTabIndex + 1 || (await this.getLastTabIndex()) + 1
    }

    const hostname = getHostname(url) || 'unknown'

    // 创建标签页数据并保存到 KV 存储
    const item = await this.kv.create({
      title: hostname,
      view: view.dataValue,
      index: newIndex
    })

    const tab = new TabItem(this, view, item)
    this.tabs.splice(newIndex, 0, tab)

    if (options.active) {
      this.setActiveTab(item.id)
    } else if (options.activate) {
      this.activateTab(item.id)
    }

    this.emit(TabsServiceEmitterNames.CREATED, tab)

    return tab
  }

  /**
   * 使用已有的 WebContentsView 创建新标签页
   * @param view 要关联的 WebContentsView
   * @param opts 标签页创建选项
   */
  async createWithView(
    view: WebContentsView,
    opts: Partial<CreateTabOptions> = {}
  ): Promise<TabItem> {
    const options = {
      active: true,
      activate: false,
      ...opts
    } as CreateTabOptions

    if (options.selectionHighlight) {
      view.highlightSelection(options.selectionHighlight)
    }

    this.log.debug('使用视图创建新标签页:', view, '选项:', options)

    const newIndex = (await this.getLastTabIndex()) + 1
    const hostname = getHostname(view.urlValue) || 'unknown'

    const item = await this.kv.create({
      title: hostname,
      view: view.dataValue,
      index: newIndex
    })

    const tab = new TabItem(this, view, item)
    this.tabs = [...this.tabs, tab]

    if (options.active) {
      this.setActiveTab(item.id)
    } else if (options.activate) {
      this.activateTab(item.id)
    }

    this.emit(TabsServiceEmitterNames.CREATED, tab)

    return tab
  }

  /**
   * 打开或创建指定 URL 的标签页
   * 如果 URL 已在某个标签页打开，则激活该标签页；否则创建新标签页
   * @param url 要打开的 URL
   * @param opts 标签页创建选项
   * @param isUserAction 是否是用户操作
   */
  async openOrCreate(
    url: string,
    opts: Partial<CreateTabOptions> = {},
    isUserAction = false
  ): Promise<TabItem> {
    this.log.debug('打开或创建 URL 的标签页:', url, opts)

    const canonicalUrl = parseUrlIntoCanonical(url) ?? url
    const existingTab = this.tabs.find(
      (tab) => (parseUrlIntoCanonical(tab.view.urlValue) ?? tab.view.urlValue) === canonicalUrl
    )

    if (existingTab) {
      this.log.debug('标签页已存在，激活:', existingTab.id)

      if (opts.active) {
        await this.setActiveTab(existingTab.id, isUserAction)
      } else if (opts.activate) {
        this.activateTab(existingTab.id)
      }

      if (opts.selectionHighlight) {
        await existingTab.view.highlightSelection(opts.selectionHighlight)
      }

      return existingTab
    }

    this.log.debug('标签页不存在，创建新标签页')
    return this.create(url, opts)
  }

  /**
   * 根据 ID 获取标签页
   * @param id 要获取的标签页 ID
   */
  async get(id: string): Promise<TabItem | null> {
    try {
      this.log.debug('获取 ID 为:', id, '的标签页')
      const item = await this.kv.read(id)

      if (!item) {
        this.log.warn(`未找到 ID 为 "${id}" 的标签页`)
        return null
      }

      const tabItem = this.itemToTabItem(item)
      if (!tabItem) {
        this.log.warn(`无法将 ID 为 "${id}" 的标签页数据转换为 TabItem`)
        return null
      }

      return tabItem
    } catch (error) {
      this.log.error('获取标签页时出错:', error)
      return null
    }
  }

  /**
   * 更新标签页数据
   * @param id 要更新的标签页 ID
   * @param data 要更新的数据
   */
  async update(id: string, data: Partial<KVTabItem>) {
    try {
      this.log.debug('更新 ID 为:', id, '的标签页数据:', data)
      const item = await this.kv.update(id, data)

      this.log.debug('标签页已更新:', item)

      // 注意：由于数据变更不受 activeTabStore derived.by 跟踪，因此我们手动更新 activeTabStore
      if (id === this.activeTabIdValue) {
        this.log.debug('更新活动标签页的 activeTabStore', id, this.activeTabValue?.view.urlValue)
        this.activeTabStore.set(this.activeTabValue)
      }

      return !!item
    } catch (error) {
      this.log.error('更新标签页时出错:', error)
      return false
    }
  }

  /**
   * 关闭标签页，对固定标签页有特殊处理
   * 如果标签页是固定的，将切换到下一个可用标签页而不是删除它
   * 如果标签页不是固定的，将正常删除
   *
   * @param id 要关闭的标签页 ID
   * @param userAction 是否是用户发起的操作
   */
  async closeTab(id: string, userAction = false) {
    try {
      this.log.debug('关闭 ID 为:', id, '的标签页')

      const tab = this.tabs.find((t) => t.id === id)
      if (!tab) {
        this.log.error('未找到 ID 为:', id, '的标签页')
        return
      }

      if (tab.pinned) {
        this.log.debug('标签页已固定，跳转到下一个标签页而不是关闭')

        const allTabs = this.tabs
        let targetTab: TabItem | null = null

        const currentIndex = allTabs.findIndex((t) => t.id === id)
        const nextTabIndex = currentIndex + 1

        if (nextTabIndex < allTabs.length) {
          targetTab = allTabs[nextTabIndex]
        } else if (allTabs.length > 1) {
          targetTab = allTabs[allTabs.length - 2]
        }

        if (targetTab) {
          await this.setActiveTab(targetTab.id, userAction)
        }
      } else {
        // 正常删除非固定标签页
        await this.delete(id, userAction)
      }
    } catch (error) {
      this.log.error('关闭标签页时出错:', error)
    }
  }

  /**
   * 删除标签页
   * @param id 要删除的标签页 ID
   * @param userAction 是否是用户操作
   * @param spawnSmoke 是否生成关闭标签页的动画效果
   */
  async delete(id: string, userAction = false, spawnSmoke = true) {
    try {
      this.log.debug('删除 ID 为:', id, '的标签页')

      const tab = this.tabs.find((t) => t.id === id)
      const tabIdx = this.tabs.findIndex((t) => t.id === id)
      if (tab) {
        this.tabs = this.tabs.filter((t) => t.id !== id)
        this.closedTabs.push(tab.dataValue)

        if (this.activeTabId === id) {
          // 如果删除的是活动标签页，设置第一个可用的标签页为活动状态
          if (this.tabs.length > 0) {
            const nextTab = this.tabs.at(tabIdx)
            if (nextTab) this.setActiveTab(nextTab.id, userAction)
            else this.setActiveTab(this.tabs.at(-1)!.id, userAction)
          } else {
            this.activeTabId = null
          }
        }

        tab.onDestroy()
      } else {
        this.log.warn(`未找到 ID 为 "${id}" 的标签页`)
      }

      if (spawnSmoke) {
        const rect = document.getElementById(`tab-${id}`)?.getBoundingClientRect()
        if (rect) {
          spawnBoxSmoke(rect, {
            densityN: 30,
            size: 13,
            //velocityScale: 0.5,
            cloudPointN: 7
          })
        }
      }

      await this.kv.delete(id)

      this.emit(TabsServiceEmitterNames.DELETED, id)

      if (this.tabs.length <= 0) {
        this.openNewTabPage()
      }
    } catch (error) {
      this.log.error('删除标签页时出错:', error)
    }
  }

  /**
   * 激活标签页（添加到激活历史）
   * @param id 要激活的标签页 ID
   */
  activateTab(id: string) {
    this.log.debug('激活标签页 ID:', id)
    this.activatedTabs = [...this.activatedTabs.filter((t) => t !== id), id]
  }

  /**
   * 设置活动标签页
   * @param id 要设置为活动的标签页 ID
   * @param userAction 是否是用户操作
   */
  async setActiveTab(id: string | null, userAction = false) {
    try {
      this.log.debug('设置活动标签页 ID:', id)

      this.activeTabId = id

      if (id) {
        const tab = this.tabs.find((t) => t.id === id)
        if (!tab) {
          this.log.warn(`未找到 ID 为 "${id}" 的标签页`)
          return
        }

        this.activateTab(tab.id)
        this.viewManager.activate(tab.view.id)

        // 为了使扩展正常工作，我们需要向主进程通知活动标签页的 webContents id
        tab.view.waitForWebContentsReady().then((webContents) => {
          if (webContents && tab.id === this.activeTabIdValue) {
            // @ts-ignore
            window.api.setActiveTab(webContents.webContentsId)
          }
        })
      }

      // 注意：我们是否需要在这里发出事件？为了确保后续的响应式处理正常工作
      // 或者这应该放在 if (id) 作用域内？
      this.emit(TabsServiceEmitterNames.ACTIVATED, this.activeTab)
    } catch (err) {
      this.log.error('激活标签页时出错:', err)
    }
  }

  /**
   * 重新排序标签页到标签栏中的新位置
   * 更新内存中的标签页数组并将新顺序持久化到存储中
   *
   * @param tabId 要重新排序的标签页 ID
   * @param newIndex 目标索引位置（从 0 开始）
   */
  async reorderTab(tabId: string, newIndex: number) {
    try {
      this.log.debug(`将标签页 ${tabId} 重新排序到索引 ${newIndex}`)

      const currentIndex = this.tabs.findIndex((tab) => tab.id === tabId)
      if (currentIndex === -1) {
        this.log.warn(`未找到 ID 为 "${tabId}" 的标签页用于重新排序`)
        return
      }

      // 将 newIndex 限制在有效范围内
      newIndex = Math.max(0, Math.min(newIndex, this.tabs.length - 1))

      // 如果已经在正确位置，则不重新排序
      if (currentIndex === newIndex) {
        return
      }

      const newTabs = [...this.tabs]
      const [movedTab] = newTabs.splice(currentIndex, 1)
      newTabs.splice(newIndex, 0, movedTab)

      this.tabs = newTabs

      newTabs.forEach((tab, index) => (tab.index = index))

      // 更新所有标签页索引，使用 Promise.allSettled 处理竞态条件错误
      const updateResults = await Promise.allSettled(
        newTabs.map((tab) => this.update(tab.id, { index: tab.index }))
      )

      // 记录任何失败但不阻止重新排序操作
      updateResults.forEach((result, idx) => {
        if (result.status === 'rejected') {
          this.log.warn(`更新标签页 ${newTabs[idx].id} 索引失败:`, result.reason)
        }
      })

      this.emit(TabsServiceEmitterNames.REORDERED, { tabId, oldIndex: currentIndex, newIndex })
      this.log.debug(`成功将标签页 ${tabId} 从 ${currentIndex} 重新排序到 ${newIndex}`)
    } catch (error) {
      this.log.error('重新排序标签页时出错:', error)
    }
  }

  /**
   * 固定标签页，保持其当前位置
   * @param tabId 要固定的标签页 ID
   */
  async pinTab(tabId: string) {
    try {
      this.log.debug(`固定标签页 ${tabId}`)

      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) {
        this.log.warn(`未找到 ID 为 "${tabId}" 的标签页用于固定`)
        return
      }

      if (tab.pinned) {
        this.log.debug(`标签页 ${tabId} 已经是固定的`)
        return
      }

      // 更新标签页的固定状态
      tab.pinned = true
      await this.update(tabId, { pinned: true })

      this.log.debug(`成功固定标签页 ${tabId}`)
    } catch (error) {
      this.log.error('固定标签页时出错:', error)
    }
  }

  /**
   * 取消固定标签页，保持其当前位置
   * @param tabId 要取消固定的标签页 ID
   */
  async unpinTab(tabId: string) {
    try {
      this.log.debug(`取消固定标签页 ${tabId}`)

      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) {
        this.log.warn(`未找到 ID 为 "${tabId}" 的标签页用于取消固定`)
        return
      }

      if (!tab.pinned) {
        this.log.debug(`标签页 ${tabId} 已经是未固定的`)
        return
      }

      // 更新标签页的固定状态
      tab.pinned = false
      await this.update(tabId, { pinned: false })

      this.log.debug(`成功取消固定标签页 ${tabId}`)
    } catch (error) {
      this.log.error('取消固定标签页时出错:', error)
    }
  }

  /**
   * 打开新标签页
   */
  async openNewTabPage() {
    try {
      if (!this.newTabView) {
        return this.create('surf://surf/notebook')
      }

      const tab = await this.createWithView(this.newTabView, { activate: true })
      this.newTabView = null

      // 准备下一个新标签页
      setTimeout(() => this.prepareNewTabPage(), 100)

      return tab
    } catch (error) {
      this.log.error('打开新标签页时出错:', error)
    }
  }

  /**
   * 创建资源标签页
   * @param resourceId 资源 ID
   * @param opts 创建选项
   */
  async createResourceTab(resourceId: string, opts?: Partial<CreateTabOptions>) {
    this.log.debug('Creating new resource tab')
    const tab = await this.create(`surf://surf/resource/${resourceId}`, opts)
    return tab
  }

  async changeActiveTabURL(url: string, opts?: Partial<CreateTabOptions>) {
    try {
      this.log.debug('Replacing active tab with new URL:', url)
      const activeTab = this.activeTabValue

      if (!activeTab) {
        this.log.warn('No active tab found to replace URL')
        return
      }

      if (!activeTab.view.webContents) {
        this.log.warn('Active tab has no webContents to load URL')
        return
      }

      activeTab.view.webContents.loadURL(url)

      if (opts?.selectionHighlight) {
        activeTab.view.highlightSelection(opts.selectionHighlight)
      }

      if (opts?.active) {
        this.setActiveTab(activeTab.id)
      } else if (opts?.activate) {
        this.activateTab(activeTab.id)
      }

      return activeTab
    } catch (error) {
      this.log.error('Error changing active tab URL:', error)
    }
  }

  async reopenLastClosed() {
    try {
      const tabData = this.closedTabs.pop()
      if (tabData) {
        this.log.debug('Opening previously closed tab')

        const tab = this.itemToTabItem(tabData)
        if (!tab) {
          this.log.error('Failed to convert closed tab data to tab item:', tabData)
          return
        }

        this.tabs = [...this.tabs, tab]
        this.setActiveTab(tab.id, true)
      }
    } catch (error) {
      this.log.error('Error reopening last closed tab:', error)
    }
  }

  getTabByViewId(viewId: string): TabItem | null {
    const tab = this.tabs.find((t) => t.view.id === viewId) || null
    return tab
  }

  findTabByURL(url: string): TabItem | null {
    const tab = this.tabs.find((t) => t.view.urlValue === url) || null
    return tab
  }

  onDestroy() {
    this.log.debug('Destroying TabsService')
    this.unsubs.forEach((unsub) => unsub())

    if (this.newTabView) {
      this.newTabView.destroy()
      this.newTabView = null
    }
  }

  static provide(viewManager?: ViewManager): TabsService {
    TabsService.self = new TabsService(viewManager)
    return TabsService.self
  }

  static useTabs(): TabsService {
    return TabsService.self
  }
}

export const createTabsService = (viewManager?: ViewManager) => TabsService.provide(viewManager)
export const useTabs = () => TabsService.useTabs()
