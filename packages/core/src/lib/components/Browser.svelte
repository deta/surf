<svelte:options immutable={true} />

<script lang="ts">
  import { onMount, setContext, tick } from 'svelte'
  import { fly } from 'svelte/transition'
  import SplashScreen from './Atoms/SplashScreen.svelte'
  import { writable, derived, get, type Writable } from 'svelte/store'
  import { type WebviewWrapperEvents } from './Webview/WebviewWrapper.svelte'
  import { Icon } from '@horizon/icons'
  import {
    isModKeyAndEventCodeIs,
    isModKeyAndKeyPressed,
    isModKeyAndKeysPressed,
    isModKeyAndShiftKeyAndKeyPressed
  } from '@horizon/utils/src/keyboard'
  import { createTelemetry } from '../service/telemetry'
  import {
    useDebounce,
    useThrottle,
    wait,
    writableAutoReset,
    parseStringIntoBrowserLocation,
    generateID,
    useLogScope,
    useLocalStorageStore,
    truncate,
    tooltip,
    type LogLevel,
    isMac,
    isDev
  } from '@horizon/utils'
  import { MEDIA_TYPES, createResourcesFromMediaItems, processDrop } from '../service/mediaImporter'
  import SidebarPane from './Sidebars/SidebarPane.svelte'

  import type { PaneAPI } from 'paneforge'
  import {
    Resource,
    ResourceHistoryEntry,
    ResourceTag,
    createResourceManager
  } from '../service/resources'

  import {
    DragTypeNames,
    type DragTypes,
    SpaceEntryOrigin,
    type Space,
    type SpaceSource
  } from '../types'

  import BrowserTab, { type BrowserTabNewTabEvent } from './Browser/BrowserTab.svelte'
  import BrowserHomescreen from './Browser/BrowserHomescreen.svelte'
  import TabItem from './Core/Tab.svelte'
  import { type ShortcutMenuEvents } from './Shortcut/ShortcutMenu.svelte'
  import '../../app.css'
  import { createDemoItems, createOnboardingSpace } from '../service/demoitems'

  import './index.scss'
  import type {
    PageMagic,
    Tab,
    TabPage,
    TabSpace,
    DroppedTab,
    TabHistory,
    CreateTabOptions,
    ControlWindow,
    TabResource,
    BookmarkTabState,
    ContextItem,
    AddContextItemEvent,
    ChatWithSpaceEvent
  } from '../types/browser.types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../constants/searchEngines'
  import Chat from './Chat/Chat.svelte'
  import { HorizonDatabase } from '../service/storage'
  import type {
    DownloadDoneMessage,
    Optional,
    SFFSResourceMetadata,
    SFFSResourceTag
  } from '../types'
  import { WebParser } from '@horizon/web-parser'
  import Importer from './Core/Importer.svelte'
  import OasisDiscovery from './Core/OasisDiscovery.svelte'
  import MagicSidebar from './Sidebars/MagicSidebar.svelte'
  import AppSidebar, { type ExecuteCodeInTabEvent } from './Sidebars/AppSidebar.svelte'
  import {
    ActivateTabEventTrigger,
    AddResourceToSpaceEventTrigger,
    CreateAnnotationEventTrigger,
    CreateSpaceEventFrom,
    CreateTabEventTrigger,
    DeleteTabEventTrigger,
    MoveTabEventAction,
    OpenSpaceEventTrigger,
    PageChatUpdateContextEventAction,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SaveToOasisEventTrigger,
    UpdateSpaceSettingsEventTrigger,
    WebViewEventReceiveNames,
    type AnnotationCommentData,
    type ResourceDataAnnotation,
    type WebViewEventAnnotation,
    type RightSidebarTab,
    type Download,
    EventContext,
    SelectTabEventAction,
    MultiSelectResourceEventAction,
    PageChatUpdateContextEventTrigger,
    OpenInMiniBrowserEventFrom
  } from '@horizon/types'
  import { OnboardingFeature } from './Onboarding/onboardingScripts'
  import { scrollToTextCode } from '../constants/inline'
  import { onboardingSpace } from '../constants/examples'
  import { SFFS } from '../service/sffs'
  import { provideOasis, colorPairs } from '../service/oasis'
  import OasisSpace from './Oasis/OasisSpace.svelte'

  import AnnotationsSidebar from './Sidebars/AnnotationsSidebar.svelte'
  import ToastsProvider from './Toast/ToastsProvider.svelte'
  import { provideToasts, type ToastItem } from '../service/toast'
  import { PromptIDs, getPrompts, resetPrompt, updatePrompt } from '../service/prompts'
  import { Tabs } from 'bits-ui'
  import BrowserHistory from './Browser/BrowserHistory.svelte'
  import {
    HTMLDragZone,
    HTMLAxisDragZone,
    type DragculaDragEvent,
    Dragcula
  } from '@horizon/dragcula'
  import NewTabOverlay from './Core/NewTabOverlay.svelte'
  import CustomPopover from './Atoms/CustomPopover.svelte'
  import { provideConfig } from '../service/config'
  import { HistoryEntriesManager } from '../service/history'
  import { spawnBoxSmoke } from './Effects/SmokeParticle.svelte'
  import DevOverlay from './Browser/DevOverlay.svelte'
  import BrowserActions from './Browser/BrowserActions.svelte'
  import CreateLiveSpace from './Oasis/CreateLiveSpace.svelte'
  import { createTabsManager } from '../service/tabs'
  import ResourceTab from './Oasis/ResourceTab.svelte'
  import ScreenshotPicker, { type ScreenshotPickerMode } from './Webview/ScreenshotPicker.svelte'
  import {
    dataUrltoBlob,
    captureScreenshot,
    getHostFromURL,
    getScreenshotFileName
  } from '../utils/screenshot'
  import { contextMenu, prepareContextMenu } from './Core/ContextMenu.svelte'
  import TabOnboarding from './Core/TabOnboarding.svelte'
  import Tooltip from './Onboarding/Tooltip.svelte'
  import { launchTimeline, endTimeline, hasActiveTimeline } from './Onboarding/timeline'
  import SidebarMetaOverlay from './Oasis/sidebar/SidebarMetaOverlay.svelte'
  import { debugMode } from '../stores/debug'
  import MiniBrowser from './MiniBrowser/MiniBrowser.svelte'
  import {
    createMiniBrowserService,
    useScopedMiniBrowserAsStore
  } from '@horizon/core/src/lib/service/miniBrowser'

  let activeTabComponent: TabItem | null = null
  const addressBarFocus = writable(false)
  let showLeftSidebar = true
  let showRightSidebar = false
  let rightPane: PaneAPI | undefined = undefined
  let sidebarComponent: SidebarPane | null = null
  let annotationsSidebar: AnnotationsSidebar
  let magicSidebar: MagicSidebar
  let isFirstButtonVisible = true
  let containerRef: Element
  let pinnedTabsWrapper: HTMLElement

  const onboardingActive = writable(false)

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

  const log = useLogScope('Browser')
  const resourceManager = createResourceManager(telemetry)
  const storage = new HorizonDatabase()
  const sffs = new SFFS()
  const historyEntriesManager = new HistoryEntriesManager()
  const oasis = provideOasis(resourceManager)
  const toasts = provideToasts()
  const config = provideConfig()
  const tabsManager = createTabsManager(resourceManager, historyEntriesManager, telemetry)
  const miniBrowserService = createMiniBrowserService(resourceManager)

  const globalMiniBrowser = miniBrowserService.globalBrowser
  const userConfigSettings = config.settings
  const tabsDB = storage.tabs
  const spaces = oasis.spaces
  const selectedSpace = oasis.selectedSpace

  const {
    tabs,
    activeTabId,
    activeTab,
    activeTabLocation,
    activeBrowserTab,
    activeTabs,
    browserTabs,
    pinnedTabs,
    unpinnedTabs,
    magicTabs,
    activatedTabs,
    showNewTabOverlay,
    selectedTabs,
    lastSelectedTabId
  } = tabsManager

  const showScreenshotPicker = writable(false)
  const screenshotPickerMode = writable<ScreenshotPickerMode>('inline')
  const addressValue = writable('')
  const activeChatId = useLocalStorageStore<string>('activeChatId', '')
  const sidebarTab = writable<'active' | 'archive' | 'oasis'>('active')
  const magicInputValue = writable('')
  const activeTabMagic = writable<PageMagic>({
    running: false,
    showSidebar: false,
    initializing: false,
    responses: [],
    errors: []
  })
  const showCreateLiveSpaceDialog = writable(false)
  const bookmarkingTabsState = writable<Record<string, BookmarkTabState>>({})
  const isCreatingLiveSpace = writable(false)
  const activeAppId = writable<string>('')
  const showAppSidebar = writable(false)
  const rightSidebarTab = writable<RightSidebarTab>('chat')
  const showSplashScreen = writable(false)
  const cachedMagicTabs = new Set<string>()
  const downloadResourceMap = new Map<string, Download>()
  const downloadToastsMap = new Map<string, ToastItem>()
  const downloadIntercepters = new Map<string, (data: Download) => void>()
  const showStartMask = writable(false)
  const showEndMask = writable(false)
  const additionalChatContextItems = writable<ContextItem[]>([])

  // on windows and linux the custom window actions are shown in the tab bar
  const showCustomWindowActions = !isMac()

  const CHAT_DOWNLOAD_INTERCEPT_TIMEOUT = 1000 * 60 // 60s

  $: log.debug('right sidebar tab', $rightSidebarTab)

  // Set global context
  setContext('selectedFolder', 'all')

  const sidebarTools = derived(
    [activeTabMagic, activeTab, showAppSidebar, userConfigSettings],
    ([$activeTabMagic, $activeTab, $showAppSidebar, userConfigSettings]) => {
      const tools = [
        {
          id: 'chat',
          name: 'Chat',
          type: 'tool',
          icon: $activeTabMagic ? ($activeTabMagic.running ? 'spinner' : 'chat') : 'chat',
          disabled: !$activeTabMagic,
          showCondition: $activeTab && $activeTabMagic,
          fallbackContent: {
            icon: 'info',
            message: 'Magic chat not available'
          }
        }
      ]

      if (userConfigSettings.annotations_sidebar) {
        tools.push({
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
        })
      }

      if (userConfigSettings.go_wild_mode) {
        tools.push({
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
        })
      }

      return tools
    }
  )

  const chatContextItems = derived(
    [magicTabs, additionalChatContextItems],
    ([magicTabs, additionalChatContextItems]) => {
      return [
        ...additionalChatContextItems,
        ...magicTabs.map((tab) => ({ id: tab.id, type: 'tab', data: tab }) as ContextItem)
      ]
    }
  )

  $: activeTabMiniBrowser = useScopedMiniBrowserAsStore(`tab-${$activeTabId}`)
  $: activeTabMiniBrowserIsOpen = $activeTabMiniBrowser?.isOpen

  $: canGoBack = (() => {
    if ($showNewTabOverlay !== 0) return false
    if (activeTabMiniBrowserIsOpen !== undefined && $activeTabMiniBrowserIsOpen) return false

    return $activeTab?.type === 'page' && $activeTab?.currentHistoryIndex > 0
  })()

  $: canGoForward = (() => {
    if ($showNewTabOverlay !== 0) return false
    if (activeTabMiniBrowserIsOpen !== undefined && $activeTabMiniBrowserIsOpen) return false

    return (
      $activeTab?.type === 'page' &&
      $activeTab?.currentHistoryIndex < $activeTab.historyStackIds.length - 1
    )
  })()

  $: canReload = (() => {
    if ($showNewTabOverlay !== 0) return false
    if (activeTabMiniBrowserIsOpen !== undefined && $activeTabMiniBrowserIsOpen) return false

    return $activeTab?.type === 'page'
  })()

  $: {
    handleRightSidebarTabsChange($rightSidebarTab)
  }

  $: if ($activeTab?.archived !== ($sidebarTab === 'archive')) {
    log.debug('Active tab is not in view, resetting')
    tabsManager.makePreviousActive()
  }

  $: if (onboardingActive) {
    // Set onboarding to active if the user is on the onboarding tab or an active onboarding timeline is running.
    if ($activeTab?.type === 'onboarding' || hasActiveTimeline) {
      onboardingActive.set(false)
    } else {
      onboardingActive.set(true)
    }
  }

  const openResourceDetailsModal = async (
    resourceId: string,
    from?: OpenInMiniBrowserEventFrom
  ) => {
    globalMiniBrowser.openResource(resourceId, { from })
  }

  const handleDeleteTab = async (
    e: CustomEvent<{ tabId: string; trigger: DeleteTabEventTrigger }>
  ) => {
    await tabsManager.delete(e.detail.tabId, e.detail.trigger)
  }

  const handeCreateResourceFromOasis = async (e: CustomEvent<string>) => {
    const newTab = await tabsManager.addPageTab(e.detail, {
      active: true,
      trigger: CreateTabEventTrigger.OasisCreate
    })

    // Since we dont have the webview available right here, we need to wait a bit before we can handle the bookmark
    await wait(10000)

    if (newTab) {
      await handleBookmark(newTab.id, false, SaveToOasisEventTrigger.CreateMenu)
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
        const defaultSearchEngine =
          SEARCH_ENGINES.find((e) => e.key === $userConfigSettings.search_engine) ??
          SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
        if (!defaultSearchEngine)
          throw new Error('No search engine / default engine found, config error?')

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

    addressBarFocus.set(false)

    let addressVal = activeTabComponent && get(activeTabComponent?.inputUrl)
    log.debug('Address bar blur', addressVal)

    if (!addressVal) {
      return
    }

    if ($activeTab?.type === 'page') {
      log.debug('Navigating to address from page', addressVal)
      const url = getNavigationURL(addressVal)
      $activeBrowserTab?.navigate(url)

      if (url === $activeTabLocation) {
        $activeBrowserTab?.reload()
      } else {
        tabsManager.updateActive({ initialLocation: url })
      }
    } else if ($activeTab?.type === 'empty') {
      log.debug('Navigating to address from empty tab', addressVal)
      const url = getNavigationURL(addressVal)
      log.debug('Converting empty tab to page', url)
      tabsManager.updateActive({
        type: 'page',
        initialLocation: url,
        historyStackIds: [],
        currentHistoryIndex: -1
      })
    } else if ($activeTab?.type === 'chat') {
      log.debug('Renaming chat tab', addressVal)
      tabsManager.updateActive({ title: addressVal })
    }
  }

  const handleFocus = () => {
    addressBarFocus.set(true)
    activeTabComponent?.editAddress()
  }

  const getActiveMiniBrowser = () => {
    if (globalMiniBrowser.isOpenValue) {
      const selectedItem = globalMiniBrowser.selected ? get(globalMiniBrowser.selected) : null

      if (!selectedItem) {
        return null
      }

      return {
        miniBrowser: globalMiniBrowser,
        selected: selectedItem
      }
    }

    if (activeTabMiniBrowserIsOpen && $activeTabMiniBrowserIsOpen && $activeTabMiniBrowser) {
      const selectedItem = $activeTabMiniBrowser.selected
        ? get($activeTabMiniBrowser.selected)
        : null

      if (!selectedItem) {
        return null
      }

      return {
        miniBrowser: $activeTabMiniBrowser,
        selected: selectedItem
      }
    }

    return null
  }

  const handleCopyLocation = useDebounce(() => {
    const activeTabMiniBrowser = getActiveMiniBrowser()
    if (activeTabMiniBrowser) {
      window.api.copyToClipboard(
        activeTabMiniBrowser.selected.data.currentLocation ||
          activeTabMiniBrowser.selected.data.initialLocation
      )

      toasts.success('Copied to Clipboard!')
      return
    }

    if ($activeTabLocation) {
      log.debug('Copying location to clipboard', $activeTabLocation)
      window.api.copyToClipboard($activeTabLocation)
      toasts.success('Copied to Clipboard!')
    }
  }, 200)

  const createHistoryTab = useDebounce(async (opts?: CreateTabOptions) => {
    log.debug('Creating new history tab')

    // check if there already exists a history tab, if yes we just change to it

    const historyTab = $tabs.find((tab) => tab.type === 'history')

    if (historyTab) {
      tabsManager.makeActive(historyTab.id)
      return
    }

    await tabsManager.create<TabHistory>(
      {
        title: 'History',
        icon: '',
        type: 'history'
      },
      { active: true }
    )
  }, 200)

  $: savedTabsOrientation = $userConfigSettings.tabs_orientation
  $: horizontalTabs = savedTabsOrientation === 'horizontal'
  $: showSidebarTools = $userConfigSettings.annotations_sidebar || $userConfigSettings.go_wild_mode

  const handleCollapseRight = () => {
    if (showRightSidebar) {
      showRightSidebar = false
    }

    if ($activeTabMagic.showSidebar) {
      setPageChatState(false)
    }
  }

  const handleExpandRight = () => {
    showRightSidebar = true
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
    showLeftSidebar = false
    changeTraficLightsVisibility(false)
  }

  const handleExpand = () => {
    log.debug('Expanding sidebar')
    showLeftSidebar = true
    changeTraficLightsVisibility(true)
  }

  const handleRightSidebarTabsChange = (tab: RightSidebarTab) => {
    // check if sidebar is even open
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

  const toggleRightSidebarTab = useDebounce((tab: RightSidebarTab) => {
    log.debug('Toggling right sidebar tab', tab, $rightSidebarTab, showRightSidebar)
    if ($rightSidebarTab === tab && showRightSidebar) handleCollapseRight()
    else openRightSidebarTab(tab)
  }, 100)

  const changeTraficLightsVisibility = (visible: boolean) => {
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
      if ($showNewTabOverlay !== 0) return
      if ($showScreenshotPicker) {
        $showScreenshotPicker = false
        return
      }

      if (get(globalMiniBrowser.isOpen)) {
        globalMiniBrowser.close()
        return
      }

      const activeTabMiniBrowser = miniBrowserService.useScopedBrowser(`tab-${$activeTabId}`, false)
      if (activeTabMiniBrowser) {
        activeTabMiniBrowser.close()
        return
      }

      deselectAllTabs()
    } else if (e.metaKey && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      debugMode.update((mode) => !mode)

      // @ts-ignore
      if (window.LOG_LEVEL === 'debug') {
        // @ts-ignore
        window.setLogLevel('info')
      } else {
        // @ts-ignore
        window.setLogLevel('debug')
      }
    } else if (e.key === 'Enter' && $addressBarFocus) {
      console.warn('addr foc')
      handleBlur()
      activeTabComponent?.blur()
    } else if (e.key === 'Enter' && $selectedTabs.size > 1) {
      console.warn('enter magic')

      startChatWithSelectedTabs()
    } else if (e.key === 'Backspace' && $selectedTabs.size > 1 && !$activeTabMagic.showSidebar) {
      const tabsToDelete = Array.from($selectedTabs)
      tabsToDelete.forEach((tab) => tabsManager.delete(tab.id))
      selectedTabs.set(new Set())
    } else if (isModKeyAndKeyPressed(e, 'w')) {
      // Note: even though the electron menu handles the shortcut this is still needed here
      if ($showNewTabOverlay !== 0) setShowNewTabOverlay(0)
      else tabsManager.deleteActive(DeleteTabEventTrigger.Shortcut)
    } else if (isModKeyAndKeyPressed(e, 'e')) {
      if ($showNewTabOverlay !== 0) setShowNewTabOverlay(0)
      toggleRightSidebarTab('chat')
    } else if (isModKeyAndKeyPressed(e, 'd')) {
      handleBookmark($activeTabId, false, SaveToOasisEventTrigger.Shortcut)
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
    } else if (isModKeyAndKeyPressed(e, 'l') && !e.shiftKey) {
      handleEdit()
    } else if (isModKeyAndKeyPressed(e, 'j')) {
      // showTabSearch = !showTabSearch
    } else if (isModKeyAndKeyPressed(e, 'y')) {
      setShowNewTabOverlay(0)
      createHistoryTab()
    } else if (
      isModKeyAndEventCodeIs(e, 'Plus') ||
      isModKeyAndEventCodeIs(e, 'Equal') ||
      isModKeyAndEventCodeIs(e, 'BracketRight')
    ) {
      setShowNewTabOverlay(0)
      $activeBrowserTab?.zoomIn()
    } else if (isModKeyAndEventCodeIs(e, 'Minus') || isModKeyAndEventCodeIs(e, 'Slash')) {
      setShowNewTabOverlay(0)
      $activeBrowserTab?.zoomOut()
    } else if (isModKeyAndKeyPressed(e, '0') || isModKeyAndEventCodeIs(e, 'Digit0')) {
      setShowNewTabOverlay(0)
      $activeBrowserTab?.resetZoom()
    } else if (isModKeyAndShiftKeyAndKeyPressed(e, 't')) {
      tabsManager.reopenDeleted()
    } else if (
      !window.api.disableTabSwitchingShortcuts &&
      isModKeyAndKeysPressed(e, ['1', '2', '3', '4', '5', '6', '7', '8', '9']) &&
      !e.shiftKey
    ) {
      const index = parseInt(e.key, 10) - 1
      const tabs = [...$pinnedTabs, ...$unpinnedTabs]

      if (index < 8) {
        if (index < tabs.length) {
          tabsManager.makeActive(tabs[index].id, ActivateTabEventTrigger.Shortcut)
        }
      } else {
        // if 9 is pressed, go to the last tab
        tabsManager.makeActive(tabs[tabs.length - 1].id, ActivateTabEventTrigger.Shortcut)
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

  const startChatWithSelectedTabs = () => {
    if (($activeTab?.type === 'page' || $activeTab?.type === 'space') && !showRightSidebar) {
      toggleRightSidebar()
      setPageChatState(true)
      // Turn selected tabs into magic tabs
      tabs.update((allTabs) => {
        return allTabs.map((tab) => {
          const isSelected = Array.from($selectedTabs).some((item) => item.id === tab.id)
          if (isSelected) {
            return { ...tab, magic: true }
          }
          return tab
        })
      })

      // Update selectedTabs to reflect the change
      selectedTabs.update((selected) => {
        const updatedSelection = new Set(
          Array.from(selected).map((item) => ({ ...item, userSelected: true }))
        )
        return updatedSelection
      })
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
  const debouncedCycleActiveTab = useDebounce((previous) => {
    const tabId = tabsManager.cycle(previous)
    if (tabId && tabId != $activeTabId) selectTab(tabId, ActivateTabEventTrigger.Shortcut)
  }, 100)

  const openUrlHandler = (url: string, active = true) => {
    log.debug('open url', url, active)

    tabsManager.addPageTab(url, { active: active, trigger: CreateTabEventTrigger.System })
  }

  const handleTabNavigation = (e: CustomEvent<string>) => {
    log.debug('Navigating to', e.detail)

    tabsManager.updateActive({
      type: 'page',
      initialLocation: e.detail,
      historyStackIds: [],
      currentHistoryIndex: -1
    })

    telemetry.trackCreateTab(CreateTabEventTrigger.AddressBar, true)
  }

  const handleMultiSelect = (event: CustomEvent<string>) => {
    const tabId = event.detail
    const unpinnedTabsArray = get(unpinnedTabs)
    const currentSelectedTabs = get(selectedTabs)

    const addedTabsToMagic: TabPage[] = []

    if (!$lastSelectedTabId) {
      lastSelectedTabId.set($activeTabId)
    }

    const startIndex = unpinnedTabsArray.findIndex((tab) => tab.id === $lastSelectedTabId)
    const endIndex = unpinnedTabsArray.findIndex((tab) => tab.id === tabId)
    const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]

    // Check if the clicked tab is already selected
    const isClickedTabSelected = Array.from(currentSelectedTabs).some((item) => item.id === tabId)

    let numChanged = 0
    selectedTabs.update((t) => {
      const newSelection = new Set(t)

      if (isClickedTabSelected) {
        // Deselect the entire range
        for (let i = start; i <= end; i++) {
          const id = unpinnedTabsArray[i]?.id
          if (id) {
            const item = Array.from(newSelection).find((item) => item.id === id)
            if (item) {
              newSelection.delete(item)
              numChanged--
            }
          }
        }
      } else {
        // Select the entire range
        for (let i = start; i <= end; i++) {
          const id = unpinnedTabsArray[i]?.id
          if (id) {
            const item = Array.from(newSelection).find((item) => item.id === id)
            if (!item) {
              newSelection.add({ id, userSelected: true })
              numChanged++
            }
          }
        }
      }

      return newSelection
    })

    // Update magic status based on the new selection model
    tabs.update((tabs) => {
      const newSelection = get(selectedTabs)
      return tabs.map((tab) => {
        const shouldBeMagic =
          $activeTabMagic.showSidebar && Array.from(newSelection).some((item) => item.id === tab.id)

        if (tab.type === 'page' && shouldBeMagic) {
          addedTabsToMagic.push(tab)
        }

        return {
          ...tab,
          magic: shouldBeMagic
        }
      })
    })

    lastSelectedTabId.set(tabId)

    // Ensure no gaps in selection when switching modes
    if (!$activeTabMagic.showSidebar) {
      selectedTabs.update((t) => new Set(t))
    }

    if (addedTabsToMagic.length > 0) {
      preparePageTabsForChatContext(addedTabsToMagic)
    }

    tick().then(() => {
      if ($activeTabMagic.showSidebar) {
        telemetry.trackPageChatContextUpdate(
          PageChatUpdateContextEventAction.MultiSelect,
          $magicTabs.length,
          numChanged
        )
      } else {
        telemetry.trackSelectTab(SelectTabEventAction.MultiSelect, $selectedTabs.size, numChanged)
      }
    })
  }

  const handlePassiveSelect = (event: CustomEvent<string>) => {
    const tabId = event.detail
    let addedTabToMagic: Tab | null = null
    let addedTabToSelection = false

    selectedTabs.update((t) => {
      const newSelection = new Set(t)
      const isMagicMode = $activeTabMagic.showSidebar

      const existingItem = Array.from(newSelection).find((item) => item.id === tabId)
      if (existingItem) {
        newSelection.delete(existingItem)
        addedTabToSelection = false
      } else {
        newSelection.add({ id: tabId, userSelected: true })
        addedTabToSelection = true
      }

      if (isMagicMode) {
        tabs.update((t) => {
          const updatedTabs = t.map((tab) => {
            if (tab.id === tabId) {
              const enableMagic = !existingItem
              if (enableMagic) {
                addedTabToMagic = tab
              }
              return { ...tab, magic: enableMagic }
            }
            return tab
          })
          return updatedTabs
        })
      }

      return newSelection
    })

    lastSelectedTabId.set(tabId)

    if (addedTabToMagic) {
      preparePageTabsForChatContext([addedTabToMagic])
    }

    tick().then(() => {
      if ($activeTabMagic.showSidebar) {
        if (addedTabToMagic) {
          telemetry.trackPageChatContextUpdate(
            PageChatUpdateContextEventAction.Add,
            $magicTabs.length
          )
        } else {
          telemetry.trackPageChatContextUpdate(
            PageChatUpdateContextEventAction.Remove,
            $magicTabs.length
          )
        }
      } else {
        telemetry.trackSelectTab(
          addedTabToSelection ? SelectTabEventAction.Add : SelectTabEventAction.Remove,
          $selectedTabs.size
        )
      }
    })
  }

  const selectTabWhileKeepingOthersSelected = (tabId: string) => {
    let addedTabToMagic: Tab | null = null

    log.debug('select tab while keeping others selected', tabId)

    log.debug('selected tabs', $selectedTabs)

    // mark all currently selected tabs as user selected so they don't get deselected
    selectedTabs.update((t) => {
      const newSelection = new Set(t)

      newSelection.forEach((item) => {
        if (!item.userSelected) {
          newSelection.delete(item)
          newSelection.add({ ...item, userSelected: true })
        }
      })

      const existingItem = Array.from(newSelection).find((item) => item.id === tabId)
      if (!existingItem) {
        newSelection.add({ id: tabId, userSelected: true })
      }

      const activeTabItem = Array.from(newSelection).find((item) => item.id === $activeTabId)
      if (!activeTabItem) {
        newSelection.add({ id: $activeTabId, userSelected: true })
      }

      return newSelection
    })

    log.debug('selected tabs', $selectedTabs)

    tabs.update((t) => {
      const updatedTabs = t.map((tab) => {
        if (tab.id === tabId) {
          addedTabToMagic = tab
          return { ...tab, magic: true }
        }
        return tab
      })
      return updatedTabs
    })

    lastSelectedTabId.set(tabId)

    if (addedTabToMagic) {
      preparePageTabsForChatContext([addedTabToMagic])
    }

    // Make the tab active
    tabsManager.makeActive(tabId, ActivateTabEventTrigger.Click)

    tick().then(() => {
      telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.ActiveChanged,
        $magicTabs.length
      )
    })
  }

  const openContextItemAsTab = async (contextItem: ContextItem) => {
    if (contextItem.type === 'tab') {
      selectTabWhileKeepingOthersSelected(contextItem.data.id)
    } else if (contextItem.type === 'resource') {
      const existingTab = $tabs.find(
        (tab) => tab.type === 'resource' && tab.resourceId === contextItem.data.id
      )
      if (existingTab) {
        selectTabWhileKeepingOthersSelected(existingTab.id)
      } else {
        const tab = await openResourcFromContextAsPageTab(contextItem.data.id)
        if (tab) {
          selectTabWhileKeepingOthersSelected(tab.id)
        }
      }
    } else if (contextItem.type === 'space') {
      const existingTab = $tabs.find(
        (tab) => tab.type === 'space' && tab.spaceId === contextItem.data.id
      )
      if (existingTab) {
        selectTabWhileKeepingOthersSelected(existingTab.id)
      } else {
        const existingContextTab = $chatContextItems.find(
          (item) => item.type === 'space' && item.data.id === contextItem.data.id
        )

        const newTab = await tabsManager.addSpaceTab(contextItem.data, {
          active: false,
          trigger: CreateTabEventTrigger.OasisChat
        })

        selectTabWhileKeepingOthersSelected(newTab.id)

        if (existingContextTab) {
          log.debug('removing existing context item for same resource', existingContextTab.id)
          removeContextItem(existingContextTab.id)
        }

        log.debug('created tab for space', newTab)
      }
    } else {
      log.debug('cannot open context item as tab', contextItem)
      toasts.info('Cannot open this item as a tab')
    }
  }

  const selectTab = (tabId: string, trigger?: ActivateTabEventTrigger) => {
    const currentSelectedTabs = Array.from(get(selectedTabs))
    const currentTab = currentSelectedTabs.find((item) => item.id === tabId)

    // Update selectedTabs to only include the newly selected tab
    if (!$activeTabMagic.showSidebar) {
      selectedTabs.set(new Set([{ id: tabId, userSelected: currentTab?.userSelected || false }]))
    }

    tabsManager.makeActive(tabId, trigger)

    // If chat mode is activated, update magic tabs
    if ($activeTabMagic.showSidebar) {
      updateMagicTabs(tabId, currentSelectedTabs, currentTab)
      cleanUpSelectedTabs()
      synchronizeMagicTabsWithSelection()
      trackMagicTabChanges()
    }

    lastSelectedTabId.set(tabId)
  }

  const updateMagicTabs = (tabId: string, currentSelectedTabs: any[], currentTab: any) => {
    let addedTabToMagic: Tab | null = null
    tabs.update((allTabs) => {
      return allTabs.map((tab) => {
        // If the tab is the one that was just selected, mark it as a magic tab
        if (tab.id === tabId) {
          addedTabToMagic = tab
          return { ...tab, magic: true }
        }
        // If the tab is the last selected tab, update its magic status based on user selection
        else if (tab.id === $lastSelectedTabId) {
          const isUserSelected = currentSelectedTabs.find(
            (item) => item.id === tab.id
          )?.userSelected
          return { ...tab, magic: isUserSelected ? tab.magic : false }
        }
        // If the current tab is not user-selected and is not the active tab, remove it from selected tabs and mark it as non-magic
        else if (!currentTab?.userSelected && tab.id !== $activeTabId) {
          selectedTabs.update((t) => {
            t.delete(currentTab)
            return t
          })
          return { ...tab, magic: false }
        }
        // For all other tabs, return them unchanged
        return tab
      })
    })

    if (addedTabToMagic) {
      preparePageTabsForChatContext([addedTabToMagic])
    }
  }

  const cleanUpSelectedTabs = () => {
    selectedTabs.update((t) => {
      const newSelection = new Set(t)
      newSelection.forEach((item) => {
        if (!item.userSelected && item.id !== $activeTabId) {
          newSelection.delete(item)
        }
      })
      return newSelection
    })
  }

  const synchronizeMagicTabsWithSelection = () => {
    tabs.update((allTabs) => {
      return allTabs.map((tab) => {
        const isUserSelected = Array.from(get(selectedTabs)).some((item) => item.id === tab.id)
        return { ...tab, magic: isUserSelected || tab.id === $activeTabId }
      })
    })
  }

  const trackMagicTabChanges = () => {
    tick().then(() => {
      telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.ActiveChanged,
        $magicTabs.length
      )
    })
  }

  const deselectAllTabs = () => {
    log.debug('deselect tabs')
    selectedTabs.set(new Set())
    lastSelectedTabId.set(null)

    handleEndOnboardingTooltips()

    tabs.update((x) => {
      return x.map((tab) => {
        return {
          ...tab,
          magic: false
        }
      })
    })

    activeTabId.set('')
    activeTabMagic.set({
      running: false,
      showSidebar: false,
      initializing: false,
      responses: [],
      errors: []
    })

    if (showRightSidebar) {
      handleCollapseRight()
    }
  }

  function openScreenshotPicker(mode: ScreenshotPickerMode = 'inline') {
    $showScreenshotPicker = true
    $screenshotPickerMode = mode
  }

  function handlePickScreenshotForChat() {
    openScreenshotPicker('sidebar')
  }

  function updateBookmarkingTabState(tabId: string, value: BookmarkTabState | null) {
    if (value === null) {
      bookmarkingTabsState.update((state) => {
        const newState = { ...state }
        delete newState[tabId]
        return newState
      })
    } else {
      bookmarkingTabsState.update((state) => {
        return { ...state, [tabId]: value }
      })
    }
  }

  async function handleBookmark(
    tabId: string,
    savedToSpace = false,
    trigger: SaveToOasisEventTrigger = SaveToOasisEventTrigger.Click
  ): Promise<{ resource: Resource | null; isNew: boolean }> {
    let toast: ToastItem | null = null

    try {
      const tab = $tabs.find((t: Tab) => t.id === tabId)

      if (!tab || tab.type !== 'page') {
        log.error('invalid tab for bookmarking', tab)
        return { resource: null, isNew: false }
      }

      updateBookmarkingTabState(tabId, 'in_progress')
      toast = toasts.loading('Saving Page…')

      let browserTab = $browserTabs[tabId]
      const isActivated = $activatedTabs.includes(tab.id)
      if (!isActivated) {
        log.debug('Tab not activated, activating first', tab.id)
        activatedTabs.update((tabs) => {
          return [...tabs, tab.id]
        })

        // give the tab some time to load
        await wait(200)

        browserTab = $browserTabs[tab.id]
        if (!browserTab) {
          log.error('Browser tab not found', tab.id)
          throw Error(`Browser tab not found`)
        }

        log.debug('Waiting for tab to become active', tab.id)
        await browserTab.waitForAppDetection(3000)
      }

      const resource = await browserTab.bookmarkPage({
        silent: false,
        createdForChat: false,
        freshWebview: true
      })
      oasis.pushPendingStackAction(resource.id, { tabId: tabId })

      updateBookmarkingTabState(tabId, 'success')
      toast?.success('Page Saved!')

      oasis.reloadStack()

      await telemetry.trackSaveToOasis(resource.type, trigger, savedToSpace)

      return { resource, isNew: true }
    } catch (e) {
      log.error('error creating resource', e)

      updateBookmarkingTabState(tabId, 'error')

      if (toast) {
        toast?.error('Failed to save page!')
      } else {
        toasts.error('Failed to save page!')
      }
      return { resource: null, isNew: false }
    } finally {
      setTimeout(() => {
        updateBookmarkingTabState(tabId, null)
      }, 1500)
    }
  }

  const handleRemoveBookmark = async (tabId: string) => {
    const tab = $tabs.find((t: Tab) => t.id === tabId)

    if (!tab || tab.type !== 'page') {
      log.error('invalid tab for bookmarking', tab)
      return
    }

    const resourceId = tab.resourceBookmark
    if (!resourceId) {
      log.error('no resource bookmark found', tab)
      return
    }

    const confirmed = await confirm('Are you sure you want to delete this page from your stuff?')
    if (!confirmed) {
      return
    }

    const toast = toasts.loading('Deleting from your stuff…')
    updateBookmarkingTabState(tabId, 'in_progress')

    try {
      await resourceManager.deleteResource(resourceId)
      tabsManager.update(tabId, {
        resourceBookmark: null,
        chatResourceBookmark: null,
        resourceBookmarkedManually: false
      })
      toast.success('Deleted page from your stuff!')
    } catch (e) {
      log.error('error deleting resource', e)
      toast.error('Failed to delete page from your stuff!')
    }

    updateBookmarkingTabState(tabId, null)
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
      tabsManager.update(tab.id, { resourceBookmark: null, chatResourceBookmark: null })
    }

    if (tab.chatResourceBookmark) {
      const resource = await resourceManager.getResource(tab.chatResourceBookmark)
      if (!resource) {
        return
      }

      const isSilent =
        (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)?.value ===
        'true'

      if (isSilent) {
        log.debug(
          'deleting silent chat resource as the tab has navigated away',
          tab.chatResourceBookmark
        )
        await resourceManager.deleteResource(resource.id)
      }
    }
  }

  function handleCreateChat(e: CustomEvent<string>) {
    log.debug('create chat', e.detail)

    tabsManager.updateActive({ type: 'chat', query: e.detail, title: e.detail, icon: '' })
  }

  const createSpaceWithTabs = async (tabIds: string[]) => {
    const toast = toasts.loading('Creating space with tabs..')
    try {
      const targetTabs = tabIds
        .map((id) => $tabs.find((t: Tab) => t.id === id))
        .filter((t) => t !== undefined) as Tab[]

      // Create a new space
      const newSpace = await oasis.createSpace({
        folderName: 'New Space',
        showInSidebar: true,
        colors: ['#FFD700', '#FF8C00'], // Default colors, you can randomize this
        sources: [],
        sortBy: 'created_at',
        liveModeEnabled: false
      })

      // Create resources from selected tabs and add them to the space
      const resourceIds = []
      for (const tab of targetTabs) {
        if (tab.type === 'page') {
          if (tab.resourceBookmark) {
            const existingResource = await resourceManager.getResource(tab.resourceBookmark)
            const isDeleted =
              existingResource?.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.DELETED)
                ?.value === 'true'

            if (existingResource && !isDeleted) {
              const existingCanonical = (existingResource?.tags ?? []).find(
                (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
              )

              log.debug('existing canonical', existingCanonical)

              if (existingCanonical?.value === tab.currentLocation) {
                log.debug('already bookmarked, removing silent tag', tab.resourceBookmark)

                const isSilent = (existingResource.tags ?? []).some(
                  (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
                )

                if (isSilent) {
                  // mark resource as not silent since the user is explicitely bookmarking it
                  await resourceManager.deleteResourceTag(
                    tab.resourceBookmark,
                    ResourceTagsBuiltInKeys.SILENT
                  )
                }
              }
            }

            resourceIds.push(tab.resourceBookmark)
          } else {
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
            resourceIds.push(newResources[0].id)
          }
        } else if (tab.type === 'resource') {
          resourceIds.push((tab as TabResource).resourceId)
        }
      }

      const validResourceIds = resourceIds.filter((id) => id !== null) as string[]
      await oasis.addResourcesToSpace(newSpace.id, validResourceIds, SpaceEntryOrigin.ManuallyAdded)

      await tabsManager.addSpaceTab(newSpace, { active: true })

      $selectedTabs = new Set()
      for (const tab of targetTabs) tabsManager.delete(tab.id, DeleteTabEventTrigger.ContextMenu)

      toast.success('Space created!')
    } catch (e) {
      log.error('Failed to create space with tabs', e)
      toast.error('Failed to create space with tabs!')
    }
  }

  function handleRag(e: CustomEvent<string>) {
    log.debug('rag search', e.detail)

    tabsManager.updateActive({
      type: 'chat',
      query: e.detail,
      title: e.detail,
      icon: '',
      ragOnly: true
    })
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

  const openResourcFromContextAsPageTab = async (resourceId: string) => {
    const existingContextTab = $chatContextItems.find(
      (item) => item.type === 'resource' && item.data.id === resourceId
    )

    const resource = await resourceManager.getResource(resourceId)
    const url = resource?.tags?.find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
    )?.value

    let tab: Tab | null = null
    if (url) {
      tab = await tabsManager.addPageTab(url, {
        active: false,
        trigger: CreateTabEventTrigger.OasisChat
      })
    } else {
      log.debug('no url found for resource, using resource tab as fallback', resourceId)

      const resource = await resourceManager.getResource(resourceId)
      if (resource) {
        tab = await tabsManager.addResourceTab(resource, {
          active: false,
          trigger: CreateTabEventTrigger.OasisChat
        })
      }
    }

    if (!tab) {
      log.error('failed to open resource from context', resourceId)
      toasts.error('Failed to open as tab')
      return null
    }

    if (existingContextTab) {
      log.debug('removing existing context item for same resource', existingContextTab.id)
      removeContextItem(existingContextTab.id)
    }

    return tab
  }

  const highlightWebviewText = async (
    resourceId: string,
    answerText: string,
    sourceUid?: string
  ) => {
    log.debug('highlighting text', resourceId, answerText, sourceUid)

    const tabs = [...getTabsInChatContext(), ...$unpinnedTabs]
    let tab = tabs.find((tab) => tab.type === 'page' && tab.resourceBookmark === resourceId) || null

    if (!tab) {
      tab = await openResourcFromContextAsPageTab(resourceId)
      if (!tab) {
        log.error('failed to open resource from context', resourceId)
        toasts.error('Failed to highlight citation')
        return
      }

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

      tabsManager.makeActive(tab.id, ActivateTabEventTrigger.ChatCitation)

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

      await browserTab.highlightWebviewText(resourceId, answerText)
    } else {
      log.error('No tab in chat context found for resource', resourceId)
      toasts.error('Failed to highlight citation')
    }
  }

  const handleSeekToTimestamp = async (resourceId: string, timestamp: number) => {
    log.info('seeking to timestamp', resourceId, timestamp)

    const tabs = [...getTabsInChatContext(), ...$unpinnedTabs]
    let tab = tabs.find((tab) => tab.type === 'page' && tab.resourceBookmark === resourceId) || null

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

      tab = await tabsManager.addPageTab(url, {
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

      tabsManager.makeActive(tab.id, ActivateTabEventTrigger.ChatCitation)
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
      tabsManager.update($activeTabId, { appId: appId })
    } catch (e) {
      log.error('Error clearing app sidebar:', e)
    }
  }

  const preparePDFPageForChat = async (tab: TabPage) => {
    const browserTab = $browserTabs[tab.id]

    const url = tab.currentLocation || tab.initialLocation

    const downloadData = await new Promise<Download | null>((resolve) => {
      const timeout = setTimeout(() => {
        downloadIntercepters.delete(url)
        resolve(null)
      }, CHAT_DOWNLOAD_INTERCEPT_TIMEOUT)

      downloadIntercepters.set(url, (data) => {
        clearTimeout(timeout)
        downloadIntercepters.delete(url)
        resolve(data)
      })

      // initiate download
      browserTab.downloadURL(url)
    })

    if (!downloadData) {
      return null
    }

    log.debug('intercepted download', downloadData)

    tabsManager.update(tab.id, {
      chatResourceBookmark: downloadData.resourceId,
      resourceBookmark: downloadData.resourceId,
      resourceBookmarkedManually: false
    })

    const resource = await resourceManager.getResource(downloadData.resourceId)
    log.debug('downloaded resource', resource)
    return resource
  }

  const prepareTabForChatContext = async (tab: TabPage | TabSpace | TabResource) => {
    if (tab.type === 'space' || tab.type === 'resource') {
      log.debug('Preparing space tab for chat context', tab.id)
      return
    }

    const isActivated = $activatedTabs.includes(tab.id)
    if (!isActivated) {
      log.debug('Tab not activated, activating first', tab.id)
      activatedTabs.update((tabs) => {
        return [...tabs, tab.id]
      })

      // give the tab some time to load
      await wait(200)

      const browserTab = $browserTabs[tab.id]
      if (!browserTab) {
        log.error('Browser tab not found', tab.id)
        throw Error(`Browser tab not found`)
      }

      log.debug('Waiting for tab to become active', tab.id)
      await browserTab.waitForAppDetection(3000)
    }

    log.debug('Preparing tab for chat context', tab.id)
    const getExistingResource = async () => {
      const existingResourceId = tab.resourceBookmark ?? tab.chatResourceBookmark
      if (!existingResourceId) {
        return null
      }

      const fetchedResource = await resourceManager.getResource(existingResourceId)
      if (!fetchedResource) {
        return null
      }

      const isDeleted =
        (fetchedResource?.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.DELETED)
          ?.value === 'true'
      if (isDeleted) {
        log.debug('Existing resource is deleted, ignoring', fetchedResource.id)
        return null
      }

      const fetchedCanonical = (fetchedResource?.tags ?? []).find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
      )?.value

      if (!fetchedCanonical) {
        log.debug(
          'Existing resource has no canonical url, still going to use it',
          fetchedResource.id
        )
        return fetchedResource
      }

      if (fetchedCanonical !== tab.currentLocation) {
        log.debug('Existing resource does not match current location', fetchedCanonical, tab.id)
        return null
      }

      return fetchedResource
    }

    const browserTab = $browserTabs[tab.id]
    if (!browserTab) {
      log.error('Browser tab not found', tab.id)
      throw Error(`Browser tab not found`)
    }

    let tabResource = await getExistingResource()
    if (!tabResource) {
      log.debug('No existing resource found for tab', tab.id)

      const detectedResourceType = tab.currentDetectedApp?.resourceType
      if (detectedResourceType === 'application/pdf') {
        log.debug('Page is PDF')
        tabResource = await preparePDFPageForChat(tab)
      } else {
        log.debug('Bookmarking page for chat context', tab.id)
        tabResource = await browserTab.createResourceForChat()
      }
    } else {
      const url =
        tabResource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
          ?.value ??
        tab.currentLocation ??
        tab.initialLocation

      log.debug(
        'Existing resource found for tab, updating with fresh content',
        tab.id,
        tabResource.id,
        url
      )
      tabResource = await browserTab.refreshResourceWithPage(tabResource, url, false)
    }

    if (!tabResource) {
      log.error('Failed to bookmark page for chat context', tab.id)
      throw Error(`Failed to bookmark page for chat context`)
    }

    log.debug('Tab prepared for chat context', tab.id, tabResource)
    return tabResource
  }

  const preparePageTabsForChatContext = async (tabs?: Array<TabPage | TabSpace | TabResource>) => {
    updateActiveMagicPage({ initializing: true, errors: [] })

    if (!tabs) {
      tabs = getTabsInChatContext()
    }

    log.debug('Making sure resources for all page tabs in context are extracted', tabs)

    await Promise.allSettled(
      tabs.map(async (tab) => {
        if (tab.type === 'onboarding') {
          log.debug('Ignoring onboarding tab', tab.id)
          return
        }
        try {
          await prepareTabForChatContext(tab)
        } catch (e: any) {
          log.error('Error preparing page tabs for chat context', e)
          let errors = $activeTabMagic.errors
          updateActiveMagicPage({ errors: errors.concat(e.message) })
        }
      })
    )

    log.debug('Done preparing page tabs for chat context')
    updateActiveMagicPage({ initializing: false })
  }

  const handlePrepareTabForChat = async (e: CustomEvent<TabPage | TabSpace | TabResource>) => {
    try {
      const tab = e.detail
      if (tab.type === 'page') {
        await preparePDFPageForChat(tab)
      }

      log.debug('Done preparing page tab for chat context')
    } catch (e: any) {
      log.error('Error preparing page tabs for chat context', e)
      let errors = $activeTabMagic.errors
      updateActiveMagicPage({ errors: errors.concat(e.message) })
    }
  }

  const setPageChatState = async (enabled: boolean) => {
    log.debug('Toggling magic sidebar')
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

    if (!enabled) {
      selectedTabs.set(new Set())
    }

    if (enabled) {
      tabs.update((allTabs) => {
        return allTabs.map((tab) => {
          const isSelected = Array.from($selectedTabs).some((item) => item.id === tab.id)
          if (isSelected) {
            return { ...tab, magic: true }
          }
          return tab
        })
      })

      // Update the store with the changed tabs
      for (const tab of $tabs) {
        await tabsDB.update(tab.id, {
          magic: Array.from($selectedTabs.values())
            .map((e) => e.id)
            .includes(tab.id)
        })
      }
    }

    if (!enabled) {
      selectedTabs.set(new Set())
      lastSelectedTabId.set(null)
    }

    // Clear the selection
    toggleTabsMagic(enabled)
    await tick()

    if (enabled) {
      await preparePageTabsForChatContext()
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

      tabsManager.update(tab.id, { appId: appId })
      // updateAppIdsForAppSidebar(appId)
      // await preparePageTabsForChatContext()
    }

    activeAppId.set(appId!)
    showAppSidebar.set(enabled)
  }

  const handleExecuteAppSidebarCode = async (e: CustomEvent<ExecuteCodeInTabEvent>) => {
    try {
      const { tabId, appId, code } = e.detail

      const tab = $tabs.find((t) => t.id === tabId) as TabPage | undefined
      const browserTab = $browserTabs[tabId]
      if (!tab || !browserTab) {
        log.error('Tab not found for executing code')
        toasts.error('Failed to run go wild in page')
        return
      }

      if (tab.appId !== appId) {
        log.error('App ID does not match active tab')
        return
      }

      await browserTab.executeJavaScript(code)
    } catch (e) {
      log.error('Error executing app sidebar code:', e)
      toasts.error('Failed to run go wild in page')
    }
  }

  const createPageAnnotation = async (
    text: string,
    html?: string,
    tags?: string[],
    source?: AnnotationCommentData['source']
  ) => {
    if ($activeTab?.type !== 'page' || !$activeBrowserTab) return

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

      const resource = await $activeBrowserTab.bookmarkPage({ silent: true })
      bookmarkedResource = resource.id
    }

    log.debug('creating annotation', data)
    const annotation = await resourceManager.createResourceAnnotation(data, { sourceURI: url }, [
      ResourceTag.canonicalURL(url),
      ResourceTag.annotates(bookmarkedResource),
      ...(tags?.map((tag) => ResourceTag.hashtag(tag)) ?? [])
    ])

    toasts.success('Saved to My Stuff!')

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
    if (!$activeBrowserTab) {
      log.error('No active browser tab')
      return
    }

    $activeBrowserTab.sendWebviewEvent(WebViewEventReceiveNames.ScrollToAnnotation, e.detail)
  }

  const handleAnnotationSidebarCreate = async (
    e: CustomEvent<{ text: string; html: string; tags: string[] }>
  ) => {
    log.debug('Annotation sidebar create', e.detail)

    const annotation = await createPageAnnotation(
      e.detail.text,
      e.detail.html,
      e.detail.tags,
      'user'
    )

    log.debug('created annotation', annotation)
    annotationsSidebar.reload()
  }

  const handleAnnotationSidebarReload = () => {
    log.debug('Annotation sidebar reload')

    // TODO: implement IPC to update the annotation inline instead of reloading the page
    if (
      $activeTab?.type === 'page' &&
      $activeTab?.currentDetectedApp?.appId !== 'youtube' &&
      $activeBrowserTab
    ) {
      $activeBrowserTab.reload()
    }
  }

  const handleCreateTabFromSpace = async (e: CustomEvent<{ tab: TabSpace; active: boolean }>) => {
    const { tab, active } = e.detail

    log.debug('create tab from sidebar', tab)

    await tabsManager.create(tab, { active: active })

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
        tabsManager.makeActive(existingTab.id)
        return
      }

      await tabsManager.addSpaceTab(space, { active: true })

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
      const { resource } = await handleBookmark($activeTabId, true, SaveToOasisEventTrigger.Click)
      log.debug('bookmarked resource', resource)

      if (resource) {
        log.debug('will add item', resource.id, 'to space', e.detail.id)
        await resourceManager.addItemsToSpace(
          e.detail.id,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )

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

  // const handleCreateNewSpace = async (e: CustomEvent<ShortcutMenuEvents['create-new-space']>) => {
  //   const { name, processNaturalLanguage } = e.detail
  //   const toast = toasts.loading(
  //     processNaturalLanguage ? 'Creating Space with AI...' : 'Creating Space...'
  //   )

  //   try {
  //     log.debug('Create new Space with Name', name, processNaturalLanguage)

  //     const newSpace = await oasis.createSpace({
  //       folderName: name,
  //       colors: ['#FFBA76', '#FB8E4E'],
  //       smartFilterQuery: processNaturalLanguage ? name : null
  //     })

  //     log.debug('New Folder:', newSpace)

  //     if (processNaturalLanguage) {
  //       const userPrompt = JSON.stringify(name)

  //       const response = await resourceManager.getResourcesViaPrompt(userPrompt)

  //       log.debug(`Automatic Folder Generation request`, response)

  //       const results = response.embedding_search_query
  //         ? response.embedding_search_results
  //         : response.sql_query_results
  //       log.debug('Automatic Folder generated with', results)

  //       if (!results) {
  //         log.warn('No results found for', userPrompt, response)
  //         return
  //       }

  //       await oasis.addResourcesToSpace(newSpace.id, results)
  //     }

  //     if (newSpace) {
  //       await tabsManager.addSpaceTab(newSpace, { active: true })
  //     }

  //     await telemetry.trackCreateSpace(CreateSpaceEventFrom.SpaceHoverMenu, {
  //       createdUsingAI: processNaturalLanguage
  //     })

  //     toast.success('Space created!')
  //   } catch (error) {
  //     log.error('Failed to create new space:', error)
  //     toast.error(
  //       processNaturalLanguage
  //         ? 'Failed to create new space with AI, try again with a different name'
  //         : 'Failed to create new space'
  //     )
  //   }
  // }

  const createSpaceSourceFromActiveTab = async (tab: TabPage) => {
    if (!tab.currentDetectedApp) {
      log.debug('No app detected in tab', tab)
      return null
    }

    if (!$activeBrowserTab) {
      log.error('No active browser tab')
      return null
    }

    log.debug('reloading tab to get RSS feed')
    $activeBrowserTab.reload()

    const app = await $activeBrowserTab.waitForAppDetection(5000)
    if (!app) {
      log.debug('No app detected after reload')
      return null
    }

    log.debug('detected app', app)
    // if (app.appId === 'youtube') {
    //   // For youtube we have to manually refresh the tab to make sure we are grabbing the feed of the right page as they don't update it on client side navigations
    //   const validTypes = [ResourceTypes.CHANNEL_YOUTUBE, ResourceTypes.PLAYLIST_YOUTUBE]

    //   if (validTypes.includes(app.resourceType as any)) {
    //     log.debug('reloading tab to get RSS feed')

    //     $activeBrowserTab.reload()

    //     const detectedApp = await $activeBrowserTab.waitForAppDetection(5000)
    //     if (!detectedApp) {
    //       log.debug('No app detected after reload')
    //       return null
    //     }

    //     log.debug('reloaded tab app', detectedApp)
    //     app = detectedApp
    //   }
    // }

    if (!app.rssFeedUrl) {
      log.debug('No RSS feed found for app', app)
      return null
    }

    log.debug('create live space out of app', app)

    let name = tab.title ?? app.appName
    if (name) {
      // remove strings like "(1238)" from the beginning which are usually notification counts
      name = name.replace(/^\(\d+\)\s/, '')
    }

    const spaceSource = {
      id: generateID(),
      name: name ?? 'Unknown',
      type: 'rss',
      url: app.rssFeedUrl,
      last_fetched_at: null
    } as SpaceSource

    return {
      name: name ?? 'Space',
      source: spaceSource
    }
  }

  const handleCreateLiveSpace = async (_e?: MouseEvent) => {
    if ($activeTab?.type !== 'page') {
      log.debug('No page tab active')
      return
    }

    const toast = toasts.loading('Creating Space...')

    try {
      isCreatingLiveSpace.set(true)

      const parsed = await createSpaceSourceFromActiveTab($activeTab)
      if (!parsed) {
        log.debug('No source found for live space')
        toast.error('No feed found for this website')
        return
      }

      const { name, source } = parsed

      log.debug('creating live space', name, source)
      const space = await oasis.createSpace({
        folderName: truncate(name, 35),
        showInSidebar: true,
        colors: colorPairs[Math.floor(Math.random() * colorPairs.length)],
        sources: [source],
        sortBy: 'source_published_at',
        liveModeEnabled: true
      })

      log.debug('created space', space)

      await tabsManager.addSpaceTab(space, { active: true })

      await telemetry.trackCreateSpace(CreateSpaceEventFrom.TabLiveSpaceButton, {
        isLiveSpace: true
      })

      toast.success('Space created!')
    } catch (e) {
      log.error('Error creating live space', e)
      toast.error('Failed to create Space')
    } finally {
      isCreatingLiveSpace.set(false)
    }
  }

  const handleAddSourceToSpace = async (e: CustomEvent<Space>) => {
    if ($activeTab?.type !== 'page') {
      log.debug('No page tab active')
      return
    }

    const toast = toasts.loading('Adding source to Space...')

    try {
      isCreatingLiveSpace.set(true)

      const space = e.detail

      const parsed = await createSpaceSourceFromActiveTab($activeTab)
      if (!parsed) {
        log.debug('No source found for live space')
        toast.error('No feed found for this website')
        return
      }

      const { name, source } = parsed

      log.debug('adding source to space', name, source)
      await oasis.updateSpaceData(space.id, {
        showInSidebar: true,
        sources: [...(space.name.sources ?? []), source],
        sortBy: 'source_published_at',
        liveModeEnabled: true
      })

      log.debug('added source to space', space)

      const existingTab = $unpinnedTabs.find(
        (tab) => tab.type === 'space' && tab.spaceId === space.id
      )

      if (existingTab) {
        tabsManager.makeActive(existingTab.id, ActivateTabEventTrigger.Click)
      } else {
        await tabsManager.addSpaceTab(space, { active: true })
      }

      await telemetry.trackUpdateSpaceSettings(
        {
          setting: 'source',
          change: 'added'
        },
        UpdateSpaceSettingsEventTrigger.TabLiveSpaceButton
      )

      toast.success('Page added as source to Space!')
    } catch (e) {
      log.error('Error creating live space', e)
      toast.error('Failed to add source to Space')
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

      const rect = document.getElementById(`tab-${tab.id}`)?.getBoundingClientRect()
      if (rect) {
        spawnBoxSmoke(rect, {
          densityN: 28,
          size: 13,
          //velocityScale: 0.5,
          cloudPointN: 7
        })
      }

      tabsManager.delete(tab.id)
    }

    oasis.resetSelectedSpace()
  }

  const handleCreateNote = async (e: CustomEvent<string>) => {
    const query = e.detail ?? ''
    log.debug('create note with query', query)

    const resource = await resourceManager.createResourceNote(query)
    await tabsManager.addResourceTab(resource, { active: true })
    toasts.success('Note created!')
  }

  const handleCreateChatWithQuery = async (e: CustomEvent<string>) => {
    const query = e.detail
    log.debug('create chat with query', query)

    openRightSidebarTab('chat')

    await wait(500)

    await excludeOtherTabsFromMagic($activeTabId)

    if (magicSidebar) {
      magicSidebar.startChatWithQuery(query)
    } else {
      log.error('Magic sidebar not found')
      toasts.error('Failed to start chat with query')
    }
  }

  const handleOpenAndChat = async (e: CustomEvent<string | string[]>) => {
    const resourceIds = Array.isArray(e.detail) ? e.detail : [e.detail]

    log.debug('create chat with resources', resourceIds)

    let validTabs: Tab[] = []

    for (const id of resourceIds) {
      try {
        const resource = await resourceManager.getResource(id, { includeAnnotations: false })
        if (resource) {
          const tab = await tabsManager.openResourceAsTab(resource, {
            active: true,
            trigger: CreateTabEventTrigger.OasisMultiSelect
          })
          if (tab) {
            validTabs.push(tab)
          }
        }
      } catch (error) {
        log.error(`Failed to process resource ${id}:`, error)
      }

      if (resourceIds.length > 1) {
        await telemetry.trackMultiSelectResourceAction(
          MultiSelectResourceEventAction.AddToChat,
          resourceIds.length
        )
      }
    }

    if (validTabs.length > 0) {
      openRightSidebarTab('chat')

      for (const tab of validTabs) {
        try {
          await includeTabAndExcludeOthersFromMagic(tab.id)
        } catch (error) {
          log.error(`Failed to include tab ${tab.id} in magic:`, error)
        }
      }

      // Select the tabs
      selectedTabs.set(new Set(validTabs.map((tab) => ({ id: tab.id, userSelected: true }))))

      // Add tabs to magic
      tabs.update((allTabs) => {
        return allTabs.map((tab) => {
          if (validTabs.some((validTab) => validTab.id === tab.id)) {
            cachedMagicTabs.add(tab.id)
            return { ...tab, magic: true }
          }
          return tab
        })
      })

      try {
        await preparePageTabsForChatContext(validTabs)
      } catch (error) {
        log.error('Failed to prepare page tabs for chat context:', error)
      }

      await tick()

      telemetry.trackPageChatContextUpdate(PageChatUpdateContextEventAction.Add, validTabs.length)
    } else {
      log.error('No valid resources found or failed to open as tabs', resourceIds)
      toasts.error('Failed to open resources')
    }
  }
  const handleOpenTabs = async (e: CustomEvent<string | string[]>) => {
    const tabIds = Array.isArray(e.detail) ? e.detail : [e.detail]
    log.debug('open tabs', tabIds)

    let validTabs: Tab[] = []

    for (const id of tabIds) {
      try {
        const resource = await resourceManager.getResource(id, { includeAnnotations: false })
        if (resource) {
          const tab = await tabsManager.openResourceAsTab(resource, {
            active: true,
            trigger: CreateTabEventTrigger.OasisMultiSelect
          })
          if (tab) {
            validTabs.push(tab)
          }
        }
      } catch (error) {
        log.error(`Failed to process resource ${id}:`, error)
      }
    }

    if (tabIds.length > 1) {
      await telemetry.trackMultiSelectResourceAction(
        MultiSelectResourceEventAction.OpenAsTab,
        tabIds.length
      )
    }

    if (validTabs.length > 0) {
      try {
        await preparePageTabsForChatContext(validTabs as (TabPage | TabSpace | TabResource)[])
      } catch (error) {
        log.error('Failed to prepare page tabs for chat context:', error)
      }

      await tick()
    } else {
      log.error('No valid resources found or failed to open as tabs', tabIds)
      toasts.error('Failed to open resources')
    }
  }

  const handleOpenSpaceAndChat = async (e: CustomEvent<ChatWithSpaceEvent>) => {
    const { spaceId, text = '' } = e.detail

    log.debug('create chat with space', spaceId)

    const space = await oasis.getSpace(spaceId)

    if (!space) {
      log.error('Space not found', spaceId)
      toasts.error('Space not found')
      return
    }

    // When the user drops the onboarding space into the chat we start the onboarding
    const ONBOARDING_SPACE_NAME = onboardingSpace.name
    if (space.name.folderName === ONBOARDING_SPACE_NAME) {
      handleAddContextItem(
        new CustomEvent('add-context-item', {
          detail: {
            item: {
              id: space.id,
              type: 'space',
              data: space
            },
            trigger: PageChatUpdateContextEventTrigger.Onboarding
          }
        })
      )

      return
    }

    let tab = $tabs.find((tab) => tab.type === 'space' && tab.spaceId === spaceId)
    if (tab) {
      tabsManager.makeActive(tab.id)
    } else if (!tab) {
      tab = await tabsManager.addSpaceTab(space, { active: true })
    }

    if (tab) {
      openRightSidebarTab('chat')
      await includeTabAndExcludeOthersFromMagic(tab.id)

      // Wait for the chat to be ready
      await wait(500)

      if (magicSidebar) {
        magicSidebar.startChatWithQuery(text)
      } else {
        log.error('Magic sidebar not found')
        toasts.error('Failed to start chat with space')
      }
    } else {
      log.error('Failed to open space as tab')
      toasts.error('Failed to open space')
    }
  }

  const handleChattingWithOnboardingSpace = async (spaceName: string) => {
    const ONBOARDING_SPACE_NAME = onboardingSpace.name
    const ONBOARDING_SPACE_QUERY = onboardingSpace.query

    // When the user drops the onboarding space into the chat we start the onboarding
    if (spaceName === ONBOARDING_SPACE_NAME) {
      endTimeline()
      launchTimeline(OnboardingFeature.ChatWithSpaceOnboardingInChat)
      await handleOnboardingChatWithQuery(
        new CustomEvent('onboardingChatWithQuery', { detail: { query: ONBOARDING_SPACE_QUERY } })
      )

      showNewTabOverlay.set(0)
      return true
    } else {
      return false
    }
  }

  const handleOnboardingChatWithSpace = async (e: CustomEvent<{ id: string; query: string }>) => {
    const { id: spaceId, query } = e.detail

    const space = await oasis.getSpace(spaceId)

    if (space) {
      let tab = $tabs.find((t) => t.spaceId === spaceId)
      log.debug('Current tabs:', $tabs)
      if (!tab) {
        tab = await tabsManager.addSpaceTab(space, { active: false })
        log.debug('Added new space tab:', tab)
      }
      if (tab) {
        await tick()
        await includeTabAndExcludeOthersFromMagic(tab.id)
        openRightSidebarTab('chat')

        const attemptInsertQuery = (retries = 3) => {
          if (magicSidebar) {
            magicSidebar.insertQueryIntoChat(query)
          } else if (retries > 0) {
            setTimeout(() => attemptInsertQuery(retries - 1), 1000)
          } else {
            log.error('Magic sidebar not found after multiple attempts')
            toasts.error('Failed to start chat with prefilled message')
          }
        }

        attemptInsertQuery()
      } else {
        log.error('Failed to open space as tab')
        toasts.error('Failed to open space')
      }
    } else {
      log.error('Space not found', spaceId)
      toasts.error('Space not found')
    }
  }

  const handleOnboardingChatWithQuery = async (e: CustomEvent<{ query: string }>) => {
    const { query } = e.detail

    openRightSidebarTab('chat')

    const attemptInsertQuery = (retries = 3) => {
      if (magicSidebar) {
        magicSidebar.insertQueryIntoChat(query)
      } else if (retries > 0) {
        setTimeout(() => attemptInsertQuery(retries - 1), 1000)
      } else {
        log.error('Magic sidebar not found after multiple attempts')
        toasts.error('Failed to start chat with prefilled message')
      }
    }

    attemptInsertQuery()
  }

  const handleLaunchOnboardingTooltips = (timeline: OnboardingFeature) => {
    launchTimeline(timeline)
  }

  const handleEndOnboardingTooltips = () => {
    console.log('end onboarding tooltips')
    endTimeline()
  }

  const handleOpenOnboardingTabs = (e: CustomEvent<string[]>) => {
    const tabUrls = e.detail
    tabUrls.forEach((url) => {
      tabsManager.addPageTab(url, { active: false })
    })
  }

  let maxWidth = window.innerWidth

  let tabSize = 0

  $: plusBtnLeftPos = $unpinnedTabs.reduce(
    (total, tab) =>
      total +
      4 +
      (tab.id === $activeTabId && tabSize && tabSize <= 260
        ? 260
        : Math.min(300, Math.max(24, tabSize))),
    0
  )
  $: {
    const reservedSpace = 400 + $pinnedTabs.length * 50 + 32
    const availableSpace = maxWidth - reservedSpace
    const numberOfTabs = $unpinnedTabs.length
    tabSize = availableSpace / numberOfTabs
  }

  const handleOasisResize = useThrottle(async () => {
    const previousValue = $showNewTabOverlay
    showNewTabOverlay.set(-1)
    await tick()
    showNewTabOverlay.set(previousValue)
  }, 100)

  const handleResize = async () => {
    maxWidth = window.innerWidth

    handleOasisResize()

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
        $showEndMask = scrollTop + clientHeight <= scrollHeight - 10
      }
    }
  }

  const controlWindow = (action: ControlWindow) => {
    window.api.controlWindow(action)
  }

  onMount(() => {
    const unsubscribeCreated = tabsManager.on('created', (tab, active) => {
      checkScroll()

      // Ensure the new tab is in context when the sidebar is open
      if ($activeTabMagic.showSidebar) {
        // TODO: this should be cleaned up more
        if (active) {
          selectTab(tab.id)
        } else {
          handlePassiveSelect(new CustomEvent('tab-select', { detail: tab.id }))
        }
      }
    })

    const unsubscribeDeleted = tabsManager.on('deleted', async (tab) => {
      checkScroll()

      if (tab.type === 'page' && tab.chatResourceBookmark) {
        const resource = await resourceManager.getResource(tab.chatResourceBookmark)
        if (!resource) {
          log.error('resource not found', tab.chatResourceBookmark)
          return
        }

        const isSilent =
          (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
            ?.value === 'true'

        if (isSilent) {
          log.debug('Deleting resource used in chat as tab was deleted', resource.id)
          await resourceManager.deleteResource(resource.id)

          tabsManager.update(tab.id, { chatResourceBookmark: null })
        }
      }
    })

    const unsubscribeActiveTab = activeTab.subscribe((tab) => {
      if (!tab) return

      if (tab?.type === 'page') {
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

      // TODO: is this needed? persistTabChanges(tab?.id, tab)
    })

    const unsubscribeSidebarTab = sidebarTab.subscribe((tab) => {
      const tabsInView = $tabs.filter((tab) =>
        $sidebarTab === 'active' ? !tab.archived : tab.archived
      )

      if (tabsInView.length === 0) {
        log.debug('No tabs in view')
        return
      }

      if (tab === 'archive' && !$activeTab?.archived) {
        tabsManager.makeActive(tabsInView[0].id)
      } else if (tab === 'active' && $activeTab?.archived) {
        tabsManager.makeActive(tabsInView[0].id)
      }
    })

    return () => {
      unsubscribeCreated()
      unsubscribeDeleted()
      unsubscribeActiveTab()
      unsubscribeSidebarTab()
    }
  })

  onMount(async () => {
    window.addEventListener('resize', handleResize)

    // @ts-ignore
    window.setLogLevel = (level: LogLevel) => {
      // @ts-ignore
      window.LOG_LEVEL = level
      log.debug(`[Logger]: Log level set to '${level}'`)
      toasts.info(`Log level set to '${level}'`)

      return level
    }

    const userConfig = await window.api.getUserConfig()
    log.debug('user config', userConfig)

    await telemetry.init(userConfig)

    // Handle new window requests from webviews
    window.api.onNewWindowRequest((details) => {
      log.debug('new window request', details)

      const { disposition, url } = details
      if (disposition === 'new-window') {
        globalMiniBrowser.openWebpage(url)
        return
      }

      const active = disposition === 'foreground-tab'
      openUrlHandler(url, active)
    })

    window.api.onOpenURL((details) => {
      openUrlHandler(details.url, details.active)
    })

    window.api.onTrackpadScrollStart(() => $browserTabs[$activeTabId]?.handleTrackpadScrollStart())
    window.api.onTrackpadScrollStop(() => $browserTabs[$activeTabId]?.handleTrackpadScrollStop())

    window.api.onGetPrompts(() => {
      return getPrompts()
    })

    window.api.onUpdatePrompt((id, content) => {
      telemetry.trackUpdatePrompt(id)

      return updatePrompt(id as PromptIDs, content)
    })

    window.api.onResetPrompt((id) => {
      telemetry.trackResetPrompt(id)
      return resetPrompt(id as PromptIDs)
    })

    window.api.onToggleSidebar((visible) => {
      changeLeftSidebarState(visible)
    })

    window.api.onToggleTabsPosition(() => {
      handleToggleHorizontalTabs()
    })

    window.api.onCopyActiveTabURL(() => {
      handleCopyLocation()
    })

    window.api.onOpenFeedbackPage(() => {
      openFeedback()
    })

    window.api.onOpenWelcomePage(() => {
      openWelcomeTab()
    })

    window.api.onOpenCheatSheet(() => {
      openCheatSheet()
    })

    window.api.onOpenDevtools(() => {
      const activeTabMiniBrowserSelected = getActiveMiniBrowser()
      if (activeTabMiniBrowserSelected && activeTabMiniBrowserSelected.selected.browserTab) {
        activeTabMiniBrowserSelected.selected.browserTab.openDevTools()
        return
      }

      $activeBrowserTab?.openDevTools()
    })

    window.api.onOpenOasis(() => {
      if ($showNewTabOverlay === 2) {
        $showNewTabOverlay = 0
      } else {
        $showNewTabOverlay = 2
      }
    })

    window.api.onStartScreenshotPicker(() => {
      setShowNewTabOverlay(0)
      if ($showScreenshotPicker === false) {
        openScreenshotPicker()
      } else {
        $showScreenshotPicker = false
      }
    })

    window.api.onOpenHistory(() => {
      setShowNewTabOverlay(0)
      createHistoryTab()
    })

    window.api.toggleRightSidebar(() => {
      toggleRightSidebar()
    })

    window.api.onToggleRightSidebarTab((tab) => {
      toggleRightSidebarTab(tab)
    })

    window.api.onCreateNewTab(() => {
      if ($showNewTabOverlay === 1) {
        $showNewTabOverlay = 0
      } else {
        $showNewTabOverlay = 1
      }
    })

    window.api.onCloseActiveTab(() => {
      const activeTabMiniBrowserSelected = getActiveMiniBrowser()
      if (activeTabMiniBrowserSelected) {
        activeTabMiniBrowserSelected.miniBrowser.close()
        return
      }

      tabsManager.deleteActive(DeleteTabEventTrigger.Shortcut)
    })

    window.api.onReloadActiveTab((force) => {
      if ($showNewTabOverlay !== 0) return

      const activeTabMiniBrowserSelected = getActiveMiniBrowser()
      if (activeTabMiniBrowserSelected && activeTabMiniBrowserSelected.selected.browserTab) {
        if (force) {
          activeTabMiniBrowserSelected.selected.browserTab.forceReload()
        } else {
          activeTabMiniBrowserSelected.selected.browserTab.reload()
        }

        return
      }

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

    window.api.onRequestDownloadPath(async (data) => {
      await tick()

      const downloadIntercepter = downloadIntercepters.get(data.url)
      const existingDownload = downloadResourceMap.get(data.id)
      if (existingDownload) {
        log.debug('download already in progress', data)
        return {
          path: existingDownload.savePath,
          copyToDownloads: !downloadIntercepter && $userConfigSettings.save_to_user_downloads
        }
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

      if (!downloadIntercepter) {
        const toast = toasts.loading(`Downloading "${downloadData.filename}"...`)
        downloadToastsMap.set(data.id, toast)
      }

      // TODO: add metadata/tags here
      const resource = await resourceManager.createResource(
        data.mimeType,
        undefined,
        {
          name: data.filename,
          sourceURI: data.url
        },
        [
          ResourceTag.download(),
          ...(downloadIntercepter
            ? [
                ResourceTag.silent(),
                ResourceTag.createdForChat(),
                ResourceTag.canonicalURL(data.url)
              ]
            : [])
        ]
      )

      log.debug('resource for download created', downloadData, resource)

      downloadData.resourceId = resource.id
      downloadData.savePath = resource.path
      downloadResourceMap.set(data.id, downloadData)

      return {
        path: downloadData.savePath,
        copyToDownloads: !downloadIntercepter && $userConfigSettings.save_to_user_downloads
      }
    })

    window.api.onDownloadUpdated((data) => {
      log.debug('download updated', data)

      const downloadData = downloadResourceMap.get(data.id)
      if (!downloadData) {
        log.error('download data not found', data)
        return
      }

      const toast = downloadToastsMap.get(data.id)
      if (!toast) {
        return
      }

      if (data.state === 'progressing') {
        const progress =
          isFinite(data.receivedBytes) && isFinite(data.totalBytes)
            ? data.receivedBytes / data.totalBytes
            : 0
        const roundedPercent = Math.round(progress * 100)

        if (roundedPercent >= 0 && roundedPercent <= 100) {
          toast.update(`Downloading "${downloadData.filename}" (${roundedPercent}%)...`)
        } else {
          toast.update(`Downloading "${downloadData.filename}"...`)
        }
      } else if (data.state === 'interrupted') {
        toast.error(`Download of "${downloadData.filename}" interrupted`)
      } else if (data.isPaused) {
        toast.info(`Download of "${downloadData.filename}" paused`)
      }
    })

    window.api.onDownloadDone(async (data) => {
      log.debug('download done', data)

      const downloadData = downloadResourceMap.get(data.id)
      if (!downloadData) {
        log.error('download data not found', data)
        return
      }

      if (data.state === 'completed') {
        resourceManager.reloadResource(downloadData.resourceId)
        window.backend.resources.triggerPostProcessing(downloadData.resourceId)
      }

      const toast = downloadToastsMap.get(data.id)
      if (toast) {
        if (data.state === 'completed') {
          toast.success(`"${downloadData.filename}" saved to My Stuff!`)
        } else if (data.state === 'interrupted') {
          toast.error(`Download of "${downloadData.filename}" interrupted`)
        } else if (data.state === 'cancelled') {
          toast.error(`Download of "${downloadData.filename}" cancelled`)
        }
      }

      downloadResourceMap.delete(data.id)

      const downloadIntercepter = downloadIntercepters.get(downloadData.url)
      if (downloadIntercepter) {
        downloadIntercepter(downloadData)
      } else {
        await telemetry.trackFileDownload()
      }
    })

    const tabsList = await tabsDB.all()
    tabs.update((currentTabs) => currentTabs.sort((a, b) => a.index - b.index))
    tabs.set(tabsList)
    log.debug('Tabs loaded', tabsList)

    // TODO: for safety we wait a bit before we tell the app that we are ready, we need a better way to do this
    setTimeout(() => {
      window.api.appIsReady()
    }, 2000)

    const activeTabs = tabsList.filter((tab) => !tab.archived)

    if (activeTabs.length === 0) {
      tabsManager.showNewTab()
    } else if ($activeTabId) {
      tabsManager.makeActive($activeTabId)
    } else {
      tabsManager.makeActive(activeTabs[activeTabs.length - 1].id)
    }

    // activeTabs.forEach((tab, index) => {
    //   tabsManager.update(tab.id, { index: index })
    // })

    // if we have some magicTabs, make them unpinned

    $tabs.forEach((tab: Tab) => {
      removeTabFromMagic(tab.id)
    })

    tabs.update((tabs) => tabs.sort((a, b) => a.index - b.index))

    log.debug('tabs', $tabs)

    await tick()

    checkScroll()

    if (userConfig && !userConfig.initialized_tabs) {
      log.debug('Creating initial tabs')

      showSplashScreen.set(true)

      await createDemoItems(tabsManager, oasis, tabsManager.addSpaceTab, resourceManager)

      await window.api.updateInitializedTabs(true)

      showSplashScreen.set(false)
    } else if (!userConfig?.settings.onboarding.completed_welcome_v2) {
      openWelcomeTab()
    } else if (isDev) {
      // @ts-ignore
      window.createDemoItems = () => {
        createDemoItems(tabsManager, oasis, tabsManager.addSpaceTab, resourceManager)
      }

      // @ts-ignore
      window.createOnboardingSpace = () => {
        createOnboardingSpace(tabsManager, oasis, tabsManager.addSpaceTab, resourceManager)
      }
    }

    prepareContextMenu()
  })

  const openFeedback = () => {
    const url = 'https://surf.featurebase.app/'
    window.open(url, '_blank')
  }

  const openWelcomeTab = async () => {
    const onboardingTab = $tabs.find((tab) => tab.type === 'onboarding')
    if (onboardingTab) {
      tabsManager.makeActive(onboardingTab.id)
    } else {
      await tabsManager.addOnboardingTab(false)
    }
  }

  const openCheatSheet = useDebounce(async (opts?: CreateTabOptions) => {
    const url = 'https://deta.notion.site/Surf-v0-0-1-e9c49ddf02a8476fb3c53b7efdc7e0fd'
    tabsManager.addPageTab(url, {
      active: true
    })
  }, 200)

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

        const rect = document.getElementById(`tab-${tab.id}`)?.getBoundingClientRect()
        if (rect) {
          spawnBoxSmoke(rect, {
            densityN: 28,
            size: 13,
            //velocityScale: 0.5,
            cloudPointN: 7
          })
        }

        // await archiveTab(tabId)

        await tabsManager.delete(tabId, DeleteTabEventTrigger.Click)
      } else {
        // await archiveTab(tabId)
        await tabsManager.delete(tabId, DeleteTabEventTrigger.Click)
      }

      toasts.success('Space removed from sidebar!')
    } catch (error) {
      log.error('Failed to remove space from sidebar:', error)
    }
  }

  const excludeOtherTabsFromMagic = async (tabId: string) => {
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

  const removeMagicTab = (e: CustomEvent<Tab>) => {
    const tab = e.detail

    tabs.update((x) => {
      return x.map((t) => {
        if (t.id === tab.id) {
          cachedMagicTabs.delete(tab.id)
          return {
            ...t,
            magic: false
          }
        }
        return t
      })
    })

    // tick().then(() => {
    //   telemetry.trackPageChatContextUpdate(
    //     PageChatUpdateContextEventAction.Remove,
    //     $magicTabs.length
    //   )
    // })
  }

  const includeTabAndExcludeOthersFromMagic = async (tabId: string) => {
    // include the specified tab and exclude all others from magic
    tabs.update((x) => {
      return x.map((tab) => {
        if (tab.id === tabId) {
          cachedMagicTabs.add(tab.id)
          return {
            ...tab,
            magic: true
          }
        } else {
          cachedMagicTabs.delete(tab.id)
          return {
            ...tab,
            magic: false
          }
        }
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

  const removeTabFromMagic = (tabId: string) => {
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

    // deselect the tab
    selectedTabs.update((t) => {
      const newSelection = new Set(t)
      Array.from(newSelection).forEach((item) => {
        if (item.id === tabId) {
          newSelection.delete(item)
        }
      })
      return newSelection
    })
  }

  const handleExcludeTab = async (e: CustomEvent<string>) => {
    const tabId = e.detail

    removeTabFromMagic(tabId)

    lastSelectedTabId.set($activeTabId)

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

    tabs.update((x) => {
      return x.map((tab) => {
        if (tab.id === tabId) {
          return {
            ...tab,
            magic: true
          }
        }
        return tab
      })
    })

    selectedTabs.update((t) => {
      const newSelection = new Set(t)
      newSelection.add({ id: tabId, userSelected: true })
      return newSelection
    })

    lastSelectedTabId.set($activeTabId)

    await preparePageTabsForChatContext()
    tick().then(() => {
      telemetry.trackPageChatContextUpdate(PageChatUpdateContextEventAction.Add, $magicTabs.length)
    })
  }

  const handleEdit = async () => {
    await tick()
    setShowNewTabOverlay(0)
    activeTabComponent?.editAddress()
    handleFocus()
  }
  const toggleTabsMagic = async (on: boolean) => {
    const allTabs = get(tabs)
    const magicTabsArray = get(magicTabs)
    const unpinnedTabsArray = get(unpinnedTabs)
    const pinnedTabsArray = get(pinnedTabs)

    if (on) {
      log.debug('Toggling tabs magic on', cachedMagicTabs.values())

      const activeTab = allTabs.find((tab) => tab.id === $activeTabId)
      if (
        activeTab &&
        (activeTab.type === 'page' || activeTab.type === 'space' || activeTab.type === 'resource')
      ) {
        log.debug('Using current tab as magic tab')
        cachedMagicTabs.add(activeTab.id)
        tabs.update((x) => {
          return x.map((tab) => {
            if (tab.id === activeTab.id) {
              return {
                ...tab,
                magic: true
              }
            }
            return tab
          })
        })
      } else {
        log.debug('Current tab cannot be used as magic tab, using cached or all tabs')
        if (cachedMagicTabs.size > 0) {
          log.debug('Using cached magic tabs')
          const cachedTabs = Array.from(cachedMagicTabs.values())
          cachedTabs.forEach((id) => {
            const tab = unpinnedTabsArray.find((t) => t.id === id)
          })
        } else {
          log.debug('Creating new magic tabs')
          // Move all unpinned tabs to magic tabs
          unpinnedTabsArray.forEach((tab) => {
            if (tab.type === 'page' || tab.type === 'space') {
              cachedMagicTabs.add(tab.id)
            }
          })
        }
      }
    } else {
      log.debug('Toggling tabs magic off')
      // When turning magic off, maintain the original order
      const updatedTabs = allTabs.map((tab) => {
        if (tab.magic) {
          return { ...tab, magic: false }
        }
        return tab
      })

      tabs.set(updatedTabs)
    }

    // Update indices while maintaining the original order
    const updateIndices = (tabArray: Tab[]) => tabArray.map((tab, index) => ({ ...tab, index }))

    const newUnpinnedTabsArray = updateIndices(allTabs.filter((t) => !t.pinned && !t.magic))
    const newPinnedTabsArray = updateIndices(allTabs.filter((t) => t.pinned))
    const newMagicTabsArray = updateIndices(allTabs.filter((t) => t.magic))

    // Combine all lists back together, maintaining the original order
    const newTabs = [...newUnpinnedTabsArray, ...newPinnedTabsArray, ...newMagicTabsArray]

    // Update the store with the changed tabs
    await tabsManager.bulkPersistChanges(
      newTabs.map((tab) => ({
        id: tab.id,
        updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
      }))
    )

    log.debug('Tabs reset successfully')
  }

  const useAllTabsMagic = () => {
    tabs.update((x) => {
      return x.map((tab) => {
        cachedMagicTabs.add(tab.id)
        return {
          ...tab,
          magic: true
        }
      })
    })
    preparePageTabsForChatContext()
    tick().then(() => {
      telemetry.trackPageChatContextUpdate(PageChatUpdateContextEventAction.Add, $magicTabs.length)
    })
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
    await tabsManager.bulkPersistChanges(
      newTabs.map((tab) => ({
        id: tab.id,
        updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
      }))
    )

    log.debug('State updated successfully')
  }

  const handleDropSidebar = async (drag: DragculaDragEvent<DragTypes>) => {
    log.debug('dropping onto sidebar', drag, ' | ', drag.from?.id, ' >> ', drag.to?.id, ' | ')

    // Used to set pinned property later to drop at correct position
    const pinned = drag.to?.id === 'sidebar-pinned-tabs'

    if (drag.isNative) {
      const parsed = await processDrop(drag.event!)
      log.debug('Parsed', parsed)

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
      log.debug('Resources', newResources)

      for (const r of newResources) {
        const tab = await tabsManager.openResourceAsTab(r, {
          active: false,
          index: drag.index ?? undefined
        })

        // NOTE: Should be opt? when creating tab, but currently api does not support and
        // adding into CreateTabOptions doesnt match other tab apis props
        if (tab && pinned) tabsManager.update(tab!.id, { pinned })

        telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, false)
      }

      return
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
      const droppedTab = drag.item!.data.getData(DragTypeNames.SURF_TAB)
      tabs.update((_tabs) => {
        let unpinnedTabsArray = get(unpinnedTabs)
        let pinnedTabsArray = get(pinnedTabs)
        let magicTabsArray = get(magicTabs)

        let fromTabs: Tab[] = []
        let toTabs: Tab[] = []

        if (drag.from?.id === 'sidebar-unpinned-tabs') {
          fromTabs = unpinnedTabsArray
        } else if (drag.from?.id === 'sidebar-pinned-tabs') {
          fromTabs = pinnedTabsArray
        } else if (drag.from?.id === 'sidebar-magic-tabs') {
          fromTabs = magicTabsArray
        }
        if (drag.to?.id === 'sidebar-unpinned-tabs') {
          toTabs = unpinnedTabsArray
        } else if (drag.to?.id === 'sidebar-pinned-tabs') {
          toTabs = pinnedTabsArray
        } else if (drag.to?.id === 'sidebar-magic-tabs') {
          toTabs = magicTabsArray
        }

        // CASE: to already includes tab
        if (toTabs.find((v) => v.id === droppedTab.id)) {
          log.warn('ONLY Update existin tab')
          const existing = fromTabs.find((v) => v.id === droppedTab.id)
          if (existing && drag.index !== undefined) {
            existing.index = drag.index ?? 0
          }
          fromTabs.splice(
            fromTabs.findIndex((v) => v.id === droppedTab.id),
            1
          )
          fromTabs.splice(existing!.index, 0, existing!)
        } else {
          log.warn('ADDING NEW ONE')
          // Remove old
          const idx = fromTabs.findIndex((v) => v.id === droppedTab.id)
          if (idx > -1) {
            fromTabs.splice(idx, 1)
          }

          if (drag.to?.id === 'sidebar-pinned-tabs') {
            droppedTab.pinned = true
            droppedTab.magic = false

            cachedMagicTabs.delete(droppedTab.id)
            telemetry.trackMoveTab(MoveTabEventAction.Pin)
          } else if (drag.to?.id === 'sidebar-magic-tabs') {
            droppedTab.pinned = false
            droppedTab.magic = true

            cachedMagicTabs.add(droppedTab.id)

            if (droppedTab.type === 'page' && $activeTabMagic?.showSidebar) {
              log.debug('prepare tab for chat context after moving to magic')
              preparePageTabsForChatContext([droppedTab])
            }

            telemetry.trackMoveTab(MoveTabEventAction.AddMagic)
            telemetry.trackPageChatContextUpdate(
              PageChatUpdateContextEventAction.Add,
              magicTabsArray.length + 1
            )
          } else {
            if (droppedTab.magic) {
              telemetry.trackMoveTab(MoveTabEventAction.RemoveMagic)
              telemetry.trackPageChatContextUpdate(
                PageChatUpdateContextEventAction.Remove,
                magicTabsArray.length - 1
              )
            } else {
              telemetry.trackMoveTab(MoveTabEventAction.Unpin)
            }

            droppedTab.pinned = false
            droppedTab.magic = false
            cachedMagicTabs.delete(droppedTab.id)
          }

          toTabs.splice(drag.index || 0, 0, droppedTab)
        }

        // Update the indices of the tabs in all lists
        const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }))

        unpinnedTabsArray = updateIndices(unpinnedTabsArray)
        pinnedTabsArray = updateIndices(pinnedTabsArray)
        magicTabsArray = updateIndices(magicTabsArray)

        // Combine all lists back together
        const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray]

        log.warn('New tabs', [...newTabs])

        // Update the store with the changed tabs
        tabsManager.bulkPersistChanges(
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
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.item!.data.getData(DragTypeNames.SURF_SPACE)
      const tab = await tabsManager.addSpaceTab(space, {
        active: false,
        index: drag.index ?? undefined
      })
      if (tab && pinned) await tabsManager.update(tab!.id, { pinned })
    } else if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
    ) {
      let resource: Resource | null = null
      if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
        resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
      } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
        const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
        resource = await resourceFetcher()
      }

      if (resource === null) {
        log.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      const tab = await tabsManager.openResourceAsTab(resource, {
        active: true,
        index: drag.index ?? 0,
        trigger: CreateTabEventTrigger.Drop
      })

      if (!tab) {
        log.error('Failed to add page')
        return
      }

      // NOTE: Should be opt? when creating tab, but currently api does not support and
      // adding into CreateTabOptions doesnt match other tab apis props
      if (pinned) await tabsManager.update(tab!.id, { pinned, index: drag.index ?? 0 })

      /*await tabsManager.bulkPersistChanges(
        get(tabs).map((tab) => ({
          id: tab.id,
          updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
        }))
      )*/

      log.debug('State updated successfully')

      drag.continue()
      return
    }
  }

  const handleAddToChat = (e: CustomEvent<string>) => {
    const query = e.detail

    openRightSidebarTab('chat')

    // wait for the magic sidebar to open
    tick().then(() => {
      if (magicSidebar) {
        magicSidebar.addChatWithQuery(query)
      } else {
        log.error('Magic sidebar not found')
        toasts.error('Failed to add to chat')
      }
    })
  }

  const handleTabDragEnd = async (drag: DragculaDragEvent) => {
    // TODO: (dragcula): migrate
    return
    if (
      drag.status === 'done' &&
      drag.effect === 'move' &&
      !['sidebar-pinned-tabs', 'sidebar-unpinned-tabs', 'sidebar-magic-tabs'].includes(
        drag.to?.id || ''
      )
    ) {
      await tabsManager.delete(drag.data['surf/tab'].id)
    }
    drag.continue()
  }

  const handleDropOnSpaceTab = async (drag: DragculaDragEvent<DragTypes>, spaceId?: string) => {
    log.debug('dropping onto sidebar tab', drag)

    if (drag.item !== null && drag.item !== undefined) drag.item.dropEffect = 'copy'

    const toast = toasts.loading(
      spaceId === 'all'
        ? 'Saving to Your Stuff...'
        : `${drag.effect === 'move' ? 'Moving' : 'Copying'} to Space...`
    )

    if (drag.isNative) {
      const parsed = await processDrop(drag.event!)
      log.debug('Parsed', parsed)

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
      log.debug('Resources', newResources)

      if (spaceId !== undefined) {
        await oasis.addResourcesToSpace(
          spaceId,
          newResources.map((r) => r.id),
          SpaceEntryOrigin.ManuallyAdded
        )
      }

      for (const r of newResources) {
        telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, false)
      }

      // FIX: Not exposed outside OasisSpace component.. cannot reload directlry :'( !?
      //await oasis.loadSpaceContents(spaceId)
    } else if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
    ) {
      let resource: Resource | null = null
      if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
        resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
      } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
        const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
        resource = await resourceFetcher()
      }

      if (resource === null) {
        log.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      const isSilent =
        resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)?.value === 'true'
      const hideInEverything =
        resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)
          ?.value === 'true'

      if (hideInEverything) {
        // remove hide in everything tag if it exists since the user is explicitly adding it
        log.debug('Removing hide in everything tag from resource', resource.id)
        await resourceManager.deleteResourceTag(
          resource.id,
          ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
        )
      }

      if (isSilent) {
        // remove silent tag if it exists since the user is explicitly adding it
        log.debug('Removing silent tag from resource', resource.id)
        await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
        telemetry.trackSaveToOasis(resource.type, SaveToOasisEventTrigger.Drop, spaceId !== 'all')
      }

      if (spaceId !== undefined) {
        await oasis.addResourcesToSpace(spaceId, [resource.id], SpaceEntryOrigin.ManuallyAdded)
      }

      // FIX: Not exposed outside OasisSpace component.. cannot reload directlry :'( !?
      //await loadSpaceContents(spaceId)
    }

    drag.continue()
    toast.success(`Resources Saved!`)
    /*toast.success(
      `Resources ${drag.isNative ? 'added' : drag.effect === 'move' ? 'moved' : 'copied'}!`
    )*/
  }

  const handleSaveScreenshot = async (
    event: CustomEvent<{
      rect: { x: number; y: number; width: number; height: number }
      loading: boolean
    }>
  ) => {
    try {
      const blob = await captureScreenshot(event.detail.rect)
      const host = getHostFromURL($activeTabLocation ?? 'https://surf.browser')
      const fileName = getScreenshotFileName(host)

      const metadata = {
        name: fileName,
        alt: `Screenshot of ${host} taken on ${new Date().toLocaleString()}`,
        sourceURI: $activeTabLocation ?? 'surf',
        userContext: 'Screenshot taken via WebviewWrapper'
      }

      const tags = [ResourceTag.screenshot()]
      const type = 'image/png'

      await resourceManager.createResource(type, blob, metadata, tags)
      // update
      await telemetry.trackSaveToOasis(
        type,
        SaveToOasisEventTrigger.Click,
        false,
        EventContext.Inline
      )
      toasts.success('Screenshot saved!')
    } catch (error) {
      toasts.error('Failed to save screenshot')
    } finally {
      if (!event.detail.loading) {
        $showScreenshotPicker = false
      }
    }
  }

  const handleCopyScreenshot = async (
    event: CustomEvent<{
      rect: { x: number; y: number; width: number; height: number }
      loading: boolean
    }>
  ) => {
    try {
      const blob = await captureScreenshot(event.detail.rect)
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      toasts.success('Screenshot copied to clipboard!')
    } catch (error) {
      log.error('Failed to copy screenshot to clipboard:', error)
      toasts.error('Failed to copy screenshot to clipboard')
    } finally {
      if (!event.detail.loading) {
        $showScreenshotPicker = false
      }
    }
  }

  const handleTakeScreenshotForChat = async (
    event: CustomEvent<{
      rect: { x: number; y: number; width: number; height: number }
      loading: boolean
    }>
  ) => {
    try {
      const blob = await captureScreenshot(event.detail.rect)

      log.debug('Captured screenshot for chat', blob)

      additionalChatContextItems.update((additionalChatContextItems) => {
        return [
          ...additionalChatContextItems,
          {
            id: generateID(),
            type: 'screenshot',
            data: blob
          }
        ]
      })
    } catch (error) {
      log.error('Failed to create screenshot for chat:', error)
      toasts.error('Failed to create screenshot for chat')
    } finally {
      if (!event.detail.loading) {
        $showScreenshotPicker = false
      }
    }
  }

  const removeContextItem = (itemId: string) => {
    const item = $chatContextItems.find((item) => item.id === itemId)
    if (!item) {
      log.error('Context item not found', itemId)
      return
    }

    additionalChatContextItems.update((additionalChatContextItems) => {
      return additionalChatContextItems.filter((s) => s.id !== itemId)
    })
  }

  const handleAddContextItem = (e: CustomEvent<AddContextItemEvent>) => {
    const { item, trigger } = e.detail

    if (item.type === 'space') {
      // This is needed for the onboarding to get to the next step
      handleChattingWithOnboardingSpace(item.data.name.folderName)
    }

    additionalChatContextItems.update((additionalChatContextItems) => {
      return [...additionalChatContextItems, item]
    })

    telemetry.trackPageChatContextUpdate(
      PageChatUpdateContextEventAction.Add,
      $chatContextItems.length + 1,
      1,
      trigger
    )
  }

  const handleOpenTabChat = (e: CustomEvent<string>) => {
    // Called from tab context menu

    // TODO: add to context if already chat open
    const tabId = e.detail
    const tab = $tabs.find((t) => t.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    // Open chat with the tab
    openRightSidebarTab('chat')
    includeTabAndExcludeOthersFromMagic(tabId)
  }
  const handlePinTab = (e: CustomEvent<string>) => {
    const tabId = e.detail
    const tab = $tabs.find((t) => t.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    tabsManager.update(tabId, { pinned: true })
  }
  const handleUnpinTab = (e: CustomEvent<string>) => {
    const tabId = e.detail
    const tab = $tabs.find((t) => t.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    tabsManager.update(tabId, { pinned: false })
  }
</script>

{#if $debugMode}
  <DevOverlay />
{/if}

<SplashScreen show={$showSplashScreen} />

<svelte:window on:keydown={handleKeyDown} />

<ToastsProvider service={toasts} />

<Tooltip rootID="body" />
<!-- <pre
  style="position: fixed; bottom: 1rem; right: 1rem; top:1rem; z-index: 10000; background: black; color: white; overflow-y: scroll;"
  aria-hidden={true}>
    {JSON.stringify(
    {
      timestamp: new Date().getTime(),
      lastSelectedTabId: $lastSelectedTabId,
      selectedTabs: Array.from($selectedTabs).map(
        (tabId) => $tabs.find((tab) => tab.id === tabId)?.id
      )
    },
    null,
    2
  )}
</pre> -->

{#if $showScreenshotPicker === true}
  <ScreenshotPicker
    mode={$screenshotPickerMode}
    onboarding={$onboardingActive}
    on:save={handleSaveScreenshot}
    on:copy={handleCopyScreenshot}
    on:screenshot-for-chat={handleTakeScreenshotForChat}
    on:cancel={() => ($showScreenshotPicker = false)}
  />
{/if}

<MiniBrowser service={globalMiniBrowser} />

<div
  class="antialiased w-screen h-screen will-change-auto transform-gpu relative drag flex flex-col"
  class:drag={$showScreenshotPicker === false}
  class:no-drag={$showScreenshotPicker === true}
>
  {#if !horizontalTabs && showCustomWindowActions}
    <div class="flex flex-row flex-shrink-0 items-center justify-between p-1">
      <div>
        <BrowserActions
          {horizontalTabs}
          {showCustomWindowActions}
          {canGoBack}
          {canGoForward}
          {canReload}
          on:go-back={() => $activeBrowserTab?.goBack()}
          on:go-forward={() => $activeBrowserTab?.goForward()}
          on:reload={() => $activeBrowserTab?.reload()}
          on:toggle-sidebar={() => changeLeftSidebarState()}
        />
      </div>
      <div class="flex flex-row items-center space-x-2 ml-5">
        <button
          on:click={() => controlWindow('minimize')}
          class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
        >
          <Icon name="minus" />
        </button>
        <button
          on:click={() => controlWindow('toggle-maximize')}
          class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
        >
          <Icon name="rectangle" />
        </button>
        <button
          on:click={() => controlWindow('close')}
          class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  {/if}

  <!--
    NOTE: Removed from SidebarPane to disable chat peek for now.

    on:rightPeekOpen={() => {
      setPageChatState(true)
      telemetry.trackOpenRightSidebar($rightSidebarTab)
    }}
    on:rightPeekClose={() => {
      cachedMagicTabs.clear()
      setPageChatState(false)
    }}
-->
  <SidebarPane
    {horizontalTabs}
    bind:showLeftSidebar
    bind:showRightSidebar
    enablePeeking={$showScreenshotPicker === false}
    on:leftPeekClose={() => changeTraficLightsVisibility(false)}
    on:leftPeekOpen={() => changeTraficLightsVisibility(true)}
  >
    <div
      slot="sidebar"
      id="left-sidebar"
      class="flex-grow {horizontalTabs ? 'w-full h-full py-1' : 'h-full'}"
      style="z-index: 5000;"
    >
      {#if $sidebarTab !== 'oasis'}
        <div
          class="flex {!horizontalTabs
            ? `flex-col w-full ${showCustomWindowActions ? 'h-[calc(100%-45px)]' : 'py-1.5 h-full'} space-y-4 px-2`
            : `flex-row items-center h-full ${showCustomWindowActions ? '' : 'ml-20'} space-x-4 mr-4`} relative"
          use:contextMenu={{
            items: [
              {
                type: 'action',
                icon: 'add',
                text: 'New Tab',
                action: () => tabsManager.addPageTab('')
              },
              { type: 'separator' },
              {
                type: 'action',
                icon: 'sidebar.left',
                text: `${showLeftSidebar ? 'Hide' : 'Show'} ${horizontalTabs ? 'Tabs' : 'Sidebar'}`,
                action: () => handleLeftSidebarChange(!showLeftSidebar)
              },
              {
                type: 'action',
                icon: '',
                text: 'Toggle Tabs Orientation',
                action: () => handleToggleHorizontalTabs()
              },
              { type: 'separator' },
              {
                type: 'action',
                icon: 'trash',
                text: 'Close All Unpinned Tabs',
                kind: 'danger',
                action: () => {
                  const tabs = $unpinnedTabs
                  for (const tab of tabs) {
                    tabsManager.delete(tab.id, DeleteTabEventTrigger.CommandMenu)
                  }
                }
              }
            ]
          }}
        >
          {#if horizontalTabs || !showCustomWindowActions}
            <BrowserActions
              {horizontalTabs}
              {showCustomWindowActions}
              {canGoBack}
              {canGoForward}
              {canReload}
              on:go-back={() => $activeBrowserTab?.goBack()}
              on:go-forward={() => $activeBrowserTab?.goForward()}
              on:reload={() => $activeBrowserTab?.reload()}
              on:toggle-sidebar={() => changeLeftSidebarState()}
            />
          {/if}

          <div
            id="sidebar-pinned-tabs-wrapper"
            class={$pinnedTabs.length !== 0
              ? 'relative no-drag my-auto rounded-xl flex-shrink-0 overflow-x-scroll no-scrollbar transition-colors'
              : horizontalTabs
                ? 'absolute top-1 h-[1.9rem] left-[9rem] w-[16px] rounded-md no-drag my-auto flex-shrink-0 overflow-x-scroll no-scrollbar transition-colors'
                : 'absolute top-8 h-2 left-4 right-4 rounded-md no-drag my-auto flex-shrink-0 overflow-x-scroll no-scrollbar transition-colors'}
            class:horizontalTabs
            class:empty={$pinnedTabs.length === 0}
            bind:this={pinnedTabsWrapper}
          >
            <div
              id="sidebar-pinned-tabs"
              style:view-transition-name="pinned-tabs-wrapper"
              class="flex items-center h-fit"
              axis="horizontal"
              dragdeadzone="5"
              aria-hidden="true"
              use:HTMLAxisDragZone.action={{
                accepts: (drag) => {
                  if (
                    drag.isNative ||
                    drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
                    drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
                    drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
                    drag.item?.data.hasData(DragTypeNames.SURF_SPACE)
                  ) {
                    return true
                  }
                  return false
                }
              }}
              on:Drop={handleDropSidebar}
            >
              {#if $pinnedTabs.length === 0}
                <div style="height: 0rem; width: 100%;"></div>
              {:else}
                {#each $pinnedTabs as tab, index (tab.id + index)}
                  <TabItem
                    hibernated={!$activatedTabs.includes(tab.id)}
                    removeHighlight={$showNewTabOverlay !== 0}
                    {tab}
                    {horizontalTabs}
                    {activeTabId}
                    pinned={true}
                    isMagicActive={$magicTabs.length > 0}
                    isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                    isUserSelected={Array.from($selectedTabs).some(
                      (item) => item.id === tab.id && item.userSelected
                    )}
                    on:select={(e) => selectTab(e.detail)}
                    on:remove-from-sidebar={handleRemoveFromSidebar}
                    on:delete-tab={handleDeleteTab}
                    on:exclude-tab={handleExcludeTab}
                    on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                    on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                    on:multi-select={handleMultiSelect}
                    on:passive-select={handlePassiveSelect}
                    on:include-tab={handleIncludeTabInMagic}
                    on:chat-with-tab={handleOpenTabChat}
                    on:pin={handlePinTab}
                    on:unpin={handleUnpinTab}
                    on:edit={handleEdit}
                  />
                {/each}
              {/if}
            </div>
          </div>

          <div
            class=" {horizontalTabs
              ? 'overflow-x-scroll space-x-2 outline'
              : 'overflow-y-scroll space-y-2 outline'} w-full h-full inline-flex flex-nowrap overflow-hidden no-scrollbar outline'"
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
            <div
              class="no-scrollbar relative h-full flex-grow w-full overflow-y-visible"
              class:space-x-2={horizontalTabs}
              class:items-center={horizontalTabs}
              use:contextMenu={{
                canOpen: $selectedTabs.size > 1,
                items: [
                  {
                    type: 'action',
                    icon: '',
                    text: 'Create Space',
                    action: () => {
                      // selectedTabs has two types of ids: string and { id: string, userSelected: boolean }
                      // we need to filter out the ones that are not userSelected
                      const tabIds = $tabs
                        .filter((tab) =>
                          Array.from($selectedTabs).some((item) => item.id === tab.id)
                        )
                        .map((e) => e.id)
                      createSpaceWithTabs(tabIds)
                    }
                  },
                  {
                    type: 'action',
                    icon: 'chat',
                    text: 'Open Tabs in Chat',
                    action: () => startChatWithSelectedTabs()
                  },
                  { type: 'separator' },
                  {
                    type: 'action',
                    icon: 'trash',
                    text: 'Close Tabs',
                    kind: 'danger',
                    action: () => {
                      for (const tab of $selectedTabs) {
                        tabsManager.delete(tab.id, DeleteTabEventTrigger.ContextMenu)
                      }
                    }
                  }
                ]
              }}
            >
              {#if horizontalTabs}
                <div
                  id="sidebar-unpinned-tabs"
                  class="horizontal-tabs space-x-1 h-full divide-x-1"
                  axis="horizontal"
                  dragdeadzone="5"
                  placeholder-size="60"
                  use:HTMLAxisDragZone.action={{
                    accepts: (drag) => {
                      if (
                        drag.isNative ||
                        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
                        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
                        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
                        drag.item?.data.hasData(DragTypeNames.SURF_SPACE)
                      ) {
                        return true
                      }
                      return false
                    }
                  }}
                  on:Drop={handleDropSidebar}
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
                        bookmarkingState={$bookmarkingTabsState[tab.id]}
                        pinned={false}
                        {spaces}
                        enableEditing
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        isMagicActive={$magicTabs.length > 0}
                        bind:this={activeTabComponent}
                        isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                        isUserSelected={Array.from($selectedTabs).some(
                          (item) => item.id === tab.id && item.userSelected
                        )}
                        on:multi-select={handleMultiSelect}
                        on:passive-select={handlePassiveSelect}
                        on:select={(e) => selectTab(e.detail)}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:delete-tab={handleDeleteTab}
                        on:exclude-tab={handleExcludeTab}
                        on:input-enter={handleBlur}
                        on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                        on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                        on:create-live-space={handleCreateLiveSpace}
                        on:add-source-to-space={handleAddSourceToSpace}
                        on:save-resource-in-space={handleSaveResourceInSpace}
                        on:include-tab={handleIncludeTabInMagic}
                        on:chat-with-tab={handleOpenTabChat}
                        on:pin={handlePinTab}
                        on:unpin={handleUnpinTab}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                        on:edit={handleEdit}
                      />
                    {:else}
                      <TabItem
                        showClose
                        hibernated={!$activatedTabs.includes(tab.id)}
                        {tab}
                        tabSize={Math.min(300, Math.max(24, tabSize))}
                        {activeTabId}
                        {spaces}
                        pinned={false}
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                        isUserSelected={Array.from($selectedTabs).some(
                          (item) => item.id === tab.id && item.userSelected
                        )}
                        isMagicActive={$magicTabs.length > 0}
                        bookmarkingState={$bookmarkingTabsState[tab.id]}
                        on:multi-select={handleMultiSelect}
                        on:passive-select={handlePassiveSelect}
                        on:select={(e) => selectTab(e.detail)}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:exclude-tab={handleExcludeTab}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                        on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                        on:include-tab={handleIncludeTabInMagic}
                        on:chat-with-tab={handleOpenTabChat}
                        on:pin={handlePinTab}
                        on:unpin={handleUnpinTab}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                        on:edit={handleEdit}
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
                  use:HTMLAxisDragZone.action={{
                    accepts: (drag) => {
                      if (
                        drag.isNative ||
                        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
                        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
                        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
                        drag.item?.data.hasData(DragTypeNames.SURF_SPACE)
                      ) {
                        return true
                      }
                      return false
                    }
                  }}
                  on:Drop={handleDropSidebar}
                >
                  {#each $unpinnedTabs as tab, index (tab.id)}
                    <!-- check if this tab is active -->
                    {#if $activeTabId === tab.id}
                      <TabItem
                        hibernated={!$activatedTabs.includes(tab.id)}
                        removeHighlight={$showNewTabOverlay !== 0}
                        showClose
                        horizontalTabs={false}
                        {tab}
                        {activeTabId}
                        bookmarkingState={$bookmarkingTabsState[tab.id]}
                        pinned={false}
                        {spaces}
                        enableEditing
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        isMagicActive={$magicTabs.length > 0}
                        bind:this={activeTabComponent}
                        isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                        isUserSelected={Array.from($selectedTabs).some(
                          (item) => item.id === tab.id && item.userSelected
                        )}
                        on:multi-select={handleMultiSelect}
                        on:passive-select={handlePassiveSelect}
                        on:select={(e) => selectTab(e.detail)}
                        on:exclude-tab={handleExcludeTab}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:delete-tab={handleDeleteTab}
                        on:exclude-tab={handleExcludeTab}
                        on:input-enter={handleBlur}
                        on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                        on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                        on:create-live-space={handleCreateLiveSpace}
                        on:add-source-to-space={handleAddSourceToSpace}
                        on:save-resource-in-space={handleSaveResourceInSpace}
                        on:include-tab={handleIncludeTabInMagic}
                        on:chat-with-tab={handleOpenTabChat}
                        on:pin={handlePinTab}
                        on:unpin={handleUnpinTab}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                        on:edit={handleEdit}
                      />
                    {:else}
                      <TabItem
                        hibernated={!$activatedTabs.includes(tab.id)}
                        showClose
                        {tab}
                        horizontalTabs={false}
                        {activeTabId}
                        {spaces}
                        pinned={false}
                        showIncludeButton={$activeTabMagic?.showSidebar &&
                          (tab.type === 'page' || tab.type === 'space')}
                        isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                        isUserSelected={Array.from($selectedTabs).some(
                          (item) => item.id === tab.id && item.userSelected
                        )}
                        isMagicActive={$magicTabs.length > 0}
                        bookmarkingState={$bookmarkingTabsState[tab.id]}
                        on:multi-select={handleMultiSelect}
                        on:passive-select={handlePassiveSelect}
                        on:select={(e) => selectTab(e.detail)}
                        on:exclude-tab={handleExcludeTab}
                        on:remove-from-sidebar={handleRemoveFromSidebar}
                        on:delete-tab={handleDeleteTab}
                        on:input-enter={handleBlur}
                        on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                        on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                        on:include-tab={handleIncludeTabInMagic}
                        on:chat-with-tab={handleOpenTabChat}
                        on:pin={handlePinTab}
                        on:unpin={handleUnpinTab}
                        on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                        on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                        on:edit={handleEdit}
                      />
                    {/if}
                  {/each}
                </div>
              {/if}
              <div
                style="position: absolute; top: {!horizontalTabs
                  ? 42 * $unpinnedTabs.length
                  : 0}px; left: {horizontalTabs ? plusBtnLeftPos : 0}px; right: 0;"
                class:w-fit={horizontalTabs}
                class:h-full={horizontalTabs}
                class="select-none flex items-center justify-center"
                class:opacity-100={!$showEndMask}
                class:opacity-0={$showEndMask}
                class:pointer-events-auto={!$showEndMask}
                class:pointer-events-none={$showEndMask}
              >
                <button
                  class="transform select-none no-drag active:scale-95 space-x-2 {horizontalTabs
                    ? 'w-fit rounded-xl p-2'
                    : 'w-full rounded-2xl px-4 py-3'} appearance-none select-none outline-none border-0 margin-0 group flex items-center p-2 hover:bg-sky-200 transition-colors duration-200 text-sky-800 cursor-pointer"
                  class:bg-sky-200={$showNewTabOverlay === 1}
                  on:click|preventDefault={() => tabsManager.showNewTab()}
                >
                  <Icon name="add" />
                  {#if !horizontalTabs}
                    <span class="label">New Tab</span>
                  {/if}
                </button>
              </div>
            </div>
          </div>

          <div
            class="flex {horizontalTabs
              ? 'h-full flex-row items-center'
              : 'flex-col'} flex-shrink-0"
          >
            <button
              class="transform select-none no-drag active:scale-95 space-x-2 {horizontalTabs
                ? 'w-fit rounded-xl p-2'
                : 'w-full rounded-2xl px-4 py-3'} appearance-none border-0 margin-0 group flex items-center p-2 hover:bg-sky-200 transition-colors duration-200 text-sky-800 cursor-pointer"
              on:click|preventDefault={() => tabsManager.showNewTab()}
              class:opacity-100={$showEndMask}
              class:opacity-0={!$showEndMask}
              class:pointer-events-auto={$showEndMask}
              class:pointer-events-none={!$showEndMask}
              class:bg-sky-200={$showNewTabOverlay === 1}
            >
              <Icon name="add" />
              {#if !horizontalTabs}
                <span class="label">New Tab</span>
              {/if}
            </button>
            <!-- This overlay will dynamically grow / shrink depending on the current state -->
            <SidebarMetaOverlay
              on:open-stuff={() => ($showNewTabOverlay = 2)}
              on:open-resource-in-mini-browser={(e) =>
                openResourceDetailsModal(e.detail, OpenInMiniBrowserEventFrom.Stack)}
              on:Drop={({ detail }) => {
                handleDropOnSpaceTab(detail)
              }}
            >
              <div slot="tools">
                {#if showSidebarTools}
                  {#if !horizontalTabs || (horizontalTabs && !showRightSidebar)}
                    <CustomPopover position={horizontalTabs ? 'top' : 'bottom'}>
                      <button
                        slot="trigger"
                        class="no-drag transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                        on:click={() => toggleRightSidebar()}
                      >
                        <Icon name="triangle-square-circle" />
                      </button>

                      <div
                        slot="content"
                        class="flex no-drag flex-row items-center justify-center space-x-4 px-3 py-3"
                        let:closePopover
                      >
                        {#each $sidebarTools as tool}
                          <button
                            class="flex flex-col items-center space-y-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            on:click={() => {
                              closePopover()
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
                {:else}
                  <button
                    use:tooltip={{
                      text: 'Chat (⌘ + E)',
                      position: horizontalTabs ? 'left' : 'top'
                    }}
                    class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                    on:click={() => {
                      toggleRightSidebarTab('chat')
                    }}
                    class:bg-sky-200={showRightSidebar && $rightSidebarTab === 'chat'}
                  >
                    <Icon name="chat" />
                  </button>
                {/if}
                <!--<button
                use:tooltip={{
                  text: 'My Stuff (⌘ + O)',
                  position: horizontalTabs ? 'left' : 'top'
                }}
                class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                on:click={() => ($showNewTabOverlay = 2)}
                class:bg-sky-200={$showNewTabOverlay === 2}
              >
                <div
                  id="oasis-zone"
                  class="oasis-drop-zone"
                  style="position: absolute; inset-inline: 10%; inset-block: 20%;"
                  use:HTMLDragZone.action={{
                    accepts: (drag) => {
                      if (
                        drag.isNative ||
                        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
                        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
                        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
                      ) {
                        return true
                      }

                      return false
                    }
                  }}
                  on:Drop={(drag) => handleDropOnSpaceTab(drag, 'all')}
                ></div>

                <Icon name="leave" />
              </button>-->
              </div>
            </SidebarMetaOverlay>

            <!--<div
              class="flex flex-row flex-shrink-0 w-full mx-auto"
              style="justify-content: space-between;"
              class:space-x-4={!horizontalTabs}
            >
              <!--<SaveVisualizer />
              <RecentsStack />--
            </div>-->

            <!-- TODO: (maxu): Figure out what this is.. windiws.? -->
            {#if horizontalTabs && showCustomWindowActions}
              <div class="flex flex-row items-center space-x-2 ml-5">
                <button
                  on:click={() => controlWindow('minimize')}
                  class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                >
                  <Icon name="minus" />
                </button>
                <button
                  on:click={() => controlWindow('toggle-maximize')}
                  class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                >
                  <Icon name="rectangle" />
                </button>
                <button
                  on:click={() => controlWindow('close')}
                  class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
                >
                  <Icon name="close" />
                </button>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- <OasisSidebar on:tabsManager.create={handleCreateTabFromSpace} /> -->
      {/if}
    </div>

    <div slot="content" class="h-full w-full flex relative flex-row">
      <div
        style:view-transition-name="active-content-wrapper"
        class="w-full h-full overflow-hidden flex-grow rounded-xl"
        style="z-index: 0;"
        class:hasNoTab={!$activeBrowserTab}
        class:sidebarHidden={!showLeftSidebar}
      >
        <NewTabOverlay
          spaceId={'all'}
          activeTab={$activeTab}
          bind:showTabSearch={$showNewTabOverlay}
          on:open-space-as-tab={handleCreateTabForSpace}
          on:deleted={handleDeletedSpace}
          {historyEntriesManager}
          activeTabs={$activeTabs}
          on:activate-tab={(e) => selectTab(e.detail, ActivateTabEventTrigger.Click)}
          on:close-active-tab={() => tabsManager.deleteActive(DeleteTabEventTrigger.CommandMenu)}
          on:bookmark={() =>
            handleBookmark($activeTabId, false, SaveToOasisEventTrigger.CommandMenu)}
          on:toggle-sidebar={() => changeLeftSidebarState()}
          on:create-tab-from-space={handleCreateTabFromSpace}
          on:toggle-horizontal-tabs={debounceToggleHorizontalTabs}
          on:reload-window={() => $activeBrowserTab?.reload()}
          on:open-space={handleCreateTabForSpace}
          on:create-chat={handleCreateChatWithQuery}
          on:create-note={handleCreateNote}
          on:open-and-chat={handleOpenAndChat}
          on:batch-open={handleOpenTabs}
          on:open-space-and-chat={handleOpenSpaceAndChat}
          on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
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
            tabsManager.addPageTab(e.detail, {
              active: true,
              trigger: CreateTabEventTrigger.AddressBar
            })
          }}
        />

        {#if $sidebarTab === 'oasis'}
          <div class="browser-window flex-grow active no-drag" style="--scaling: 1;">
            <OasisSpace
              spaceId={$selectedSpace}
              active
              on:create-resource-from-oasis={handeCreateResourceFromOasis}
              on:deleted={handleDeletedSpace}
              on:open-space-as-tab={handleCreateTabForSpace}
              on:open-space-and-chat={handleOpenSpaceAndChat}
              hideBar={$showNewTabOverlay !== 0}
              {historyEntriesManager}
            />
          </div>
        {/if}

        {#each $activeTabs as tab (tab.id)}
          {#if $activatedTabs.includes(tab.id)}
            <div
              class="browser-window flex-grow will-change-contents transform-gpu no-drag"
              style="--scaling: 1;"
              class:active={$activeTabId === tab.id && $sidebarTab !== 'oasis'}
              class:magic-glow-big={$activeTabId === tab.id &&
                tab.type === 'page' &&
                $activeTabMagic?.running}
            >
              <!-- {#if !horizontalTabs}<div
                  class="w-full h-3 pointer-events-none fixed z-[1002] drag"
                />{/if} -->

              {#if tab.type === 'page'}
                <BrowserTab
                  {historyEntriesManager}
                  active={$activeTabId === tab.id}
                  pageMagic={$activeTabMagic}
                  bind:this={$browserTabs[tab.id]}
                  bind:tab={$tabs[$tabs.findIndex((t) => t.id === tab.id)]}
                  on:navigation={(e) => handleWebviewTabNavigation(e, tab)}
                  on:update-tab={(e) => tabsManager.update(tab.id, e.detail)}
                  on:open-resource={(e) =>
                    openResourceDetailsModal(e.detail, OpenInMiniBrowserEventFrom.WebPage)}
                  on:reload-annotations={(e) => reloadAnnotationsSidebar(e.detail)}
                  on:update-page-magic={(e) => updateActiveMagicPage(e.detail)}
                  on:keydown={(e) => handleKeyDown(e.detail)}
                  on:add-to-chat={(e) => handleAddToChat(e)}
                  on:prepare-tab-for-chat={handlePrepareTabForChat}
                />
              {:else if tab.type === 'chat'}
                <Chat
                  {tab}
                  {resourceManager}
                  resourceIds={[]}
                  on:navigate={(e) =>
                    tabsManager.addPageTab(e.detail.url, {
                      active: e.detail.active,
                      trigger: CreateTabEventTrigger.OasisChat
                    })}
                  on:tabsManager.update={(e) => tabsManager.update(tab.id, e.detail)}
                  on:openResource={(e) =>
                    openResourceDetailsModal(e.detail, OpenInMiniBrowserEventFrom.Chat)}
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
                  on:open-and-chat={handleOpenAndChat}
                  on:batch-open={handleOpenTabs}
                  on:deleted={handleDeletedSpace}
                  on:open-space-and-chat={handleOpenSpaceAndChat}
                  hideBar={$showNewTabOverlay !== 0}
                  {historyEntriesManager}
                />
              {:else if tab.type === 'history'}
                <BrowserHistory {tab} active={$activeTabId === tab.id} />
              {:else if tab.type === 'resource'}
                <ResourceTab {tab} on:update-tab={(e) => tabsManager.update(tab.id, e.detail)} />
              {:else if tab.type === 'onboarding'}
                <TabOnboarding
                  on:openChat={handleOnboardingChatWithQuery}
                  on:openStuff={() => ($showNewTabOverlay = 2)}
                  on:openScreenshot={() => openScreenshotPicker()}
                  on:launchTimeline={(e) => handleLaunchOnboardingTooltips(e.detail)}
                  on:endTimeline={() => handleEndOnboardingTooltips}
                  on:batchOpenTabs={handleOpenOnboardingTabs}
                  on:createOnboardingSpace={() => {
                    createOnboardingSpace(
                      tabsManager,
                      oasis,
                      tabsManager.addSpaceTab,
                      resourceManager
                    )
                  }}
                />
              {/if}
            </div>
          {/if}
        {/each}

        {#if !$activeTabs && !$activeTab}
          <div class="no-drag" style="--scaling: 1;">
            <BrowserHomescreen
              {historyEntriesManager}
              active
              on:navigate={handleTabNavigation}
              on:chat={handleCreateChat}
              on:rag={handleRag}
              {spaces}
            />
          </div>
        {/if}
      </div>
    </div>

    <Tabs.Root
      bind:value={$rightSidebarTab}
      class="h-full flex flex-col relative no-drag"
      slot="right-sidebar"
      let:minimal
    >
      {#if showSidebarTools}
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
            class="grid w-full {$sidebarTools.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2'} gap-1 rounded-9px bg-dark-10 text-sm font-semibold leading-[0.01em]"
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
      {/if}

      <Tabs.Content value="chat" class="flex-grow overflow-hidden">
        {#if $activeTab && $activeTabMagic}
          {#key showRightSidebar}
            <MagicSidebar
              magicPage={activeTabMagic}
              contextItems={chatContextItems}
              bind:this={magicSidebar}
              bind:inputValue={$magicInputValue}
              on:highlightText={(e) => scrollWebviewToText(e.detail.tabId, e.detail.text)}
              on:highlightWebviewText={(e) =>
                highlightWebviewText(e.detail.resourceId, e.detail.answerText, e.detail.sourceUid)}
              on:seekToTimestamp={(e) =>
                handleSeekToTimestamp(e.detail.resourceId, e.detail.timestamp)}
              on:navigate={(e) => {
                $browserTabs[$activeTabId].navigate(e.detail.url)
              }}
              on:open-context-item={(e) => openContextItemAsTab(e.detail)}
              on:exclude-tab={handleExcludeTab}
              on:updateActiveChatId={(e) => activeChatId.set(e.detail)}
              on:remove-magic-tab={removeMagicTab}
              on:include-tab={handleIncludeTabInMagic}
              {horizontalTabs}
              on:close-chat={() => {
                toggleRightSidebarTab('chat')
                handleEndOnboardingTooltips()
              }}
              on:pick-screenshot={handlePickScreenshotForChat}
              on:remove-context-item={(e) => removeContextItem(e.detail)}
              on:add-context-item={handleAddContextItem}
              {activeTabMagic}
            />
          {/key}
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
            {horizontalTabs}
            on:close={() => toggleRightSidebarTab('annotations')}
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
            activeTab={$activeTab}
            activeBrowserTab={$activeBrowserTab}
            on:clear={() => handleAppSidebarClear(true)}
            on:execute-tab-code={handleExecuteAppSidebarCode}
            {horizontalTabs}
            on:close={() => toggleRightSidebarTab('go-wild')}
          />
        {:else}
          <div class="w-full h-full flex items-center justify-center flex-col opacity-50">
            <Icon name="info" />
            <span>Go wild not available.</span>
          </div>
        {/if}
      </Tabs.Content>
    </Tabs.Root>
  </SidebarPane>
</div>

<style lang="scss">
  /// DRAGCULA STATES NOTE: these should be @horizon/dragcula/dist/styles.css import, but this doesnt work currently!
  :global(::view-transition-group(*)) {
    animation-duration: 280ms;
    animation-timing-function: ease; //cubic-bezier(0, 1, 0.41, 0.99);
  }

  :global([data-drag-preview]) {
    pointer-events: none !important;
    user-select: none !important;
    width: var(--drag-width, auto);
    height: var(--drag-height, auto);
    transform-origin: center center;
    transform: translate(-50%, -50%) translate(var(--drag-offsetX, 0px), var(--drag-offsetY, 0px))
      scale(var(--drag-scale, 1)) scale(var(--drag-scaleX, 1), var(--drag-scaleY, 1))
      rotate(var(--drag-tilt, 0)) scale(var(--scale, 1)) !important;
    transition:
      transform 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      opacity 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      border 135ms cubic-bezier(0, 1.22, 0.73, 1.13),
      box-shadow 165ms cubic-bezier(0, 1.22, 0.73, 1.13) !important;
    opacity: 85%;
    box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;
    /*scale: var(--scaleX, 1) var(--scaleY, 1);*/
  }
  :global(body[data-dragging]:has([data-drag-target^='webview'])) {
    // NOTE: Only kinda works sometimes, still ahve to debug how/if we can reliably
    // have custom cursors during native dndn.
    //cursor: wait !important;
  }

  /* Necessary so that image & pdf view dont prevent dragging */
  :global(body[data-dragging] webview:not([data-drag-zone])) {
    pointer-events: none !important;
  }

  :global(.dragcula-drop-indicator) {
    --color: #3765ee;
    --dotColor: white;
    --inset: 2%;
    background: var(--color);
    transition:
      top 100ms cubic-bezier(0.2, 0, 0, 1),
      left 100ms cubic-bezier(0.2, 0, 0, 1);
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
  /*:global(body[data-dragcula-dragging='true'] *:not([data-dragcula-zone])) {
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
    object-fit: cover;
    max-width: 25ch;
    max-height: 25ch;
    opacity: 0.7;
  }
  :global(body *[data-dragcula-dragging-item].tab) {
    pointer-events: none !important;
    object-fit: cover;
    max-width: 35ch;
    max-height: 35ch;
  }

  :global(
      body[data-dragcula-target]:not(
          [data-dragcula-target^='sidebar']
        )[data-dragcula-drag-effect='copy']
    ) {
    cursor: copy;
  }*/

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
  :global([data-drag-zone][axis='vertical']) {
    // This is needed to prevent margin collapse when the first child has margin-top. Without this, it will move the container element instead.
    padding-top: 1px;
    margin-top: -1px;
  }
  :global([data-drag-zone='sidebar-pinned-tabs']) {
    min-height: 24px;
  }
  :global(.magic-tabs-wrapper [data-drag-zone]) {
    min-height: 4rem !important;
    height: fit-content !important;
  }
  /*:global(div[data-dragcula-zone]) {
    overflow: visible !important;
    background: transparent !important;
  }*/

  :global(body[data-dragging='true'] .chat-hint-tooltop) {
    opacity: 0;
  }

  :global(body[data-dragging='true'] #sidebar-pinned-tabs-wrapper.empty) {
    @apply bg-sky-100;
    z-index: 100;
  }

  :global(*) {
    scrollbar-color: rgb(130, 130, 130) transparent;
    scrollbar-width: thin;
  }

  /* Pulse effect for tooltip targets */
  :global(.tooltip-target[data-tooltip-target]) {
    position: relative;
    outline: 2px solid rgba(73, 82, 242, 0.4);
    border-radius: 16px;
  }

  :global(.tooltip-target[data-tooltip-target]::after) {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border-radius: inherit;
    border-radius: calc(inherit + 8px);
    z-index: -1;
    animation: pulse 2s infinite;
    filter: blur(4px);
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
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
      // border-radius: 0.5rem;
      // overflow: hidden;
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
    gap: 6px;
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
  :global([data-drag-zone='sidebar-pinned-tabs']) {
    height: fit-content !important;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  :global([data-drag-zone='sidebar-unpinned-tabs'].vertical-tabs) {
    min-height: 100%;
    height: auto;
  }
  :global([data-drag-zone='sidebar-unpinned-tabs'].horizontal-tabs) {
    min-width: 100%;
    width: auto;
    display: flex;
    flex-direction: row;
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

  :global(.magic-tabs-wrapper [data-drag-zone]) {
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
    background-image: url('../../../public/assets/ai.png');
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
