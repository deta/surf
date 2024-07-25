<svelte:options immutable={true} />

<script lang="ts">
  import { afterUpdate, onMount, setContext, tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import { tooltip } from '@svelte-plugins/tooltips'
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
  import { Telemetry } from '../../service/telemetry'
  import { useDebounce } from '@horizon/core/src/lib/utils/debounce'
  import { processDrop } from '../../service/mediaImporter'

  import { ResourceTag, createResourceManager } from '../../service/resources'

  import { type Space, type SpaceSource } from '../../types'

  import { HorizonsManager } from '../../service/horizon'
  import { API } from '../../service/api'
  import BrowserTab, { type BrowserTabNewTabEvent } from './BrowserTab.svelte'
  import Horizon from '../Horizon/Horizon.svelte'
  import BrowserHomescreen from './BrowserHomescreen.svelte'
  import OasisSidebar from '../Oasis/OasisSidebar.svelte'
  import TabItem from './Tab.svelte'
  import TabSearch from './TabSearch.svelte'
  import { type ShortcutMenuEvents } from '../Shortcut/ShortcutMenu.svelte'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'
  import '../../../app.css'

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
    TabHistory
  } from './types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../Cards/Browser/searchEngines'
  import type { Drawer } from '@horizon/drawer'
  import Chat from './Chat.svelte'
  import { HorizonDatabase } from '../../service/storage'
  import type { Optional } from '../../types'
  import { useLocalStorageStore } from '../../utils/localstorage'
  import { WebParser } from '@horizon/web-parser'
  import Importer from './Importer.svelte'
  import OasisDiscovery from './OasisDiscovery.svelte'
  import { parseChatResponseSources } from '../../service/ai'
  import MagicSidebar from './MagicSidebar.svelte'
  import AppSidebar from './AppSidebar.svelte'
  import {
    ResourceTagsBuiltInKeys,
    WebViewEventReceiveNames,
    type AnnotationCommentData,
    type ResourceDataAnnotation,
    type WebViewEventAnnotation
  } from '@horizon/types'
  import { scrollToTextCode } from './inline'
  import { SFFS } from '../../service/sffs'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { provideOasis } from '../../service/oasis'
  import OasisSpace from '../Oasis/OasisSpace.svelte'

  import AnnotationsSidebar from './AnnotationsSidebar.svelte'
  import ToastsProvider from '../Toast/ToastsProvider.svelte'
  import { provideToasts } from '../../service/toast'
  import {
    PromptIDs,
    getPrompt,
    getPrompts,
    resetPrompt,
    updatePrompt
  } from '../../service/prompts'
  import { LinkPreview, Popover, Tooltip } from 'bits-ui'
  import BrowserHistory from './BrowserHistory.svelte'
  import NewTabButton from './NewTabButton.svelte'
  import { flyAndScale } from '../../utils'
  import {
    HTMLDragZone,
    DragItem,
    type DragOperation,
    type DragculaDragEvent,
    type IndexedDragculaDragEvent
  } from '@horizon/dragcula'
  //import '@horizon/dragcula/dist/styles.scss'

  let activeTabComponent: TabItem | null = null
  let drawer: Drawer
  let observer: IntersectionObserver
  let addressBarFocus = false
  let showTabSearch = false
  let showTabs = true
  let annotationsSidebar: AnnotationsSidebar
  let isFirstButtonVisible = true
  let newTabButton: Element
  let containerRef: Element

  let telemetryAPIKey = ''
  let telemetryActive = false
  if (import.meta.env.PROD) {
    telemetryAPIKey = import.meta.env.R_VITE_TELEMETRY_API_KEY
    telemetryActive = true
  }

  const telemetry = new Telemetry({
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

  const tabsDB = storage.tabs
  const horizons = horizonManager.horizons
  const historyEntriesManager = horizonManager.historyEntriesManager
  const spaces = oasis.spaces
  const selectedSpace = oasis.selectedSpace

  const masterHorizon = derived(horizons, (horizons) => horizons[0])

  const log = useLogScope('Browser')

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
  const activeTabMagic = writable<PageMagic>()
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
    return tabs.filter((tab) => tab.magic).sort((a, b) => a.index - b.index)
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

  $: canGoBack = $activeTab?.type === 'page' && $activeTab?.currentHistoryIndex > 0
  $: canGoForward =
    $activeTab?.type === 'page' &&
    $activeTab?.currentHistoryIndex < $activeTab.historyStackIds.length - 1

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

  const openResourceDetailsModal = (resourceId: string) => {
    resourceDetailsModalSelected.set(resourceId)
    showResourceDetails.set(true)
  }

  const closeResourceDetailsModal = () => {
    showResourceDetails.set(false)
    resourceDetailsModalSelected.set(null)
  }

  const getSpace = (id: string) => {
    return $spaces.find((space) => space.id === id)
  }

  const makeTabActive = (tabId: string) => {
    activeTabId.set(tabId)
    addToActiveTabsHistory(tabId)
    activeAppId.set('')
    showAppSidebar.set(false)
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
    tab: Optional<T, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'pinned' | 'index' | 'magic'>
  ) => {
    const newTab = await tabsDB.create({
      archived: false,
      pinned: false,
      magic: false,
      index: Date.now(),
      ...tab
    })
    log.debug('Created tab', newTab)
    tabs.update((tabs) => [...tabs, newTab])

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
    await deleteTab(e.detail)
  }

  const deleteTab = async (tabId: string) => {
    const tab = $tabs.find((tab) => tab.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    const activeTabIndex = $activeTabs.findIndex((tab) => tab.id === tabId)

    tabs.update((tabs) => tabs.filter((tab) => tab.id !== tabId))
    activeTabsHistory.update((history) => history.filter((id) => id !== tabId))

    await tick()

    if ($activeTabId === tabId) {
      makePreviousTabActive(activeTabIndex)
    }

    await tabsDB.delete(tabId)

    observer.unobserve(newTabButton)
    observer.observe(newTabButton)
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

  const closeActiveTab = async () => {
    if (!$activeTab) {
      log.error('No active tab')
      return
    }
    await deleteTab($activeTab.id)

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
    const newTab = await createPageTab(e.detail, true)

    // Since we dont have the webview available right here, we need to wait a bit before we can handle the bookmark
    await wait(10000)

    if (newTab) {
      await handleBookmark()
    }
  }

  const toggleOasis = () => {
    if (drawer.isShown()) {
      drawer.close()
    } else {
      drawer.open()
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

  const createHistoryTab = useDebounce(async () => {
    log.debug('Creating new history tab')

    // check if there already exists a history tab, if yes we just change to it

    const historyTab = $tabs.find((tab) => tab.type === 'history')

    if (historyTab) {
      makeTabActive(historyTab.id)
      return
    }

    const newTab = await createTab<TabHistory>({
      title: 'History',
      icon: '',
      type: 'history'
    })

    makeTabActive(newTab.id)
  }, 200)

  let keyBuffer = ''
  let index: number
  let keyTimeout: any
  const KEY_TIMEOUT = 120
  const MAX_TABS = 99

  let horizontalTabs = false

  // fix the syntax error
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && addressBarFocus) {
      handleBlur()
      activeTabComponent?.blur()
    } else if (isModKeyPressed(e) && e.shiftKey && e.key === 'c') {
      handleCopyLocation()
    } else if (isModKeyPressed(e) && e.key === 't') {
      debouncedCreateNewEmptyTab()
    } else if (isModKeyAndKeyPressed(e, 'o')) {
      toggleOasis()
    } else if (isModKeyAndKeyPressed(e, 'w')) {
      closeActiveTab()
      // } else if (isModKeyAndKeyPressed(e, 'p')) {
      // setActiveTabAsPinnedTab()
    } else if (isModKeyAndKeyPressed(e, 'd')) {
      handleBookmark()
    } else if (isModKeyAndKeyPressed(e, 'g')) {
      sidebarTab.set('active')
    } else if (isModKeyAndShiftKeyAndKeyPressed(e, 'h')) {
      // horizontalTabs = !horizontalTabs
      debounceToggleHorizontalTabs()
      log.debug('horizontalTabs', horizontalTabs)
    } else if (isModKeyAndKeyPressed(e, 'h')) {
      showTabs = !showTabs
      log.debug('showTabs', showTabs)
      // @ts-ignore
      window.api.updateTrafficLightsVisibility(showTabs)
    } else if (isModKeyAndKeyPressed(e, 'n')) {
      handleNewHorizon()
    } else if (isModKeyAndKeyPressed(e, 'r')) {
      $activeBrowserTab?.reload()
    } else if (isModKeyAndKeyPressed(e, 'i')) {
      createImporterTab()
    } else if (isModKeyAndKeyPressed(e, 'e')) {
      createOasisDiscoveryTab()
    } else if (e.ctrlKey && e.key === 'Tab') {
      debouncedCycleActiveTab(e.shiftKey)
    } else if (isModKeyAndKeyPressed(e, 'l')) {
      activeTabComponent?.editAddress()
      handleFocus()
    } else if (isModKeyAndKeyPressed(e, 'j')) {
      showTabSearch = true
    } else if (isModKeyAndKeyPressed(e, 'y')) {
      createHistoryTab()
    } else if (isModKeyAndKeyPressed(e, '+')) {
      $activeBrowserTab?.zoomIn()
    } else if (isModKeyAndKeyPressed(e, '-')) {
      $activeBrowserTab?.zoomOut()
    } else if (isModKeyAndKeyPressed(e, '0')) {
      $activeBrowserTab?.resetZoom()
    } else if (isModKeyAndKeysPressed(e, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])) {
      keyBuffer = (keyBuffer || '') + e.key
      clearTimeout(keyTimeout)

      keyTimeout = setTimeout(() => {
        index = parseInt(keyBuffer, 10)

        if (index > 99) {
          index /= 10
        }
        keyBuffer = '' // Reset buffer

        if (!isNaN(index) && index >= 0 && index <= MAX_TABS) {
          const tabs = [...$pinnedTabs, ...$unpinnedTabs]
          if (index > tabs.length) {
            return
          }
          if (index <= tabs.length) {
            makeTabActive(tabs[index - 1].id)
          }
        }
      }, KEY_TIMEOUT)
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

  const handleToggleHorizontalTabs = () => {
    const t = document.startViewTransition(() => {
      horizontalTabs = !horizontalTabs
    })
  }

  const debounceToggleHorizontalTabs = useDebounce(handleToggleHorizontalTabs, 100)

  const handleAddressBarKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      showURLBar.set(!showURLBar)
    }
  }

  const handleNewHorizon = async () => {
    log.debug('Creating new horizon')

    const newHorizon = await horizonManager.createHorizon('New Horizon ' + $horizons.length + 1)
    log.debug('New Horizon', newHorizon)

    newHorizon.tint.set('#' + Math.floor(Math.random() * 16777215).toString(16) + '80')

    await horizonManager.switchHorizon(newHorizon.id)

    await tick()

    const newTab = await createTab<TabHorizon>({
      horizonId: newHorizon.id,
      title: newHorizon.data.name,
      icon: '',
      type: 'horizon'
    })

    makeTabActive(newTab.id)
    addressValue.set(newHorizon.data.name)
  }

  const createNewEmptyTab = async () => {
    log.debug('Creating new tab')

    // check if there already exists an empty tab, if yes we just change to it
    const emptyTab = $tabs.find((tab) => tab.type === 'empty')

    if (emptyTab) {
      makeTabActive(emptyTab.id)
      return
    }

    const newTab = await createTab<TabEmpty>({ title: 'New Tab', icon: '', type: 'empty' })
    makeTabActive(newTab.id)
  }

  const debouncedCreateNewEmptyTab = useDebounce(createNewEmptyTab, 100)

  const createPageTab = async (url: string, active = true): Promise<Tab> => {
    log.debug('Creating new page tab')
    const newTab = await createTab<TabPage>({
      title: url,
      icon: '',
      type: 'page',
      initialLocation: url,
      historyStackIds: [],
      currentHistoryIndex: -1,
      index: 0,
      pinned: false
    })

    if (active) {
      makeTabActive(newTab.id)
    }

    return newTab
  }

  const createChatTab = async (query: string, active = true) => {
    log.debug('Creating new chat tab')
    const newTab = await createTab<TabChat>({ title: query, icon: '', type: 'chat', query: query })

    if (active) {
      makeTabActive(newTab.id)
    }
  }

  const createImporterTab = async () => {
    log.debug('Creating new importer tab')
    const newTab = await createTab<TabImporter>({
      title: 'Importer',
      icon: '',
      type: 'importer',
      index: 0,
      pinned: false,
      magic: false
    })

    makeTabActive(newTab.id)
  }

  const createOasisDiscoveryTab = async () => {
    log.debug('Creating new oasis discovery tab')
    const newTab = await createTab<TabOasisDiscovery>({
      title: 'Oasis Discovery',
      icon: '',
      type: 'oasis-discovery',
      magic: false
    })
    makeTabActive(newTab.id)
  }

  const handleNewTab = (e: CustomEvent<BrowserTabNewTabEvent>) => {
    const { url, active } = e.detail

    if (url) {
      createPageTab(url, active)
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
        makeTabActive(ordered[0].id)
      } else {
        makeTabActive(ordered[nextTabIndex].id)
      }
    } else {
      const previousTabIndex = activeTabIndex - 1
      if (previousTabIndex < 0) {
        makeTabActive(ordered[ordered.length - 1].id)
      } else {
        makeTabActive(ordered[previousTabIndex].id)
      }
    }
  }
  const debouncedCycleActiveTab = useDebounce(cycleActiveTab, 100)

  const openUrlHandler = (url: string) => {
    log.debug('open url', url)

    createPageTab(url, true)
  }

  const handleTabNavigation = (e: CustomEvent<string>) => {
    log.debug('Navigating to', e.detail)
    updateActiveTab({
      type: 'page',
      initialLocation: e.detail,
      historyStackIds: [],
      currentHistoryIndex: -1
    })
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

    makeTabActive(newId)
  }

  async function handleBookmark() {
    try {
      if (!$activeTabLocation || $activeTab?.type !== 'page') return

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

            // mark resource as not silent since the user is explicitely bookmarking it
            await resourceManager.deleteResourceTag(
              $activeTab.resourceBookmark,
              ResourceTagsBuiltInKeys.SILENT
            )

            bookmarkingSuccess.set(true)

            // if (openAfter) {
            //   openResource($activeTab.resourceBookmark)
            // }

            updateTab($activeTabId, { resourceBookmarkedManually: true })

            return $activeTab.resourceBookmark
          }
        }
      }

      const resource = await $activeBrowserTab.bookmarkPage(false)

      // automatically resets after some time
      toasts.success('Bookmarked Page!')
      bookmarkingSuccess.set(true)

      // if (openAfter) {
      //   openResource(resource.id)
      // }

      return resource.id
    } catch (e) {
      log.error('error creating resource', e)
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
    activeTabMagic.update((magic) => {
      return {
        ...magic,
        ...updates
      }
    })
  }

  function addPageMagicResponse(response: AIChatMessageParsed) {
    activeTabMagic.update((magic) => {
      return {
        ...magic,
        responses: [...magic.responses, response]
      }
    })
  }

  function updatePageMagicResponse(responseId: string, updates: Partial<AIChatMessageParsed>) {
    activeTabMagic.update((magic) => {
      return {
        ...magic,
        responses: magic.responses.map((response) => {
          if (response.id === responseId) {
            return {
              ...response,
              ...updates
            }
          }

          return response
        })
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
    sourceHash?: string
  ) => {
    log.info('highlighting text', resourceId, answerText, sourceHash)
    for (const tab of getTabsInChatContext()) {
      const t = tab as TabPage
      if (t.resourceBookmark === resourceId) {
        const browserTab = $browserTabs[t.id]
        if (!browserTab) {
          log.error('Browser tab not found', t.id)
          return
        }
        makeTabActive(t.id)
        if (answerText === '') {
          if (sourceHash) {
            const source = await sffs.getAIChatDataSource(sourceHash)
            if (source) {
              answerText = source.content
            } else {
              return
            }
          } else {
            return
          }
        }
        const detectedResource = await browserTab.detectResource()
        if (!detectedResource) {
          log.error('no resource detected')
          alert('Error: no resource detected')
          return
        }
        const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
        if (!content || !content.html) {
          log.debug('no content found from web parser')
          alert('Error: no content found form web parser')
          return
        }
        const textElements = getTextElementsFromHtml(content.html)
        if (!textElements) {
          log.debug('no text elements found')
          alert('Error: could not find any relevant text in the page')
          return
        }
        const docsSimilarity = await sffs.getAIDocsSimilarity(answerText, textElements, 0.6)
        if (!docsSimilarity || docsSimilarity.length === 0) {
          log.debug('no docs similarity found')
          alert('Error: could not find any relevant text in the page')
          return
        }
        const texts = []
        for (const docSimilarity of docsSimilarity) {
          if (docSimilarity.doc.includes(' ')) {
            texts.push(docSimilarity.doc)
          }
        }
        browserTab.sendWebviewEvent(WebViewEventReceiveNames.HighlightText, {
          texts: texts
        })
        return
      }
    }
    log.error('No tab in chat context found for resource', resourceId)
    alert('Error: No tab in chat context found for resource')
  }

  const handleSeekToTimestamp = async (resourceId: string, timestamp: number) => {
    for (const tab of getTabsInChatContext()) {
      const t = tab as TabPage
      if (t.resourceBookmark === resourceId) {
        const browserTab = $browserTabs[t.id]
        if (!browserTab) {
          log.error('Browser tab not found', t.id)
          alert('Error: Browser tab not found')
          return
        }
        makeTabActive(t.id)
        browserTab.sendWebviewEvent(WebViewEventReceiveNames.SeekToTimestamp, {
          timestamp: timestamp
        })
        return
      }
    }
    log.error('No tab in chat context found for resource', resourceId)
    alert('Error: No tab in chat context found for resource')
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

  const sendSidebarChatMessage = async (
    tabsInContext: Tab[],
    magicPage: PageMagic,
    prompt: string,
    role: AIChatMessageRole = 'user',
    query?: string
  ) => {
    if (tabsInContext.length === 0) {
      log.debug('No tabs in context, general chat:')
    }
    const chatId = $activeChatId
    if (!chatId) {
      alert('Error: Existing chat not found')
      return
    }

    let response: AIChatMessageParsed | null = null

    try {
      log.debug('Magic button clicked')
      const resourceIds: string[] = []
      for (const tab of tabsInContext) {
        const t = tab as TabPage
        if (t.chatResourceBookmark) {
          resourceIds.push(t.chatResourceBookmark)
        }
      }
      response = {
        id: generateID(),
        role: role,
        query: query ?? prompt,
        status: 'pending',
        content: '',
        citations: {}
      } as AIChatMessageParsed

      updateActiveMagicPage({ running: true })
      addPageMagicResponse(response)

      log.debug('calling the AI')
      let step = 'idle'
      let content = ''

      await sffs.sendAIChatMessage(
        chatId!,
        prompt,
        (chunk: string) => {
          if (step === 'idle') {
            log.debug('sources chunk', chunk)

            content += chunk

            if (content.includes('</sources>')) {
              const sources = parseChatResponseSources(content)
              log.debug('Sources', sources)

              step = 'sources'
              content = ''

              updatePageMagicResponse(response?.id ?? '', {
                sources
              })
            }
          } else {
            content += chunk
            updatePageMagicResponse(response?.id!, {
              content: content
                // .replace('<answer>', '')
                // .replace('</answer>', '')
                // .replace('<citation>', '')
                // .replace('</citation>', '')
                .replace('<br>', '\n')
            })
          }
        },
        {
          limit: 30,
          resourceIds: resourceIds,
          general: resourceIds.length === 0
        }
      )

      updatePageMagicResponse(response.id, { status: 'success' })
    } catch (e) {
      log.error('Error doing magic', e)
      if (response) {
        updatePageMagicResponse(response.id, {
          content: (e as any).message ?? 'Failed to generate response.',
          status: 'error'
        })
      }

      throw e
    } finally {
      updateActiveMagicPage({ running: false })
    }
  }

  const handleMagicSidebarPromptSubmit = async (e: CustomEvent<PromptIDs>) => {
    try {
      const promptType = e.detail
      log.debug('Magic button clicked')

      const prompt = await getPrompt(promptType)

      if (!$activeTabMagic) {
        log.error('No active magic page')
        return
      }

      await sendSidebarChatMessage(
        getTabsInChatContext(),
        $activeTabMagic,
        prompt.content,
        'system',
        prompt.title
      )
    } catch (e) {
      log.error('Error doing magic', e)
    }
  }

  const handleChatSubmit = async (magicPage: PageMagic) => {
    const savedInputValue = $magicInputValue

    try {
      $magicInputValue = ''
      log.debug('Magic button clicked')

      if (!savedInputValue) {
        log.debug('No input value')
        return
      }
      await sendSidebarChatMessage(getTabsInChatContext(), magicPage, savedInputValue)
    } catch (e) {
      log.error('Error doing magic', e)
      $magicInputValue = savedInputValue
    }
  }

  const deleteChatsForPageChat = async () => {
    for (const tab of getTabsInChatContext()) {
      if (tab.type === 'page' && tab.chatId) {
        await sffs.deleteAIChat(tab.chatId)
      }
    }
  }

  const deleteAppIdsForAppSidebar = async () => {
    for (const tab of getTabsInChatContext()) {
      if (tab.type === 'page' && tab.appId) {
        await sffs.deleteAIChat(tab.appId)
      }
    }
  }

  const updateChatIdsForPageChat = (newChatId: string) => {
    for (const tab of getTabsInChatContext()) {
      if (tab.type === 'page') {
        updateTab(tab.id, { chatId: newChatId })
      }
    }
  }

  const updateAppIdsForAppSidebar = (newAppId: string) => {
    for (const tab of getTabsInChatContext()) {
      if (tab.type === 'page') {
        updateTab(tab.id, { appId: newAppId })
      }
    }
  }

  const handleChatClear = async (createNewChat: boolean) => {
    log.debug('clearing chat')
    let pageMagic = $activeTabMagic
    if (!pageMagic) return

    try {
      let chatId: string = ''
      await deleteChatsForPageChat()
      if (createNewChat) {
        const newChatId = await sffs.createAIChat('')
        if (!newChatId) {
          log.error('Failed to create new chat aftering clearing the old one')
          return
        }
        chatId = newChatId
      }
      pageMagic.responses = []
      updateChatIdsForPageChat(chatId)
      activeChatId.set(chatId)
    } catch (e) {
      log.error('Error clearing chat:', e)
    }
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

  const bookmarkPageTabsInContext = async () => {
    log.debug('Bookmarking all page tabs in context')
    for (const tab of getTabsInChatContext()) {
      if (tab.type === 'page' && !tab.resourceBookmark) {
        try {
          log.debug('Bookmarking page tab', tab)
          const browserTab = $browserTabs[tab.id]
          await browserTab.bookmarkPage(true)
        } catch (e) {
          log.warn('Error bookmarking page tab', tab, e)
        }
      }
    }
  }

  const handleToggleMagicSidebar = async () => {
    document.startViewTransition(async () => {
      showAppSidebar.set(false)
      const tab = $activeTab as TabPage | null

      if (!$activeTabMagic) return
      if (!tab) return

      if (!$activeTabMagic.showSidebar) {
        if (!$activeChatId) {
          const chatId = await sffs.createAIChat('')
          if (!chatId) {
            log.error('Failed to create chat')
            return
          }
          updateChatIdsForPageChat(chatId)
          activeChatId.set(chatId)
        }
        await bookmarkPageTabsInContext()
      }
      activeTabMagic.update((magic) => {
        return {
          ...magic,
          showSidebar: !magic.showSidebar
        }
      })
      toggleTabsMagic($activeTabMagic.showSidebar)
      await tick()
    })
  }

  const handleToggleAppSidebar = async () => {
    const tab = $activeTab as TabPage | null
    if (!tab) return

    let appId = tab.appId
    if (!$showAppSidebar && !appId) {
      // TODO: a different way to create app id? not sure yet, single chat id should be fine
      appId = await sffs.createAIChat('')
      if (!appId) {
        log.error('Failed to create an app id')
        alert('Error: Failed to create an pp id')
        return
      }
      updateTab(tab.id, { appId: appId })
      // updateAppIdsForAppSidebar(appId)
      // await bookmarkPageTabsInContext()
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
      alert('Error: failed to parse content for create app context')
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
    showAppSidebar.set(!$showAppSidebar)
  }

  const handleExecuteAppSidebarCode = async (appId: string, code: string) => {
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

    return annotation
  }

  const openResource = async (id: string) => {
    openResourceDetailsModal(id)
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

  const handleCreateTabFromSpace = async (e: CustomEvent<Tab>) => {
    const tab = e.detail

    log.debug('create tab from sidebar', tab)

    await createTab(tab)

    toasts.success('Space added to your Tabs!')
  }

  const handleCreateTabFromPopover = async (e: CustomEvent<Space>) => {
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

      const tab = {
        title: space.name.folderName,
        icon: '',
        spaceId: space.id,
        type: 'space',
        index: 0,
        pinned: false,
        archived: false
      } as TabSpace

      const newTab = await createTab(tab)

      makeTabActive(newTab.id)

      await tick()
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }

    toasts.success('Space added to your Tabs!')
  }

  const handleSaveResourceInSpace = async (e: CustomEvent<Space>) => {
    log.debug('add resource to space', e.detail)

    const toast = toasts.loading('Adding resource to space...')

    try {
      const resourceId = await handleBookmark()
      log.debug('bookmarked resource', resourceId)

      if (resourceId) {
        log.debug('will add item', resourceId, 'to space', e.detail.id)
        await resourceManager.addItemsToSpace(e.detail.id, [resourceId])
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
        showInSidebar: false,
        liveModeEnabled: false,
        hideViewed: false,
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
        const tab = await createTab({
          title: newSpace.name.folderName,
          icon: '',
          spaceId: newSpace.id,
          type: 'space',
          index: 0,
          pinned: false,
          archived: false
        } as TabSpace)

        makeTabActive(tab.id)
      }

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
      if ($activeTab?.type !== 'page' || !$activeTab.currentDetectedApp?.rssFeedUrl) {
        log.debug('No RSS feed detected')
        return
      }

      const app = $activeTab.currentDetectedApp

      log.debug('create live space out of app', app)

      isCreatingLiveSpace.set(true)
      const toast = toasts.loading('Creating Live Space...')

      const spaceSource = {
        id: generateID(),
        name: $activeTab.title ?? app.appName ?? 'Unknown',
        type: 'rss',
        url: app.rssFeedUrl,
        last_fetched_at: null
      } as SpaceSource

      // create new space
      const space = await oasis.createSpace({
        folderName: $activeTab.title ?? app.appName ?? 'Live Space',
        showInSidebar: true,
        colors: ['#FFD700', '#FF8C00'],
        sources: [spaceSource],
        liveModeEnabled: true,
        hideViewed: false,
        smartFilterQuery: null
      })

      log.debug('created space', space)

      const tab = await createTab({
        title: space.name.folderName,
        icon: '',
        spaceId: space.id,
        type: 'space',
        index: 0,
        pinned: false,
        archived: false
      } as TabSpace)

      makeTabActive(tab.id)

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

  $: tabSize = (maxWidth - 600) / $unpinnedTabs.length

  const handleResize = () => {
    maxWidth = window.innerWidth
    tabSize = (maxWidth - 600) / $unpinnedTabs.length
  }

  onMount(async () => {
    window.addEventListener('resize', handleResize)

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
      return updatePrompt(id, content)
    })

    // @ts-expect-error
    window.api.onResetPrompt((id: PromptIDs) => {
      return resetPrompt(id)
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
    } else if (!$activeTabId) {
      makeTabActive(activeTabs[activeTabs.length - 1].id)
    }

    // activeTabs.forEach((tab, index) => {
    //   updateTab(tab.id, { index: index })
    // })

    tabs.update((tabs) => tabs.sort((a, b) => a.index - b.index))

    log.debug('tabs', $tabs)

    setupObserver()

    // ON DESTROY!!
  })

  const createChatResourceBookmark = async (tab: TabPage) => {
    let resource_id: string

    if (tab.resourceBookmark) {
      resource_id = tab.resourceBookmark
    } else {
      const detectedResource = await $activeBrowserTab.detectResource()
      log.debug('extracted resource data', detectedResource)

      if (!detectedResource) {
        log.debug('no resource detected')
        return
      }

      // strip &t from url suffix
      let url = $activeTabLocation ?? ''
      let youtubeHostnames = [
        'youtube.com',
        'youtu.be',
        'youtube.de',
        'www.youtube.com',
        'www.youtu.be',
        'www.youtube.de'
      ]
      if (youtubeHostnames.includes(new URL(url).host)) {
        url = url.replace(/&t.*/g, '')
      }

      const resource = await resourceManager.createResourceOther(
        new Blob([JSON.stringify(detectedResource.data)], {
          type: `${detectedResource.type}`
        }),
        { name: $activeTab?.title ?? '', sourceURI: url, alt: '' },
        [ResourceTag.canonicalURL(url)]
      )
      resource_id = resource.id

      log.debug('created resource', resource)
    }

    updateTab(tab.id, { chatResourceBookmark: resource_id })
    return resource_id
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

  const handleExcludeOtherTabsFromMagic = (e: CustomEvent<string>) => {
    const tabId = e.detail

    // exclude all other tabs from magic
    tabs.update((x) => {
      return x.map((tab) => {
        if (tab.id !== tabId) {
          return {
            ...tab,
            magic: false
          }
        }
        return tab
      })
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
      unpinnedTabsArray.forEach((tab) => {
        tab.magic = true
      })
      newUnpinnedTabsArray = []
    } else {
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

  const onDropDragcula = async (e: DragculaDragEvent) => {
    console.debug('DROP DRAGCULA', e)

    if (e.isNative) {
      // TODO: Handle otherwise
      return
    }

    if (e.data['farc/resource'] !== undefined) {
      // TODO: Rename to oasis/resource
      const resource = e.data['farc/resource']

      if (
        resource.type === 'application/vnd.space.link' ||
        resource.type === 'application/vnd.space.article'
      ) {
        const tab = await createPageTab(resource.parsedData.url, true)
        tab.index = e.index
        await bulkUpdateTabsStore(
          get(tabs).map((tab) => ({
            id: tab.id,
            updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
          }))
        )

        log.debug('State updated successfully')
      }
      return
    }

    // Handle tab dnd
    if (e.data['farc/tab'] !== undefined) {
      const dragData = e.data['farc/tab'] as Tab

      // Get all the tab arrays
      let unpinnedTabsArray = get(unpinnedTabs)
      let pinnedTabsArray = get(pinnedTabs)
      let magicTabsArray = get(magicTabs)

      // Determine source and target lists
      let fromTabs: Tab[]
      let toTabs: Tab[]

      if (e.from.id === 'sidebar-unpinned-tabs') {
        fromTabs = unpinnedTabsArray
      } else if (e.from.id === 'sidebar-pinned-tabs') {
        fromTabs = pinnedTabsArray
      } else if (e.from.id === 'sidebar-magic-tabs') {
        fromTabs = magicTabsArray
      }

      if (
        true ||
        !['sidebar-unpinned-tabs', 'sidebar-pinned-tabs', 'sidebar-magic-tabs'].includes(e.to?.id)
      ) {
        // NOTE: We only want to remove the tab if its dragged out of the sidebar
        const idx = fromTabs.findIndex((v) => v.id === dragData.id)
        console.error('rem frim', [fromTabs], idx)
        if (idx > -1) {
          fromTabs.splice(idx, 1)
        }
      }
      {
        // Update the indices of the tabs in all lists
        const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }))

        unpinnedTabsArray = updateIndices(unpinnedTabsArray)
        pinnedTabsArray = updateIndices(pinnedTabsArray)
        magicTabsArray = updateIndices(magicTabsArray)

        // Combine all lists back together
        const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray]

        log.debug('Removed old tab drag item', newTabs)

        tabs.set(newTabs)
      }
      // NOTE: This is important, as the old item needs to be removed before the new one can be added
      await tick()

      if (e.to.id === 'sidebar-unpinned-tabs') {
        toTabs = unpinnedTabsArray
      } else if (e.to.id === 'sidebar-pinned-tabs') {
        toTabs = pinnedTabsArray
      } else if (e.to.id === 'sidebar-magic-tabs') {
        toTabs = magicTabsArray
      }

      // Update pinned or magic state of the tab
      if (e.to.id === 'sidebar-pinned-tabs') {
        dragData.pinned = true
        dragData.magic = false
      } else if (e.to.id === 'sidebar-magic-tabs') {
        dragData.pinned = false
        dragData.magic = true
      } else {
        dragData.pinned = false
        dragData.magic = false
      }

      toTabs.splice(e.index, 0, dragData)

      // Update the indices of the tabs in all lists
      const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }))

      unpinnedTabsArray = updateIndices(unpinnedTabsArray)
      pinnedTabsArray = updateIndices(pinnedTabsArray)
      magicTabsArray = updateIndices(magicTabsArray)

      // Combine all lists back together
      const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray]

      log.debug('New tabs', newTabs)

      tabs.set(newTabs)
      await tick()

      // Update the store with the changed tabs
      await bulkUpdateTabsStore(
        newTabs.map((tab) => ({
          id: tab.id,
          updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
        }))
      )

      log.debug('State updated successfully')
    }
  }

  const onDragculaRemoveTab = (drag: DragOperation) => {
    return
    //if (drag.from?.id === drag.to?.id || drag.item === null) return
    tabs.update((tabs) => {
      const idx = tabs.findIndex((v) => v.id === drag.item?.id)
      if (idx > -1) {
        tabs.splice(idx, 1)
      }
      return tabs
    })
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

<SplashScreen />

<svelte:window on:keydown={handleKeyDown} />

<ToastsProvider service={toasts} />

<div class="antialiased w-screen h-screen will-change-auto transform-gpu">
  {#if showTabSearch}
    <TabSearch
      onClose={() => {
        showTabSearch = false
      }}
      activeTabs={$activeTabs}
      on:activateTab={handleTabSelect}
    />
  {/if}

  <div class="relative h-screen flex {horizontalTabs ? 'flex-col' : 'flex-row'}">
    {#if showTabs}
      <div
        transition:slide={{ axis: !horizontalTabs ? 'x' : 'y', duration: 100 }}
        class="flex-grow transform-gpu {horizontalTabs && 'h-[51px]'}"
        class:magic={$magicTabs.length === 0 && $activeTabMagic?.showSidebar}
        style="z-index: 5000;"
      >
        {#if $sidebarTab !== 'oasis'}
          <div
            class="flex {!horizontalTabs
              ? 'flex-col w-[288px]  py-3 space-y-4 px-2 h-full'
              : 'flex-row items-center h-[52px] ml-24 space-x-4 mr-4'} relative"
          >
            <div
              class="flex flex-row items-center flex-shrink-0 {!horizontalTabs &&
                'w-full justify-end'}"
            >
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
                    class="transform active:scale-95 appearance-none border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                    on:click={$activeBrowserTab?.reload}
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

            <div
              class="bg-sky-50 my-auto p-2 rounded-xl shadow-md flex-shrink-0 max-w-[300px] overflow-x-scroll no-scrollbar"
            >
              <div
                style:view-transition-name="pinned-tabs-wrapper"
                axis="horizontal"
                dragdeadzone="3"
                use:HTMLDragZone.action={{
                  id: 'sidebar-pinned-tabs',
                  acceptDrag: (drag) => {
                    return true
                  }
                }}
                on:Drop={onDropDragcula}
              >
                {#if $pinnedTabs.length === 0}
                  <div class="">Drop Tabs here to pin them.</div>
                {:else}
                  {#each $pinnedTabs as tab, index (tab.id)}
                    {#key $pinnedTabs[index]}
                      <TabItem
                        tab={$pinnedTabs[index]}
                        {activeTabId}
                        {deleteTab}
                        {unarchiveTab}
                        pinned={true}
                        on:select={handleTabSelect}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                      />
                    {/key}
                  {/each}
                {/if}
              </div>
            </div>

            {#if $activeTabMagic}
              {#if $activeTabMagic.showSidebar}
                <div
                  class="relative group {horizontalTabs
                    ? 'max-w-[512px] no-scrollbar h-[47px]'
                    : 'w-full'}"
                >
                  <div
                    style="opacity: 0.2"
                    class="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl blur opcaity-20 group-hover:opacity-10 transition duration-1000 group-hover:duration-200 animate-tilt"
                  ></div>
                  <div
                    class="relative bg-sky-100/50 rounded-2xl overflow-auto no-scrollbar
                    {horizontalTabs ? 'h-full' : 'w-full'}"
                  >
                    <div
                      class={horizontalTabs ? 'p-1 pt-[2px]' : 'p-2'}
                      class:magic={$magicTabs.length > 0}
                    >
                      {#if horizontalTabs}
                        <div
                          axis="vertical"
                          use:HTMLDragZone.action={{
                            id: 'sidebar-magic-tabs'
                          }}
                          on:Drop={onDropDragcula}
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
                            {#each $magicTabs as tab, index (tab.id)}
                              <TabItem
                                showClose
                                tab={$magicTabs[index]}
                                {activeTabId}
                                pinned={false}
                                showButtons={false}
                                showExcludeOthersButton
                                on:delete-tab={handleDeleteTab}
                                on:unarchive-tab={handleUnarchiveTab}
                                on:select={handleTabSelect}
                                on:remove-from-sidebar={handleRemoveFromSidebar}
                                on:exclude-other-tabs={handleExcludeOtherTabsFromMagic}
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
                          axis="vertical"
                          use:HTMLDragZone.action={{
                            id: 'sidebar-magic-tabs',
                            acceptDrag: (drag) => {
                              return true
                            }
                          }}
                          on:Drop={onDropDragcula}
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
                            {#each $magicTabs as tab, index (tab.id)}
                              <TabItem
                                showClose
                                tab={$magicTabs[index]}
                                {activeTabId}
                                pinned={false}
                                showButtons={false}
                                showExcludeOthersButton
                                on:unarchive-tab={handleUnarchiveTab}
                                on:delete-tab={handleDeleteTab}
                                on:select={handleTabSelect}
                                on:remove-from-sidebar={handleRemoveFromSidebar}
                                on:exclude-other-tabs={handleExcludeOtherTabsFromMagic}
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
              class="overflow-x-scroll no-scrollbar relative flex-grow"
              class:space-x-2={horizontalTabs}
              class:items-center={horizontalTabs}
              bind:this={containerRef}
            >
              {#if horizontalTabs}
                <div
                  class="horizontal-tabs"
                  axis="horizontal"
                  dragdeadzone="5"
                  use:HTMLDragZone.action={{
                    id: 'sidebar-unpinned-tabs',
                    acceptDrag: (drag) => {
                      return true
                    }
                  }}
                  on:Drop={onDropDragcula}
                >
                  {#each $unpinnedTabs as tab, index (tab.id)}
                    <!-- check if this tab is active -->
                    {#if $activeTabId === $unpinnedTabs[index].id}
                      <TabItem
                        showClose
                        tabSize={Math.min(400, Math.max(240, tabSize))}
                        tab={$unpinnedTabs[index]}
                        {activeTabId}
                        bookmarkingInProgress={$bookmarkingInProgress}
                        bookmarkingSuccess={$bookmarkingSuccess}
                        pinned={false}
                        {spaces}
                        enableEditing
                        bind:this={activeTabComponent}
                        on:select={() => {}}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:drop={handleDrop}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:unarchive-tab={handleUnarchiveTab}
                        on:bookmark={handleBookmark}
                        on:create-live-space={handleCreateLiveSpace}
                        on:save-resource-in-space={handleSaveResourceInSpace}
                      />
                    {:else}
                      <TabItem
                        showClose
                        tab={$unpinnedTabs[index]}
                        tabSize={Math.min(400, Math.max(240, tabSize))}
                        {activeTabId}
                        {deleteTab}
                        {unarchiveTab}
                        pinned={false}
                        on:select={handleTabSelect}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:drop={handleDrop}
                      />
                    {/if}
                  {/each}
                </div>
              {:else}
                <div
                  class="vertical-tabs"
                  axis="vertical"
                  dragdeadzone="5"
                  use:HTMLDragZone.action={{
                    id: 'sidebar-unpinned-tabs',
                    acceptDrag: (drag) => {
                      return true
                    }
                  }}
                  on:Drop={onDropDragcula}
                >
                  {#each $unpinnedTabs as tab, index (tab.id)}
                    <!-- check if this tab is active -->
                    {#if $activeTabId === $unpinnedTabs[index].id}
                      <!-- on:drop={handleDrop} -->
                      <TabItem
                        showClose
                        tab={$unpinnedTabs[index]}
                        {activeTabId}
                        bookmarkingInProgress={$bookmarkingInProgress}
                        bookmarkingSuccess={$bookmarkingSuccess}
                        pinned={false}
                        {spaces}
                        enableEditing
                        bind:this={activeTabComponent}
                        on:select={() => {}}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:drop={handleDrop}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:unarchive-tab={handleUnarchiveTab}
                        on:bookmark={handleBookmark}
                        on:create-live-space={handleCreateLiveSpace}
                        on:save-resource-in-space={handleSaveResourceInSpace}
                      />
                    {:else}
                      <TabItem
                        showClose
                        tab={$unpinnedTabs[index]}
                        {activeTabId}
                        {deleteTab}
                        {unarchiveTab}
                        pinned={false}
                        on:select={handleTabSelect}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:drop={handleDrop}
                      />
                    {/if}
                  {/each}
                </div>
              {/if}
              <div
                style="position: absolute; top: {!horizontalTabs
                  ? 45 * $unpinnedTabs.length
                  : 0}px; left: {horizontalTabs
                  ? Math.min(400, Math.max(240, tabSize)) * $unpinnedTabs.length
                  : 0}px; right: 0;"
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
                    : 'w-full rounded-2xl px-4 py-3'} appearance-none border-0 margin-0 group flex items-center p-2 hover:bg-sky-200 transition-colors duration-200 text-sky-800 cursor-pointer"
                  on:click|preventDefault={() => createNewEmptyTab()}
                >
                  <Icon name="add" />
                  {#if !horizontalTabs}
                    <span class="label">New Tab</span>
                  {/if}
                </button>
              </div>
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
              >
                <Icon name="add" />
                {#if !horizontalTabs}
                  <span class="label">New Tab</span>
                {/if}
              </button>
              <div class="flex flex-row flex-shrink-0 items-center space-x-4 mx-auto">
                <button
                  class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                  on:click={handleToggleMagicSidebar}
                  disabled={$sidebarTab !== 'active' ||
                    !$activeTabMagic ||
                    $activeTab?.type !== 'page'}
                  use:tooltip={{
                    content: 'Toggle Page Chat',
                    action: 'hover',
                    position: 'bottom',
                    animation: 'fade',
                    delay: 300
                  }}
                >
                  {#if !$activeTabMagic}
                    <Icon name="message" />
                  {:else if $activeTabMagic.showSidebar}
                    <Icon name="close" />
                  {:else if $activeTabMagic.running}
                    <Icon name="spinner" />
                  {:else}
                    <Icon name="message" />
                  {/if}
                </button>
                {#if $activeTabMagic}
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                {/if}

                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <button
                  class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                  on:click={() => ($showAnnotationsSidebar = !$showAnnotationsSidebar)}
                  disabled={$sidebarTab !== 'active' || $activeTab?.type !== 'page'}
                  use:tooltip={{
                    content: 'Toggle Annotations',
                    action: 'hover',
                    position: 'bottom',
                    animation: 'fade',
                    delay: 300
                  }}
                >
                  {#if $showAnnotationsSidebar}
                    <Icon name="close" />
                  {:else}
                    <Icon name="marker" />
                  {/if}
                </button>

                <button
                  class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                  disabled={$sidebarTab !== 'active' || $activeTab?.type !== 'page'}
                  on:click={handleToggleAppSidebar}
                  use:tooltip={{
                    content: 'Go wild',
                    action: 'hover',
                    position: 'bottom',
                    animation: 'fade',
                    delay: 300
                  }}
                >
                  {#if $showAppSidebar}
                    <Icon name="close" />
                  {:else}
                    <Icon name="sparkles" />
                  {/if}
                </button>

                <NewTabButton
                  {resourceManager}
                  {spaces}
                  on:create-tab-from-space={handleCreateTabFromPopover}
                  on:create-new-space={handleCreateNewSpace}
                  on:create-new-history-tab={createHistoryTab}
                  on:create-new-tab={debouncedCreateNewEmptyTab}
                />
              </div>
            </div>
          </div>
        {:else}
          <OasisSidebar on:createTab={handleCreateTabFromSpace} />
        {/if}
      </div>
    {/if}

    <div
      class="h-screen w-screen shadow-lg flex space-x-4 relative flex-row {horizontalTabs
        ? 'px-1.5'
        : 'py-1.5'}"
    >
      <!-- {horizontalTabs ? `pb-1.5 ${showTabs && 'pt-1.5'}` : `pr-1.5 ${showTabs && 'pl-1.5'}`}  -->
      <div
        style:view-transition-name="active-content-wrapper"
        class="w-full h-full overflow-hidden flex-grow"
        class:pb-1.5={horizontalTabs}
        class:pt-1.5={horizontalTabs && !showTabs}
        class:pr-1.5={!horizontalTabs}
        class:pl-1.5={!horizontalTabs && !showTabs}
        style="z-index: 0;"
        class:hasNoTab={!$activeBrowserTab}
        class:sidebarHidden={!showTabs}
      >
        {#if $sidebarTab === 'oasis'}
          <div class="browser-window active" style="--scaling: 1;">
            <OasisSpace
              spaceId={$selectedSpace}
              active
              on:create-resource-from-oasis={handeCreateResourceFromOasis}
              on:deleted={handleDeletedSpace}
              on:new-tab={handleNewTab}
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
          <div
            class="browser-window will-change-contents transform-gpu"
            style="--scaling: 1;"
            class:active={$activeTabId === tab.id && $sidebarTab !== 'oasis'}
            class:magic-glow-big={$activeTabId === tab.id && $activeTabMagic?.running}
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
                on:open-resource={(e) => openResource(e.detail)}
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
                on:navigate={(e) => createPageTab(e.detail.url, e.detail.active)}
                on:updateTab={(e) => updateTab(tab.id, e.detail)}
                on:openResource={(e) => openResource(e.detail)}
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
              />
            {:else if tab.type === 'history'}
              <BrowserHistory {tab} active={$activeTabId === tab.id} on:new-tab={handleNewTab} />
            {:else}
              <BrowserHomescreen
                {historyEntriesManager}
                active={$activeTabId === tab.id}
                on:navigate={handleTabNavigation}
                on:chat={handleCreateChat}
                on:rag={handleRag}
                on:create-tab-from-space={handleCreateTabFromSpace}
                on:new-tab={handleNewTab}
              />
            {/if}
          </div>
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
            />
          </div>
        {/if}
      </div>

      {#if $activeTab && $activeTab.type === 'page' && $activeTabMagic && $activeTabMagic?.showSidebar}
        <div
          transition:slide={{ axis: 'x' }}
          class="bg-neutral-50/80 backdrop-blur-sm rounded-xl w-[440px] h-auto mb-1.5 {!showTabs &&
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
          class="bg-neutral-50/80 backdrop-blur-sm rounded-xl w-[440px] h-auto mb-1.5 {!showTabs &&
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
          class="bg-neutral-50/80 backdrop-blur-sm rounded-xl w-[440px] h-auto mb-1.5 {!showTabs &&
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
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  /// DRAGCULA STATES NOTE: these should be @horizon/dragcula/dist/styles.css import, but this doesnt work currently!
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
  :global(*[data-dragcula-drop-target] *:not([data-dragcula-zone])) {
    pointer-events: none;
  }

  :global(*[data-dragcula-drop-target] *[data-dragcula-zone]) {
    pointer-events: all;
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
    min-height: 32px;
  }
  :global(.magic-tabs-wrapper [data-dragcula-zone]) {
    min-height: 4rem !important;
    height: fit-content !important;
  }

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
    padding: 0.2rem;
    gap: 1rem;

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
    height: 100%;
  }
  :global([data-dragcula-zone='sidebar-unpinned-tabs'].horizontal-tabs) {
    width: 100%;
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

  :global(div[data-dragcula-zone]) {
    overflow: visible !important;
    background: transparent !important;
  }

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
    width: calc(48px);
    height: calc(48px);
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
