<svelte:options immutable={true} />

<script lang="ts">
  import { afterUpdate, onMount, setContext, tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import { popover } from '../Atoms/Popover/popover'
  import SplashScreen from '../SplashScreen.svelte'
  import { writable, derived, get } from 'svelte/store'
  import { type WebviewWrapperEvents } from './WebviewWrapper.svelte'
  import { useLogScope } from '../../utils/log'
  import { Icon } from '@horizon/icons'
  import { generateID } from '../../utils/id'
  import { parseStringIntoBrowserLocation } from '../../utils/url'
  import {
    isModKeyAndKeyPressed,
    isModKeyAndKeysPressed,
    isModKeyAndShiftKeyAndKeyPressed,
    isModKeyPressed
  } from '../../utils/keyboard'
  import { wait, writableAutoReset } from '../../utils/time'
  import { createTelemetry, Telemetry } from '../../service/telemetry'
  import { useDebounce } from '@horizon/core/src/lib/utils/debounce'
  import {
    MEDIA_TYPES,
    createResourcesFromMediaItems,
    processDrop
  } from '../../service/mediaImporter'
  import SidebarPane from './SidebarPane.svelte'

  import { PaneGroup, Pane, PaneResizer, type PaneAPI } from 'paneforge'
  import { Resource, ResourceTag, createResourceManager } from '../../service/resources'

  import { type Space, type SpaceSource } from '../../types'

  import { HorizonsManager } from '../../service/horizon'
  import { API } from '../../service/api'
  import BrowserTab, { type BrowserTabNewTabEvent } from './BrowserTab.svelte'
  import Horizon from '../Horizon/Horizon.svelte'
  import BrowserHomescreen from './BrowserHomescreen.svelte'
  import SpacesView from '../Oasis/SpacesView.svelte'
  import TabItem from './Tab.svelte'
  import TabSearch from './TabSearch.svelte'
  import { type ShortcutMenuEvents } from '../Shortcut/ShortcutMenu.svelte'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'
  import '../../../app.css'
  import { createDemoItems } from './demoitems'

  import '../Horizon/index.scss'
  import type {
    AIChatMessageParsed,
    PageMagic,
    Tab,
    TabChat,
    TabEmpty,
    TabHorizon,
    TabImporter,
    TabPage,
    TabSpace,
    TabOasisDiscovery,
    AIChatMessageRole,
    DroppedTab,
    TabHistory,
    CreateTabOptions,
    RightSidebarTab
  } from './types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../Cards/Browser/searchEngines'
  import type { Drawer } from '@horizon/drawer'
  import Chat from './Chat.svelte'
  import { HorizonDatabase } from '../../service/storage'
  import type {
    Download,
    DownloadDoneMessage,
    DownloadRequestMessage,
    DownloadUpdatedMessage,
    Optional
  } from '../../types'
  import { useLocalStorageStore } from '../../utils/localstorage'
  import { WebParser } from '@horizon/web-parser'
  import Importer from './Importer.svelte'
  import OasisDiscovery from './OasisDiscovery.svelte'
  import { parseChatResponseSources } from '../../service/ai'
  import MagicSidebar from './MagicSidebar.svelte'
  import AppSidebar from './AppSidebar.svelte'
  import {
    ActivateTabEventTrigger,
    AddResourceToSpaceEventTrigger,
    CreateAnnotationEventTrigger,
    CreateSpaceEventFrom,
    CreateTabEventTrigger,
    DeleteTabEventTrigger,
    MoveTabEventAction,
    OpenResourceEventFrom,
    OpenSpaceEventTrigger,
    PageChatUpdateContextEventAction,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SaveToOasisEventTrigger,
    WebViewEventReceiveNames,
    type AnnotationCommentData,
    type ResourceDataAnnotation,
    type UserConfig,
    type UserSettings,
    type WebViewEventAnnotation
  } from '@horizon/types'
  import { scrollToTextCode } from './inline'
  import { SFFS } from '../../service/sffs'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { provideOasis } from '../../service/oasis'
  import OasisSpace from '../Oasis/OasisSpace.svelte'

  import AnnotationsSidebar from './AnnotationsSidebar.svelte'
  import ToastsProvider from '../Toast/ToastsProvider.svelte'
  import { provideToasts, type Toast, type ToastItem } from '../../service/toast'
  import {
    PromptIDs,
    getPrompt,
    getPrompts,
    resetPrompt,
    updatePrompt
  } from '../../service/prompts'
  import { LinkPreview, Tabs, Tooltip } from 'bits-ui'
  import BrowserHistory from './BrowserHistory.svelte'
  import NewTabButton from './NewTabButton.svelte'
  import { flyAndScale } from '../../utils'
  import {
    HTMLDragZone,
    HTMLAxisDragZone,
    type DragOperation,
    type DragculaDragEvent
  } from '@horizon/dragcula'
  import NewTabOverlay from './NewTabOverlay.svelte'
  import CustomPopover from './CustomPopover.svelte'
  import { truncate } from '../../utils/text'
  import { provideConfig } from '../../service/config'
  import { tooltip } from '../../utils/directives'
  //import '@horizon/dragcula/dist/styles.scss'

  let activeTabComponent: TabItem | null = null
  let drawer: Drawer
  let observer: IntersectionObserver
  let addressBarFocus = false
  let showLeftSidebar = true
  let showRightSidebar = false
  let rightPane: PaneAPI | undefined = undefined
  let sidebarComponent: SidebarPane | null = null
  let annotationsSidebar: AnnotationsSidebar
  let isFirstButtonVisible = true
  let newTabButton: Element
  let containerRef: Element
  const showStartMask = writable(false)
  const showEndMask = writable(false)

  let telemetryAPIKey = ''
  let telemetryActive = false
  if (import.meta.env.PROD || import.meta.env.R_VITE_TELEMETRY_ENABLED) {
    telemetryAPIKey = import.meta.env.R_VITE_TELEMETRY_API_KEY
    telemetryActive = true
  }

  const telemetry = createTelemetry({
    apiKey: telemetryAPIKey,
    active: telemetryActive,
    trackHostnames: false
  })

  const api = new API()
  const resourceManager = createResourceManager(telemetry)
  const horizonManager = new HorizonsManager(api, resourceManager, telemetry)
  const storage = new HorizonDatabase()
  const sffs = new SFFS()
  const oasis = provideOasis(resourceManager)
  const toasts = provideToasts()
  const config = provideConfig()

  const userConfigSettings = config.settings
  const tabsDB = storage.tabs
  const horizons = horizonManager.horizons
  const historyEntriesManager = horizonManager.historyEntriesManager
  const spaces = oasis.spaces
  const selectedSpace = oasis.selectedSpace

  const masterHorizon = derived(horizons, (horizons) => horizons[0])

  const log = useLogScope('Browser')

  const showNewTabOverlay = writable(0)
  const tabs = writable<Tab[]>([])
  const addressValue = writable('')
  const activeTabId = useLocalStorageStore<string>('activeTabId', '')
  const activeChatId = useLocalStorageStore<string>('activeChatId', '')
  const loadingOrganize = writable(false)
  const visorSearchTerm = writable('')
  const sidebarTab = writable<'active' | 'archive' | 'oasis'>('active')
  const browserTabs = writable<Record<string, BrowserTab>>({})
  const bookmarkingInProgress = writable(false)
  const magicInputValue = writable('')
  const activeTabMagic = writable<PageMagic>({
    running: false,
    showSidebar: false,
    initializing: false,
    responses: [],
    errors: []
  })
  const activeAppSidebarContext = writable<string>('') // TODO: support multiple contexts in the future
  const bookmarkingSuccess = writableAutoReset(false, 1000)
  const showURLBar = writable(false)
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)
  const showAnnotationsSidebar = writable(false)
  const activeTabsHistory = writable<string[]>([])
  const isCreatingLiveSpace = writable(false)
  const activeAppId = writable<string>('')
  const showAppSidebar = writable(false)
  const activatedTabs = writable<string[]>([]) // for lazy loading
  const rightSidebarTab = writable<RightSidebarTab>('chat')
  const showSplashScreen = writable(false)
  const cachedMagicTabs = new Set<string>()
  const downloadResourceMap = new Map<string, Download>()
  const downloadToastsMap = new Map<string, ToastItem>()

  $: log.debug('right sidebar tab', $rightSidebarTab)

  // Set global context
  setContext('selectedFolder', 'all')

  const activeTabs = derived([tabs], ([tabs]) => {
    return tabs
      .filter((tab) => !tab.archived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  const pinnedTabs = derived([activeTabs], ([tabs]) => {
    return tabs.filter((tab) => tab.pinned).sort((a, b) => a.index - b.index)
  })

  const unpinnedTabs = derived([activeTabs], ([tabs]) => {
    return tabs.filter((tab) => !tab.pinned && !tab.magic).sort((a, b) => a.index - b.index)
  })

  const magicTabs = derived([activeTabs], ([tabs]) => {
    return tabs.filter((tab) => tab.magic).sort((a, b) => a.index - b.index) as (
      | TabPage
      | TabSpace
    )[]
  })

  const activeTab = derived([tabs, activeTabId], ([tabs, activeTabId]) => {
    return tabs.find((tab) => tab.id === activeTabId)
  })

  const activeTabLocation = derived(activeTab, (activeTab) => {
    if (activeTab?.type === 'page') {
      if (activeTab.currentLocation) {
        return activeTab.currentLocation
      }

      const currentEntry = historyEntriesManager.getEntry(
        activeTab.historyStackIds[activeTab.currentHistoryIndex]
      )

      return currentEntry?.url ?? null
    }

    return null
  })

  const activeBrowserTab = derived([browserTabs, activeTabId], ([browserTabs, activeTabId]) => {
    return browserTabs[activeTabId]
  })

  const sidebarTools = derived(
    [activeTabMagic, activeTab, showAppSidebar],
    ([$activeTabMagic, $activeTab, $showAppSidebar]) => [
      {
        id: 'chat',
        name: 'Chat',
        type: 'tool',
        icon: $activeTabMagic ? ($activeTabMagic.running ? 'spinner' : 'message') : 'message',
        disabled: !$activeTabMagic,
        showCondition: $activeTab && $activeTabMagic,
        fallbackContent: {
          icon: 'info',
          message: 'Magic chat not available'
        }
      },
      {
        id: 'annotations',
        name: 'Annotate',
        type: 'tool',
        icon: 'marker',
        disabled: $activeTab?.type !== 'page',
        showCondition: $activeTab && $activeTab.type === 'page',
        fallbackContent: {
          icon: 'info',
          message: 'No page info available.'
        }
      },
      {
        id: 'go-wild',
        name: 'Go Wild',
        type: 'tool',
        icon: 'sparkles',
        disabled: $activeTab?.type !== 'page',
        showCondition: $activeTab && $activeTab.type === 'page' && $showAppSidebar,
        fallbackContent: {
          icon: 'info',
          message: 'Go wild not available.'
        }
      }
    ]
  )

  $: {
    handleRightSidebarTabsChange($rightSidebarTab)
  }

  $: canGoBack =
    $showNewTabOverlay === 0 && $activeTab?.type === 'page' && $activeTab?.currentHistoryIndex > 0
  $: canGoForward =
    $showNewTabOverlay === 0 &&
    $activeTab?.type === 'page' &&
    $activeTab?.currentHistoryIndex < $activeTab.historyStackIds.length - 1
  $: canReload = $showNewTabOverlay === 0 && $activeTab?.type === 'page'

  $: if ($activeTab?.archived !== ($sidebarTab === 'archive')) {
    log.debug('Active tab is not in view, resetting')
    makePreviousTabActive()
  }

  activeTab.subscribe((tab) => {
    if (!tab) return

    if (tab?.type === 'horizon') {
      const horizon = $horizons.find((horizon) => horizon.id === tab.horizonId)
      if (horizon) {
        addressValue.set(horizon.data.name)
      } else {
        log.warn('Horizon not found', tab.horizonId)
      }
    } else if (tab?.type === 'page') {
      if (tab.currentLocation) {
        addressValue.set(tab.currentLocation)
      } else {
        const currentEntry = historyEntriesManager.getEntry(
          tab.historyStackIds[tab.currentHistoryIndex]
        )
        addressValue.set(currentEntry?.url ?? tab.initialLocation)
      }
    } else if (tab?.type === 'chat') {
      addressValue.set(tab.title)
    } else {
      addressValue.set('')
    }

    persistTabChanges(tab?.id, tab)
  })

  sidebarTab.subscribe((tab) => {
    const tabsInView = $tabs.filter((tab) =>
      $sidebarTab === 'active' ? !tab.archived : tab.archived
    )

    if (tabsInView.length === 0) {
      log.debug('No tabs in view')
      return
    }

    if (tab === 'archive' && !$activeTab?.archived) {
      makeTabActive(tabsInView[0].id)
    } else if (tab === 'active' && $activeTab?.archived) {
      makeTabActive(tabsInView[0].id)
    }
  })

  $: if ($activeBrowserTab) $activeBrowserTab.focus()

  const openResourceDetailsModal = (resourceId: string, from?: OpenResourceEventFrom) => {
    resourceDetailsModalSelected.set(resourceId)
    showResourceDetails.set(true)

    resourceManager.getResource(resourceId, { includeAnnotations: false }).then((resource) => {
      if (resource) {
        resourceManager.telemetry.trackOpenResource(resource.type, from)
      }
    })
  }

  const closeResourceDetailsModal = () => {
    showResourceDetails.set(false)
    resourceDetailsModalSelected.set(null)
  }

  const getSpace = (id: string) => {
    return $spaces.find((space) => space.id === id)
  }

  const makeTabActive = (tabId: string, trigger?: ActivateTabEventTrigger) => {
    log.debug('Making tab active', tabId)
    const tab = $tabs.find((tab) => tab.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }
    showNewTabOverlay.set(0)

    const browserTab = $browserTabs[tabId]

    const activeElement = document.activeElement
    if (activeElement && typeof (activeElement as any).blur === 'function') {
      ;(activeElement as any).blur()
    }

    if (browserTab) {
      if (typeof browserTab.focus === 'function') {
        browserTab.focus()
      }
    }

    activatedTabs.update((tabs) => {
      if (tabs.includes(tabId)) {
        return tabs
      }

      return [...tabs, tabId]
    })

    activeTabId.set(tabId)
    addToActiveTabsHistory(tabId)
    if ($showAppSidebar) {
      setAppSidebarState(true)
    } else {
      setAppSidebarState(false)
    }

    if (trigger) {
      telemetry.trackActivateTab(trigger, tab.type)
    }
  }

  const makePreviousTabActive = (currentIndex?: number) => {
    if ($activeTabs.length === 0) {
      log.debug('No tabs in view')
      return
    }

    const previousTab = $activeTabsHistory[$activeTabsHistory.length - 1]
    const nextTabIndex = currentIndex
      ? currentIndex + 1
      : $activeTabs.findIndex((tab) => tab.id === $activeTabId)

    log.debug('xx Previous tab', previousTab, 'Next tab index', nextTabIndex, $activeTabsHistory)

    if (previousTab) {
      makeTabActive(previousTab)
    } else if (nextTabIndex >= $activeTabs.length && $activeTabs[0]) {
      makeTabActive($activeTabs[0].id)
    } else if ($activeTabs[nextTabIndex]) {
      makeTabActive($activeTabs[nextTabIndex].id)
    } else {
      // go to last tab
      if ($unpinnedTabs.length > 0) {
        makeTabActive($unpinnedTabs[$unpinnedTabs.length - 1].id)
      }
    }
  }

  const createTab = async <T extends Tab>(
    tab: Optional<T, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'pinned' | 'index' | 'magic'>,
    opts?: CreateTabOptions
  ) => {
    console.log('CREATE TAB WITH', opts)
    const defaultOpts = {
      placeAtEnd: true,
      active: false
    }

    const { placeAtEnd, active } = Object.assign(defaultOpts, opts)

    const activeTabIndex =
      $unpinnedTabs.find((tab) => tab.id === $activeTabId)?.index ?? $unpinnedTabs.length - 1
    const nextTabIndex = $unpinnedTabs[activeTabIndex + 1]?.index ?? -1

    // generate index in between active and next tab so that the new tab is placed in between
    const TAB_INDEX_OFFSET = 0.1
    const nextIndex =
      nextTabIndex > 0 ? nextTabIndex - TAB_INDEX_OFFSET : activeTabIndex + TAB_INDEX_OFFSET

    const newIndex = placeAtEnd ? Date.now() : nextIndex

    log.debug('Creating tab', tab, 'at index', newIndex, $unpinnedTabs)

    const newTab = await tabsDB.create({
      archived: false,
      pinned: false,
      magic: false,
      index: newIndex,
      ...tab
    })

    log.debug('Created tab', newTab)
    activatedTabs.update((tabs) => [...tabs, newTab.id])
    tabs.update((tabs) => [...tabs, newTab])

    if (active) {
      makeTabActive(newTab.id)
    }

    return newTab
  }

  function setupObserver() {
    observer = new IntersectionObserver(
      ([entry]) => {
        isFirstButtonVisible = entry.isIntersecting
      },
      {
        root: null,
        threshold: 0.01 // 1% visibility threshold
      }
    )

    if (newTabButton) {
      observer.observe(newTabButton)
    }
  }

  const archiveTab = async (tabId: string) => {
    const tab = $tabs.find((tab) => tab.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    const activeTabIndex = $activeTabs.findIndex((tab) => tab.id === tabId)

    updateTab(tabId, { archived: true })

    // remove tab from active tabs history
    activeTabsHistory.update((history) => history.filter((id) => id !== tabId))

    await tick()

    if ($activeTabId === tabId) {
      makePreviousTabActive(activeTabIndex)
    }
  }

  const unarchiveTab = async (tabId: string) => {
    const tab = $tabs.find((tab) => tab.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    log.debug('Unarchiving tab', tabId)

    // Mark tab as unarchived and update the creation date to now to make it appear at the bottom
    updateTab(tabId, { archived: false })

    sidebarTab.set('active')

    await tick()

    setTimeout(() => {
      makeTabActive(tabId)
    }, 50)
  }

  const handleUnarchiveTab = async (e: CustomEvent<string>) => {
    await unarchiveTab(e.detail)
  }

  const handleDeleteTab = async (e: CustomEvent<string>) => {
    await deleteTab(e.detail, DeleteTabEventTrigger.Click)
  }

  const deleteTab = async (tabId: string, trigger?: DeleteTabEventTrigger) => {
    const tab = $tabs.find((tab) => tab.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    const activeTabIndex = $activeTabs.findIndex((tab) => tab.id === tabId)

    tabs.update((tabs) => tabs.filter((tab) => tab.id !== tabId))
    activeTabsHistory.update((history) => history.filter((id) => id !== tabId))
    activatedTabs.update((tabs) => tabs.filter((id) => id !== tabId))

    await tick()

    if ($activeTabId === tabId) {
      makePreviousTabActive(activeTabIndex)
    }

    await tabsDB.delete(tabId)

    observer.unobserve(newTabButton)
    observer.observe(newTabButton)

    if (tab.type === 'page' && trigger) {
      await telemetry.trackDeletePageTab(trigger)
    }
  }

  const persistTabChanges = async (tabId: string, updates: Partial<Tab>) => {
    await tabsDB.update(tabId, updates)
  }

  const bulkUpdateTabsStore = async (items: { id: string; updates: Partial<Tab> }[]) => {
    await tabsDB.bulkUpdate(items)
  }

  const updateTab = async (tabId: string, updates: Partial<Tab>) => {
    log.debug('Updating tab', tabId, updates)
    tabs.update((tabs) => {
      const updatedTabs = tabs.map((tab) => {
        if (tab.id === tabId) {
          return {
            ...tab,
            ...updates
          } as Tab
        }

        return tab
      })

      return updatedTabs
    })
    await persistTabChanges(tabId, updates)
  }

  const closeActiveTab = async (trigger?: DeleteTabEventTrigger) => {
    if (!$activeTab) {
      log.error('No active tab')
      return
    }

    if ($showNewTabOverlay !== 0) {
      setShowNewTabOverlay(0)
      return
    }

    if ($activeTab.pinned) {
      log.debug('Active tab is pinned, deactivating it')
      $activatedTabs = $activatedTabs.filter((id) => id !== $activeTab.id)

      const nextTabIndex = $unpinnedTabs.findIndex((tab) => tab.id === $activeTab.id) + 1
      if ($unpinnedTabs[nextTabIndex]) {
        makeTabActive($unpinnedTabs[nextTabIndex].id)
      } else {
        makeTabActive($unpinnedTabs[$unpinnedTabs.length - 1].id)
      }
    } else {
      await deleteTab($activeTab.id, trigger)
    }

    /*
    if ($activeTab.archived) {
      await deleteTab($activeTab.id)
    } else {
      await archiveTab($activeTab.id)
    }
    */

    // if ($activeTab.type === 'page') {
    //   const currentEntry = historyEntriesManager.getEntry(
    //     $activeTab.historyStackIds[$activeTab.currentHistoryIndex]
    //   )

    //   if (currentEntry) {
    //     archiveTab(currentEntry.id)
    //   }
    // }

    // await deleteTab($activeTab.id)
  }

  const setActiveTabAsPinnedTab = async () => {
    if (!$activeTab) {
      log.error('No active tab')
      return
    }

    await updateTab($activeTab.id, { pinned: !$activeTab.pinned })
  }

  const updateActiveTab = (updates: Partial<Tab>) => {
    if (!$activeTab) {
      log.error('No active tab')
      return
    }

    updateTab($activeTab.id, updates)
  }

  const handeCreateResourceFromOasis = async (e: CustomEvent<string>) => {
    const newTab = await createPageTab(e.detail, {
      active: true,
      trigger: CreateTabEventTrigger.OasisCreate
    })

    // Since we dont have the webview available right here, we need to wait a bit before we can handle the bookmark
    await wait(10000)

    if (newTab) {
      await handleBookmark(false, SaveToOasisEventTrigger.CreateMenu)
    }
  }

  const getNavigationURL = (value: string) => {
    const url = parseStringIntoBrowserLocation(value)
    if (!url) {
      log.debug('Invalid URL, using search engine')

      const queryParts = value.split(' ')

      let matchedPart = null
      const matchingSearchEngine = SEARCH_ENGINES.find((engine) =>
        queryParts.some((part) =>
          engine.shortcuts.some((s) => {
            if (part.length > 2) {
              const match = s.includes(part)
              if (match) {
                matchedPart = part
              }
              return match
            } else {
              const match = s === part
              if (match) {
                matchedPart = part
              }
            }
          })
        )
      )

      if (!matchingSearchEngine) {
        const defaultSearchEngine = SEARCH_ENGINES.find(
          (engine) => engine.key === DEFAULT_SEARCH_ENGINE
        )!

        log.debug('Using default search engine', defaultSearchEngine.key)
        const searchURL = defaultSearchEngine.getUrl(encodeURIComponent(value))
        return searchURL
      }

      log.debug('Using search engine', matchingSearchEngine.key)

      const query = matchedPart ? value.replace(matchedPart, '').trim() : value
      const searchURL = matchingSearchEngine?.getUrl(encodeURIComponent(query))
      return searchURL
    }

    return url
  }

  let blockBlurHandler = false
  const handleBlur = () => {
    if (blockBlurHandler) {
      return
    }

    blockBlurHandler = true
    setTimeout(() => {
      blockBlurHandler = false
    }, 300)

    addressBarFocus = false

    let addressVal = activeTabComponent && get(activeTabComponent?.inputUrl)
    log.debug('Address bar blur', addressVal)

    if (!addressVal) {
      return
    }

    if ($activeTab?.type === 'horizon') {
      const horizon = $horizons.find((horizon) => horizon.id === $activeTab.horizonId)
      if (horizon) {
        horizon.updateData({ name: addressVal })

        updateActiveTab({ title: addressVal })
      }
    } else if ($activeTab?.type === 'page') {
      log.debug('Navigating to address from page', addressVal)
      const url = getNavigationURL(addressVal)
      $activeBrowserTab.navigate(url)

      if (url === $activeTabLocation) {
        $activeBrowserTab.reload()
      } else {
        updateActiveTab({ initialLocation: url })
      }
    } else if ($activeTab?.type === 'empty') {
      log.debug('Navigating to address from empty tab', addressVal)
      const url = getNavigationURL(addressVal)
      log.debug('Converting empty tab to page', url)
      updateActiveTab({
        type: 'page',
        initialLocation: url,
        historyStackIds: [],
        currentHistoryIndex: -1
      })
    } else if ($activeTab?.type === 'chat') {
      log.debug('Renaming chat tab', addressVal)
      updateActiveTab({ title: addressVal })
    }
  }

  const handleFocus = () => {
    addressBarFocus = true
    activeTabComponent?.editAddress()
  }

  const handleCopyLocation = useDebounce(() => {
    if ($activeTabLocation) {
      log.debug('Copying location to clipboard', $activeTabLocation)
      // @ts-ignore
      window.api.copyToClipboard($activeTabLocation)
      toasts.success('Copied to Clipboard!')
    }
  }, 200)

  const createHistoryTab = useDebounce(async (opts?: CreateTabOptions) => {
    log.debug('Creating new history tab')

    // check if there already exists a history tab, if yes we just change to it

    const historyTab = $tabs.find((tab) => tab.type === 'history')

    if (historyTab) {
      makeTabActive(historyTab.id)
      return
    }

    await createTab<TabHistory>(
      {
        title: 'History',
        icon: '',
        type: 'history'
      },
      { active: true }
    )
  }, 200)

  let keyBuffer = ''
  let index: number
  let keyTimeout: any
  const KEY_TIMEOUT = 120
  const MAX_TABS = 99

  $: savedTabsOrientation = $userConfigSettings.tabs_orientation
  $: horizontalTabs = savedTabsOrientation === 'horizontal'

  const handleCollapseRight = () => {
    if (sidebarComponent) {
      sidebarComponent.collapseRight()
    }

    if (showRightSidebar) {
      showRightSidebar = false
    }

    if ($activeTabMagic.showSidebar) {
      setPageChatState(false)
    }
  }

  const handleExpandRight = () => {
    if (sidebarComponent) {
      sidebarComponent.expandRight()
    }

    showRightSidebar = true
  }

  const handleRightPaneUpdate = (event: CustomEvent<PaneAPI>) => {
    rightPane = event.detail
  }

  const toggleRightSidebar = () => {
    if (showRightSidebar) {
      handleCollapseRight()
      cachedMagicTabs.clear()
    } else {
      handleExpandRight()
      setPageChatState(true)
      telemetry.trackOpenRightSidebar($rightSidebarTab)
    }
  }

  const handleCollapse = () => {
    log.debug('Collapsing sidebar')
    if (sidebarComponent) {
      sidebarComponent.collapseLeft()
      changeTraficLightsVisibility(false)
    }
  }

  const handleExpand = () => {
    log.debug('Expanding sidebar')
    if (sidebarComponent) {
      sidebarComponent.expandLeft()
      changeTraficLightsVisibility(true)
    }
  }

  const handleRightSidebarTabsChange = (tab: RightSidebarTab) => {
    // check if sidebar is even open
    if (!showRightSidebar) {
      log.warn('Right sidebar is not open, ignoring tab change')
      return
    }

    log.debug('Right sidebar tab change', tab)

    // delay the tracking to make sure the sidebar can update first
    setTimeout(() => {
      telemetry.trackOpenRightSidebar(tab)
    }, 50)

    if (tab === 'chat') {
      setPageChatState(true)
    } else if ($activeTabMagic.showSidebar) {
      setPageChatState(false)
    }

    if (tab === 'go-wild') {
      setAppSidebarState(true)
    } else if ($showAppSidebar) {
      setAppSidebarState(false)
    }
  }

  const openRightSidebarTab = (id: RightSidebarTab) => {
    if ($rightSidebarTab === id) {
      telemetry.trackOpenRightSidebar(id)
    } else {
      rightSidebarTab.set(id)
    }

    if (!showRightSidebar) {
      handleExpandRight()

      if (id === 'chat') {
        setPageChatState(true)
      }
    }
  }

  const changeTraficLightsVisibility = (visible: boolean) => {
    // @ts-ignore
    window.api.updateTrafficLightsVisibility(visible)
  }

  const handleLeftSidebarChange = useDebounce((value: boolean) => {
    if (showLeftSidebar === value) {
      return
    }

    showLeftSidebar = value
    changeTraficLightsVisibility(value)

    telemetry.trackToggleSidebar(showLeftSidebar)
  }, 200)

  const changeLeftSidebarState = (value?: boolean) => {
    const newState = value ?? !showLeftSidebar

    if (newState) {
      handleExpand()
    } else {
      handleCollapse()
    }
  }

  // fix the syntax error
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (rightPane?.isExpanded()) handleCollapseRight()
    } else if (e.key === 'Enter' && addressBarFocus) {
      handleBlur()
      activeTabComponent?.blur()
      // Note: even though the electron menu handles the shortcut this is still needed here
    } else if (isModKeyAndKeyPressed(e, 'w')) {
      if ($showNewTabOverlay !== 0) setShowNewTabOverlay(0)
      else closeActiveTab(DeleteTabEventTrigger.Shortcut)
      // } else if (isModKeyAndKeyPressed(e, 'p')) {
      // setActiveTabAsPinnedTab()
    } else if (isModKeyAndKeyPressed(e, 'd')) {
      handleBookmark(false, SaveToOasisEventTrigger.Shortcut)
    } else if (isModKeyAndKeyPressed(e, 'n')) {
      // this creates a new electron window
    } else if (isModKeyAndKeyPressed(e, 'o')) {
      if ($showNewTabOverlay === 2) {
        setShowNewTabOverlay(0)
      } else {
        setShowNewTabOverlay(2)
      }
    } else if (e.ctrlKey && e.key === 'Tab') {
      setShowNewTabOverlay(0)
      debouncedCycleActiveTab(e.shiftKey)
    } else if (isModKeyAndKeyPressed(e, 'l')) {
      setShowNewTabOverlay(0)
      activeTabComponent?.editAddress()
      handleFocus()
    } else if (isModKeyAndKeyPressed(e, 'j')) {
      // showTabSearch = !showTabSearch
    } else if (isModKeyAndKeyPressed(e, 'y')) {
      setShowNewTabOverlay(0)
      createHistoryTab()
    } else if (isModKeyAndKeyPressed(e, '+')) {
      setShowNewTabOverlay(0)
      $activeBrowserTab?.zoomIn()
    } else if (isModKeyAndKeyPressed(e, '-')) {
      setShowNewTabOverlay(0)
      $activeBrowserTab?.zoomOut()
    } else if (isModKeyAndKeyPressed(e, '0')) {
      setShowNewTabOverlay(0)
      $activeBrowserTab?.resetZoom()
    } else if (isModKeyAndShiftKeyAndKeyPressed(e, 'i')) {
      $activeBrowserTab?.openDevTools()
    } else if (isModKeyAndKeysPressed(e, ['1', '2', '3', '4', '5', '6', '7', '8', '9'])) {
      const index = parseInt(e.key, 10) - 1
      const tabs = [...$pinnedTabs, ...$magicTabs, ...$unpinnedTabs]

      if (index < 8) {
        if (index < tabs.length) {
          makeTabActive(tabs[index].id, ActivateTabEventTrigger.Shortcut)
        }
      } else {
        // if 9 is pressed, go to the last tab
        makeTabActive(tabs[tabs.length - 1].id, ActivateTabEventTrigger.Shortcut)
      }
    } else if (e.key === 'ArrowLeft' && e.metaKey) {
      if (canGoBack) {
        $activeBrowserTab?.goBack()
      }
    } else if (e.key === 'ArrowRight' && e.metaKey) {
      if (canGoForward) {
        $activeBrowserTab?.goForward()
      }
    }
  }

  const setShowNewTabOverlay = (value: number) => {
    showNewTabOverlay.set(value)
  }

  const handleToggleHorizontalTabs = () => {
    const t = document.startViewTransition(() => {
      horizontalTabs = !horizontalTabs

      config.updateSettings({
        tabs_orientation: horizontalTabs ? 'horizontal' : 'vertical'
      })

      // localStorage.setItem('horizontalTabs', horizontalTabs.toString())
      telemetry.trackToggleTabsOrientation(horizontalTabs ? 'horizontal' : 'vertical')
    })
    checkScroll()
  }

  const debounceToggleHorizontalTabs = useDebounce(handleToggleHorizontalTabs, 100)

  const createNewEmptyTab = async () => {
    showNewTabOverlay.set(1)
    // log.debug('Creating new tab')
    // // check if there already exists an empty tab, if yes we just change to it
    // const emptyTab = $tabs.find((tab) => tab.type === 'empty')
    // if (emptyTab) {
    //   makeTabActive(emptyTab.id)
    //   return
    // }
    // const newTab = await createTab<TabEmpty>({ title: 'New Tab', icon: '', type: 'empty' })
    // makeTabActive(newTab.id)
  }

  const debouncedCreateNewEmptyTab = useDebounce(createNewEmptyTab, 100)

  const createPageTab = async (url: string, opts?: CreateTabOptions): Promise<TabPage> => {
    log.debug('Creating new page tab')

    const options = {
      active: true,
      placeAtEnd: true,
      trigger: CreateTabEventTrigger.Other,
      ...opts
    }

    const newTab = await createTab<TabPage>(
      {
        title: url,
        icon: '',
        type: 'page',
        initialLocation: url,
        historyStackIds: [],
        currentHistoryIndex: -1
      },
      options
    )

    await telemetry.trackCreatePageTab(options.trigger, options.active)

    return newTab as TabPage
  }

  const createSpaceTab = async (space: Space, active = true) => {
    log.debug('Creating new space tab')
    const newTab = await createTab<TabSpace>(
      {
        title: space.name.folderName,
        icon: '',
        spaceId: space.id,
        type: 'space',
        colors: space.name.colors
      },
      { active }
    )

    return newTab
  }

  const createChatTab = async (query: string, active = true) => {
    log.debug('Creating new chat tab')
    await createTab<TabChat>({ title: query, icon: '', type: 'chat', query: query }, { active })
  }

  const createImporterTab = async () => {
    log.debug('Creating new importer tab')
    await createTab<TabImporter>(
      {
        title: 'Importer',
        icon: '',
        type: 'importer',
        index: 0,
        pinned: false,
        magic: false
      },
      { active: true }
    )
  }

  const createOasisDiscoveryTab = async () => {
    log.debug('Creating new oasis discovery tab')
    await createTab<TabOasisDiscovery>(
      {
        title: 'Oasis Discovery',
        icon: '',
        type: 'oasis-discovery',
        magic: false
      },
      { active: true }
    )
  }

  const handleNewTab = (e: CustomEvent<BrowserTabNewTabEvent>) => {
    const { url, active, trigger } = e.detail

    if (url) {
      createPageTab(url, { active, trigger, placeAtEnd: false })
    } else {
      createNewEmptyTab()
    }
  }

  const cycleActiveTab = (previous: boolean) => {
    if ($tabs.length === 0) {
      log.debug('No tabs in view')
      return
    }
    let ordered = [
      ...$magicTabs.sort((a, b) => a.index - b.index),
      ...$unpinnedTabs.sort((a, b) => a.index - b.index),
      ...$pinnedTabs.sort((a, b) => a.index - b.index)
    ].filter((tab) => !tab.archived)

    const activeTabIndex = ordered.findIndex((tab) => tab.id === $activeTabId)
    if (!previous) {
      const nextTabIndex = activeTabIndex + 1
      if (nextTabIndex >= ordered.length) {
        makeTabActive(ordered[0].id, ActivateTabEventTrigger.Shortcut)
      } else {
        makeTabActive(ordered[nextTabIndex].id, ActivateTabEventTrigger.Shortcut)
      }
    } else {
      const previousTabIndex = activeTabIndex - 1
      if (previousTabIndex < 0) {
        makeTabActive(ordered[ordered.length - 1].id, ActivateTabEventTrigger.Shortcut)
      } else {
        makeTabActive(ordered[previousTabIndex].id, ActivateTabEventTrigger.Shortcut)
      }
    }
  }
  const debouncedCycleActiveTab = useDebounce(cycleActiveTab, 100)

  const openUrlHandler = (url: string) => {
    log.debug('open url', url)

    createPageTab(url, { active: true, trigger: CreateTabEventTrigger.System })
  }

  const handleTabNavigation = (e: CustomEvent<string>) => {
    log.debug('Navigating to', e.detail)

    updateActiveTab({
      type: 'page',
      initialLocation: e.detail,
      historyStackIds: [],
      currentHistoryIndex: -1
    })

    telemetry.trackCreatePageTab(CreateTabEventTrigger.AddressBar, true)
  }

  const addToActiveTabsHistory = (tabId: string) => {
    activeTabsHistory.update((history) => {
      if (history[history.length - 1] !== tabId) {
        // remove tab from history if it already exists and add it to the end
        return [...history.filter((id) => id !== tabId), tabId]
      }

      return history
    })
  }

  const handleTabSelect = (event: CustomEvent<string>) => {
    const newId = event.detail
    log.debug('Active Tab ID:', newId)

    makeTabActive(newId, ActivateTabEventTrigger.Click)
  }

  async function handleBookmark(
    savedToSpace = false,
    trigger: SaveToOasisEventTrigger = SaveToOasisEventTrigger.Click
  ): Promise<{ resource: Resource | null; isNew: boolean }> {
    try {
      if (!$activeTabLocation || $activeTab?.type !== 'page')
        return { resource: null, isNew: false }

      bookmarkingInProgress.set(true)

      if ($activeTab.resourceBookmark) {
        log.debug(
          'checking if existing bookmark still valid for url',
          $activeTabLocation,
          $activeTab.resourceBookmark
        )

        const existingResource = await resourceManager.getResource($activeTab.resourceBookmark)
        if (existingResource) {
          const existingCanonical = (existingResource?.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
          )

          log.debug('existing canonical', existingCanonical)

          if (existingCanonical?.value === $activeTabLocation) {
            log.debug('already bookmarked, removing silent tag', $activeTab.resourceBookmark)

            const isSilent = (existingResource.tags ?? []).some(
              (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
            )

            if (isSilent) {
              // mark resource as not silent since the user is explicitely bookmarking it
              await resourceManager.deleteResourceTag(
                $activeTab.resourceBookmark,
                ResourceTagsBuiltInKeys.SILENT
              )
            }

            bookmarkingSuccess.set(true)

            // if (openAfter) {
            //   openResourceDetailsModal($activeTab.resourceBookmark)
            // }

            updateTab($activeTabId, { resourceBookmarkedManually: true })

            // If the resource hasn't been saved before we track the event
            if (isSilent) {
              await telemetry.trackSaveToOasis(existingResource.type, trigger, savedToSpace)
            }

            return { resource: existingResource, isNew: false }
          }
        }
      }

      const resource = await $activeBrowserTab.bookmarkPage(false)

      // automatically resets after some time
      toasts.success('Bookmarked Page!')
      bookmarkingSuccess.set(true)

      await telemetry.trackSaveToOasis(resource.type, trigger, savedToSpace)

      // if (openAfter) {
      //   openResourceDetailsModal(resource.id)
      // }

      return { resource, isNew: true }
    } catch (e) {
      log.error('error creating resource', e)
      return { resource: null, isNew: false }
    } finally {
      bookmarkingInProgress.set(false)
    }
  }

  async function handleWebviewTabNavigation(
    e: CustomEvent<WebviewWrapperEvents['navigation']>,
    tab: Tab
  ) {
    const { url, oldUrl } = e.detail
    log.debug('webview navigation', { url, oldUrl }, tab)

    if (tab.type !== 'page') return

    if (url === oldUrl) {
      log.debug('webview navigation same url')
      return
    }

    if (tab.resourceBookmark) {
      log.debug('tab url changed, removing bookmark')
      updateTab(tab.id, { resourceBookmark: null, chatResourceBookmark: null })
    }
  }

  function handleCreateChat(e: CustomEvent<string>) {
    log.debug('create chat', e.detail)

    updateActiveTab({ type: 'chat', query: e.detail, title: e.detail, icon: '' })
  }

  function handleRag(e: CustomEvent<string>) {
    log.debug('rag search', e.detail)

    updateActiveTab({ type: 'chat', query: e.detail, title: e.detail, icon: '', ragOnly: true })
  }

  function updateActiveMagicPage(updates: Partial<PageMagic>) {
    log.debug('updating active magic page', updates)

    if (updates.chatId) {
      activeChatId.set(updates.chatId)
    }

    activeTabMagic.update((magic) => {
      return {
        ...magic,
        ...updates
      }
    })
  }

  const getTextElementsFromHtml = (html: string): string[] => {
    let textElements: string[] = []
    const body = new DOMParser().parseFromString(html, 'text/html').body
    body.querySelectorAll('p').forEach((p) => {
      textElements.push(p.textContent?.trim() ?? '')
    })
    return textElements
  }

  // this is a separate function as it will be easier to easily change what it means for tabs to be in chat context
  const getTabsInChatContext = () => {
    return $magicTabs
  }

  const highlightWebviewText = async (
    resourceId: string,
    answerText: string,
    sourceUid?: string
  ) => {
    log.debug('highlighting text', resourceId, answerText, sourceUid)

    const tabs = [...getTabsInChatContext(), ...$unpinnedTabs]
    let tab = tabs.find((tab) => tab.type === 'page' && tab.resourceBookmark === resourceId)

    if (!tab) {
      const resource = await resourceManager.getResource(resourceId)
      const url = resource?.tags?.find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
      )?.value

      if (!url) {
        log.error('no url found for resource', resourceId)
        toasts.error('Failed to highlight citation')
        return
      }

      tab = await createPageTab(url, {
        active: false,
        trigger: CreateTabEventTrigger.OasisChat
      })

      // give the new tab some time to load
      await wait(1000)
    }

    if (tab) {
      const browserTab = $browserTabs[tab.id]
      if (!browserTab) {
        log.error('Browser tab not found', tab.id)
        toasts.error('Failed to highlight citation')
        return
      }

      makeTabActive(tab.id, ActivateTabEventTrigger.ChatCitation)

      log.debug('highlighting citation', tab.id, answerText, sourceUid)
      if (answerText === '') {
        if (!sourceUid) {
          return
        }
        const source = await sffs.getAIChatDataSource(sourceUid)
        if (!source) {
          return
        }
        answerText = source.content
      }

      const toast = toasts.loading('Highlighting citation..')
      const detectedResource = await browserTab.detectResource()
      if (!detectedResource) {
        log.error('no resource detected')
        toast.error('Failed to highlight citation')
        return
      }
      const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
      if (!content || !content.html) {
        log.debug('no content found from web parser')
        toast.error('Failed to parse content to highlight citation')
        return
      }

      const textElements = getTextElementsFromHtml(content.html)
      if (!textElements) {
        log.debug('no text elements found')
        toast.error('Failed to find source text in the page for citation')
        return
      }

      log.debug('text elements length', textElements.length)
      let docsSimilarity = await sffs.getAIDocsSimilarity(answerText, textElements, 0.5)
      if (!docsSimilarity || docsSimilarity.length === 0) {
        log.debug('no docs similarity found')
        toast.error('Failed to find source text in the page for citation')
        return
      }

      docsSimilarity.sort((a, b) => a.similarity - b.similarity)
      const texts = []
      for (const docSimilarity of docsSimilarity) {
        const doc = textElements[docSimilarity.index]
        log.debug('doc', doc)
        if (doc && doc.includes(' ')) {
          texts.push(doc)
        }
      }

      browserTab.sendWebviewEvent(WebViewEventReceiveNames.HighlightText, {
        texts: texts
      })
      toast.success('Citation highlighted')
    } else {
      log.error('No tab in chat context found for resource', resourceId)
      toasts.error('Failed to highlight citation')
    }
  }

  const handleSeekToTimestamp = async (resourceId: string, timestamp: number) => {
    log.info('seeking to timestamp', resourceId, timestamp)

    const tabs = [...getTabsInChatContext(), ...$unpinnedTabs]
    let tab = tabs.find((tab) => tab.type === 'page' && tab.resourceBookmark === resourceId)

    if (!tab) {
      const resource = await resourceManager.getResource(resourceId)
      const url = resource?.tags?.find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
      )?.value

      if (!url) {
        log.error('no url found for resource', resourceId)
        toasts.error('Failed to open citation')
        return
      }

      tab = await createPageTab(url, {
        active: false,
        trigger: CreateTabEventTrigger.OasisChat
      })

      // give the new tab some time to load
      await wait(1000)
    }

    if (tab) {
      const browserTab = $browserTabs[tab.id]
      if (!browserTab) {
        log.error('Browser tab not found', tab.id)
        alert('Error: Browser tab not found')
        return
      }

      makeTabActive(tab.id, ActivateTabEventTrigger.ChatCitation)
      browserTab.sendWebviewEvent(WebViewEventReceiveNames.SeekToTimestamp, {
        timestamp: timestamp
      })
    } else {
      log.error('No tab in chat context found for resource', resourceId)
      toasts.error('Failed to open citation')
    }
  }

  const scrollWebviewToText = async (tabId: string, text: string) => {
    const browserTab = $browserTabs[tabId]
    if (!browserTab) {
      log.error('Browser tab not found', tabId)
      return
    }

    const html = await browserTab.executeJavaScript(scrollToTextCode(text))

    log.debug('HTML', html)
  }

  const handleAppSidebarClear = async (createNewAppId: boolean) => {
    log.debug('clearing app sidebar')
    try {
      let appId: string | null = null
      await sffs.deleteAIChat($activeAppId)
      //await deleteAppIdsForAppSidebar()
      if (createNewAppId) {
        appId = await sffs.createAIChat('')
        if (!appId) {
          log.error('Failed to create new app id aftering clearing the old one')
          return
        }
      }
      //updateAppIdsForAppSidebar(appId!)
      activeAppId.set(appId!)
      updateTab($activeTabId, { appId: appId })
    } catch (e) {
      log.error('Error clearing app sidebar:', e)
    }
  }

  const prepareTabForChatContext = async (tab: TabPage | TabSpace, title: string) => {
    const isActivated = $activatedTabs.includes(tab.id)
    if (!isActivated) {
      log.debug('Tab not activated, activating first', tab)
      activatedTabs.update((tabs) => {
        return [...tabs, tab.id]
      })

      // give the tab some time to load
      await wait(200)
    }

    log.debug('Preparing tab for chat context', tab)
    if (tab.type === 'page' && !tab.resourceBookmark) {
      log.debug('Bookmarking page tab', tab)
      const browserTab = $browserTabs[tab.id]
      if (!browserTab) {
        log.error('Browser tab not found', tab.id)
        throw Error(`Browser tab not found`)
      }
      try {
        await browserTab.bookmarkPage(true)
      } catch (e) {
        log.error('Error bookmarking page tab', e)
        throw Error(`could not prepare tab '${title}'`)
      }
    }
  }

  const preparePageTabsForChatContext = async () => {
    updateActiveMagicPage({ initializing: true, errors: [] })

    const tabs = getTabsInChatContext()
    log.debug('Making sure resources for all page tabs in context are extracted', tabs)

    tabs.map(async (tab) => {
      try {
        await prepareTabForChatContext(tab, tab.title)
      } catch (e: any) {
        log.error('Error preparing page tabs for chat context', e)
        let errors = $activeTabMagic.errors
        updateActiveMagicPage({ errors: errors.concat(e.message) })
      }
    })
    log.debug('Done preparing page tabs for chat context')
    updateActiveMagicPage({ initializing: false })
  }

  const setPageChatState = async (enabled: boolean) => {
    log.debug('Toggling magic sidebar')
    const transition = document.startViewTransition(async () => {
      const tab = $activeTab as TabPage | null

      if (!$activeTabMagic) return
      if (!tab) return

      activeTabMagic.update((magic) => {
        return {
          ...magic,
          initializing: enabled,
          chatId: $activeChatId,
          showSidebar: enabled
        }
      })

      toggleTabsMagic(enabled)
      await tick()
    })

    await transition.finished

    if (enabled) {
      // Delay to let the sidebar open first
      requestAnimationFrame(async () => {
        await preparePageTabsForChatContext()
      })
    }
  }

  const setAppSidebarState = async (enabled: boolean) => {
    log.debug('Changing app sidebar state', enabled)

    const tab = $activeTab as TabPage | null
    if (!tab) {
      log.error('No active tab')
      toasts.error('Error: No active tab')
      return
    }

    if (!enabled) {
      activeAppId.set('')
      showAppSidebar.set(false)
      return
    }

    let appId = tab.appId
    if (!appId) {
      // TODO: a different way to create app id? not sure yet, single chat id should be fine
      appId = await sffs.createAIChat('')
      if (!appId) {
        log.error('Failed to create an app id')
        toasts.error('Error: Failed to create an pp id')
        return
      }

      updateTab(tab.id, { appId: appId })
      // updateAppIdsForAppSidebar(appId)
      // await preparePageTabsForChatContext()
    }
    /*
    const detectedResource = await $activeBrowserTab.detectResource()
    if (!detectedResource) {
      log.error('no resource detected')
      alert('Create App not supported currently for this page')
      return
    }
    const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
    if (!content || !content.html) {
      log.debug('no content found from web parser')
      alert('Error: no content found form web parser')
      return
    }
    */
    const content = await $activeBrowserTab.executeJavaScript('document.body.outerHTML.toString()')
    if (!content) {
      log.debug('no content found from javscript execution')
      toasts.error('Error: failed to parse content for create app context')
      return
    }
    let cleaned = content
      .replace(/style="[^"]*"/g, '') // remove inline styles
      .replace(/script="[^"]*"/g, '') // remove inline scripts
      .replace(/<style([\s\S]*?)<\/style>/gi, '') // remove style tags
      .replace(/<script([\s\S]*?)<\/script>/gi, '') // remove script tags

    // @ts-ignore
    cleaned = window.api.minifyHtml(cleaned, {
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      collapseInlineTagWhitespace: true,
      continueOnParseError: true,
      decodeEntities: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
      removeAttributeQuotes: true,
      removeEmptyAttributes: true,
      removeEmptyElements: true,
      removeOptionalTags: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true
    })

    cleaned = activeAppSidebarContext.set(cleaned)

    activeAppId.set(appId!)
    showAppSidebar.set(enabled)
  }

  const handleExecuteAppSidebarCode = async (appId: string, code: string) => {
    try {
      const t = $activeTab as TabPage
      if (t.appId != appId) {
        log.error('App ID does not match active tab')
        return
      }
      if (!$activeBrowserTab) {
        log.debug('No active browser tab')
        return
      }
      await $activeBrowserTab.executeJavaScript(code)
    } catch (e) {
      log.error('Error executing app sidebar code:', e)
      toasts.error('Failed to run go wild in page')
    }
  }

  const saveTextFromPage = async (
    text: string,
    html?: string,
    tags?: string[],
    source?: AnnotationCommentData['source']
  ) => {
    if ($activeTab?.type !== 'page') return

    const url = $activeTabLocation ?? $activeTab?.initialLocation

    const data = {
      type: 'comment',
      anchor: null,
      data: {
        url: url,
        content_plain: text,
        content_html: html ?? text,
        tags: tags ?? [],
        source: source
      } as AnnotationCommentData
    } as ResourceDataAnnotation

    let bookmarkedResource = $activeTab.resourceBookmark

    if (!bookmarkedResource) {
      log.debug('no bookmarked resource')

      const resource = await $activeBrowserTab.bookmarkPage(true)
      bookmarkedResource = resource.id
    }

    log.debug('creating annotation', data)
    const annotation = await resourceManager.createResourceAnnotation(data, { sourceURI: url }, [
      ResourceTag.canonicalURL(url),
      ResourceTag.annotates(bookmarkedResource),
      ...(tags?.map((tag) => ResourceTag.hashtag(tag)) ?? [])
    ])

    toasts.success('Saved to Oasis!')

    const trigger =
      source === 'user'
        ? CreateAnnotationEventTrigger.PageSidebar
        : CreateAnnotationEventTrigger.PageChatMessage
    await telemetry.trackCreateAnnotation('comment', trigger)

    return annotation
  }

  const reloadAnnotationsSidebar = (showLoading?: boolean) => {
    if (annotationsSidebar) {
      annotationsSidebar.reload(showLoading)
    }
  }

  const handleAnnotationScrollTo = (e: CustomEvent<WebViewEventAnnotation>) => {
    log.debug('Annotation scroll to', e.detail)
    $activeBrowserTab.sendWebviewEvent(WebViewEventReceiveNames.ScrollToAnnotation, e.detail)
  }

  const handleAnnotationSidebarCreate = async (
    e: CustomEvent<{ text: string; html: string; tags: string[] }>
  ) => {
    log.debug('Annotation sidebar create', e.detail)

    const annotation = await saveTextFromPage(e.detail.text, e.detail.html, e.detail.tags, 'user')

    log.debug('created annotation', annotation)
    annotationsSidebar.reload()
  }

  const handleAnnotationSidebarReload = () => {
    log.debug('Annotation sidebar reload')
    if ($activeBrowserTab) {
      $activeBrowserTab.reload()
    }
  }

  const handleCreateTabFromSpace = async (e: CustomEvent<{ tab: TabSpace; active: boolean }>) => {
    const { tab, active } = e.detail

    log.debug('create tab from sidebar', tab)

    await createTab(tab, { active: active })

    toasts.success('Space added to your Tabs!')
  }

  const handleCreateTabForSpace = async (e: CustomEvent<Space>) => {
    const space = e.detail

    log.debug('create tab from space', space)

    try {
      await oasis.updateSpaceData(space.id, {
        showInSidebar: true
      })

      const existingTab = $unpinnedTabs.find(
        (tab) => tab.type === 'space' && tab.spaceId === space.id
      )
      if (existingTab) {
        makeTabActive(existingTab.id)
        return
      }

      await createSpaceTab(space, true)

      await tick()

      await telemetry.trackOpenSpace(OpenSpaceEventTrigger.SidebarMenu, {
        isLiveSpace: space.name.liveModeEnabled,
        hasSources: (space.name.sources ?? []).length > 0,
        hasSmartQuery: !!space.name.smartFilterQuery
      })
    } catch (error) {
      log.error('[Browser.svelte] Failed to add folder to sidebar:', error)
    }

    toasts.success('Space added to your Tabs!')
  }

  const handleSaveResourceInSpace = async (e: CustomEvent<Space>) => {
    log.debug('add resource to space', e.detail)

    const toast = toasts.loading('Adding resource to space...')

    try {
      const { resource } = await handleBookmark(true, SaveToOasisEventTrigger.Click)
      log.debug('bookmarked resource', resource)

      if (resource) {
        log.debug('will add item', resource.id, 'to space', e.detail.id)
        await resourceManager.addItemsToSpace(e.detail.id, [resource.id])

        // new resources are already tracked in the bookmarking function
        await telemetry.trackAddResourceToSpace(
          resource.type,
          AddResourceToSpaceEventTrigger.TabMenu
        )
      }

      toast.success('Resource added to space!')
    } catch (e) {
      log.error('Failed to add resource to space:', e)
      toast.error('Failed to add resource to space')
    }
  }

  const handleCreateNewSpace = async (e: CustomEvent<ShortcutMenuEvents['create-new-space']>) => {
    const { name, processNaturalLanguage } = e.detail
    const toast = toasts.loading(
      processNaturalLanguage ? 'Creating Space with AI...' : 'Creating Space...'
    )

    try {
      log.debug('Create new Space with Name', name, processNaturalLanguage)

      const newSpace = await oasis.createSpace({
        folderName: name,
        colors: ['#FFBA76', '#FB8E4E'],
        smartFilterQuery: processNaturalLanguage ? name : null
      })

      log.debug('New Folder:', newSpace)

      if (processNaturalLanguage) {
        const userPrompt = JSON.stringify(name)

        const response = await resourceManager.getResourcesViaPrompt(userPrompt)

        log.debug(`Automatic Folder Generation request`, response)

        const results = response.embedding_search_query
          ? response.embedding_search_results
          : response.sql_query_results
        log.debug('Automatic Folder generated with', results)

        if (!results) {
          log.warn('No results found for', userPrompt, response)
          return
        }

        await oasis.addResourcesToSpace(newSpace.id, results)
      }

      if (newSpace) {
        await createSpaceTab(newSpace, true)
      }

      await telemetry.trackCreateSpace(CreateSpaceEventFrom.SpaceHoverMenu, {
        createdUsingAI: processNaturalLanguage
      })

      toast.success('Space created!')
    } catch (error) {
      log.error('Failed to create new space:', error)
      toast.error(
        processNaturalLanguage
          ? 'Failed to create new space with AI, try again with a different name'
          : 'Failed to create new space'
      )
    }
  }

  const handleCreateLiveSpace = async (_e?: MouseEvent) => {
    try {
      if ($activeTab?.type !== 'page' || !$activeTab.currentDetectedApp) {
        log.debug('No app detected in active tab')
        return
      }

      const toast = toasts.loading('Creating Live Space...')

      let app = $activeTab.currentDetectedApp
      if (app.appId === 'youtube') {
        // For youtube we have to manually refresh the tab to make sure we are grabbing the feed of the right page as they don't update it on client side navigations
        const validTypes = [ResourceTypes.CHANNEL_YOUTUBE, ResourceTypes.PLAYLIST_YOUTUBE]

        if (validTypes.includes(app.resourceType as any)) {
          log.debug('reloading tab to get RSS feed')

          // TODO: find a better way to wait for the tab to reload and the new app to be detected
          $activeBrowserTab.reload()
          await wait(3000)

          log.debug('reloaded tab app', $activeTab.currentDetectedApp)
          app = $activeTab.currentDetectedApp
        }
      }

      if (!app.rssFeedUrl) {
        log.debug('No RSS feed found for app', app)
        toast.error('No RSS feed found for this app')
        return
      }

      log.debug('create live space out of app', app)
      isCreatingLiveSpace.set(true)

      const spaceSource = {
        id: generateID(),
        name: $activeTab.title ?? app.appName ?? 'Unknown',
        type: 'rss',
        url: app.rssFeedUrl,
        last_fetched_at: null
      } as SpaceSource

      let name = $activeTab.title ?? app.appName
      if (name) {
        // remove strings like "(1238)" from the beginning which are usually notification counts
        name = name.replace(/^\(\d+\)\s/, '')
      } else {
        name = 'Live Space'
      }

      // create new space
      const space = await oasis.createSpace({
        folderName: truncate(name, 35),
        showInSidebar: true,
        colors: ['#FFD700', '#FF8C00'],
        sources: [spaceSource],
        sortBy: 'source_published_at',
        liveModeEnabled: true
      })

      log.debug('created space', space)

      await createSpaceTab(space, true)

      await telemetry.trackCreateSpace(CreateSpaceEventFrom.TabLiveSpaceButton, {
        isLiveSpace: true
      })

      toast.success('Live Space created!')
    } catch (e) {
      log.error('Error creating live space', e)
    } finally {
      isCreatingLiveSpace.set(false)
    }
  }

  const handleDeletedSpace = (e: CustomEvent<string>) => {
    const spaceId = e.detail
    log.debug('Deleted space', spaceId)

    const tab = $tabs.find((tab) => tab.type === 'space' && tab.spaceId === spaceId)
    if (tab) {
      log.debug('Deleting tab', tab.id)
      deleteTab(tab.id)
    }
  }

  let maxWidth = window.innerWidth

  let tabSize = 0

  $: plusBtnLeftPos = horizontalTabs
    ? $unpinnedTabs.reduce(
        (total, tab) =>
          total +
          (tab.id === $activeTabId && tabSize && tabSize <= 260
            ? 260
            : Math.min(300, Math.max(24, tabSize))) +
          6,
        0
      ) +
      $magicTabs.reduce(
        (total, tab) =>
          total +
          (tab.id === $activeTabId && tabSize <= 260 ? 260 : Math.min(300, Math.max(96, tabSize))) +
          3,
        0
      )
    : 0

  $: {
    const reservedSpace = 200 + 40 * $pinnedTabs.length + 200
    const availableSpace = maxWidth - reservedSpace
    const numberOfTabs = $unpinnedTabs.length + $magicTabs.length
    tabSize = availableSpace / (numberOfTabs || 1)
  }
  const handleResize = () => {
    maxWidth = window.innerWidth
    checkScroll()
  }

  function checkScroll() {
    if (containerRef) {
      const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } =
        containerRef

      if (horizontalTabs) {
        $showStartMask = scrollLeft > 0
        $showEndMask = scrollLeft + clientWidth <= scrollWidth - 1
      } else {
        $showStartMask = scrollTop > 0
        $showEndMask = scrollTop + clientHeight <= scrollHeight - 1
      }
    }
  }

  onMount(async () => {
    window.addEventListener('resize', handleResize)

    // @ts-expect-error
    const userConfig = (await window.api.getUserConfig()) as UserConfig
    log.debug('user config', userConfig)

    await telemetry.init(userConfig)

    const horizonId = await horizonManager.init()
    log.debug('initialized', horizonId)

    // @ts-expect-error
    window.api.registerMainNewWindowHandler((details: { url: string }) =>
      openUrlHandler(details.url)
    )
    // @ts-expect-error
    window.api.onOpenURL((url: string) => openUrlHandler(url))

    // @ts-expect-error
    window.api.onGetPrompts(() => {
      return getPrompts()
    })

    // @ts-expect-error
    window.api.onUpdatePrompt((id: PromptIDs, content: string) => {
      telemetry.trackUpdatePrompt(id)
      return updatePrompt(id, content)
    })

    // @ts-expect-error
    window.api.onResetPrompt((id: PromptIDs) => {
      telemetry.trackResetPrompt(id)
      return resetPrompt(id)
    })

    // @ts-expect-error
    window.api.onToggleSidebar((visible?: boolean) => {
      changeLeftSidebarState(visible)
    })

    // @ts-expect-error
    window.api.onAddDemoItems(async () => {
      await createDemoItems(createTab, oasis, createSpaceTab, resourceManager)
    })

    // @ts-expect-error
    window.api.onToggleTabsPosition(() => {
      handleToggleHorizontalTabs()
    })

    // @ts-expect-error
    window.api.onCopyActiveTabURL(() => {
      handleCopyLocation()
    })

    // @ts-expect-error
    window.api.onOpenOasis(() => {
      if ($showNewTabOverlay === 2) {
        $showNewTabOverlay = 0
      } else {
        $showNewTabOverlay = 2
      }
    })

    // @ts-expect-error
    window.api.onCreateNewTab(() => {
      if ($showNewTabOverlay === 1) {
        $showNewTabOverlay = 0
      } else {
        $showNewTabOverlay = 1
      }
    })

    // @ts-expect-error
    window.api.onCloseActiveTab(() => {
      closeActiveTab(DeleteTabEventTrigger.Shortcut)
    })

    // @ts-expect-error
    window.api.onReloadActiveTab((force: boolean) => {
      if ($showNewTabOverlay !== 0) return
      if (force) {
        $activeBrowserTab?.forceReload()
      } else {
        $activeBrowserTab?.reload()
      }
    })

    // truncate filename if it's too long but make sure the extension is preserved
    const shortenFilename = (raw: string, max = 30) => {
      const extension = raw.slice(raw.lastIndexOf('.'))
      const name = raw.slice(0, raw.lastIndexOf('.'))

      return name.length > max ? `${name.slice(0, max)}[...]${extension}` : raw
    }

    // @ts-ignore
    window.api.onRequestDownloadPath(async (data: DownloadRequestMessage) => {
      await tick()

      const existingDownload = downloadResourceMap.get(data.id)
      if (existingDownload) {
        log.debug('download already in progress', data)
        return existingDownload.savePath
      }

      const downloadData: Download = {
        id: data.id,
        url: data.url,
        filename: shortenFilename(data.filename),
        mimeType: data.mimeType,
        startTime: data.startTime,
        totalBytes: data.totalBytes,
        contentDisposition: data.contentDisposition,
        savePath: '',
        resourceId: ''
      }

      downloadResourceMap.set(data.id, downloadData)

      log.debug('new download request', downloadData)

      const toast = toasts.loading(`Downloading "${downloadData.filename}"...`)

      downloadToastsMap.set(data.id, toast)

      // TODO: add metadata/tags here
      const resource = await resourceManager.createResource(
        data.mimeType,
        undefined,
        {
          name: data.filename,
          sourceURI: data.url
        },
        [ResourceTag.download()]
      )

      log.debug('resource for download created', downloadData, resource)

      downloadData.resourceId = resource.id
      downloadData.savePath = resource.path
      downloadResourceMap.set(data.id, downloadData)

      return downloadData.savePath
    })

    // @ts-ignore
    window.api.onDownloadUpdated((data: DownloadUpdatedMessage) => {
      log.debug('download updated', data)

      const downloadData = downloadResourceMap.get(data.id)
      if (!downloadData) {
        log.error('download data not found', data)
        return
      }

      const toast = downloadToastsMap.get(data.id)
      if (!toast) {
        log.error('toast not found', data)
        return
      }

      if (data.state === 'progressing') {
        const progress = data.receivedBytes / data.totalBytes
        toast.update(`Downloading "${downloadData.filename}" (${Math.round(progress * 100)}%)...`)
      } else if (data.state === 'interrupted') {
        toast.error(`Download of "${downloadData.filename}" interrupted`)
      } else if (data.isPaused) {
        toast.info(`Download of "${downloadData.filename}" paused`)
      }
    })

    // @ts-ignore
    window.api.onDownloadDone(async (data: DownloadDoneMessage) => {
      // TODO: trigger the post-processing call here
      log.debug('download done', data)

      const downloadData = downloadResourceMap.get(data.id)
      if (!downloadData) {
        log.error('download data not found', data)
        return
      }

      // if (data.state === 'completed') {
      //   resourceManager.reloadResource(downloadData.resourceId)
      // }

      const toast = downloadToastsMap.get(data.id)
      if (!toast) {
        log.error('toast not found', data)
        return
      }

      if (data.state === 'completed') {
        toast.success(`"${downloadData.filename}" saved to Oasis!`)
      } else if (data.state === 'interrupted') {
        toast.error(`Download of "${downloadData.filename}" interrupted`)
      } else if (data.state === 'cancelled') {
        toast.error(`Download of "${downloadData.filename}" cancelled`)
      }

      downloadResourceMap.delete(data.id)

      await telemetry.trackFileDownload()
    })

    const tabsList = await tabsDB.all()
    tabs.update((currentTabs) => currentTabs.sort((a, b) => a.index - b.index))
    tabs.set(tabsList)
    log.debug('Tabs loaded', tabsList)

    log.debug('Loading spaces')
    const spacesList = await oasis.loadSpaces()

    // add spaces to tabs if missing
    // spacesList.forEach((space) => {
    //   if (!tabsList.find((tab) => tab.type === 'space' && tab.spaceId === space.id)) {
    //     createTab<TabSpace>({
    //       type: 'space',
    //       spaceId: space.id,
    //       title: space.name,
    //       icon: ''
    //     })
    //   }
    // })

    // TODO: for safety we wait a bit before we tell the app that we are ready, we need a better way to do this
    setTimeout(() => {
      // @ts-expect-error
      window.api.appIsReady()
    }, 2000)

    const activeTabs = tabsList.filter((tab) => !tab.archived)

    if (activeTabs.length === 0) {
      createNewEmptyTab()
    } else if ($activeTabId) {
      makeTabActive($activeTabId)
    } else {
      makeTabActive(activeTabs[activeTabs.length - 1].id)
    }

    // activeTabs.forEach((tab, index) => {
    //   updateTab(tab.id, { index: index })
    // })

    // if we have some magicTabs, make them unpinned
    turnMagicTabsIntoUnpinned()

    tabs.update((tabs) => tabs.sort((a, b) => a.index - b.index))

    log.debug('tabs', $tabs)

    setupObserver()

    await tick()

    checkScroll()

    if (!userConfig.initialized_tabs) {
      log.debug('Creating initial tabs')

      showSplashScreen.set(true)

      await createDemoItems(createTab, oasis, createSpaceTab, resourceManager)

      // @ts-ignore
      await window.api.updateInitializedTabs(true)

      showSplashScreen.set(false)
    }
  })

  const turnMagicTabsIntoUnpinned = async () => {
    const magicTabsArray = get(magicTabs)
    const unpinnedTabsArray = get(unpinnedTabs)

    if (magicTabsArray.length === 0) {
      // No magic tabs to process
      return
    }

    // Turn magic tabs into unpinned tabs
    magicTabsArray.forEach((magicTab) => {
      magicTab.magic = false
      unpinnedTabsArray.push(magicTab)
    })

    // Clear the magic tabs array
    magicTabsArray.length = 0

    // Update indices of unpinned tabs
    const updatedUnpinnedTabs = unpinnedTabsArray.map((tab, index) => ({ ...tab, index }))

    // Update the tabs store
    tabs.update((x) => {
      return x.map((tab) => {
        const updatedTab = updatedUnpinnedTabs.find((t) => t.id === tab.id)
        if (updatedTab) {
          tab.index = updatedTab.index
          tab.magic = false
          tab.pinned = false
        }
        return tab
      })
    })

    // Update the store with the changed tabs
    await bulkUpdateTabsStore(
      updatedUnpinnedTabs.map((tab) => ({
        id: tab.id,
        updates: { pinned: false, magic: false, index: tab.index }
      }))
    )

    log.debug('Magic tabs turned into unpinned tabs successfully')
  }

  const handleDrop = async (event: CustomEvent) => {
    const tab = event.detail?.tab

    event.preventDefault()

    const mediaResults = await processDrop(event.detail.event)

    const resourceItems = mediaResults.filter((r) => r.type === 'resource')

    if (resourceItems.length > 0) {
      await resourceManager.addItemsToSpace(
        tab.spaceId,
        resourceItems.map((r) => r.data as string)
      )
      log.debug(`Resources dropped into folder ${tab.title}`)

      toasts.success('Resources added to folder!')
    } else {
      log.debug('No resources found in drop event')
    }
  }

  const handleRemoveFromSidebar = async (e: CustomEvent) => {
    const tabId = e.detail

    // Find the tab with the given ID
    const tab = get(tabs).find((t) => t.id === tabId)

    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    // Ensure the tab is of type 'space'
    if (tab.type !== 'space') {
      log.error('Tab is not of type space', tabId)
      return
    }

    const spaceId = tab.spaceId
    log.debug('spaceid', spaceId)

    try {
      const space = $spaces.find((space) => space.id === spaceId)
      if (space) {
        await oasis.updateSpaceData(space.id, {
          showInSidebar: false
        })

        await tick()

        // await archiveTab(tabId)

        await deleteTab(tabId)
      } else {
        // await archiveTab(tabId)
        await deleteTab(tabId)
      }

      toasts.success('Space removed from sidebar!')
    } catch (error) {
      log.error('Failed to remove space from sidebar:', error)
    }
  }

  const handleExcludeOtherTabsFromMagic = async (e: CustomEvent<string>) => {
    const tabId = e.detail

    // exclude all other tabs from magic
    tabs.update((x) => {
      return x.map((tab) => {
        if (tab.id !== tabId) {
          cachedMagicTabs.delete(tab.id)

          return {
            ...tab,
            magic: false
          }
        }
        return tab
      })
    })
    await preparePageTabsForChatContext()
    tick().then(() => {
      telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.ExcludeOthers,
        $magicTabs.length
      )
    })
  }

  const handleExcludeTabFromMagic = async (e: CustomEvent<string>) => {
    const tabId = e.detail

    // exclude the tab from magic
    tabs.update((x) => {
      return x.map((tab) => {
        if (tab.id === tabId) {
          cachedMagicTabs.delete(tab.id)

          return {
            ...tab,
            magic: false
          }
        }
        return tab
      })
    })
    await preparePageTabsForChatContext()
    tick().then(() => {
      telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.Remove,
        $magicTabs.length
      )
    })
  }

  const handleIncludeTabInMagic = async (e: CustomEvent<string>) => {
    const tabId = e.detail

    // include the tab in magic
    tabs.update((x) => {
      return x.map((tab) => {
        if (tab.id === tabId) {
          cachedMagicTabs.add(tab.id)

          return {
            ...tab,
            magic: true
          }
        }
        return tab
      })
    })

    await preparePageTabsForChatContext()
    tick().then(() => {
      telemetry.trackPageChatContextUpdate(PageChatUpdateContextEventAction.Add, $magicTabs.length)
    })
  }

  const toggleTabsMagic = async (on: boolean) => {
    const magicTabsArray = get(magicTabs)
    const unpinnedTabsArray = get(unpinnedTabs)
    const pinnedTabsArray = get(pinnedTabs)

    // Update the indices of the tabs in all lists
    const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }))
    let newUnpinnedTabsArray: Tab[] = []

    if (on) {
      log.debug('Toggling tabs magic on', cachedMagicTabs.values())

      if (cachedMagicTabs.size > 0) {
        log.debug('Using cached magic tabs')
        const cachedTabs = Array.from(cachedMagicTabs.values())
        cachedTabs.forEach((id) => {
          const tab = unpinnedTabsArray.find((t) => t.id === id)
          if (tab) {
            tab.magic = true
          }
        })
      } else {
        log.debug('Creating new magic tabs')
        // Move all unpinned tabs to magic tabs
        unpinnedTabsArray.forEach((tab) => {
          if (tab.type === 'page' || tab.type === 'space') {
            tab.magic = true
            cachedMagicTabs.add(tab.id)
          }
        })
      }

      newUnpinnedTabsArray = []
    } else {
      log.debug('Toggling tabs magic off')
      // Revert each magic tab to its previous state
      magicTabsArray.forEach((magicTab) => {
        magicTab.magic = false

        if (magicTab.pinned) {
          pinnedTabsArray.push(magicTab)
        } else {
          unpinnedTabsArray.push(magicTab)
        }
      })
      // Reset magic tabs array
      magicTabsArray.length = 0
      newUnpinnedTabsArray = updateIndices(unpinnedTabsArray)
    }

    const newPinnedTabsArray = updateIndices(pinnedTabsArray)
    const newMagicTabsArray = updateIndices(magicTabsArray)

    // combine all lists back together
    const newTabs = [...newUnpinnedTabsArray, ...newPinnedTabsArray, ...newMagicTabsArray]

    log.debug('Toggled tabs magic', newTabs)

    // only update the tabs that were changed (archived stay unaffected)
    tabs.update((x) => {
      return x.map((tab) => {
        const newTab = newTabs.find((t) => t.id === tab.id)
        if (newTab) {
          tab.index = newTab.index
          tab.pinned = newTab.pinned
          tab.magic = newTab.magic
        }
        return tab
      })
    })

    // Update the store with the changed tabs
    await bulkUpdateTabsStore(
      newTabs.map((tab) => ({
        id: tab.id,
        updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
      }))
    )

    log.debug('Tabs reset successfully')
  }

  const onDrop = async (event: CustomEvent<DroppedTab>, action: string) => {
    const { from, to } = event.detail
    if (!to || (from.dropZoneID === to.dropZoneID && from.index === to.index)) return

    // Get all the tab arrays
    let unpinnedTabsArray = get(unpinnedTabs)
    let pinnedTabsArray = get(pinnedTabs)
    let magicTabsArray = get(magicTabs)

    // Determine source and target lists
    let fromTabs: Tab[]
    let targetTabsArray: Tab[]

    if (from.dropZoneID === 'tabs') {
      fromTabs = unpinnedTabsArray
    } else if (from.dropZoneID === 'pinned-tabs') {
      fromTabs = pinnedTabsArray
    } else {
      fromTabs = magicTabsArray
    }

    if (to.dropZoneID === 'tabs') {
      targetTabsArray = unpinnedTabsArray
    } else if (to.dropZoneID === 'pinned-tabs') {
      targetTabsArray = pinnedTabsArray
    } else {
      targetTabsArray = magicTabsArray
    }

    const movedTab = fromTabs[from.index]
    const shouldChangeSection = from.dropZoneID !== to.dropZoneID

    log.debug('Moving tab', movedTab, from, to)

    // Remove the tab from its original position in the source list
    fromTabs.splice(from.index, 1)

    // Update pinned or magic state of the tab
    if (to.dropZoneID === 'pinned-tabs') {
      movedTab.pinned = true
      movedTab.magic = false
    } else if (to.dropZoneID === 'magic-tabs') {
      movedTab.pinned = false
      movedTab.magic = true
    } else {
      movedTab.pinned = false
      movedTab.magic = false
    }

    // Add the tab to the new position
    targetTabsArray.splice(to.index, 0, movedTab)

    // Update the indices of the tabs in all lists
    const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }))

    unpinnedTabsArray = updateIndices(unpinnedTabsArray)
    pinnedTabsArray = updateIndices(pinnedTabsArray)
    magicTabsArray = updateIndices(magicTabsArray)

    // Combine all lists back together
    const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray]

    log.debug('New tabs', newTabs)

    // Only update the tabs that were changed (archived stay unaffected)
    tabs.update((x) => {
      return x.map((tab) => {
        const newTab = newTabs.find((t) => t.id === tab.id)
        if (newTab) {
          tab.index = newTab.index
          tab.pinned = newTab.pinned
          tab.magic = newTab.magic
        }
        return tab
      })
    })

    // Update the store with the changed tabs
    await bulkUpdateTabsStore(
      newTabs.map((tab) => ({
        id: tab.id,
        updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
      }))
    )

    log.debug('State updated successfully')
  }

  const handleDragEnterSidebar = async (drag: DragculaDragEvent) => {
    drag.continue()
  }

  const handleDropSidebar = async (drag: DragculaDragEvent) => {
    log.debug('DROP DRAGCULA', drag)

    if (drag.isNative) {
      // TODO: Handle otherwise
      return
    }

    if (drag.data['oasis/resource'] !== undefined) {
      const resource = drag.data['oasis/resource']

      if (
        resource.type === 'application/vnd.space.link' ||
        resource.type === 'application/vnd.space.article'
      ) {
        let tab = await createPageTab(resource.parsedData.url, {
          active: true,
          trigger: CreateTabEventTrigger.Drop
        })
        tab.index = drag.index || 0

        await bulkUpdateTabsStore(
          get(tabs).map((tab) => ({
            id: tab.id,
            updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
          }))
        )

        log.debug('State updated successfully')
      }
      drag.continue()
      return
    }

    if (drag.data['surf/tab'] !== undefined) {
      const dragData = drag.data['surf/tab'] as Tab
      tabs.update((_tabs) => {
        let unpinnedTabsArray = get(unpinnedTabs)
        let pinnedTabsArray = get(pinnedTabs)
        let magicTabsArray = get(magicTabs)

        let fromTabs: ITab[]
        let toTabs: ITab[]

        if (drag.from.id === 'sidebar-unpinned-tabs') {
          fromTabs = unpinnedTabsArray
        } else if (drag.from.id === 'sidebar-pinned-tabs') {
          fromTabs = pinnedTabsArray
        } else if (drag.from.id === 'sidebar-magic-tabs') {
          fromTabs = magicTabsArray
        }
        if (drag.to.id === 'sidebar-unpinned-tabs') {
          toTabs = unpinnedTabsArray
        } else if (drag.to.id === 'sidebar-pinned-tabs') {
          toTabs = pinnedTabsArray
        } else if (drag.to.id === 'sidebar-magic-tabs') {
          toTabs = magicTabsArray
        }

        // CASE: to already includes tab
        if (toTabs.find((v) => v.id === dragData.id)) {
          log.warn('ONLY Update existin tab')
          const existing = fromTabs.find((v) => v.id === dragData.id)
          if (existing && drag.index !== undefined) {
            existing.index = drag.index
          }
          fromTabs.splice(
            fromTabs.findIndex((v) => v.id === dragData.id),
            1
          )
          fromTabs.splice(existing.index, 0, existing)
        } else {
          log.warn('ADDING NEW ONE')
          // Remove old
          const idx = fromTabs.findIndex((v) => v.id === dragData.id)
          if (idx > -1) {
            fromTabs.splice(idx, 1)
          }

          if (drag.to.id === 'sidebar-pinned-tabs') {
            dragData.pinned = true
            dragData.magic = false

            cachedMagicTabs.delete(dragData.id)
            telemetry.trackMoveTab(MoveTabEventAction.Pin)
          } else if (drag.to.id === 'sidebar-magic-tabs') {
            dragData.pinned = false
            dragData.magic = true

            cachedMagicTabs.add(dragData.id)

            if (dragData.type === 'page' && $activeTabMagic?.showSidebar) {
              log.debug('prepare tab for chat context after moving to magic')
              prepareTabForChatContext(dragData, dragData.title)
            }

            telemetry.trackMoveTab(MoveTabEventAction.AddMagic)
            telemetry.trackPageChatContextUpdate(
              PageChatUpdateContextEventAction.Add,
              magicTabsArray.length + 1
            )
          } else {
            if (dragData.magic) {
              telemetry.trackMoveTab(MoveTabEventAction.RemoveMagic)
              telemetry.trackPageChatContextUpdate(
                PageChatUpdateContextEventAction.Remove,
                magicTabsArray.length - 1
              )
            } else {
              telemetry.trackMoveTab(MoveTabEventAction.Unpin)
            }

            dragData.pinned = false
            dragData.magic = false
            cachedMagicTabs.delete(dragData.id)
          }

          toTabs.splice(drag.index || 0, 0, dragData)
        }

        // log.log(...pinnedTabsArray, ...unpinnedTabsArray, ...magicTabsArray)

        // Update the indices of the tabs in all lists
        const updateIndices = (tabs: ITab[]) => tabs.map((tab, index) => ({ ...tab, index }))

        unpinnedTabsArray = updateIndices(unpinnedTabsArray)
        pinnedTabsArray = updateIndices(pinnedTabsArray)
        magicTabsArray = updateIndices(magicTabsArray)

        // Combine all lists back together
        const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray]

        log.warn('New tabs', [...newTabs])

        // Update the store with the changed tabs
        bulkUpdateTabsStore(
          newTabs.map((tab) => ({
            id: tab.id,
            updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
          }))
        )

        return newTabs
      })

      await preparePageTabsForChatContext()

      log.debug('State updated successfully')
      // Mark the drop completed
      drag.continue()
    }
  }

  const handleTabDragEnd = async (drag: DragculaDragEvent) => {
    console.debug('TAB DRAG END', drag.effect)

    if (
      drag.status === 'done' &&
      drag.effect === 'move' &&
      !['sidebar-pinned-tabs', 'sidebar-unpinned-tabs', 'sidebar-magic-tabs'].includes(
        drag.to?.id || ''
      )
    ) {
      await deleteTab(drag.data['surf/tab'].id)
    }
    drag.continue()
  }

  const handleDropOnSpaceTab = async (drag: DragculaDragEvent, spaceId: string) => {
    console.warn('DROP ON SPACE TAB', spaceId, drag)

    const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)

    if (
      ['sidebar-pinned-tabs', 'sidebar-unpinned-tabs', 'sidebar-magic-tabs'].includes(
        drag.from?.id || ''
      ) &&
      !drag.metaKey
    ) {
      drag.item!.dragEffect = 'copy' // Make sure tabs are always copy from sidebar
    }

    let resourceIds: string[] = []
    if (drag.isNative) {
      log.debug('Dropped native', drag)
      const event = new DragEvent('drop', { dataTransfer: drag.data })
      log.debug('native drop drop event emulated:', event)

      const isOwnDrop = event.dataTransfer?.types.includes(MEDIA_TYPES.RESOURCE)
      if (isOwnDrop) {
        log.debug('Own drop detected, ignoring...')
        log.debug(event.dataTransfer?.files)
        return
      }

      const parsed = await processDrop(event)
      log.debug('Parsed', parsed)

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
      log.debug('Resources', newResources)

      newResources.forEach((r) => resourceIds.push(r.id))
    } else {
      try {
        const existingResources: string[] = []

        const dragData = drag.data as { 'surf/tab': Tab; 'horizon/resource/id': string }
        if (dragData['surf/tab'] !== undefined) {
          if (dragData['horizon/resource/id'] !== undefined) {
            const resourceId = dragData['horizon/resource/id']
            resourceIds.push(resourceId)
            existingResources.push(resourceId)
          } else if (dragData['surf/tab'].type === 'page') {
            const tab = dragData['surf/tab'] as TabPage

            if (tab.resourceBookmark) {
              log.debug('Detected resource from dragged tab', tab.resourceBookmark)
              resourceIds.push(tab.resourceBookmark)
              existingResources.push(tab.resourceBookmark)
            } else {
              log.debug('Detected page from dragged tab', tab)
              const newResources = await createResourcesFromMediaItems(
                resourceManager,
                [
                  {
                    type: 'url',
                    data: new URL(tab.currentLocation || tab.initialLocation),
                    metadata: {}
                  }
                ],
                ''
              )
              log.debug('Resources', newResources)
              newResources.forEach((r) => resourceIds.push(r.id))
            }
          }
        }

        if (existingResources.length > 0) {
          await Promise.all(
            existingResources.map(async (resourceId) => {
              const resource = await resourceManager.getResource(resourceId)
              if (!resource) {
                log.error('Resource not found')
                return
              }

              log.debug('Detected resource from dragged tab', resource)

              const isSilent =
                resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT) !==
                undefined
              if (isSilent) {
                // remove silent tag if it exists sicne the user is explicitly adding it
                log.debug('Removing silent tag from resource', resourceId)
                await resourceManager.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.SILENT)
              }
            })
          )
        }
      } catch {
        drag.abort()
        toast.error('Failed to add resources to space!')
        return
      }
    }

    drag.continue()
    console.warn('ADDING resources to spaceid', spaceId, resourceIds)
    if (spaceId !== 'everything') {
      await oasis.addResourcesToSpace(spaceId, resourceIds)
      //await loadSpaceContents(spaceId)
    } else {
      //await loadEverything()
    }

    toast.success(
      `Resources ${drag.isNative ? 'added' : drag.effect === 'move' ? 'moved' : 'copied'}!`
    )
  }

  function checkVisibility() {
    if (newTabButton && containerRef) {
      const containerRect = containerRef.getBoundingClientRect()
      const buttonRect = newTabButton.getBoundingClientRect()
      isFirstButtonVisible =
        buttonRect.top >= containerRect.top &&
        buttonRect.left >= containerRect.left &&
        buttonRect.bottom <= containerRect.bottom &&
        buttonRect.right <= containerRect.right
    }
  }

  afterUpdate(() => {
    checkVisibility()
  })
</script>

<SplashScreen show={$showSplashScreen} />

<svelte:window on:keydown={handleKeyDown} />

<ToastsProvider service={toasts} />

<div class="antialiased w-screen h-screen will-change-auto transform-gpu relative">
  <SidebarPane
    {horizontalTabs}
    bind:this={sidebarComponent}
    on:collapsed-left-sidebar={() => handleLeftSidebarChange(false)}
    on:expanded-left-sidebar={() => handleLeftSidebarChange(true)}
    on:collapsed-right-sidebar={() => {
      showRightSidebar = false
    }}
    on:expanded-right-sidebar={() => {
      showRightSidebar = true
    }}
    bind:rightPaneItem={rightPane}
    on:pane-update-right={handleRightPaneUpdate}
    rightSidebarHidden={!showRightSidebar}
    leftSidebarHidden={!showLeftSidebar}
  >
    <div
      slot="sidebar"
      class="flex-grow {horizontalTabs ? 'w-full h-full py-1' : 'h-full'}"
      class:magic={$magicTabs.length === 0 && $activeTabMagic?.showSidebar}
      style="z-index: 5000;"
    >
      {#if $sidebarTab !== 'oasis'}
        <div
          class="flex {!horizontalTabs
            ? 'flex-col w-full py-1.5 space-y-4 px-2 h-full'
            : 'flex-row items-center h-full ml-20 space-x-4 mr-4'} relative"
        >
          <div
            class="flex flex-row items-center flex-shrink-0 {horizontalTabs
              ? 'pl-3'
              : 'w-full justify-between pl-[4.4rem]'}"
          >
            {#if !horizontalTabs}
              <Tooltip.Root openDelay={400} closeDelay={10}>
                <Tooltip.Trigger>
                  <button
                    class="transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                    on:click={handleCollapse}
                  >
                    <span
                      class="inline-block translate-x-0 transition-transform ease-in-out duration-200"
                    >
                      <Icon name="sidebar.left" />
                    </span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  transition={flyAndScale}
                  transitionConfig={{ y: 8, duration: 150 }}
                  sideOffset={8}
                >
                  <div class="bg-neutral-100">
                    <Tooltip.Arrow class="rounded-[2px] border-l border-t border-dark-10" />
                  </div>
                  <div
                    class="flex items-center justify-center rounded-input border border-dark-10 bg-neutral-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
                  >
                    Toggle Sidebar (⌘ + B)
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>
            {/if}

            <div class="flex flex-row items-center">
              <Tooltip.Root openDelay={400} closeDelay={10}>
                <Tooltip.Trigger>
                  <button
                    class="transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 {!canGoBack
                      ? 'opacity-30 cursor-not-allowed'
                      : 'cursor-pointer'}"
                    disabled={!canGoBack}
                    on:click={$activeBrowserTab?.goBack}
                  >
                    <span
                      class="inline-block translate-x-0 {canGoBack &&
                        'group-hover:-translate-x-1'} transition-transform ease-in-out duration-200"
                    >
                      <Icon name="arrow.left" />
                    </span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  transition={flyAndScale}
                  transitionConfig={{ y: 8, duration: 150 }}
                  sideOffset={8}
                >
                  <div class="bg-neutral-100">
                    <Tooltip.Arrow class="rounded-[2px] border-l border-t border-dark-10" />
                  </div>
                  <div
                    class="flex items-center justify-center rounded-input border border-dark-10 bg-neutral-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
                  >
                    Go back (⌘ + ←)
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>

              <Tooltip.Root openDelay={400} closeDelay={10}>
                <Tooltip.Trigger>
                  <button
                    class="transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 {!canGoForward
                      ? 'opacity-30 cursor-not-allowed'
                      : 'cursor-pointer'}"
                    disabled={!canGoForward}
                    on:click={$activeBrowserTab?.goForward}
                  >
                    <span
                      class="inline-block translate-x-0 {canGoForward &&
                        'group-hover:translate-x-1'} transition-transform ease-in-out duration-200"
                    >
                      <Icon name="arrow.right" />
                    </span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  transition={flyAndScale}
                  transitionConfig={{ y: 8, duration: 150 }}
                  sideOffset={8}
                >
                  <div class="bg-neutral-100">
                    <Tooltip.Arrow class="rounded-[2px] border-l border-t border-dark-10" />
                  </div>
                  <div
                    class="flex items-center justify-center rounded-input border border-dark-10 bg-neutral-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
                  >
                    Go forward (⌘ + →)
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>

              <Tooltip.Root openDelay={400} closeDelay={10}>
                <Tooltip.Trigger>
                  <button
                    class="transform active:scale-95 appearance-none border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 {!canReload
                      ? 'opacity-30 cursor-not-allowed'
                      : 'cursor-pointer'}"
                    on:click={$activeBrowserTab?.reload}
                    disabled={!canReload}
                  >
                    <span
                      class="group-hover:rotate-180 transition-transform ease-in-out duration-200"
                    >
                      <Icon name="reload" />
                    </span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  transition={flyAndScale}
                  transitionConfig={{ y: 8, duration: 150 }}
                  sideOffset={8}
                >
                  <div class="bg-neutral-100">
                    <Tooltip.Arrow class="rounded-[2px] border-l border-t border-dark-10" />
                  </div>
                  <div
                    class="flex items-center justify-center rounded-input border border-dark-10 bg-neutral-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
                  >
                    Reload Page (⌘ + R)
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>
            </div>
          </div>

          <div
            class="bg-sky-50 my-auto rounded-xl shadow-md flex-shrink-0 overflow-x-scroll no-scrollbar"
            class:p-2={!horizontalTabs}
            class:p-0.5={horizontalTabs}
          >
            <div
              id="sidebar-pinned-tabs"
              style:view-transition-name="pinned-tabs-wrapper"
              class="flex items-center h-fit px-2 py-1"
              axis="horizontal"
              dragdeadzone="5"
              use:HTMLAxisDragZone.action={{}}
              on:Drop={handleDropSidebar}
              on:DragEnter={handleDragEnterSidebar}
            >
              {#if $pinnedTabs.length === 0}
                <div class="">Drop Tabs here to pin them.</div>
              {:else}
                {#each $pinnedTabs as tab, index (tab.id + index)}
                  <TabItem
                    hibernated={!$activatedTabs.includes(tab.id)}
                    removeHighlight={$showNewTabOverlay !== 0}
                    {tab}
                    horizontalTabs={true}
                    {activeTabId}
                    pinned={true}
                    on:select={handleTabSelect}
                    on:remove-from-sidebar={handleRemoveFromSidebar}
                    on:unarchive-tab={handleUnarchiveTab}
                    on:delete-tab={handleDeleteTab}
                    on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                    on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                  />
                {/each}
              {/if}
            </div>
          </div>

          <div
            class=" {horizontalTabs
              ? 'overflow-x-scroll space-x-2 px-3'
              : '  overflow-y-scroll space-y-2 py-3'} w-full h-full inline-flex flex-nowrap overflow-hidden no-scrollbar


              "
            class:flex-row={horizontalTabs}
            class:items-center={horizontalTabs}
            class:flex-col={!horizontalTabs}
            on:wheel={(event) => {
              if (horizontalTabs) {
                containerRef.scrollLeft += event.deltaY
              }
            }}
            on:scroll={checkScroll}
            bind:this={containerRef}
            style="
                mask-image: linear-gradient(
                  to {horizontalTabs ? 'right' : 'bottom'},
                  {$showStartMask ? 'transparent 0,' : 'black 0,'}
                  black 96px,
                  black calc(100% - 96px),
                  {$showEndMask ? 'transparent 100%' : 'black 100%'}
                );
              "
          >
            {#if $activeTabMagic}
              {#if $activeTabMagic.showSidebar}
                <div
                  class="no-scrollbar relative flex-grow flex-shrink-0 group {horizontalTabs
                    ? ''
                    : 'w-full'}"
                >
                  <div
                    class="relative rounded-xl no-scrollbar
                      {horizontalTabs
                      ? 'h-full bg-gradient-to-r from-pink-100/60 via-pink-200/80 to-pink-300/90'
                      : 'w-full bg-gradient-to-r from-sky-100/60 to-sky-200/90'}"
                  >
                    <div class={horizontalTabs ? '' : 'p-2'} class:magic={$magicTabs.length > 0}>
                      {#if horizontalTabs}
                        <div
                          id="sidebar-magic-tabs"
                          axis="horizontal"
                          class="magic-horizontal"
                          style="display: flex;"
                          dragdeadzone="5"
                          use:HTMLAxisDragZone.action={{}}
                          on:Drop={handleDropSidebar}
                          on:DragEnter={handleDragEnterSidebar}
                        >
                          {#if $magicTabs.length === 0}
                            <div class="flex flex-row items-center">
                              <div class="ai-wrapper">
                                <Icon name="ai" size={24 + 'px'} />
                              </div>
                              <span class="text-xs text-sky-800/50">
                                General mode, drop tabs here!
                              </span>
                            </div>
                          {:else}
                            {#each $magicTabs as tab, index (tab.id + index)}
                              <TabItem
                                hibernated={!$activatedTabs.includes(tab.id)}
                                removeHighlight={$showNewTabOverlay !== 0}
                                showClose
                                tabSize={Math.min(300, Math.max(96, tabSize))}
                                {tab}
                                enableEditing
                                {activeTabId}
                                pinned={false}
                                showButtons={false}
                                showExcludeOthersButton
                                on:select={() => {}}
                                bind:this={activeTabComponent}
                                on:delete-tab={handleDeleteTab}
                                on:input-enter={handleBlur}
                                on:unarchive-tab={handleUnarchiveTab}
                                on:select={handleTabSelect}
                                on:remove-from-sidebar={handleRemoveFromSidebar}
                                on:exclude-other-tabs={handleExcludeOtherTabsFromMagic}
                                on:exclude-tab={handleExcludeTabFromMagic}
                                on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                              />
                            {/each}
                          {/if}
                        </div>
                      {:else}
                        {#if $magicTabs.length > 0}
                          <div
                            class="flex flex-row gap-2 px-4 py-2 leading-5 items-center justify-center mb-1 mx-2"
                          >
                            <Icon name="sparkles" size="18" class="text-sky-800" />
                            <span class="text-sm text-sky-800"
                              >Chat with {$magicTabs.length === 1
                                ? 'this tab'
                                : $magicTabs.length === 2
                                  ? 'two tabs'
                                  : `${$magicTabs.length} tabs`}</span
                            >
                          </div>
                        {/if}
                        <div
                          id="sidebar-magic-tabs"
                          axis="vertical"
                          dragdeadzone="5"
                          use:HTMLAxisDragZone.action={{}}
                          on:Drop={handleDropSidebar}
                          on:DragEnter={handleDragEnterSidebar}
                        >
                          {#if $magicTabs.length === 0}
                            <div class="flex flex-col items-center">
                              <div class="ai-wrapper">
                                <Icon name="ai" size={24 + 'px'} />
                              </div>
                              <span class="text-xs text-sky-800">General mode, drop tabs here!</span
                              >
                            </div>
                          {:else}
                            {#each $magicTabs as tab, index (tab.id + index)}
                              <TabItem
                                hibernated={!$activatedTabs.includes(tab.id)}
                                removeHighlight={$showNewTabOverlay !== 0}
                                showClose
                                horizontalTabs={false}
                                {tab}
                                {activeTabId}
                                pinned={false}
                                showButtons={false}
                                showExcludeOthersButton
                                on:unarchive-tab={handleUnarchiveTab}
                                on:delete-tab={handleDeleteTab}
                                on:select={handleTabSelect}
                                on:remove-from-sidebar={handleRemoveFromSidebar}
                                on:exclude-other-tabs={handleExcludeOtherTabsFromMagic}
                                on:exclude-tab={handleExcludeTabFromMagic}
                                on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                              />
                            {/each}
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>

                <div
                  class="{!horizontalTabs
                    ? 'w-1/2 mx-auto h-0.5'
                    : 'h-4 w-0.5'} rounded-xl bg-sky-200"
                ></div>
              {/if}
            {/if}

            <div
              class="no-scrollbar relative h-full flex-grow w-full"
              class:space-x-2={horizontalTabs}
              class:items-center={horizontalTabs}
            >
              {#if horizontalTabs}
                <div
                  id="sidebar-unpinned-tabs"
                  class="horizontal-tabs space-x-2 h-full divide-x-2 divide-sky-300/70"
                  axis="horizontal"
                  dragdeadzone="5"
                  placeholder-size="60"
                  use:HTMLAxisDragZone.action={{}}
                  on:Drop={handleDropSidebar}
                  on:DragEnter={handleDragEnterSidebar}
                >
                  {#each $unpinnedTabs as tab, index (tab.id + index)}
                    <!-- check if this tab is active -->
                    {#if $activeTabId === tab.id}
                      <TabItem
                        hibernated={!$activatedTabs.includes(tab.id)}
                        removeHighlight={$showNewTabOverlay !== 0}
                        showClose
                        tabSize={Math.min(300, Math.max(24, tabSize))}
                        {tab}
                        {activeTabId}
                        bookmarkingInProgress={$bookmarkingInProgress}
                        bookmarkingSuccess={$bookmarkingSuccess}
                        pinned={false}
                        {spaces}
                        enableEditing
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        bind:this={activeTabComponent}
                        on:select={() => {}}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:unarchive-tab={handleUnarchiveTab}
                        on:bookmark={() => handleBookmark()}
                        on:create-live-space={handleCreateLiveSpace}
                        on:save-resource-in-space={handleSaveResourceInSpace}
                        on:include-tab={handleIncludeTabInMagic}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                      />
                    {:else}
                      <TabItem
                        showClose
                        hibernated={!$activatedTabs.includes(tab.id)}
                        {tab}
                        tabSize={Math.min(300, Math.max(24, tabSize))}
                        {activeTabId}
                        pinned={false}
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        on:select={handleTabSelect}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:unarchive-tab={handleUnarchiveTab}
                        on:include-tab={handleIncludeTabInMagic}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                      />
                    {/if}
                  {/each}
                </div>
              {:else}
                <div
                  id="sidebar-unpinned-tabs"
                  class="vertical-tabs"
                  axis="vertical"
                  dragdeadzone="5"
                  use:HTMLAxisDragZone.action={{}}
                  on:Drop={handleDropSidebar}
                  on:DragEnter={handleDragEnterSidebar}
                >
                  {#each $unpinnedTabs as tab, index (tab.id + index)}
                    <!-- check if this tab is active -->
                    {#if $activeTabId === tab.id}
                      <TabItem
                        hibernated={!$activatedTabs.includes($unpinnedTabs[index].id)}
                        removeHighlight={$showNewTabOverlay !== 0}
                        showClose
                        horizontalTabs={false}
                        {tab}
                        {activeTabId}
                        bookmarkingInProgress={$bookmarkingInProgress}
                        bookmarkingSuccess={$bookmarkingSuccess}
                        pinned={false}
                        {spaces}
                        enableEditing
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        bind:this={activeTabComponent}
                        on:select={() => {}}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:unarchive-tab={handleUnarchiveTab}
                        on:bookmark={() => handleBookmark()}
                        on:create-live-space={handleCreateLiveSpace}
                        on:save-resource-in-space={handleSaveResourceInSpace}
                        on:include-tab={handleIncludeTabInMagic}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                      />
                    {:else}
                      <TabItem
                        hibernated={!$activatedTabs.includes($unpinnedTabs[index].id)}
                        showClose
                        {tab}
                        horizontalTabs={false}
                        {activeTabId}
                        pinned={false}
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        on:select={handleTabSelect}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:unarchive-tab={handleUnarchiveTab}
                        on:include-tab={handleIncludeTabInMagic}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                      />
                    {/if}
                  {/each}
                </div>
              {/if}
              {#if !horizontalTabs}
                <div
                  style="position: absolute; top: {!horizontalTabs
                    ? 42 * $unpinnedTabs.length
                    : 0}px; left: 0px; right: 0;"
                  class:w-fit={horizontalTabs}
                  class:h-full={horizontalTabs}
                  class="select-none flex items-center justify-center"
                  class:opacity-100={isFirstButtonVisible}
                  class:opacity-0={!isFirstButtonVisible}
                  class:pointer-events-auto={isFirstButtonVisible}
                  class:pointer-events-none={!isFirstButtonVisible}
                >
                  <button
                    bind:this={newTabButton}
                    class="transform select-none active:scale-95 space-x-2 {horizontalTabs
                      ? 'w-fit rounded-xl p-2'
                      : 'w-full rounded-2xl px-4 py-3'} appearance-none select-none outline-none border-0 margin-0 group flex items-center p-2 hover:bg-sky-200 transition-colors duration-200 text-sky-800 cursor-pointer"
                    class:bg-sky-200={$showNewTabOverlay === 1}
                    on:click|preventDefault={() => createNewEmptyTab()}
                  >
                    <Icon name="add" />
                    {#if !horizontalTabs}
                      <span class="label">New Tab</span>
                    {/if}
                  </button>
                </div>
              {/if}
            </div>

            {#if horizontalTabs}
              <div
                style="position: absolute; top: 0px; left: {plusBtnLeftPos + 180}px; right: 0;"
                class:w-fit={horizontalTabs}
                class:h-full={horizontalTabs}
                class="select-none flex items-center justify-center"
                class:opacity-100={isFirstButtonVisible}
                class:opacity-0={!isFirstButtonVisible}
                class:pointer-events-auto={isFirstButtonVisible}
                class:pointer-events-none={!isFirstButtonVisible}
              >
                <button
                  bind:this={newTabButton}
                  class="transform select-none active:scale-95 space-x-2 {horizontalTabs
                    ? 'w-fit rounded-xl p-2'
                    : 'w-full rounded-2xl px-4 py-3'} appearance-none select-none outline-none border-0 margin-0 group flex items-center p-2 hover:bg-sky-200 transition-colors duration-200 text-sky-800 cursor-pointer"
                  class:bg-sky-200={$showNewTabOverlay === 1}
                  on:click|preventDefault={() => createNewEmptyTab()}
                >
                  <Icon name="add" />
                  {#if !horizontalTabs}
                    <span class="label">New Tab</span>
                  {/if}
                </button>
              </div>
            {/if}
          </div>

          <div class="flex {horizontalTabs ? 'flex-row items-center' : 'flex-col'} flex-shrink-0">
            <button
              class="transform select-none active:scale-95 space-x-2 {horizontalTabs
                ? 'w-fit rounded-xl p-2'
                : 'w-full rounded-2xl px-4 py-3'} appearance-none border-0 margin-0 group flex items-center p-2 hover:bg-sky-200 transition-colors duration-200 text-sky-800 cursor-pointer"
              on:click|preventDefault={() => createNewEmptyTab()}
              class:opacity-100={!isFirstButtonVisible}
              class:opacity-0={isFirstButtonVisible}
              class:pointer-events-auto={!isFirstButtonVisible}
              class:pointer-events-none={isFirstButtonVisible}
              class:bg-sky-200={$showNewTabOverlay === 1}
            >
              <Icon name="add" />
              {#if !horizontalTabs}
                <span class="label">New Tab</span>
              {/if}
            </button>
            <div
              class="flex flex-row flex-shrink-0 items-center mx-auto"
              class:space-x-4={!horizontalTabs}
            >
              {#if !horizontalTabs || (horizontalTabs && !showRightSidebar)}
                <CustomPopover position={horizontalTabs ? 'top' : 'bottom'}>
                  <button
                    slot="trigger"
                    class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                    on:click={() => toggleRightSidebar()}
                  >
                    <Icon name="triangle-square-circle" />
                  </button>

                  <div
                    slot="content"
                    class="flex flex-row items-center justify-center space-x-4 px-3 py-3"
                  >
                    {#each $sidebarTools as tool}
                      <button
                        class="flex flex-col items-center space-y-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        on:click={() => {
                          openRightSidebarTab(tool.id)
                        }}
                        disabled={tool.disabled}
                      >
                        <div class="p-4 rounded-xl bg-neutral-200/50 hover:bg-neutral-200">
                          <Icon name={tool.icon} class="text-xl text-neutral-800" />
                        </div>
                        <span class="text-xs">{tool.name}</span>
                      </button>
                    {/each}
                  </div>
                </CustomPopover>
              {/if}

              <button
                use:tooltip={{ text: 'Open Oasis (⌘ + O)', position: 'top' }}
                class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                on:click={() => ($showNewTabOverlay = 2)}
                class:bg-sky-200={$showNewTabOverlay === 2}
              >
                <Icon name="leave" />
              </button>
            </div>
          </div>
        </div>
      {:else}
        <!-- <OasisSidebar on:createTab={handleCreateTabFromSpace} /> -->
      {/if}
    </div>

    <div
      slot="content"
      class="h-full shadow-lg flex space-x-4 relative flex-row {horizontalTabs
        ? 'px-1.5'
        : 'py-1.5'}"
    >
      <!-- {horizontalTabs ? `pb-1.5 ${showTabs && 'pt-1.5'}` : `pr-1.5 ${showTabs && 'pl-1.5'}`}  -->
      <div
        style:view-transition-name="active-content-wrapper"
        class="w-full h-full overflow-hidden flex-grow"
        class:pb-1.5={horizontalTabs}
        class:pt-1.5={horizontalTabs && !showLeftSidebar}
        style="z-index: 0;"
        class:hasNoTab={!$activeBrowserTab}
        class:sidebarHidden={!showLeftSidebar}
      >
        <NewTabOverlay
          spaceId={'all'}
          bind:showTabSearch={$showNewTabOverlay}
          on:open-space-as-tab={handleCreateTabForSpace}
          on:deleted={handleDeletedSpace}
          on:new-tab={handleNewTab}
          {historyEntriesManager}
          activeTabs={$activeTabs}
          on:activate-tab={handleTabSelect}
          on:close-active-tab={closeActiveTab}
          on:bookmark={handleBookmark}
          on:toggle-sidebar={() => changeLeftSidebarState()}
          on:create-tab-from-space={handleCreateTabFromSpace}
          on:toggle-horizontal-tabs={debounceToggleHorizontalTabs}
          on:reload-window={() => $activeBrowserTab?.reload()}
          on:open-space={handleCreateTabForSpace}
          on:zoom={() => {
            $activeBrowserTab?.zoomIn()
          }}
          on:zoom-out={() => {
            $activeBrowserTab?.zoomOut()
          }}
          on:reset-zoom={() => {
            $activeBrowserTab?.resetZoom()
          }}
          on:open-url={(e) => {
            createPageTab(e.detail, true)
          }}
          on:open-resource={(e) => {
            openResource(e.detail)
          }}
        />

        {#if $sidebarTab === 'oasis'}
          <div class="browser-window active" style="--scaling: 1;">
            <OasisSpace
              spaceId={$selectedSpace}
              active
              on:create-resource-from-oasis={handeCreateResourceFromOasis}
              on:deleted={handleDeletedSpace}
              on:new-tab={handleNewTab}
              on:open-space-as-tab={handleCreateTabForSpace}
              hideBar={$showNewTabOverlay !== 0}
              {historyEntriesManager}
            />
          </div>
        {/if}

        {#if $showResourceDetails && $resourceDetailsModalSelected}
          <OasisResourceModalWrapper
            resourceId={$resourceDetailsModalSelected}
            on:close={() => closeResourceDetailsModal()}
            on:new-tab={handleNewTab}
          />
        {/if}

        {#each $activeTabs as tab (tab.id)}
          {#if $activatedTabs.includes(tab.id)}
            <div
              class="browser-window will-change-contents transform-gpu"
              style="--scaling: 1;"
              class:active={$activeTabId === tab.id && $sidebarTab !== 'oasis'}
              class:magic-glow-big={$activeTabId === tab.id &&
                tab.type === 'page' &&
                $activeTabMagic?.running}
            >
              <!-- {#if $sidebarTab === 'oasis'}
                {#if $masterHorizon}
                  <DrawerWrapper
                    bind:drawer={drawer}
                    horizon={$masterHorizon}
                    {resourceManager}
                    {selectedFolder}
                  />
                {:else}
                  <div>Should not happen error: Failed to load main Horizon</div>
                {/if} -->
              {#if tab.type === 'page'}
                <BrowserTab
                  active={$activeTabId === tab.id}
                  {historyEntriesManager}
                  pageMagic={$activeTabMagic}
                  bind:this={$browserTabs[tab.id]}
                  bind:tab={$tabs[$tabs.findIndex((t) => t.id === tab.id)]}
                  on:new-tab={handleNewTab}
                  on:navigation={(e) => handleWebviewTabNavigation(e, tab)}
                  on:update-tab={(e) => updateTab(tab.id, e.detail)}
                  on:open-resource={(e) =>
                    openResourceDetailsModal(e.detail, OpenResourceEventFrom.Page)}
                  on:reload-annotations={(e) => reloadAnnotationsSidebar(e.detail)}
                  on:update-page-magic={(e) => updateActiveMagicPage(e.detail)}
                  on:keydown={(e) => handleKeyDown(e.detail)}
                />
              {:else if tab.type === 'horizon'}
                {@const horizon = $horizons.find((horizon) => horizon.id === tab.horizonId)}
                {#if horizon}
                  <Horizon
                    {horizon}
                    active={$activeTabId === tab.id}
                    {visorSearchTerm}
                    inOverview={false}
                    {resourceManager}
                  />
                {:else}
                  <div>no horizon found</div>
                {/if}
              {:else if tab.type === 'chat'}
                <Chat
                  {tab}
                  {resourceManager}
                  db={storage}
                  on:navigate={(e) =>
                    createPageTab(e.detail.url, {
                      active: e.detail.active,
                      trigger: CreateTabEventTrigger.OasisChat
                    })}
                  on:updateTab={(e) => updateTab(tab.id, e.detail)}
                  on:openResource={(e) =>
                    openResourceDetailsModal(e.detail, OpenResourceEventFrom.OasisChat)}
                />
              {:else if tab.type === 'importer'}
                <Importer {resourceManager} />
              {:else if tab.type === 'oasis-discovery'}
                <OasisDiscovery {resourceManager} />
              {:else if tab.type === 'space'}
                <OasisSpace
                  spaceId={tab.spaceId}
                  active={$activeTabId === tab.id}
                  on:create-resource-from-oasis={handeCreateResourceFromOasis}
                  on:deleted={handleDeletedSpace}
                  on:new-tab={handleNewTab}
                  hideBar={$showNewTabOverlay !== 0}
                  {historyEntriesManager}
                />
              {:else if tab.type === 'history'}
                <BrowserHistory {tab} active={$activeTabId === tab.id} on:new-tab={handleNewTab} />
              {/if}
            </div>
          {/if}
        {/each}

        {#if !$activeTabs && !$activeTab}
          <div class="" style="--scaling: 1;">
            <BrowserHomescreen
              {historyEntriesManager}
              active
              on:navigate={handleTabNavigation}
              on:chat={handleCreateChat}
              on:rag={handleRag}
              on:new-tab={handleNewTab}
              {spaces}
            />
          </div>
        {/if}
      </div>
    </div>

    <Tabs.Root
      bind:value={$rightSidebarTab}
      class="h-full flex flex-col relative"
      slot="right-sidebar"
      let:minimal
    >
      <div class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100">
        <div class="flex items-center justify-start">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            role="button"
            tabindex="0"
            on:click={() => toggleRightSidebar()}
            class="flex items-center gap-2 p-1 text-sky-800/50 rounded-lg hover:bg-sky-100 hover:text-sky-800 group cursor-pointer"
          >
            <Icon name="sidebar.right" class="group-hover:hidden" size="20px" />
            <Icon name="close" class="hidden group-hover:block" size="20px" />
          </div>
        </div>

        <Tabs.List
          class="grid w-full grid-cols-3 gap-1 rounded-9px bg-dark-10 text-sm font-semibold leading-[0.01em]"
        >
          {#each $sidebarTools as tool}
            <Tabs.Trigger
              value={tool.id}
              class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center gap-2 px-2 py-3 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer opacity-75 data-[state='active']:opacity-100 data-[state='active']:bg-sky-200 hover:bg-sky-100 data-[state='active']:hover:bg-sky-200/50"
              disabled={tool.disabled}
            >
              {#if tool.icon}
                <Icon name={tool.icon} />
              {/if}

              {#if !minimal}
                <span> {tool.name}</span>
              {/if}
            </Tabs.Trigger>
          {/each}
        </Tabs.List>

        <div class="p-1">
          <div style="width: 20px; height: 20px;"></div>
        </div>
      </div>

      <Tabs.Content value="chat" class="flex-grow overflow-hidden">
        {#if $activeTab && $activeTabMagic && $activeTabMagic?.showSidebar}
          <MagicSidebar
            magicPage={activeTabMagic}
            tabsInContext={$magicTabs}
            bind:inputValue={$magicInputValue}
            on:highlightText={(e) => scrollWebviewToText(e.detail.tabId, e.detail.text)}
            on:highlightWebviewText={(e) =>
              highlightWebviewText(e.detail.resourceId, e.detail.answerText, e.detail.sourceUid)}
            on:seekToTimestamp={(e) =>
              handleSeekToTimestamp(e.detail.resourceId, e.detail.timestamp)}
            on:navigate={(e) => {
              $browserTabs[$activeTabId].navigate(e.detail.url)
            }}
            on:saveText={(e) => saveTextFromPage(e.detail, undefined, undefined, 'chat_ai')}
            on:updateActiveChatId={(e) => activeChatId.set(e.detail)}
          />
        {:else}
          <div class="w-full h-full flex items-center justify-center flex-col opacity-50">
            <Icon name="info" />
            <span>Magic chat not available</span>
          </div>
        {/if}
      </Tabs.Content>
      <Tabs.Content value="annotations" class="flex-grow overflow-hidden">
        {#if $activeTab && $activeTab.type === 'page'}
          <AnnotationsSidebar
            bind:this={annotationsSidebar}
            resourceId={$activeTab.resourceBookmark}
            on:scrollTo={handleAnnotationScrollTo}
            on:create={handleAnnotationSidebarCreate}
            on:reload={handleAnnotationSidebarReload}
          />
        {:else}
          <div class="w-full h-full flex items-center justify-center flex-col opacity-50">
            <Icon name="info" />
            <span>No page info available.</span>
          </div>
        {/if}
      </Tabs.Content>
      <Tabs.Content value="go-wild" class="flex-grow overflow-hidden">
        {#if $activeTab && $activeTab.type === 'page' && $showAppSidebar}
          <AppSidebar
            {sffs}
            appId={$activeAppId}
            tabContext={$activeAppSidebarContext}
            on:clearAppSidebar={() => handleAppSidebarClear(true)}
            on:executeAppSidebarCode={(e) =>
              handleExecuteAppSidebarCode(e.detail.appId, e.detail.code)}
          />
        {:else}
          <div class="w-full h-full flex items-center justify-center flex-col opacity-50">
            <Icon name="info" />
            <span>Go wild not available.</span>
          </div>
        {/if}
      </Tabs.Content>
    </Tabs.Root>
    <!-- {#if $activeTab && $activeTab.type === 'page' && $activeTabMagic && $activeTabMagic?.showSidebar}
        <div
          transition:slide={{ axis: 'x' }}
          class="bg-neutral-50/80 backdrop-blur-sm rounded-xl w-[440px] h-auto mb-1.5 {!showLeftSidebar &&
            'mt-1.5'} flex-shrink-0"
        >
          <MagicSidebar
            magicPage={$activeTabMagic}
            bind:inputValue={$magicInputValue}
            on:highlightText={(e) => scrollWebviewToText(e.detail.tabId, e.detail.text)}
            on:highlightWebviewText={(e) =>
              highlightWebviewText(e.detail.resourceId, e.detail.answerText)}
            on:seekToTimestamp={(e) =>
              handleSeekToTimestamp(e.detail.resourceId, e.detail.timestamp)}
            on:navigate={(e) => {
              $browserTabs[$activeTabId].navigate(e.detail.url)
            }}
            on:saveText={(e) => saveTextFromPage(e.detail, undefined, undefined, 'chat_ai')}
            on:chat={() => handleChatSubmit($activeTabMagic)}
            on:clearChat={() => handleChatClear(true)}
            on:prompt={handleMagicSidebarPromptSubmit}
          />
        </div>
      {:else if $showAppSidebar}
        <div
          transition:slide={{ axis: 'x' }}
          class="bg-neutral-50/80 backdrop-blur-sm rounded-xl w-[440px] h-auto mb-1.5 {!showLeftSidebar &&
            'mt-1.5'} flex-shrink-0"
        >
          <AppSidebar
            {sffs}
            appId={$activeAppId}
            tabContext={$activeAppSidebarContext}
            on:clearAppSidebar={() => handleAppSidebarClear(true)}
            on:executeAppSidebarCode={(e) =>
              handleExecuteAppSidebarCode(e.detail.appId, e.detail.code)}
          />
        </div>
      {:else if $showAnnotationsSidebar && $activeTab?.type === 'page'}
        <div
          transition:slide={{ axis: 'x' }}
          class="bg-neutral-50/80 backdrop-blur-sm rounded-xl w-[440px] h-auto mb-1.5 {!showLeftSidebar &&
            'mt-1.5'} flex-shrink-0"
        >
          <AnnotationsSidebar
            bind:this={annotationsSidebar}
            resourceId={$activeTab.resourceBookmark}
            on:scrollTo={handleAnnotationScrollTo}
            on:create={handleAnnotationSidebarCreate}
            on:reload={handleAnnotationSidebarReload}
          />
        </div>
      {/if} -->
  </SidebarPane>
</div>

<style lang="scss">
  /// DRAGCULA STATES NOTE: these should be @horizon/dragcula/dist/styles.css import, but this doesnt work currently!
  :global(::view-transition-group(*)) {
    animation-duration: 280ms;
    animation-timing-function: cubic-bezier(0, 1, 0.41, 0.99);
  }

  :global(.dragcula-drop-indicator) {
    --color: #3765ee;
    --dotColor: white;
    --inset: 2%;
    background: var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical) {
    left: var(--inset);
    right: var(--inset);
    height: 2px;
    transform: translateY(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal) {
    top: var(--inset);
    bottom: var(--inset);
    width: 2px;
    transform: translateX(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical::before) {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical::after) {
    content: '';
    position: absolute;
    top: 0;
    right: -6px;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::before) {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::after) {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  /// === END OF MAXU DRAGCULA STUFF

  // Disables pointer events on all body elements if a drag operation is active
  // except, other drag zones.
  :global(body[data-dragcula-dragging='true'] *:not([data-dragcula-zone])) {
    pointer-events: none;
  }

  :global(body[data-dragcula-dragging='true'] *[data-dragcula-zone]) {
    pointer-events: all;
  }

  // Disables pointer events on all elements inside a drop target
  // except, nested drag zones.
  // This is also useful when supporting native dnd, as there won't
  // be a body class!
  :global(body[data-dragcula-dragging='true'] *[data-dragcula-zone] *:not([data-dragcula-zone])) {
    pointer-events: none;
  }
  :global(body[data-dragcula-dragging='true'] *[data-dragcula-zone] *[data-dragcula-zone]) {
    pointer-events: all;
  }
  :global([data-dragcula-dragging-item='true']) {
  }

  // Disable the zone of the drag item itself
  :global(body *[data-dragcula-dragging-item]) {
    pointer-events: none !important;
  }

  :global(
      body[data-dragcula-target]:not(
          [data-dragcula-target^='sidebar']
        )[data-dragcula-drag-effect='copy']
    ) {
    cursor: copy;
  }

  /*:global(body[data-dragcula-dragging='true']) {
    cursor: grabbing;
    user-select: none;
  }*/
  /*:global(body[data-dragcula-dragging='true'] *:not([data-dragcula-zone])) {
    pointer-events: none;
  }
  :global(body[data-dragcula-dragging='true'] *[data-dragcula-zone]) {
    pointer-events: all;
  }*/
  :global([data-dragcula-zone][axis='vertical']) {
    // This is needed to prevent margin collapse when the first child has margin-top. Without this, it will move the container element instead.
    padding-top: 1px;
    margin-top: -1px;
  }
  :global([data-dragcula-zone='sidebar-pinned-tabs']) {
    min-height: 24px;
  }
  :global(.magic-tabs-wrapper [data-dragcula-zone]) {
    min-height: 4rem !important;
    height: fit-content !important;
  }
  /*:global(div[data-dragcula-zone]) {
    overflow: visible !important;
    background: transparent !important;
  }*/

  .messi {
    backdrop-filter: blur(10px);
  }
  .hide-btn {
    display: none !important;
    background-color: transparent;
  }

  .sidebar {
    &.magic {
      background: linear-gradient(0deg, #ffeffd 0%, #ffe5fb 4.18%),
        linear-gradient(180deg, #fef4fe 0%, #fff0fa 10.87%),
        radial-gradient(41.69% 35.32% at 16.92% 87.63%, rgba(255, 208, 232, 0.85) 0%, #fee6f5 100%),
        linear-gradient(129deg, #fef7fd 0.6%, #ffe8ef 44.83%, #ffe3f4 100%), #fff;
      background: linear-gradient(
          0deg,
          color(display-p3 0.9922 0.9412 0.9879) 0%,
          color(display-p3 0.9843 0.902 0.9775 / 0) 4.18%
        ),
        linear-gradient(
          180deg,
          color(display-p3 0.9892 0.9569 0.9922) 0%,
          color(display-p3 0.9922 0.9451 0.9796 / 0) 10.87%
        ),
        radial-gradient(
          41.69% 35.32% at 16.92% 87.63%,
          color(display-p3 0.9735 0.8222 0.9054 / 0.85) 0%,
          color(display-p3 0.9804 0.9059 0.958 / 0) 100%
        ),
        linear-gradient(
          129deg,
          color(display-p3 0.9922 0.9686 0.9906) 0.6%,
          color(display-p3 0.9922 0.9137 0.9373) 44.83%,
          color(display-p3 0.9882 0.8941 0.9522) 100%
        ),
        color(display-p3 1 1 1);
      box-shadow: 0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1);
      box-shadow: 0px 0.933px 2.8px 0px color(display-p3 0 0 0 / 0.1);
    }
  }

  .sidebar-magic-toggle {
    z-index: 100000;
    background: rgba(175, 238, 238, 0.292);
    border-radius: 8px;
    padding: 0.7rem;
    cursor: pointer;
    border-top: 1px solid #e4e2d4;
    border-bottom: 1px solid #e4e2d4;
    border-left: 1px solid #e4e2d4;
  }

  .sidebar-annotations-toggle {
    right: 0.45rem;
    z-index: 100000;
    background: rgba(175, 238, 238, 0.292);
    border-radius: 8px;
    padding: 0.7rem;
    cursor: pointer;
    border-top: 1px solid #e4e2d4;
    border-bottom: 1px solid #e4e2d4;
    border-left: 1px solid #e4e2d4;
  }

  .sidebar-magic {
    flex: 1;
    width: 300px;
    z-index: 1;
    height: 96%;
  }
  :global(.magic-horizontal .tab) {
    flex: 1 1 0px;
    min-width: 120px;
  }

  .browser-window-wrapper {
    flex: 1;
    padding: 0rem 0.4rem 0.4rem 0.4rem;
    height: 100vh;
    position: relative;

    &.sidebarHidden {
      padding: 0.4rem;
    }
  }

  .browser-window {
    height: 100%;
    width: 100%;
    border-radius: 0.5rem;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    position: absolute;
    top: 0;
    opacity: 0;

    &.active {
      z-index: 1;
      position: relative;
      opacity: 100%;
    }

    :global(webview) {
      height: 100%;
      width: 100%;
      border-radius: 0.5rem;
      overflow: hidden;
    }
  }
  .link-preview-content {
    padding: 0.4rem;
    border-radius: 0.375rem;
    background-color: paleturquoise;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .address-bar-wrapper {
    border-radius: 12px;
    padding: 0.5rem;
    background: paleturquoise;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
    gap: 15px;
    position: relative;
    z-index: 50000;
  }

  .address-bar-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .popover-content {
    background-color: red;
    width: 100vh;
    height: 100vh;
  }

  .bar-wrapper {
    width: 100%;
    margin-top: 0.5rem;

    .hitarea {
      position: absolute;
      z-index: 30000;
      top: -1rem;
      width: 100%;
      height: 5rem;
      background: red;
    }

    button {
      appearance: none;
      border: none;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-radius: 5px;
      cursor: pointer;

      background-color: #fff;
      padding: 10px;

      &:hover {
        background: #eeece0;
      }
    }
  }

  #sidebar-pinned-tabs {
    gap: 4px;
  }

  input {
    flex: 1;
    width: 400px;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 1rem;
    background-color: rgb(218, 239, 239);
    color: #3f3f3f;

    &:hover {
      background: #eeece0;
    }

    &:focus {
      outline: none;
      border-color: #f73b95;
      color: #000;
      background-color: rgb(218, 239, 239);
    }
  }

  .hide {
    display: none;
  }

  .hover-line {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 15px;
    z-index: 10000;
    width: 100%;
    transition: height 0.2s ease-in-out;
    &:after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      height: 10px;
      border-radius: 5px;
      /* background-color: #f73b95; */
      width: 30rem;
    }

    .line {
      height: 5px;
      border-radius: 5px;
      background-color: #ccc;
      width: 4rem;
    }
  }

  .masked-scroll-container {
    --mask-direction: to right;
    --mask-size: 100% 100%;
    --mask-repeat: no-repeat;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .masked-content {
    width: 100%;
    height: 100%;
    -webkit-mask-image: linear-gradient(
      var(--mask-direction),
      transparent,
      black 2%,
      black 98%,
      transparent
    );
    -webkit-mask-size: var(--mask-size);
    -webkit-mask-repeat: var(--mask-repeat);
    mask-image: linear-gradient(
      var(--mask-direction),
      transparent,
      black 2%,
      black 98%,
      transparent
    );
    mask-size: var(--mask-size);
    mask-repeat: var(--mask-repeat);
  }
  .masked-content.horizontal {
    overflow-x: auto;
    overflow-y: hidden;
  }
  .masked-content.vertical {
    overflow-x: hidden;
    overflow-y: auto;
  }
  /* Hide scrollbar for Chrome, Safari and Opera */
  .masked-content::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .masked-content {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }

  .tabs {
    position: relative;
    flex: 1;
    overflow: auto;
    gap: 0.5rem;
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-left: 8rem;
    width: 100%;
    h2 {
      font-size: 1.1rem;
      font-weight: 500;
      margin-top: 15px;
      margin-bottom: 10px;
      color: #a9a9a9;
    }

    #tabs {
      overflow-x: auto;
    }

    .unpinned-tabs-wrapper {
      display: flex;
      flex-direction: row;
      align-items: center;
      overflow-y: hidden;
      -ms-overflow-style: none;
      scrollbar-width: none;
      position: relative;
      max-width: calc(100% - 120px);
    }

    .unpinned-tabs-wrapper::-webkit-scrollbar {
      display: none;
    }

    .magic-tabs-wrapper {
      border-radius: 12px;
      // padding: 0.5rem;
      border: 1px dashed rgba(88, 81, 48, 0.4);

      &.magic {
        background: linear-gradient(0deg, #ffeffd 0%, #ffe5fb 4.18%),
          linear-gradient(180deg, #fef4fe 0%, #fff0fa 10.87%),
          radial-gradient(
            41.69% 35.32% at 16.92% 87.63%,
            rgba(255, 208, 232, 0.85) 0%,
            #fee6f5 100%
          ),
          linear-gradient(129deg, #fef7fd 0.6%, #ffe8ef 44.83%, #ffe3f4 100%), #fff;
        background: linear-gradient(
            0deg,
            color(display-p3 0.9922 0.9412 0.9879) 0%,
            color(display-p3 0.9843 0.902 0.9775 / 0) 4.18%
          ),
          linear-gradient(
            180deg,
            color(display-p3 0.9892 0.9569 0.9922) 0%,
            color(display-p3 0.9922 0.9451 0.9796 / 0) 10.87%
          ),
          radial-gradient(
            41.69% 35.32% at 16.92% 87.63%,
            color(display-p3 0.9735 0.8222 0.9054 / 0.85) 0%,
            color(display-p3 0.9804 0.9059 0.958 / 0) 100%
          ),
          linear-gradient(
            129deg,
            color(display-p3 0.9922 0.9686 0.9906) 0.6%,
            color(display-p3 0.9922 0.9137 0.9373) 44.83%,
            color(display-p3 0.9882 0.8941 0.9522) 100%
          ),
          color(display-p3 1 1 1);
        box-shadow: 0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1);
        box-shadow: 0px 0.933px 2.8px 0px color(display-p3 0 0 0 / 0.1);
      }
    }

    .add-tab-button {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 1.125rem;
      border: 0;
      background: transparent;
      border-radius: 12px;

      &:hover {
        background-color: #d1dae0;
      }
      .label {
        flex: 1;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 1.1rem;
        color: #7d7448;
        font-weight: 500;
        letter-spacing: 0.0025em;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    }
  }

  .pinned-tabs-wrapper {
    position: relative;
    gap: 1rem;

    background: #f7f7f7;
    border-radius: 18px;

    background: #f7f7f7;
    border-radius: 12px;
    overflow-y: visible;
    box-shadow:
      0px 0px 32px -1px rgba(0, 0, 0, 0.05),
      0px 14px 4px 0px #000,
      0px 9px 3px 0px rgba(0, 0, 0, 0.01),
      0px 5px 3px 0px rgba(0, 0, 0, 0.03),
      0px 2px 2px 0px rgba(0, 0, 0, 0.06),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07);

    box-shadow:
      0px 0px 32px -1px color(display-p3 0 0 0 / 0.05),
      0px 14px 4px 0px color(display-p3 0 0 0 / 0),
      0px 9px 3px 0px color(display-p3 0 0 0 / 0.01),
      0px 5px 3px 0px color(display-p3 0 0 0 / 0.03),
      0px 2px 2px 0px color(display-p3 0 0 0 / 0.06),
      0px 1px 1px 0px color(display-p3 0 0 0 / 0.07);

    .description-text {
      opacity: 0.4;
    }
  }
  :global([data-dragcula-zone='sidebar-pinned-tabs']) {
    height: fit-content !important;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  :global([data-dragcula-zone='sidebar-unpinned-tabs'].vertical-tabs) {
    min-height: 100%;
    height: auto;
  }
  :global([data-dragcula-zone='sidebar-unpinned-tabs'].horizontal-tabs) {
    min-width: 100%;
    width: auto;
    display: flex;
    flex-direction: row;
  }
  :global(.tab[data-dragcula-dragging]) {
    background: white;
  }

  .divider {
    margin: 10px 8px;
    border-bottom: 1px solid #cacaca;
  }

  .icon-wrapper {
    width: 20px;
    height: 20px;
    display: block;
  }

  .tab {
    transition:
      0.2s ease-out,
      transform 0ms;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;

    button {
      appearance: none;
      border: none;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-radius: 5px;
      cursor: pointer;

      &:not(.nav-button) {
        flex: 1;
        background-color: transparent;
        padding: 10px;
      }

      &.nav-button {
        padding: 5px;
        background: none;
        color: #5e5e5e;

        &:disabled {
          color: #a9a9a9;
        }
      }

      &:hover {
        background: #eeece0;
      }
    }
  }

  .nav-buttons {
    position: absolute;
    z-index: 10000;
    top: 50%;
    transform: translateY(-50%);
    right: 3.5rem;
    width: min-content;
    margin: 0;
  }

  .page-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 10px;
    background-color: #fdf2f7;
    border-radius: 5px;
  }

  .icon-button {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    appearance: none;
    background: none;
    outline: none;
    border: none;
  }

  .tabs-list {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .tab-selector {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    z-index: 10;
    padding-top: 5px;
    padding-bottom: 5px;

    button {
      flex: 1;
      appearance: none;
      border: none;
      background: none;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      cursor: pointer;
      font-size: 1rem;
      color: #777777;
      padding: 10px;

      &.active {
        color: #000;
        font-weight: 500;
      }

      &:hover {
        color: #000;
      }
    }
  }

  .action-back-to-tabs {
    flex: none !important;
    flex-shrink: 0;
    padding-right: 1rem !important;

    .label {
      letter-spacing: 0.04rem;
    }
  }

  // :global(citation) {
  //   display: inline-flex;
  //   align-items: center;
  //   justify-content: center;
  //   width: 1.75rem;
  //   height: 1.75rem;
  //   font-size: 0.9rem;
  //   font-weight: 500;
  //   background: rgb(226 240 255);
  //   border: 1px solid rgb(183 198 218);
  //   border-radius: 100%;
  //   user-select: none;
  //   cursor: pointer;
  //   overflow: hidden;
  // }

  .tab-bar-selector {
    display: flex;
    flex-direction: row;
  }

  :global(.magic-tabs-wrapper [data-dragcula-zone]) {
    min-height: 4rem !important;
    height: fit-content !important;
  }

  .debug {
    display: flex;
    align-items: center;
    span {
      background: transparent;
      font-weight: 500;
      outline: none;
      width: fit-content;
    }
  }

  .ai-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(32px);
    height: calc(32px);
    background-repeat: no-repeat;
    background-position: center center;
    background-size: 86%;
    background-image: url('../../../../../core/public/assets/ai.png');
    z-index: 10;
    &:before {
      content: '';
      position: absolute;
      width: 60%;
      height: 60%;
      z-index: -1;
      border-radius: 50%;
      mix-blend-mode: soft-light;
      background: #ffffff;
    }
    &:after {
      content: '';
      position: absolute;
      width: 60%;
      height: 60%;
      z-index: -1;
      opacity: 0.8;
      border-radius: 50%;
      mix-blend-mode: soft-light;
      background: #ffffff;
    }
  }

  .create-space-btn {
    background: #f73b95;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px;
    cursor: pointer;
    margin-top: 1rem;
    font-size: 1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }
</style>
