<svelte:options immutable={true} />

<script lang="ts">
  import { onMount, onDestroy, setContext, tick } from 'svelte'
  import SplashScreen from './Atoms/SplashScreen.svelte'
  import { writable, derived, get } from 'svelte/store'
  import { type WebviewWrapperEvents } from './Webview/WebviewWrapper.svelte'
  import { Icon } from '@horizon/icons'

  import {
    isAltKeyAndKeysPressed,
    isModKeyAndEventCodeIs,
    isModKeyAndKeyPressed,
    isModKeyAndKeysPressed,
    isModKeyAndShiftKeyAndKeyPressed
  } from '@horizon/utils/src/keyboard'
  import { createTelemetry } from '../service/telemetry'
  import {
    useDebounce,
    wait,
    parseStringIntoBrowserLocation,
    generateID,
    useLogScope,
    truncate,
    tooltip,
    type LogLevel,
    isMac,
    isDev
  } from '@horizon/utils'
  import {
    createResourcesFromFiles,
    createResourcesFromMediaItems,
    processDrop
  } from '../service/mediaImporter'
  import SidebarPane, { leftSize, rightSize } from './Sidebars/SidebarPane.svelte'

  import type { PaneAPI } from 'paneforge'
  import {
    Resource,
    ResourceTag,
    createResourceManager,
    initResourceDebugger,
    toggleResourceDebugger
  } from '../service/resources'

  import { DragTypeNames, type DragTypes, SpaceEntryOrigin, type SpaceSource } from '../types'

  import BrowserTab from './Browser/BrowserTab.svelte'
  import BrowserHomescreen from './Browser/BrowserHomescreen.svelte'
  import TabItem from './Core/Tab.svelte'
  import '../../app.css'
  import { createDemoItems, createOnboardingSpace } from '../service/demoitems'

  import TeletypeEntry from './Overlay/TeletypeEntry.svelte'

  import './index.scss'
  import type {
    Tab,
    TabPage,
    TabSpace,
    TabHistory,
    CreateTabOptions,
    ControlWindow,
    TabResource,
    BookmarkTabState,
    ChatWithSpaceEvent,
    TabInvites,
    JumpToWebviewTimestampEvent,
    HighlightWebviewTextEvent
  } from '../types/browser.types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../constants/searchEngines'
  import { HorizonDatabase } from '../service/storage'
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
    MultiSelectResourceEventAction,
    PageChatUpdateContextEventTrigger,
    OpenHomescreenEventTrigger,
    OpenInMiniBrowserEventFrom,
    ChangeContextEventTrigger,
    PageChatUpdateContextItemType
  } from '@horizon/types'
  import { OnboardingFeature } from './Onboarding/onboardingScripts'
  import { scrollToTextCode } from '../constants/inline'
  import { onboardingSpace } from '../constants/examples'
  import { SFFS } from '../service/sffs'
  import { provideOasis, colorPairs, OasisSpace, DEFAULT_SPACE_ID } from '../service/oasis'
  import OasisSpaceRenderer from './Oasis/OasisSpace.svelte'

  import AnnotationsSidebar from './Sidebars/AnnotationsSidebar.svelte'
  import ToastsProvider from './Toast/ToastsProvider.svelte'
  import { provideToasts, type ToastItem } from '../service/toast'
  import { PromptIDs, getPrompts, resetPrompt, updatePrompt } from '../service/prompts'
  import { Tabs } from 'bits-ui'
  import BrowserHistory from './Browser/BrowserHistory.svelte'
  import { Dragcula, HTMLAxisDragZone, type DragculaDragEvent } from '@horizon/dragcula'
  import NewTabOverlay from './Core/NewTabOverlay.svelte'
  import CustomPopover from './Atoms/CustomPopover.svelte'
  import { provideConfig } from '../service/config'
  import { HistoryEntriesManager } from '../service/history'
  import { spawnBoxSmoke } from './Effects/SmokeParticle.svelte'
  import DevOverlay from './Browser/DevOverlay.svelte'
  import BrowserActions from './Browser/BrowserActions.svelte'
  import { createTabsManager, getBrowserContextScopeType } from '../service/tabs'
  import ResourceTab from './Oasis/ResourceTab.svelte'
  import ScreenshotPicker, { type ScreenshotPickerMode } from './Webview/ScreenshotPicker.svelte'
  import { captureScreenshot, getHostFromURL, getScreenshotFileName } from '../utils/screenshot'
  import { useResizeObserver } from '../utils/observers'
  import { contextMenu, prepareContextMenu, type CtxItem } from './Core/ContextMenu.svelte'
  import TabOnboarding from './Core/TabOnboarding.svelte'
  import Tooltip from './Onboarding/Tooltip.svelte'
  import { launchTimeline, endTimeline } from './Onboarding/timeline'
  import SidebarMetaOverlay from './Oasis/sidebar/SidebarMetaOverlay.svelte'
  import { createSyncService } from '@horizon/core/src/lib/service/sync'
  import TabInvite from './Core/TabInvite.svelte'
  import Homescreen from './Oasis/homescreen/Homescreen.svelte'
  import { debugMode } from '../stores/debug'
  import MiniBrowser from './MiniBrowser/MiniBrowser.svelte'
  import {
    createMiniBrowserService,
    useScopedMiniBrowserAsStore
  } from '@horizon/core/src/lib/service/miniBrowser'
  import vendorBackgroundLight from '../../../public/assets/vendorBackgroundLight.webp'
  import vendorBackgroundDark from '../../../public/assets/vendorBackgroundDark.webp'
  import { springVisibility } from './motion/springVisibility'
  import ScopeSwitcher from './Core/ScopeSwitcher/ScopeSwitcher.svelte'
  import { generalContext, newContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { provideDesktopManager } from '../service/desktop'
  import { provideAI } from '@horizon/core/src/lib/service/ai/ai'
  import { ColorMode, provideColorService } from '@horizon/core/src/lib/service/colors'
  import {
    ContextItemResource,
    ContextItemPageTab,
    ContextItemSpace,
    type ContextItem
  } from '@horizon/core/src/lib/service/ai/contextManager'

  import '$styles/app.scss'
  import { DIALOG_OASIS_REF } from './Core/Dialog/Dialog.svelte'

  /*
  NOTE: Funky notes on our z-index issue.

  Left Sidebar: 502
  Right Sidebar: 490
  Content: 500
  */

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
  let pinnedTabsScrollArea: HTMLElement
  let initializedApp = false

  const onboardingActive = writable(false)
  const onboardingTabVisible = writable(false)
  const onboardingTabOpened = writable(false)

  let telemetryAPIKey = ''
  let telemetryActive = false
  let telemetryProxyUrl: string | undefined = undefined
  if (import.meta.env.PROD || import.meta.env.R_VITE_TELEMETRY_ENABLED) {
    telemetryActive = true
    telemetryProxyUrl = import.meta.env.R_VITE_TELEMETRY_PROXY_URL
    if (!telemetryProxyUrl) {
      telemetryAPIKey = import.meta.env.R_VITE_TELEMETRY_API_KEY
    }
  }

  const telemetry = createTelemetry({
    apiKey: telemetryAPIKey,
    active: telemetryActive,
    trackHostnames: false,
    proxyUrl: telemetryProxyUrl
  })

  const downloadResourceMap = new Map<string, Download>()
  const downloadToastsMap = new Map<string, ToastItem>()
  const downloadIntercepters = writable(new Map<string, (data: Download) => void>())

  const log = useLogScope('Browser')
  const resourceManager = createResourceManager(telemetry)
  const storage = new HorizonDatabase()
  const sffs = new SFFS()
  const historyEntriesManager = new HistoryEntriesManager()
  const toasts = provideToasts()
  const config = provideConfig()
  const syncService = createSyncService(resourceManager)
  const oasis = provideOasis(resourceManager, config)
  const miniBrowserService = createMiniBrowserService(resourceManager, downloadIntercepters)
  const desktopManager = provideDesktopManager({
    telemetry,
    oasis,
    config,
    toasts,
    miniBrowserService
  })
  const tabsManager = createTabsManager(
    resourceManager,
    historyEntriesManager,
    telemetry,
    oasis,
    desktopManager
  )
  const aiService = provideAI(resourceManager, tabsManager, config)

  tabsManager.attachAIService(aiService)
  oasis.attachTabsManager(tabsManager)
  desktopManager.attachTabsManager(tabsManager)
  DIALOG_OASIS_REF.set(oasis)

  const colorService = provideColorService(config, ColorMode.HSL)
  onDestroy(colorService.destroy)
  desktopManager.attachColorService(colorService)
  const colorScheme = colorService.colorScheme

  const globalMiniBrowser = miniBrowserService.globalBrowser
  const userConfigSettings = config.settings
  const tabsDB = storage.tabs
  const spaces = oasis.spaces
  const selectedSpace = oasis.selectedSpace

  const chatContext = aiService.contextManager
  const chatContextItems = aiService.contextItems
  const showChatSidebar = aiService.showChatSidebar
  const activeTabContextItem = chatContext.activeTabContextItem
  const activeSpaceContextItem = chatContext.activeSpaceContextItem

  const desktopVisible = desktopManager.activeDesktopVisible
  const activeDesktop = desktopManager.activeDesktop
  const activeDesktopColorScheme = desktopManager.activeDesktopColorScheme

  const desktopBackgroundStore = derived(desktopManager.activeDesktop, (activeDesktop) => {
    return activeDesktop?.background_image
  })

  // NOTE: Make sure Dragcula is initialized
  Dragcula.get().isDragging.set(false)
  onDestroy(Dragcula.get().destroy)

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
    activatedTabs,
    showNewTabOverlay,
    selectedTabs,
    lastSelectedTabId
  } = tabsManager

  const showScreenshotPicker = writable(false)
  const screenshotPickerMode = writable<ScreenshotPickerMode>('inline')
  const addressValue = writable('')
  const sidebarTab = writable<'active' | 'archive' | 'oasis'>('active')
  const magicInputValue = writable('')
  const showCreateLiveSpaceDialog = writable(false)
  const bookmarkingTabsState = writable<Record<string, BookmarkTabState>>({})
  const isCreatingLiveSpace = writable(false)
  const activeAppId = writable<string>('')
  const showAppSidebar = writable(false)
  const rightSidebarTab = writable<RightSidebarTab>('chat')
  const showSplashScreen = writable(true)
  const showStartMask = writable(false)
  const showEndMask = writable(false)
  const newTabSelectedSpaceId = oasis.selectedSpace
  const updateSearchValue = writable('')

  // on windows and linux the custom window actions are shown in the tab bar
  const showCustomWindowActions = !isMac()

  const CHAT_DOWNLOAD_INTERCEPT_TIMEOUT = 1000 * 60 // 60s

  $: desktopColorScheme = $activeDesktopColorScheme
  $: {
    const isDarkMode = $userConfigSettings.app_style === 'dark'
    if (!desktopColorScheme || !$desktopColorScheme || !$desktopColorScheme.colorPalette) {
      colorService.useDefaultPalette(isDarkMode)
    } else {
      colorService.usePalette($desktopColorScheme.colorPalette, isDarkMode)
    }
  }

  // Toggle dark mode
  $: document.body.classList[$userConfigSettings.app_style === 'dark' ? 'add' : 'remove']('dark')

  // Toggle custom mode
  $: document.body.classList[isVendorBackground === false ? 'add' : 'remove']('custom')

  $: if ($activeTab) {
    const isActiveTabOnboarding = $activeTab?.type === 'onboarding'
    onboardingActive.set(isActiveTabOnboarding)
  }

  $: sffs.setVisionTaggingFlag($userConfigSettings.vision_image_tagging)

  // Set global context
  setContext('selectedFolder', 'inbox')

  const sidebarTools = derived(
    [showChatSidebar, activeTab, showAppSidebar, userConfigSettings],
    ([$showChatSidebar, $activeTab, $showAppSidebar, userConfigSettings]) => {
      const tools = [
        {
          id: 'chat',
          name: 'Chat',
          type: 'tool',
          icon: 'chat',
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

  // $: if ($activeTab?.archived !== ($sidebarTab === 'archive')) {
  //   log.debug('Active tab is not in view, resetting')
  //   tabsManager.makePreviousActive()
  // }

  $: {
    if ($onboardingActive) {
      const hasOnboardingTab = $tabs.some((tab) => tab.type === 'onboarding')
      onboardingTabOpened.set(hasOnboardingTab)
    }
  }

  const openResourceDetailsModal = async (
    resourceId: string,
    from?: OpenInMiniBrowserEventFrom
  ) => {
    globalMiniBrowser.openResource(resourceId, { from })
  }

  const openURLDetailsModal = async (e: any) => {
    showNewTabOverlay.set(0)

    let url = e.detail

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    globalMiniBrowser.openWebpage(url)
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

    if ($showChatSidebar) {
      setPageChatState(false)
    }
  }

  const handleExpandRight = () => {
    showRightSidebar = true
  }

  const toggleRightSidebar = () => {
    if (showRightSidebar) {
      handleCollapseRight()
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
    if (!initializedApp) {
      return
    }

    // check if sidebar is even open
    log.debug('Right sidebar tab change', tab)

    // delay the tracking to make sure the sidebar can update first
    setTimeout(() => {
      telemetry.trackOpenRightSidebar(tab)
    }, 50)

    if (tab === 'chat' && $showChatSidebar) {
      setPageChatState(true)
    } else if ($showChatSidebar) {
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

  const handleInvitesTab = async () => {
    // check if there already exists a invites tab, if yes we just change to it

    const invitesTab = $tabs.find((tab) => tab.type === 'invites')

    if (invitesTab) {
      tabsManager.makeActive(invitesTab.id)
      return
    }

    await tabsManager.create<TabInvites>(
      {
        title: 'Invites',
        icon: 'ticket',
        type: 'invites'
      },
      { active: true }
    )
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if ($showNewTabOverlay !== 0) {
        if ($userConfigSettings.homescreen_link_cmdt && $showNewTabOverlay === 1) {
          desktopManager.setCmdVisible(false)
        }
        showNewTabOverlay.set(0)
        return
      }
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
    } else if (e.metaKey && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
      toggleResourceDebugger(resourceManager)
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
      handleBlur()
      activeTabComponent?.blur()
    } else if (e.key === 'Enter' && $selectedTabs.size > 1) {
      startChatWithSelectedTabs()
    } else if (e.key === 'Backspace' && $selectedTabs.size > 1 && !$showChatSidebar) {
      const tabsToDelete = Array.from($selectedTabs)
      tabsToDelete.forEach((tab) => tabsManager.delete(tab.id))
      selectedTabs.set(new Set())
    } else if (isModKeyAndKeyPressed(e, 'w')) {
      // Note: even though the electron menu handles the shortcut this is still needed here
      if ($showNewTabOverlay !== 0) {
        setShowNewTabOverlay(0)
      } else if ($desktopVisible) {
        desktopManager.setVisible(false, { trigger: OpenHomescreenEventTrigger.Shortcut })
      } else {
        const activeTabMiniBrowserSelected = getActiveMiniBrowser()
        if (activeTabMiniBrowserSelected) {
          activeTabMiniBrowserSelected.miniBrowser.close()
          return
        }

        tabsManager.deleteActive(DeleteTabEventTrigger.Shortcut)
      }
    } else if (isModKeyAndKeyPressed(e, 'e')) {
      if ($showNewTabOverlay !== 0) setShowNewTabOverlay(0)
      toggleRightSidebarTab('chat')
    } else if (isModKeyAndKeyPressed(e, 'd')) {
      handleBookmark($activeTabId, false, SaveToOasisEventTrigger.Shortcut)
    } else if (isModKeyAndShiftKeyAndKeyPressed(e, 'h')) {
      desktopManager.setVisible(!$desktopVisible, { trigger: OpenHomescreenEventTrigger.Shortcut })
    } else if (isModKeyAndKeyPressed(e, 'n')) {
      // this creates a new electron window
      // TEMPORARY: this is only used for testing the invites feature
    } else if (isModKeyAndKeyPressed(e, 'o')) {
      console.log('OPEN STUFF', e, $showNewTabOverlay)
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
      handleCreateHistoryTab()
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
      ((!window.api.disableTabSwitchingShortcuts &&
        isModKeyAndKeysPressed(e, ['1', '2', '3', '4', '5', '6', '7', '8', '9'])) ||
        (window.api.disableTabSwitchingShortcuts &&
          isAltKeyAndKeysPressed(e, ['1', '2', '3', '4', '5', '6', '7', '8', '9']))) &&
      !e.shiftKey
    ) {
      selectedTabs.set(new Set())
      lastSelectedTabId.set(null)
      let key = parseInt(
        !window.api.disableTabSwitchingShortcuts ? e.key : e.code.match(/\d$/)?.[0] || '1'
      )
      if (key == 1 && !window.api.disableTabSwitchingShortcuts) {
        desktopManager.setVisible(!$desktopVisible, {
          trigger: OpenHomescreenEventTrigger.Shortcut
        })
        return
      }
      const index = key - (!window.api.disableTabSwitchingShortcuts ? 2 : 1)
      const tabs = [...$pinnedTabs, ...$unpinnedTabs]

      if (index < 8) {
        if (index < tabs.length) {
          tabsManager.makeActive(tabs[index].id, ActivateTabEventTrigger.Shortcut)
        }
      } else {
        // if 9 is pressed, go to the last tab
        tabsManager.makeActive(tabs[tabs.length - 1].id, ActivateTabEventTrigger.Shortcut)
      }
    } else if (
      e.altKey &&
      e.metaKey &&
      // Check arrow keys based on tab orientation
      (horizontalTabs
        ? e.key === 'ArrowLeft' || e.key === 'ArrowRight'
        : e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      cycleActiveTab(e.key === 'ArrowLeft' || e.key === 'ArrowUp')
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

  const handleMouseUp = (e: MouseEvent) => {
    if (e.button === 3) {
      if (canGoBack) {
        $activeBrowserTab?.goBack()
      }
    } else if (e.button === 4) {
      if (canGoForward) {
        $activeBrowserTab?.goForward()
      }
    }
  }

  const startChatWithSelectedTabs = async () => {
    if (($activeTab?.type === 'page' || $activeTab?.type === 'space') && !showRightSidebar) {
      // Update selectedTabs to reflect the change
      selectedTabs.update((selected) => {
        const updatedSelection = new Set(
          Array.from(selected).map((item) => ({ ...item, userSelected: true }))
        )
        return updatedSelection
      })

      await tick()

      openRightSidebarTab('chat')
    }
  }

  const setShowNewTabOverlay = (value: number) => {
    showNewTabOverlay.set(value)
  }

  const handleToggleHorizontalTabs = async () => {
    const t = document.startViewTransition(() => {
      horizontalTabs = !horizontalTabs

      config.updateSettings({
        tabs_orientation: horizontalTabs ? 'horizontal' : 'vertical'
      })

      // localStorage.setItem('horizontalTabs', horizontalTabs.toString())
      telemetry.trackToggleTabsOrientation(horizontalTabs ? 'horizontal' : 'vertical')
    })

    await tick().then(() => {
      checkScroll()
    })
  }

  const handleToggleTheme = () => {
    const newTheme = $userConfigSettings.app_style === 'dark' ? 'light' : 'dark'
    config.updateSettings({
      app_style: newTheme
    })

    // note: theme is tracked as a user property of all events
  }

  const debounceToggleHorizontalTabs = useDebounce(handleToggleHorizontalTabs, 100)
  const debouncedCycleActiveTab = useDebounce((previous) => {
    cycleActiveTab(previous)
  }, 100)
  const cycleActiveTab = (previous: boolean) => {
    const tabId = tabsManager.cycle(previous)
    if (tabId && tabId != $activeTabId) makeTabActive(tabId, ActivateTabEventTrigger.Shortcut)
  }

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

    telemetry.trackCreateTab(
      CreateTabEventTrigger.AddressBar,
      true,
      'page',
      getBrowserContextScopeType(tabsManager.activeScopeIdValue)
    )
  }

  const handleMultiSelect = async (event: CustomEvent<string>) => {
    const selectionEndTarget = event.detail

    log.debug('multi select', selectionEndTarget)

    await tabsManager.selectTabRange(
      selectionEndTarget,
      undefined,
      PageChatUpdateContextEventTrigger.TabSelection
    )
  }

  const handlePassiveSelect = async (event: CustomEvent<string>) => {
    const tabId = event.detail

    log.debug('passive select', tabId)

    await tabsManager.toggleTabSelection(
      tabId,
      true,
      PageChatUpdateContextEventTrigger.TabSelection
    )
  }

  const selectTabWhileKeepingOthersSelected = (tabId: string) => {
    log.debug('select tab while keeping others selected', tabId)

    makeTabActive(tabId)
    return
  }

  const openContextItemAsTab = async (contextItem: ContextItem) => {
    if (contextItem instanceof ContextItemPageTab && contextItem.dataValue) {
      selectTabWhileKeepingOthersSelected(contextItem.dataValue.id)
    } else if (contextItem instanceof ContextItemResource) {
      if (contextItem.sourceTab) {
        selectTabWhileKeepingOthersSelected(contextItem.sourceTab.id)
      } else {
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
      }
    } else if (contextItem instanceof ContextItemSpace) {
      const existingTab = $tabs.find(
        (tab) => tab.type === 'space' && tab.spaceId === contextItem.data.id
      )
      if (existingTab) {
        selectTabWhileKeepingOthersSelected(existingTab.id)
      } else {
        const existingContextTab = $chatContextItems.find(
          (item) => item instanceof ContextItemSpace && item.data.id === contextItem.data.id
        )

        const newTab = await tabsManager.addSpaceTab(contextItem.data, {
          active: false,
          trigger: CreateTabEventTrigger.OasisChat
        })

        selectTabWhileKeepingOthersSelected(newTab.id)

        if (existingContextTab) {
          log.debug('removing existing context item for same resource', existingContextTab.id)
          chatContext.removeContextItem(existingContextTab.id)
        }

        log.debug('created tab for space', newTab)
      }
    } else {
      log.debug('cannot open context item as tab', contextItem)
      toasts.info('Cannot open this item as a tab')
    }
  }

  const processContextItem = async (contextItem: ContextItem) => {
    if (contextItem instanceof ContextItemResource) {
      log.debug('re-processing context item tab resource', contextItem.data.id)
      await resourceManager.refreshResourceData(contextItem.data.id)
    } else {
      log.debug(
        `cannot re-process context item since it doesn't have a resource attached`,
        contextItem
      )
    }
  }

  const makeTabActive = (tabId: string, trigger?: ActivateTabEventTrigger) => {
    // Update selectedTabs to only include the newly selected tab
    if (!$showChatSidebar) {
      tabsManager.onlyUseTabInSelection(tabId, true)
    }

    tabsManager.makeActive(tabId, trigger)
  }

  const deselectAllTabs = () => {
    log.debug('deselect tabs')

    tabsManager.clearTabSelection()

    handleEndOnboardingTooltips()

    if ($showChatSidebar) {
      chatContext.clear()
    }

    activeTabId.set('')
    showChatSidebar.set(false)

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

      let browserTab = $browserTabs[tabId]

      const tabUrl = browserTab?.getInitialSrc() || tab.currentLocation || tab.initialLocation
      if (tabUrl.startsWith('surf://')) {
        return { resource: null, isNew: false }
      }

      updateBookmarkingTabState(tabId, 'in_progress')
      toast = toasts.loading(savedToSpace ? 'Saving Page to Context…' : 'Saving Page…')

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

      if (!resource) {
        log.error('error creating resource', resource)
        updateBookmarkingTabState(tabId, 'error')
        toast?.error('Failed to save page!')
        return { resource: null, isNew: false }
      }

      oasis.pushPendingStackAction(resource.id, { tabId: tabId })

      if (!savedToSpace && tabsManager.activeScopeIdValue) {
        await oasis.addResourcesToSpace(
          tabsManager.activeScopeIdValue,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )
        toast?.success(`Page saved to active Context!`)
      } else if (savedToSpace) {
        toast?.success('Page Saved to Context!')
      } else {
        toast?.success('Page Saved!')
      }

      updateBookmarkingTabState(tabId, 'success')

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

    const { closeType: confirmed } = await openDialog({
      message: 'Are you sure you want to delete this page from your stuff?'
    })

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
        folderName: 'New Context',
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

      toast.success('Context created!')
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

  const openResourcFromContextAsPageTab = async (resourceId: string) => {
    const existingContextTab = $chatContextItems.find(
      (item) => item.type === 'resource' && item.data.id === resourceId
    )
    const resource = await resourceManager.getResource(resourceId)
    if (resource?.type === ResourceTypes.PDF) {
      return await tabsManager.addPageTab(`surf://resource/${resourceId}`, {
        active: true,
        trigger: CreateTabEventTrigger.OasisChat
      })
    }
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
        tab = await tabsManager.openResourceAsTab(resource, {
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
      chatContext.removeContextItem(existingContextTab.id)
    }
    return tab
  }

  const highlightWebviewText = async (e: CustomEvent<HighlightWebviewTextEvent>) => {
    let { resourceId, answerText, sourceUid, preview } = e.detail
    log.debug('highlighting text', resourceId, answerText, sourceUid)

    if (preview) {
      globalMiniBrowser.openResource(resourceId, {
        from: OpenInMiniBrowserEventFrom.Chat,
        highlightSimilarText: answerText
      })
      return
    }

    let tab =
      $unpinnedTabs.find((tab) => tab.type === 'page' && tab.resourceBookmark === resourceId) ||
      null

    if (!tab) {
      tab = (await openResourcFromContextAsPageTab(resourceId)) ?? null
      if (!tab) {
        log.error('failed to open resource from context', resourceId)
        toasts.error('Failed to highlight citation')
        return
      }

      // give the new tab some time to load
      await wait(1000)
    }

    if (tab) {
      let browserTab: BrowserTab
      const isActivated = $activatedTabs.includes(tab.id)
      if (!isActivated) {
        log.debug('Tab not activated, activating first', tab.id)
        tabsManager.activateTab(tab.id)

        // give the tab some time to load
        await wait(200)

        browserTab = $browserTabs[tab.id]
        if (!browserTab) {
          log.error('Browser tab not found', tab.id)
          throw Error(`Browser tab not found`)
        }

        log.debug('Waiting for tab to become active', tab.id)
        await browserTab.waitForAppDetection(3000)
      } else {
        browserTab = $browserTabs[tab.id]
      }

      if (!browserTab) {
        log.error('Browser tab not found', tab.id)
        toasts.error('Failed to highlight citation')
        return
      }

      tabsManager.makeActive(tab.id, ActivateTabEventTrigger.ChatCitation)

      log.debug('highlighting citation', tab.id, answerText, sourceUid)
      let source = null
      if (sourceUid) source = await sffs.getAIChatDataSource(sourceUid)

      if (answerText === '') {
        if (!source) {
          return
        }
        answerText = source.content
      }

      await browserTab.highlightWebviewText(resourceId, answerText, source)
    } else {
      log.error('No tab in chat context found for resource', resourceId)
      toasts.error('Failed to highlight citation')
    }
  }

  const handleSeekToTimestamp = async (e: CustomEvent<JumpToWebviewTimestampEvent>) => {
    const { resourceId, timestamp, preview } = e.detail
    log.info('seeking to timestamp', resourceId, timestamp, preview)

    if (preview) {
      globalMiniBrowser.openResource(resourceId, {
        from: OpenInMiniBrowserEventFrom.Chat,
        jumptToTimestamp: timestamp
      })
      return
    }

    let tab =
      $unpinnedTabs.find((tab) => tab.type === 'page' && tab.resourceBookmark === resourceId) ||
      null

    if (!tab) {
      tab = (await openResourcFromContextAsPageTab(resourceId)) ?? null
      if (!tab) {
        log.error('failed to open resource from context', resourceId)
        toasts.error('Failed to highlight citation')
        return
      }

      // give the new tab some time to load
      await wait(1000)
    }

    if (tab) {
      let browserTab: BrowserTab
      const isActivated = $activatedTabs.includes(tab.id)
      if (!isActivated) {
        log.debug('Tab not activated, activating first', tab.id)
        tabsManager.activateTab(tab.id)

        // give the tab some time to load
        await wait(200)

        browserTab = $browserTabs[tab.id]
        if (!browserTab) {
          log.error('Browser tab not found', tab.id)
          throw Error(`Browser tab not found`)
        }

        log.debug('Waiting for tab to become active', tab.id)
        await browserTab.waitForAppDetection(3000)
      } else {
        browserTab = $browserTabs[tab.id]
      }

      if (!browserTab) {
        log.error('Browser tab not found', tab.id)
        toasts.error('Failed to highlight citation')
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
      await aiService.deleteChat($activeAppId)
      //await deleteAppIdsForAppSidebar()
      if (createNewAppId) {
        const chat = await aiService.createChat('')
        appId = chat?.id ?? null
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

  const setPageChatState = async (enabled: boolean) => {
    log.debug('Toggling magic sidebar', enabled)
    const tab = $activeTab as TabPage | null

    if (!enabled) {
      selectedTabs.set(new Set())
      lastSelectedTabId.set(null)
    }

    await tick()

    if (enabled) {
      showChatSidebar.set(true)

      const selectedTabIds = Array.from($selectedTabs).map((item) => item.id)

      log.debug('selected tabs', selectedTabIds)

      if (selectedTabIds.length > 1) {
        chatContext.clear()
        for (const id of selectedTabIds) {
          await chatContext.addTab(id)
        }
      } else if ($desktopVisible) {
        chatContext.clear()
        await chatContext.addActiveSpaceContext()
      } else if (tab) {
        chatContext.clear()
        await chatContext.addActiveTab()
      } else {
        await chatContext.restoreItems()
      }
    } else {
      showChatSidebar.set(false)
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
      const chat = await aiService.createChat('')
      appId = chat?.id
      if (!appId) {
        log.error('Failed to create an app id')
        toasts.error('Error: Failed to create an pp id')
        return
      }

      tabsManager.update(tab.id, { appId: appId })
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

    toasts.success('Context added to your Tabs!')
  }

  const handleCreateTabForSpace = async (e: CustomEvent<OasisSpace>) => {
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
        isLiveSpace: space.dataValue.liveModeEnabled,
        hasSources: (space.dataValue.sources ?? []).length > 0,
        hasSmartQuery: !!space.dataValue.smartFilterQuery
      })
    } catch (error) {
      log.error('[Browser.svelte] Failed to add folder to sidebar:', error)
    }

    toasts.success('Context added to your Tabs!')
  }

  const handleCreateHistoryTab = () => {
    setShowNewTabOverlay(0)
    createHistoryTab()
  }

  const handleOpenCreateSpaceMenu = async () => {
    showNewTabOverlay.set(2)
    await tick()
    const button = document.querySelector('.action-new-space') as HTMLButtonElement | null
    if (button) button.click()
  }

  const saveTabInSpace = async (tabId: string, space: OasisSpace) => {
    log.debug('save tab page to space', tabId, space)
    try {
      const { resource } = await handleBookmark(tabId, true, SaveToOasisEventTrigger.Click)
      log.debug('bookmarked resource', resource)
      if (resource) {
        log.debug('will add item', resource.id, 'to space', space.id)
        await resourceManager.addItemsToSpace(
          space.id,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded
        )
        // new resources are already tracked in the bookmarking function
        await telemetry.trackAddResourceToSpace(
          resource.type,
          AddResourceToSpaceEventTrigger.TabMenu
        )
      }
    } catch (e) {
      log.error('Failed to add resource to space:', e)
    }
  }

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
      name: name ?? 'Context',
      source: spaceSource
    }
  }

  const handleCreateLiveSpace = async (_e?: MouseEvent) => {
    if ($activeTab?.type !== 'page') {
      log.debug('No page tab active')
      return
    }

    const toast = toasts.loading('Creating Context...')

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

      toast.success('Context created!')
    } catch (e) {
      log.error('Error creating live space', e)
      toast.error('Failed to create Context')
    } finally {
      isCreatingLiveSpace.set(false)
    }
  }

  const handleAddSourceToSpace = async (e: CustomEvent<OasisSpace>) => {
    if ($activeTab?.type !== 'page') {
      log.debug('No page tab active')
      return
    }

    const toast = toasts.loading('Adding source to Context...')

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
        sources: [...(space.dataValue.sources ?? []), source],
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

      toast.success('Page added as source to Context!')
    } catch (e) {
      log.error('Error creating live space', e)
      toast.error('Failed to add source to Context')
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

  const handleCreateNote = async (e: CustomEvent<string | undefined>) => {
    const query = e.detail ?? ''
    log.debug('create note with query', query)

    const resource = await resourceManager.createResourceNote(query)
    await tabsManager.openResourceAsTab(resource, { active: true })
    toasts.success('Note created!')
  }

  const handleCreateChatWithQuery = async (e: CustomEvent<string>) => {
    const query = e.detail
    log.debug('create chat with query', query)

    openRightSidebarTab('chat')

    await wait(500)

    await chatContext.removeAllExcept($activeTabId)

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
        chatContext.addTab(tab.id)
      }

      // Select the tabs
      selectedTabs.set(new Set(validTabs.map((tab) => ({ id: tab.id, userSelected: true }))))

      await tick()

      telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.Add,
        chatContext.tabsInContextValue.length,
        validTabs.length,
        PageChatUpdateContextItemType.PageTab
      )
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
  }

  const handleOpenSpaceAndChat = async (e: CustomEvent<ChatWithSpaceEvent>) => {
    let { spaceId, text = '' } = e.detail

    log.debug('create chat with space', spaceId, text)

    const space = await oasis.getSpace(spaceId)

    if (!space) {
      log.error('Context not found', spaceId)
      toasts.error('Context not found')
      return
    }

    openRightSidebarTab('chat')

    let tab = $tabs.find((tab) => tab.type === 'space' && tab.spaceId === spaceId)
    if (tab) {
      log.debug('Found existing space tab', tab.id)
      tabsManager.makeActive(tab.id)
      await chatContext.onlyUseTabInContext(tab.id)
    } else {
      // When the user drops the onboarding space into the chat we start the onboarding
      const ONBOARDING_SPACE_NAME = onboardingSpace.name
      const isOnboarding = space.dataValue.folderName === ONBOARDING_SPACE_NAME

      log.debug('Adding space to chat context', space, isOnboarding)
      const spaceContextItem = await chatContext.addSpace(
        space,
        isOnboarding
          ? PageChatUpdateContextEventTrigger.Onboarding
          : PageChatUpdateContextEventTrigger.Onboarding
      )

      if (isOnboarding) {
        await chatContext.removeAllExcept(spaceContextItem.id)
      }

      if (isOnboarding && !text) {
        text = onboardingSpace.query
      }
    }

    /* else if (!tab) {
      tab = await tabsManager.addSpaceTab(space, { active: true })
    }*/

    // Wait for the chat to be ready
    await wait(500)

    if (magicSidebar) {
      log.debug('Inserting query into chat', text)
      magicSidebar.startChatWithQuery(text)
    } else {
      log.error('Magic sidebar not found')
      toasts.error('Failed to start chat with space')
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

  // const handleOnboardingChatWithSpace = async (e: CustomEvent<{ id: string; query: string }>) => {
  //   const { id: spaceId, query } = e.detail

  //   const space = await oasis.getSpace(spaceId)

  //   if (space) {
  //     let tab = $tabs.find((t) => t.spaceId === spaceId)
  //     log.debug('Current tabs:', $tabs)
  //     if (!tab) {
  //       tab = await tabsManager.addSpaceTab(space, { active: false })
  //       log.debug('Added new space tab:', tab)
  //     }
  //     if (tab) {
  //       await tick()
  //       await chatContext.onlyUseTabInContext(tab.id)
  //       openRightSidebarTab('chat')

  //       const attemptInsertQuery = (retries = 3) => {
  //         if (magicSidebar) {
  //           magicSidebar.insertQueryIntoChat(query)
  //         } else if (retries > 0) {
  //           setTimeout(() => attemptInsertQuery(retries - 1), 1000)
  //         } else {
  //           log.error('Magic sidebar not found after multiple attempts')
  //           toasts.error('Failed to start chat with prefilled message')
  //         }
  //       }

  //       attemptInsertQuery()
  //     } else {
  //       log.error('Failed to open space as tab')
  //       toasts.error('Failed to open space')
  //     }
  //   } else {
  //     log.error('Context not found', spaceId)
  //     toasts.error('Context not found')
  //   }
  // }

  const handleOnboardingChatWithQuery = async (e: CustomEvent<{ query: string }>) => {
    const { query } = e.detail

    openRightSidebarTab('chat')

    await tick()

    chatContext.clear()

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

  const handleOpenOnboardingTabs = async (e: CustomEvent<string[]>) => {
    const tabUrls = e.detail
    tabUrls.forEach(async (url) => {
      let existingTab =
        $tabs.find(
          (tab) =>
            tab.type === 'page' && (tab.initialLocation === url || tab.currentLocation === url)
        ) ?? null
      if (existingTab) {
        tabsManager.makeActive(existingTab.id)
      } else {
        existingTab = await tabsManager.addPageTab(url, { active: true })
        await wait(250)
      }

      if (existingTab) {
        await chatContext.addTab(existingTab.id)
      }
    })
  }

  let maxWidth = window.innerWidth

  let tabSize = 0

  $: {
    const reservedSpace = 400 + $pinnedTabs.length * 50 + 32
    const isActiveTabPinned = $activeTab?.pinned
    const availableSpace =
      maxWidth -
      reservedSpace -
      320 * (isActiveTabPinned ? 0 : 1) -
      100 * (isActiveTabPinned ? 1 : 0)
    const numberOfTabs = $unpinnedTabs.length === 0 ? 1 : $unpinnedTabs.length
    tabSize = availableSpace / (numberOfTabs - 1)
  }

  const handleResize = async () => {
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
        $showEndMask = scrollTop + clientHeight <= scrollHeight - 10
      }
    }
  }

  const controlWindow = (action: ControlWindow) => {
    window.api.controlWindow(action)
  }

  onMount(() => {
    initResourceDebugger(resourceManager)

    window.api.onBrowserFocusChange((state) => {
      if (state === 'unfocused') {
        Dragcula.get().cleanupDragOperation()
      }
    })

    const unsubscribeCreated = tabsManager.on('created', (tab, active) => {
      checkScroll()

      // Ensure the new tab is in context when the sidebar is open
      if ($showChatSidebar) {
        // TODO: this should be cleaned up more
        if (active) {
          makeTabActive(tab.id)
        } /* else {
          tabsManager.addTabToSelection(tab.id)
        }*/
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

    const unsubscribeDesktopVisible = desktopVisible.subscribe((visible) => {
      if (visible && $activeTabContextItem && !$activeSpaceContextItem) {
        log.debug('Replacing active tab context with active space context')
        const index = $chatContextItems.findIndex((item) => item.id === $activeTabContextItem.id)
        chatContext.removeContextItem($activeTabContextItem.id)
        chatContext.addActiveSpaceContext(undefined, index >= 0 ? index : undefined)
      } else if (!visible && $activeSpaceContextItem && !$activeTabContextItem) {
        log.debug('Replacing active space context with active tab context')
        const index = $chatContextItems.findIndex((item) => item.id === $activeSpaceContextItem.id)
        chatContext.removeContextItem($activeSpaceContextItem.id)
        chatContext.addActiveTab(undefined, index >= 0 ? index : undefined)
      }
    })

    return () => {
      unsubscribeCreated()
      unsubscribeDeleted()
      unsubscribeActiveTab()
      unsubscribeSidebarTab()
      unsubscribeDesktopVisible()
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

    await telemetry.init(userConfig, config)

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

    window.api.onToggleTheme(() => {
      handleToggleTheme()
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

    window.api.onOpenImporter(() => {
      openImporterTab()
    })

    window.api.onOpenCheatSheet(() => {
      openCheatSheet()
    })

    window.api.onOpenInvitePage(() => {
      openInvitePage()
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
        if ($userConfigSettings.homescreen_link_cmdt) {
          desktopManager.setCmdVisible(false)
        }
      } else {
        // THIS IS WHERE THE OLD COMMAND BAR GOT CALLED
        $showNewTabOverlay = 1
        if ($userConfigSettings.homescreen_link_cmdt) {
          desktopManager.setCmdVisible(true)
          // TODO: (maxu/home): Only until felixes new cmdt merge
          tick().then(() => document.querySelector('.drawer-overlay')?.remove())
        }
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

    window.api.onImportedFiles(async (files: File[]) => {
      const toast = toasts.loading('Importing files...')
      try {
        log.debug('imported files', files)

        const newResources = await createResourcesFromFiles(files, resourceManager)
        log.debug('Resources', newResources)

        await oasis.loadEverything(true)

        toast.success(`Imported ${newResources.length} file${newResources.length > 1 ? 's' : ''}!`)
      } catch (err) {
        log.error('Failed to import', err)
        toast.error('Failed to import files')
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

      const downloadIntercepter = get(downloadIntercepters).get(data.url)
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
        const resource = await resourceManager.reloadResource(downloadData.resourceId)
        if (resource) {
          const isValidType =
            (Object.values(ResourceTypes) as string[]).includes(resource.type) ||
            resource.type.startsWith('image/')

          if (isValidType) {
            await window.backend.resources.updateResourceHash(downloadData.resourceId)
            await window.backend.resources.triggerPostProcessing(downloadData.resourceId)
            resourceManager.reloadResource(downloadData.resourceId)
          }
        }
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

      const downloadIntercepter = get(downloadIntercepters).get(downloadData.url)
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

    const desktopId = tabsManager.activeScopeIdValue ?? '$$default'
    desktopManager.setActive(desktopId)

    await tick()

    const activeTabs = tabsList.filter((tab) => !tab.archived)

    if (activeTabs.length === 0) {
      // tabsManager.showNewTab()
    } else if ($activeTabId) {
      const tab = activeTabs.find((tab) => tab.id === $activeTabId)

      if (tabsManager.activeScopeIdValue) {
        if (tabsManager.activeScopeIdValue !== tab?.scopeId || tab.pinned) {
          desktopManager.setVisible(true, { desktop: desktopId })
        } else {
          const desktopOpen = get(desktopManager.activeDesktopVisible)
          tabsManager.makeActive($activeTabId, undefined, !desktopOpen)
        }
      } else if (tab?.scopeId) {
        desktopManager.setVisible(true, { desktop: desktopId })
      } else {
        tabsManager.makeActive($activeTabId)
      }
    } else {
      tabsManager.makeActive(activeTabs[activeTabs.length - 1].id)
    }

    selectedTabs.set(new Set())

    tabs.update((tabs) => tabs.sort((a, b) => a.index - b.index))
    log.debug('tabs', $tabs)

    await tick()

    checkScroll()
    prepareContextMenu()

    initializedApp = true

    if (userConfig && !userConfig.initialized_tabs) {
      log.debug('Creating initial tabs')
      await createDemoItems(tabsManager, oasis, tabsManager.addSpaceTab, resourceManager)
      await window.api.updateInitializedTabs(true)
    } else if (!userConfig?.settings.onboarding.completed_welcome_v2) {
      await openWelcomeTab()
    }

    showSplashScreen.set(false)

    if (isDev) {
      // @ts-ignore
      window.createDemoItems = () => {
        createDemoItems(tabsManager, oasis, tabsManager.addSpaceTab, resourceManager)
      }

      // @ts-ignore
      window.createOnboardingSpace = () => {
        createOnboardingSpace(tabsManager, oasis, tabsManager.addSpaceTab, resourceManager)
      }
    }

    syncService.init()
  })

  const openFeedback = () => {
    const url = 'https://surf.featurebase.app/'
    window.open(url, '_blank')
  }

  const openWelcomeTab = async () => {
    const onboardingTab = $tabs.find(
      (tab) =>
        tab.type === 'onboarding' && tab.scopeId === (tabsManager.activeScopeIdValue ?? undefined)
    )
    if (onboardingTab) {
      tabsManager.makeActive(onboardingTab.id)
    } else {
      await tabsManager.addOnboardingTab(false)
    }

    selectedTabs.set(
      new Set([{ id: $tabs.find((t) => t.type === 'onboarding')?.id ?? '', userSelected: true }])
    )
    onboardingTabVisible.set(true)
  }

  const openImporterTab = async () => {
    const tab = $tabs.find(
      (tab) =>
        tab.type === 'importer' && tab.scopeId === (tabsManager.activeScopeIdValue ?? undefined)
    )
    if (tab) {
      tabsManager.makeActive(tab.id)
    } else {
      await tabsManager.addImporterTab()
    }
  }

  const openInvitePage = () => {
    handleInvitesTab()
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
    } catch (error) {
      log.error('Failed to remove space from sidebar:', error)
    }
  }

  const handleEdit = async () => {
    await tick()
    setShowNewTabOverlay(0)
    activeTabComponent?.editAddress()
    handleFocus()
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
        if (tab && pinned) tabsManager.changeTabPinnedState(tab!.id, pinned)

        telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, false)
      }

      return
    } else if (drag.item!.data.hasData(DragTypeNames.SURF_TAB)) {
      const droppedTab = drag.item!.data.getData(DragTypeNames.SURF_TAB)
      tabs.update((oldTabs) => {
        let unpinnedTabsArray = get(unpinnedTabs) // oldTabs.filter((t) => !t.pinned).sort((a, b) => a.index - b.index)
        let pinnedTabsArray = get(pinnedTabs)

        let fromTabs: Tab[] = []
        let toTabs: Tab[] = []

        if (drag.from?.id === 'sidebar-unpinned-tabs') {
          fromTabs = unpinnedTabsArray
        } else if (drag.from?.id === 'sidebar-pinned-tabs') {
          fromTabs = pinnedTabsArray
        }

        if (drag.to?.id === 'sidebar-unpinned-tabs') {
          toTabs = unpinnedTabsArray
        } else if (drag.to?.id === 'sidebar-pinned-tabs') {
          toTabs = pinnedTabsArray
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
            droppedTab.scopeId = undefined
            droppedTab.pinned = true

            telemetry.trackMoveTab(MoveTabEventAction.Pin)
          } else {
            telemetry.trackMoveTab(MoveTabEventAction.Unpin)
            droppedTab.scopeId = tabsManager.activeScopeIdValue ?? undefined
            droppedTab.pinned = false
          }

          toTabs.splice(drag.index || 0, 0, droppedTab)
        }

        // Update the indices of the tabs in all lists
        const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }))

        unpinnedTabsArray = updateIndices(unpinnedTabsArray)
        pinnedTabsArray = updateIndices(pinnedTabsArray)

        // Combine all lists back together
        const combinedList = [...unpinnedTabsArray, ...pinnedTabsArray]
        const missingTabs = oldTabs.filter((tab) => !combinedList.find((t) => t.id === tab.id))
        const newTabs = [...combinedList, ...missingTabs]

        log.warn('New tabs', [...newTabs])

        // Update the store with the changed tabs
        tabsManager.bulkPersistChanges(
          newTabs.map((tab) => ({
            id: tab.id,
            updates: {
              pinned: tab.pinned,
              index: tab.index,
              scopeId: tab.scopeId
            }
          }))
        )

        return newTabs
      })

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
    const saveToSpace = spaceId !== undefined && spaceId !== 'all' && spaceId !== 'inbox'

    const toast = toasts.loading(
      !saveToSpace
        ? 'Saving to Your Stuff...'
        : `${drag.effect === 'move' ? 'Moving' : 'Copying'} to Context...`
    )

    try {
      log.debug('dropping onto sidebar tab', drag)

      if (drag.item !== null && drag.item !== undefined) drag.item.dropEffect = 'copy'

      if (drag.isNative) {
        const parsed = await processDrop(drag.event!)
        log.debug('Parsed', parsed)

        const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
        log.debug('Resources', newResources)

        if (saveToSpace) {
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
          resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)?.value ===
          'true'
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

        if (saveToSpace) {
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
    } catch (error) {
      log.error('Failed to drop on space tab', error)
      toast.error('Failed to save resources')
    }
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

      chatContext.addScreenshot(blob)
    } catch (error) {
      log.error('Failed to create screenshot for chat:', error)
      toasts.error('Failed to create screenshot for chat')
    } finally {
      if (!event.detail.loading) {
        $showScreenshotPicker = false
      }
    }
  }

  const removeAllContextItems = () => {
    chatContext.clear()
  }

  // const handleAddContextItem = (e: CustomEvent<AddContextItemEvent>) => {
  //   const { item, trigger } = e.detail

  //   if (item instanceof ContextItemSpace) {
  //     // This is needed for the onboarding to get to the next step
  //     handleChattingWithOnboardingSpace(item.data.dataValue.folderName)
  //   }

  //   chatContext.addContextItem(item, trigger)
  // }

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
    chatContext.onlyUseTabInContext(tabId)
  }
  const handlePinTab = (e: CustomEvent<string>) => {
    const tabId = e.detail
    const tab = $tabs.find((t) => t.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    tabsManager.pinTab(tabId)
  }
  const handleUnpinTab = (e: CustomEvent<string>) => {
    const tabId = e.detail
    const tab = $tabs.find((t) => t.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    tabsManager.unpinTab(tabId)
  }

  let leftSidebarWidth = 0
  let leftSidebarHeight = 0
  let rightSidebarWidth = 0

  let isVendorBackground = true
  $: backgroundImage =
    $desktopBackgroundStore === undefined
      ? writable(undefined)
      : derived(
          [$desktopBackgroundStore, userConfigSettings],
          ([$background, $userConfigSettings]) => {
            // Custom
            if (
              $background?.resourceId !== undefined &&
              $background?.resourceId !== 'transparent' &&
              $background?.resourceId !== ''
            ) {
              isVendorBackground = false
              return {
                path: `url('surf://resource/${$background.resourceId}')`,
                customColors: $background.colorPalette
              }
            }
            // Vendor
            else {
              isVendorBackground = true
              return {
                path: `url('${$userConfigSettings.app_style === 'dark' ? vendorBackgroundDark : vendorBackgroundLight}')`,
                customColors: {}
              }
            }
          }
        )
  $: console.warn('BG IMA', $backgroundImage)

  const contextMenuMoveTabsToSpaces = derived(
    [spaces, tabsManager.activeScopeId],
    ([spaces, activeScopeId]) => {
      const handleMove = async (spaceId: string | null, label: string, makeActive = false) => {
        try {
          if ($selectedTabs.size === 0) {
            toasts.error('No tabs selected')
            return
          }

          const selected = Array.from($selectedTabs).map((tab) => tab.id)

          await Promise.all(selected.map((id) => tabsManager.scopeTab(id, spaceId)))

          const lastTabId = selected[selected.length - 1]
          if (makeActive) {
            await tabsManager.makeActive(lastTabId)
          }

          // reset selected tabs
          selectedTabs.set(new Set())

          toasts.success(`Tabs moved to ${label}!`)
        } catch (e) {
          toasts.error(`Failed to add to ${label}`)
        }
      }

      return [
        {
          type: 'action',
          icon: generalContext.icon,
          text: generalContext.label,
          action: () => handleMove(null, generalContext.label)
        } as CtxItem,
        {
          type: 'action',
          icon: newContext.icon,
          text: newContext.label,
          action: async () => {
            const space = await oasis.createNewBrowsingSpace(ChangeContextEventTrigger.Tab, {
              newTab: false
            })
            await handleMove(space.id, space.dataValue.folderName, true)
          }
        } as CtxItem,
        ...spaces
          .filter(
            (e) =>
              e.id !== 'all' &&
              e.id !== 'inbox' &&
              e.dataValue?.folderName?.toLowerCase() !== '.tempspace' &&
              !e.dataValue.builtIn &&
              e.id !== activeScopeId
          )
          .map(
            (space) =>
              ({
                type: 'action',
                icon: space,
                text: space.dataValue.folderName,
                action: () => handleMove(space.id, space.dataValue.folderName)
              }) as CtxItem
          )
      ]
    }
  )
</script>

{#if $debugMode}
  <DevOverlay />
{/if}

<SplashScreen show={$showSplashScreen} />

<svelte:window on:keydown={handleKeyDown} on:mouseup={handleMouseUp} />

<ToastsProvider service={toasts} />

<Tooltip on:open-stuff={() => ($showNewTabOverlay = 2)} rootID="body" />
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

<MiniBrowser
  service={globalMiniBrowser}
  on:seekToTimestamp={handleSeekToTimestamp}
  on:highlightWebviewText={highlightWebviewText}
/>

<!-- {#if $showNewTabOverlay == 1} -->
<div
  class="teletype-motion fixed bottom-0 left-0 right-0 z-[5001] h-[1px]"
  use:springVisibility={{
    visible: $showNewTabOverlay == 1
  }}
>
  <TeletypeEntry
    {tabsManager}
    open={$showNewTabOverlay == 1}
    on:close={() => {
      showNewTabOverlay.set(0)
    }}
    on:ask={(e) => {
      let query = e.detail
      console.log('create chat')

      showNewTabOverlay.set(0)
      handleCreateChatWithQuery(e)
    }}
    on:open-url={(e) => {
      tabsManager.addPageTab(e.detail, {
        active: true,
        trigger: CreateTabEventTrigger.AddressBar
      })
    }}
    on:open-url-in-minibrowser={openURLDetailsModal}
    on:open-resource-in-minibrowser={(e) =>
      openResourceDetailsModal(e.detail, OpenInMiniBrowserEventFrom.CommandMenu)}
    on:reload={() => {
      $activeBrowserTab?.reload()
    }}
    on:zoom-in={() => {
      $activeBrowserTab?.zoomIn()
    }}
    on:zoom-out={() => {
      $activeBrowserTab?.zoomOut()
    }}
    on:reset-zoom={() => {
      $activeBrowserTab?.resetZoom()
    }}
    on:toggle-sidebar={() => changeLeftSidebarState()}
    on:close-active-tab={() => tabsManager.deleteActive(DeleteTabEventTrigger.CommandMenu)}
    on:create-note={handleCreateNote}
    on:activate-tab={(e) => makeTabActive(e.detail, ActivateTabEventTrigger.CommandMenu)}
    on:toggle-bookmark={() =>
      handleBookmark($activeTabId, false, SaveToOasisEventTrigger.CommandMenu)}
    on:show-history-tab={handleCreateHistoryTab}
    on:create-new-space={handleOpenCreateSpaceMenu}
    on:open-space={async (e) => {
      const space = e.detail
      showNewTabOverlay.set(2)
      await tick()

      newTabSelectedSpaceId.set(space.id)
    }}
    on:open-stuff={async (e) => {
      const searchValue = e.detail
      selectedSpace.set(DEFAULT_SPACE_ID)
      updateSearchValue.set(searchValue)
      await tick()
      showNewTabOverlay.set(2)
    }}
  />
</div>
<!-- {/if} -->

<div
  id="app-contents"
  class="app-contents antialiased w-screen h-screen will-change-auto transform-gpu relative drag flex flex-col bg-blue-300/40 dark:bg-gray-950/80"
  class:drag={$showScreenshotPicker === false}
  class:no-drag={$showScreenshotPicker === true}
  class:horizontalTabs
  class:verticalTabs={!horizontalTabs}
  class:showLeftSidebar
  class:showRightSidebar
  style:--left-sidebar-size={$leftSize + 'px'}
  style:--right-sidebar-size={$rightSize + 'px'}
  style:--background-image={$backgroundImage?.path}
  style:--background-opacity={$backgroundImage?.path?.startsWith(`url('surf://`) ? 1 : 0.4}
>
  {#if !horizontalTabs && showCustomWindowActions}
    <div
      class="vertical-window-bar flex flex-row flex-shrink-0 items-center justify-between p-1"
      style="position: relative; z-index: 9999999999;"
    >
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
          class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-x text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100"
        >
          <Icon name="minus" />
        </button>
        <button
          on:click={() => controlWindow('toggle-maximize')}
          class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100"
        >
          <Icon name="rectangle" />
        </button>
        <button
          on:click={() => controlWindow('close')}
          class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  {/if}

  {#if $desktopVisible && $activeDesktop}
    {#key $activeDesktop.id}
      <Homescreen
        desktop={$activeDesktop}
        newTabOverlayState={$showNewTabOverlay}
        on:click
        on:open-space={async (e) => {
          const { space, background } = e.detail
          if (!background) {
            showNewTabOverlay.set(2)
            newTabSelectedSpaceId.set(space.id)
          } else {
            const _space = await oasis.getSpace(space.id)
            if (_space === null) return
            await tabsManager.addSpaceTab(_space, {
              active: false
            })
          }
        }}
        on:open-stuff={async (e) => {
          await tick()
          showNewTabOverlay.set(2)
        }}
        on:open={(e) => {
          openResourceDetailsModal(e.detail, OpenInMiniBrowserEventFrom.Homescreeen)
        }}
        on:open-and-chat={handleOpenAndChat}
        on:open-space-as-tab={handleCreateTabForSpace}
        on:highlightWebviewText={highlightWebviewText}
        on:seekToTimestamp={handleSeekToTimestamp}
      />
    {/key}
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
      class="left-sidebar flex-grow {horizontalTabs ? 'w-full h-full' : 'h-full'}"
      class:homescreenVisible={$desktopVisible}
      class:horizontalTabs
      bind:clientWidth={leftSidebarWidth}
      bind:clientHeight={leftSidebarHeight}
    >
      {#if $sidebarTab !== 'oasis'}
        <div
          class="flex {!horizontalTabs
            ? `flex-col w-full ${showCustomWindowActions ? 'h-[calc(100%-45px)]' : 'py-1.5 h-full'} space-y-4 px-2`
            : `flex-row !items-center h-full  ${showCustomWindowActions ? '' : 'ml-20'} space-x-4 mr-4`} relative"
          use:contextMenu={{
            items: [
              {
                type: 'action',
                icon: 'add',
                text: 'New Tab',
                action: () => tabsManager.addPageTab('')
              },
              {
                type: 'action',
                icon: generalContext.icon,
                text: 'New Context',
                action: async () => {
                  await oasis.createNewBrowsingSpace(ChangeContextEventTrigger.Tab)
                  toasts.success('New Context created!')
                }
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

          {#if horizontalTabs}
            <ScopeSwitcher {horizontalTabs} />
          {/if}

          <div
            id="sidebar-pinned-tabs-wrapper"
            class={$pinnedTabs.length !== 0 || horizontalTabs
              ? 'relative no-drag my-auto rounded-xl flex justify-start flex-shrink-0 transition-colors gap-1 overflow-hidden}'
              : horizontalTabs
                ? 'absolute top-1 h-[1.9rem] left-[9rem] w-[16px] rounded-md no-drag my-auto flex-shrink-0 transition-colors overflow-hidden'
                : 'absolute top-8 h-2 left-4 right-4 rounded-md no-drag my-auto flex-shrink-0 transition-colors overflow-hidden'}
            class:horizontalTabs
            class:empty={$pinnedTabs.length === 0}
            bind:this={pinnedTabsWrapper}
            style="scroll-behavior: smooth;"
          >
            <div
              id="sidebar-pinned-tabs"
              class={`flex items-start h-full gap-1 overflow-x-scroll overflow-y-hidden overscroll-none no-scrollbar w-full justify-between min-w-[1ch]`}
              axis="horizontal"
              dragdeadzone="5"
              role="none"
              bind:this={pinnedTabsScrollArea}
              use:useResizeObserver
              on:resize={() => {
                pinnedTabsScrollArea.className = pinnedTabsScrollArea.className
              }}
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
                    {spaces}
                    pinned={true}
                    isMagicActive={$showChatSidebar}
                    isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                    isUserSelected={Array.from($selectedTabs).some(
                      (item) => item.id === tab.id && item.userSelected
                    )}
                    isMediaPlaying={$browserTabs[tab.id]?.getMediaPlaybackState()}
                    on:select={(e) => makeTabActive(e.detail)}
                    on:remove-from-sidebar={handleRemoveFromSidebar}
                    on:delete-tab={handleDeleteTab}
                    on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                    on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                    on:multi-select={handleMultiSelect}
                    on:passive-select={handlePassiveSelect}
                    on:chat-with-tab={handleOpenTabChat}
                    on:pin={handlePinTab}
                    on:unpin={handleUnpinTab}
                    on:edit={handleEdit}
                  />
                {/each}
              {/if}
            </div>
          </div>

          {#if horizontalTabs && $pinnedTabs.length > 0}
            <div class="bg-sky-50/50 h-1/2 w-1.5 rounded-full"></div>
          {/if}

          {#if !horizontalTabs}
            <ScopeSwitcher {horizontalTabs} />
          {/if}

          <div
            class="relative w-full h-full no-scrollbar overflow-hidden py-2 {horizontalTabs
              ? 'flex-row overflow-y-hidden'
              : 'flex-col overflow-x-hidden'} {horizontalTabs
              ? 'overflow-x-auto'
              : 'overflow-y-auto'} flex flex-nowrap"
            class:items-center={horizontalTabs}
            on:wheel={(event) => {
              if (horizontalTabs) {
                containerRef.scrollLeft += event.deltaY
              }
            }}
            on:scroll={checkScroll}
            bind:this={containerRef}
            use:contextMenu={{
              canOpen: $selectedTabs.size > 1,
              items: [
                {
                  type: 'action',
                  icon: 'add',
                  text: 'Save to new Context',
                  action: () => {
                    const tabIds = $tabs
                      .filter((tab) => Array.from($selectedTabs).some((item) => item.id === tab.id))
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
                {
                  type: 'sub-menu',
                  text: 'Move Tabs to Context',
                  items: $contextMenuMoveTabsToSpaces
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
                class="horizontal-tabs gap-1.5 h-full no-scrollbar"
                class:no-drag={$showEndMask || $showStartMask}
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
                      tabSize={Math.min(300, Math.max(24, tabSize)) + 0.5 * Math.min(tabSize, 200)}
                      {tab}
                      {activeTabId}
                      bookmarkingState={$bookmarkingTabsState[tab.id]}
                      pinned={false}
                      {spaces}
                      enableEditing
                      showIncludeButton={$showChatSidebar &&
                        (tab.type === 'page' || tab.type === 'space')}
                      isMagicActive={$showChatSidebar}
                      bind:this={activeTabComponent}
                      isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                      isUserSelected={Array.from($selectedTabs).some(
                        (item) => item.id === tab.id && item.userSelected
                      )}
                      isMediaPlaying={$browserTabs[tab.id]?.getMediaPlaybackState()}
                      on:multi-select={handleMultiSelect}
                      on:passive-select={handlePassiveSelect}
                      on:select={(e) => makeTabActive(e.detail)}
                      on:remove-from-sidebar={handleRemoveFromSidebar}
                      on:delete-tab={handleDeleteTab}
                      on:input-enter={handleBlur}
                      on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                      on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                      on:create-live-space={() => handleCreateLiveSpace()}
                      on:add-source-to-space={handleAddSourceToSpace}
                      on:save-resource-in-space={(e) => saveTabInSpace(tab.id, e.detail)}
                      on:create-new-space={handleOpenCreateSpaceMenu}
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
                      showIncludeButton={$showChatSidebar &&
                        (tab.type === 'page' || tab.type === 'space')}
                      isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                      isUserSelected={Array.from($selectedTabs).some(
                        (item) => item.id === tab.id && item.userSelected
                      )}
                      isMagicActive={$showChatSidebar}
                      bookmarkingState={$bookmarkingTabsState[tab.id]}
                      isMediaPlaying={$browserTabs[tab.id]?.getMediaPlaybackState()}
                      on:multi-select={handleMultiSelect}
                      on:passive-select={handlePassiveSelect}
                      on:select={(e) => makeTabActive(e.detail)}
                      on:remove-from-sidebar={handleRemoveFromSidebar}
                      on:delete-tab={handleDeleteTab}
                      on:input-enter={handleBlur}
                      on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                      on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                      on:chat-with-tab={handleOpenTabChat}
                      on:create-new-space={handleOpenCreateSpaceMenu}
                      on:pin={handlePinTab}
                      on:unpin={handleUnpinTab}
                      on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                      on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                      on:edit={handleEdit}
                    />
                  {/if}
                {/each}

                <!-- <div
                  class:w-fit={horizontalTabs}
                  class:h-full={horizontalTabs}
                  class="select-none flex items-center justify-center"
                  class:opacity-100={!$showEndMask}
                  class:opacity-0={$showEndMask}
                  class:pointer-events-auto={!$showEndMask}
                  class:pointer-events-none={$showEndMask}
                >
                  <button
                    class="new-tab-button transform select-none no-drag active:scale-95 space-x-2 {horizontalTabs
                      ? 'w-fit rounded-[0.625rem] p-1.5'
                      : 'w-full rounded-2xl px-4 py-2.5'} appearance-none select-none outline-none border-0 margin-0 group flex items-center hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors duration-200 text-sky-800 dark:text-sky-100"
                    class:bg-sky-200={$showNewTabOverlay === 1}
                    class:dark:bg-sky-900={$showNewTabOverlay === 1}
                    on:click|preventDefault={() => tabsManager.showNewTab()}
                  >
                    <Icon name="add" />
                    {#if !horizontalTabs}
                      <span class="label">New Tab</span>
                    {/if}
                  </button>
                </div> -->
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
                      showIncludeButton={$showChatSidebar &&
                        (tab.type === 'page' || tab.type === 'space')}
                      isMagicActive={$showChatSidebar}
                      bind:this={activeTabComponent}
                      isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                      isUserSelected={Array.from($selectedTabs).some(
                        (item) => item.id === tab.id && item.userSelected
                      )}
                      isMediaPlaying={$browserTabs[tab.id]?.getMediaPlaybackState()}
                      on:multi-select={handleMultiSelect}
                      on:passive-select={handlePassiveSelect}
                      on:select={(e) => makeTabActive(e.detail)}
                      on:remove-from-sidebar={handleRemoveFromSidebar}
                      on:delete-tab={handleDeleteTab}
                      on:input-enter={handleBlur}
                      on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                      on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                      on:create-live-space={() => handleCreateLiveSpace()}
                      on:add-source-to-space={handleAddSourceToSpace}
                      on:save-resource-in-space={(e) => saveTabInSpace(tab.id, e.detail)}
                      on:create-new-space={handleOpenCreateSpaceMenu}
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
                      showIncludeButton={$showChatSidebar &&
                        (tab.type === 'page' || tab.type === 'space')}
                      isSelected={Array.from($selectedTabs).some((item) => item.id === tab.id)}
                      isUserSelected={Array.from($selectedTabs).some(
                        (item) => item.id === tab.id && item.userSelected
                      )}
                      isMagicActive={$showChatSidebar}
                      bookmarkingState={$bookmarkingTabsState[tab.id]}
                      isMediaPlaying={$browserTabs[tab.id]?.getMediaPlaybackState()}
                      on:multi-select={handleMultiSelect}
                      on:passive-select={handlePassiveSelect}
                      on:select={(e) => makeTabActive(e.detail)}
                      on:remove-from-sidebar={handleRemoveFromSidebar}
                      on:delete-tab={handleDeleteTab}
                      on:input-enter={handleBlur}
                      on:bookmark={(e) => handleBookmark(tab.id, false, e.detail.trigger)}
                      on:create-new-space={handleOpenCreateSpaceMenu}
                      on:remove-bookmark={(e) => handleRemoveBookmark(tab.id)}
                      on:chat-with-tab={handleOpenTabChat}
                      on:pin={handlePinTab}
                      on:unpin={handleUnpinTab}
                      on:DragEnd={(e) => handleTabDragEnd(e.detail)}
                      on:Drop={(e) => handleDropOnSpaceTab(e.detail.drag, e.detail.spaceId)}
                      on:edit={handleEdit}
                    />
                  {/if}
                {/each}

                <div
                  class:w-fit={horizontalTabs}
                  class:h-full={horizontalTabs}
                  class="select-none flex items-center justify-center"
                  class:opacity-100={!$showEndMask}
                  class:opacity-0={$showEndMask}
                  class:pointer-events-auto={!$showEndMask}
                  class:pointer-events-none={$showEndMask}
                >
                  <button
                    class="new-tab-button transform select-none no-drag active:scale-95 space-x-2 {horizontalTabs
                      ? 'w-fit rounded-xl p-2'
                      : 'w-full rounded-2xl px-4 py-2.5'} appearance-none select-none outline-none border-0 margin-0 group flex items-center"
                    class:bg-sky-200={$showNewTabOverlay === 1}
                    class:dark:bg-sky-900={$showNewTabOverlay === 1}
                    on:click|preventDefault={() => tabsManager.showNewTab()}
                  >
                    <Icon name="add" />
                    {#if !horizontalTabs}
                      <span class="label">New Tab</span>
                    {/if}
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <div
            class="flex {horizontalTabs
              ? 'h-full flex-row items-center'
              : 'flex-col'} flex-shrink-0"
          >
            {#if !horizontalTabs}
              <button
                class="new-tab-button transform select-none no-drag active:scale-95 space-x-2
              {horizontalTabs
                  ? 'w-fit rounded-xl p-2'
                  : 'w-full rounded-2xl px-4 py-3'} appearance-none border-0 margin-0 group flex items-center"
                on:click|preventDefault={() => tabsManager.showNewTab()}
                class:opacity-100={$showEndMask || horizontalTabs}
                class:opacity-0={!$showEndMask}
                class:pointer-events-auto={$showEndMask || horizontalTabs}
                class:pointer-events-none={!$showEndMask}
                class:bg-sky-200={$showNewTabOverlay === 1}
                class:dark:bg-sky-900={$showNewTabOverlay === 1}
              >
                <Icon name="add" />
                {#if !horizontalTabs}
                  <span class="label">New Tab</span>
                {/if}
              </button>
            {/if}
            <!-- This overlay will dynamically grow / shrink depending on the current state -->
            <SidebarMetaOverlay
              on:open-stuff={() => ($showNewTabOverlay = 2)}
              on:open={(e) =>
                miniBrowserService.globalBrowser.openResource(e.detail, { from: 'stack' })}
              on:remove={(e) => oasis.removeResourcesFromSpaceOrOasis(e.detail.ids)}
              on:open-and-chat={handleOpenAndChat}
              on:open-resource-in-mini-browser={(e) =>
                openResourceDetailsModal(e.detail, OpenInMiniBrowserEventFrom.Stack)}
              on:Drop={({ detail }) => handleDropOnSpaceTab(detail)}
            >
              <div slot="tools" class="flex flex-row items-center space-x-2">
                {#if horizontalTabs && showSidebarTools}
                  <button
                    class="new-tab-button transform select-none no-drag active:scale-95 space-x-2
                    {horizontalTabs
                      ? 'w-fit rounded-xl p-2'
                      : 'w-full rounded-2xl px-4 py-3'} appearance-none border-0 margin-0 group flex items-center"
                    on:click|preventDefault={() => tabsManager.showNewTab()}
                    class:opacity-100={$showEndMask || horizontalTabs}
                    class:opacity-0={!$showEndMask}
                    class:pointer-events-auto={$showEndMask || horizontalTabs}
                    class:pointer-events-none={!$showEndMask}
                    class:bg-sky-200={$showNewTabOverlay === 1}
                    class:dark:bg-sky-900={$showNewTabOverlay === 1}
                  >
                    <Icon name="add" />
                    {#if !horizontalTabs}
                      <span class="label">New Tab</span>
                    {/if}
                  </button>
                {/if}
                {#if showSidebarTools}
                  {#if !horizontalTabs || (horizontalTabs && !showRightSidebar)}
                    <CustomPopover position={horizontalTabs ? 'top' : 'bottom'}>
                      <button
                        slot="trigger"
                        class="no-drag transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 dark:hover:bg-gray-800 dark:text-sky-100 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800"
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
                            <div
                              class="p-4 rounded-xl bg-gray-200/50 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800"
                            >
                              <Icon
                                name={tool.icon}
                                class="text-xl text-gray-800 dark:text-gray-100"
                              />
                            </div>
                            <span class="text-xs text-gray-800 dark:text-gray-100">{tool.name}</span
                            >
                          </button>
                        {/each}
                      </div>
                    </CustomPopover>
                  {/if}
                {:else if !horizontalTabs}
                  <button
                    use:tooltip={{
                      text: 'Chat (⌘ + E)',
                      position: horizontalTabs ? 'left' : 'top'
                    }}
                    class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200/40 dark:hover:bg-gray-800/40 dark:text-sky-100 transition-colors duration-200 rounded-xl text-sky-800"
                    class:scale-90={horizontalTabs ?? false}
                    on:click={() => {
                      toggleRightSidebarTab('chat')
                    }}
                    style="gap: .25rem;"
                    class:bg-sky-200={showRightSidebar && $rightSidebarTab === 'chat'}
                    class:dark:bg-gray-800={showRightSidebar && $rightSidebarTab === 'chat'}
                  >
                    <Icon name="face.light" />
                    <span class="text-xl font-medium text-white">Ask</span>
                  </button>
                {:else if horizontalTabs}
                  <button
                    class="new-tab-button transform select-none no-drag active:scale-95 space-x-2
                    {horizontalTabs
                      ? 'w-fit rounded-xl p-2'
                      : 'w-full rounded-2xl px-4 py-3'} appearance-none border-0 margin-0 group flex items-center p-"
                    on:click|preventDefault={() => tabsManager.showNewTab()}
                    class:opacity-100={$showEndMask || horizontalTabs}
                    class:opacity-0={!$showEndMask}
                    class:pointer-events-auto={$showEndMask || horizontalTabs}
                    class:pointer-events-none={!$showEndMask}
                    class:bg-sky-200={$showNewTabOverlay === 1}
                    class:dark:bg-sky-900={$showNewTabOverlay === 1}
                  >
                    <Icon name="add" size="20px" stroke-width="2" />
                    {#if !horizontalTabs}
                      <span class="label">New Tab</span>
                    {/if}
                  </button>
                {/if}
                <!--<button
                use:tooltip={{
                  text: 'My Stuff (⌘ + O)',
                  position: horizontalTabs ? 'left' : 'top'
                }}
                class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 "
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

                <Icon name="save" />
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
              <div
                class="flex flex-row items-center space-x-2 ml-5"
                style="position: relative; z-index: 9999999999;"
              >
                <button
                  on:click={() => controlWindow('minimize')}
                  class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 dark:hover:bg-gray-800 dark:text-sky-100 transition-colors duration-200 rounded-xl text-sky-800"
                >
                  <Icon name="minus" />
                </button>
                <button
                  on:click={() => controlWindow('toggle-maximize')}
                  class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 dark:hover:bg-gray-800 dark:text-sky-100 transition-colors duration-200 rounded-xl text-sky-800"
                >
                  <Icon name="rectangle" />
                </button>
                <button
                  on:click={() => controlWindow('close')}
                  class="transform no-drag active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 dark:hover:bg-gray-800 dark:text-sky-100 transition-colors duration-200 rounded-xl text-sky-800"
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

    <div
      slot="content"
      class="browser-content h-full w-full flex relative flex-row"
      class:slide-hide={$desktopVisible}
      class:horizontalTabs
    >
      <div
        class="w-full h-full overflow-hidden flex-grow"
        style="z-index: 0;"
        class:hasNoTab={!$activeBrowserTab}
        class:sidebarHidden={!showLeftSidebar}
        style:view-transition-name="browser_content"
      >
        {#if $sidebarTab === 'oasis'}
          <div class="browser-window flex-grow active no-drag" style="--scaling: 1;">
            <OasisSpaceRenderer
              spaceId={$selectedSpace}
              active
              on:create-resource-from-oasis={handeCreateResourceFromOasis}
              on:deleted={handleDeletedSpace}
              on:open-space-as-tab={handleCreateTabForSpace}
              on:open-space-and-chat={handleOpenSpaceAndChat}
              on:seekToTimestamp={handleSeekToTimestamp}
              on:highlightWebviewText={highlightWebviewText}
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
            >
              <!-- {#if !horizontalTabs}<div
                  class="w-full h-3 pointer-events-none fixed z-[1002] drag"
                />{/if} -->

              <!-- {#if $onboardingTabVisible && $onboardingTabOpened && !$userConfigSettings?.onboarding?.ignore_back_to_onboarding_button}
                <button
                  class="transform no-drag active:scale-95 appearance-none select-none outline-none border-2 border-sky-100 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800  bg-white w-fit fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
                  on:click={() => openWelcomeTab()}
                >
                  <span>← Back to Surf Onboarding</span>
                </button>
                <span
                  class="transform no-drag active:scale-95 appearance-none select-none outline-none margin-0 group flex items-center justify-center p-2 transition-colors duration-200 text-sky-800  w-fit fixed bottom-16 left-1/2 -translate-x-1/2 z-50 underline"
                >
                  <span>Dismiss this</span>
                </span>
              {/if} -->

              {#if tab.type === 'page'}
                <BrowserTab
                  {historyEntriesManager}
                  {downloadIntercepters}
                  active={$activeTabId === tab.id}
                  bind:this={$browserTabs[tab.id]}
                  bind:tab={$tabs[$tabs.findIndex((t) => t.id === tab.id)]}
                  on:navigation={(e) => handleWebviewTabNavigation(e, tab)}
                  on:update-tab={(e) => tabsManager.update(tab.id, e.detail)}
                  on:open-resource={(e) =>
                    openResourceDetailsModal(e.detail, OpenInMiniBrowserEventFrom.WebPage)}
                  on:reload-annotations={(e) => reloadAnnotationsSidebar(e.detail)}
                  on:keydown={(e) => handleKeyDown(e.detail)}
                  on:add-to-chat={(e) => handleAddToChat(e)}
                  on:seekToTimestamp={handleSeekToTimestamp}
                  on:highlightWebviewText={highlightWebviewText}
                />
              {:else if tab.type === 'importer'}
                <Importer {resourceManager} />
              {:else if tab.type === 'oasis-discovery'}
                <OasisDiscovery {resourceManager} />
              {:else if tab.type === 'space'}
                <OasisSpaceRenderer
                  spaceId={tab.spaceId}
                  active={$activeTabId === tab.id}
                  on:create-resource-from-oasis={handeCreateResourceFromOasis}
                  on:open-and-chat={handleOpenAndChat}
                  on:batch-open={handleOpenTabs}
                  on:deleted={handleDeletedSpace}
                  on:open-space-and-chat={handleOpenSpaceAndChat}
                  on:seekToTimestamp={handleSeekToTimestamp}
                  on:highlightWebviewText={highlightWebviewText}
                  hideBar={$showNewTabOverlay !== 0}
                  {historyEntriesManager}
                />
              {:else if tab.type === 'history'}
                <BrowserHistory {tab} active={$activeTabId === tab.id} />
              {:else if tab.type === 'resource'}
                <ResourceTab
                  {tab}
                  on:update-tab={(e) => tabsManager.update(tab.id, e.detail)}
                  on:highlightWebviewText={highlightWebviewText}
                  on:seekToTimestamp={handleSeekToTimestamp}
                />
              {:else if tab.type === 'onboarding'}
                <div class="onboarding-wrapper">
                  <TabOnboarding
                    on:openChat={handleOnboardingChatWithQuery}
                    on:openStuff={() => ($showNewTabOverlay = 2)}
                    on:openScreenshot={() => openScreenshotPicker()}
                    on:launchTimeline={(e) => handleLaunchOnboardingTooltips(e.detail)}
                    on:endTimeline={() => handleEndOnboardingTooltips}
                    on:wipecontext={removeAllContextItems}
                    on:batchOpenTabs={handleOpenOnboardingTabs}
                    on:createOnboardingSpace={async () => {
                      await createOnboardingSpace(
                        tabsManager,
                        oasis,
                        tabsManager.addSpaceTab,
                        resourceManager
                      )
                    }}
                    {resourceManager}
                  />
                </div>
              {:else if tab.type === 'invites'}
                <TabInvite />
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

    <div slot="right-sidebar" bind:clientWidth={rightSidebarWidth} class="w-full h-full">
      <Tabs.Root
        bind:value={$rightSidebarTab}
        class="bg-sky-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-full flex flex-col relative no-drag"
        id="sidebar-right"
        let:minimal
      >
        {#if showSidebarTools}
          <div
            class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100 dark:border-gray-700"
          >
            <div class="flex items-center justify-start">
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                role="button"
                tabindex="0"
                on:click={() => toggleRightSidebar()}
                class="flex items-center gap-2 p-1 text-sky-800/50 dark:text-gray-300 rounded-lg hover:bg-sky-100 hover:text-sky-800 dark:hover:bg-gray-700 group"
              >
                <Icon name="sidebar.right" class="group-hover:!hidden" size="20px" />
                <Icon name="close" class="hidden group-hover:!block" size="20px" />
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
                  class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center gap-2 px-2 py-3 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-300  opacity-75 data-[state='active']:opacity-100 dark:data-[state='active']:bg-gray-700 hover:bg-sky-100 dark:hover:bg-gray-700 data-[state='active']:hover:bg-sky-200/50"
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
          {#if $showChatSidebar}
            {#key showRightSidebar}
              <MagicSidebar
                bind:this={magicSidebar}
                bind:inputValue={$magicInputValue}
                on:highlightText={(e) => scrollWebviewToText(e.detail.tabId, e.detail.text)}
                on:highlightWebviewText={highlightWebviewText}
                on:seekToTimestamp={handleSeekToTimestamp}
                on:navigate={(e) => {
                  $browserTabs[$activeTabId].navigate(e.detail.url)
                }}
                on:open-context-item={(e) => openContextItemAsTab(e.detail)}
                on:process-context-item={(e) => processContextItem(e.detail)}
                on:close-chat={() => {
                  toggleRightSidebarTab('chat')
                  handleEndOnboardingTooltips()
                }}
                on:pick-screenshot={handlePickScreenshotForChat}
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
    </div>
  </SidebarPane>
</div>

<NewTabOverlay
  spaceId={DEFAULT_SPACE_ID}
  activeTab={$activeTab}
  {updateSearchValue}
  showTabSearch={showNewTabOverlay}
  selectedSpaceId={newTabSelectedSpaceId}
  on:open-space-as-tab={handleCreateTabForSpace}
  on:deleted={handleDeletedSpace}
  {historyEntriesManager}
  activeTabs={$activeTabs}
  on:activate-tab={(e) => makeTabActive(e.detail, ActivateTabEventTrigger.Click)}
  on:close-active-tab={() => tabsManager.deleteActive(DeleteTabEventTrigger.CommandMenu)}
  on:bookmark={() => handleBookmark($activeTabId, false, SaveToOasisEventTrigger.CommandMenu)}
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
  on:seekToTimestamp={handleSeekToTimestamp}
  on:highlightWebviewText={highlightWebviewText}
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
  on:toggle-homescreen={() => {
    desktopManager.setVisible(!$desktopVisible, { trigger: OpenHomescreenEventTrigger.CommandMenu })
  }}
  on:open-url={(e) => {
    tabsManager.addPageTab(e.detail, {
      active: true,
      trigger: CreateTabEventTrigger.AddressBar
    })
  }}
/>

<style lang="scss">
  *,
  a,
  button {
    cursor: default;
    user-select: none;
  }

  .ai-wrapper {
    position: relative;
    outline: 2px solid rgba(73, 82, 242, 0.4);
    border-radius: 16px;
  }

  /// App Scaffolding

  .vertical-window-bar {
    position: relative;

    :global(.custom) & {
      &::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        @include utils.material-frosted;

        z-index: -1;
      }
    }
  }

  .app-contents {
    position: relative;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: var(--background-image);
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      opacity: var(--background-opacity);
    }

    & :global(#homescreen-wrapper) {
      position: fixed;
      inset: 0;
    }
  }

  .browser-content {
    position: relative;
    z-index: 500;

    --slide-offset: -10%;
    --slide-scale: 0.9;

    &.slide-hide {
      transform-origin: left center;
      // NOTE: Dont use translate3d, this works better just with will-change
      transform: translate3d(var(--slide-offset), 0px) scale(var(--slide-scale), 0);
      opacity: 0;
      pointer-events: none !important;

      &.horizontalTabs {
        transform-origin: center top;
        // NOTE: Dont use translate3d, this works better just with will-change
        transform: translate(0%, var(--slide-offset)) scale(var(--slide-scale));
      }
    }
  }

  :global(body.custom .browser-content) {
    position: relative;
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      opacity: 1;
      width: calc(100% + 15px);
      pointer-events: none !important;

      @include utils.material-frosted;
    }
  }
  :global(body:has(.homescreenVisible) .browser-content::before) {
    display: none !important;
  }

  .browser-window {
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    opacity: 0;
    overflow: clip;

    &.active {
      z-index: 1;
      position: relative;
      opacity: 100%;
    }

    --corner-radii: 0.75rem;
    :global(body:has(.horizontalTabs)) & {
      border-top-left-radius: var(--corner-radii) !important;
      border-top-right-radius: var(--corner-radii) !important;
    }

    :global(body:has(.verticalTabs)) & {
      border-radius: var(--corner-radii) !important;
    }

    :global(webview) {
      height: 100%;
      width: 100%;
      // border-radius: 0.5rem;
      // overflow: hidden;
    }
  }

  /// SIDEBARS
  // TODO: (maxu): Revive sidebar refactor and throw these out!

  #left-sidebar {
    position: relative;

    :global(.custom) & {
      @include utils.material-frosted;
    }
  }

  :global(.sidebar-right) {
    overflow: hidden !important;
    :global(body:has(.vertical-window-bar)) & {
      margin-top: 39px;
    }

    :global(body:has(.horizontalTabs)) & {
      border-top-left-radius: 0.75rem !important;
    }
    :global(body:not(:has(.horizontalTabs))) & {
      border-top-left-radius: 0.75rem !important;
      border-bottom-left-radius: 0.75rem !important;
    }
  }

  /// DRAG AND DROP

  :global(::view-transition-group(*)) {
    animation-duration: 170ms;
    animation-timing-function: ease;
  }

  :global(*[data-drag-preview]) {
    overflow: clip !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;

    pointer-events: none !important;
    user-select: none !important;

    width: var(--drag-width, auto);
    height: var(--drag-height, auto);
    opacity: 90%;
    box-shadow:
      0px 2px 3px 2px rgba(0, 0, 0, 0.045),
      0px 1px 4px 0px rgba(0, 0, 0, 0.145);

    transform-origin: center center !important;
    translate: var(--drag-offsetX, 0px) var(--drag-offsetY, 0px) 0px !important;
    transform: translate(-50%, -50%) scale(var(--drag-scale, 1)) rotate(var(--drag-tilt, 0)) !important;
    will-change: transform !important;

    transition:
      //translate 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
     // translate 175ms cubic-bezier(0, 1, 0.73, 1.13),
      translate 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      transform 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      opacity 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      border 135ms cubic-bezier(0, 1.22, 0.73, 1.13),
      width 175ms cubic-bezier(0.4, 0, 0.2, 1),
      height 175ms cubic-bezier(0.4, 0, 0.2, 1) !important;

    // NOTE: Old ones kept for future tinkering
    /*transform-origin: center center;
    transform: translate(-50%, -50%) translate(var(--drag-offsetX, 0px), var(--drag-offsetY, 0px))
      scale(var(--drag-scale, 1)) scale(var(--drag-scaleX, 1), var(--drag-scaleY, 1))
      rotate(var(--drag-tilt, 0)) scale(var(--scale, 1)) !important;
    transition:
      transform 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      opacity 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      border 135ms cubic-bezier(0, 1.22, 0.73, 1.13) !important;*/
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

  /* Necessary so that inputs dont go all janky wanky  */
  :global(body[data-dragging] input:not([data-drag-zone])) {
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

  :global([data-drag-zone][axis='vertical']) {
    // This is needed to prevent margin collapse when the first child has margin-top. Without this, it will move the container element instead.
    padding-top: 1px;
    margin-top: -1px;
  }

  :global(body[data-dragging='true'] .chat-hint-tooltop) {
    opacity: 0;
  }

  :global(body[data-dragging='true'] #sidebar-pinned-tabs-wrapper.empty) {
    @apply bg-sky-100;
    z-index: 100;
  }

  #sidebar-pinned-tabs {
    gap: 6px;
  }

  :global([data-drag-zone='sidebar-pinned-tabs']) {
    height: fit-content !important;
    min-height: 24px;
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

  /// RANDOM UI STUFF

  .new-tab-button {
    transition: color 300ms ease-out;

    color: light-dark(var(--contrast-color), var(--contrast-color));

    &:hover {
      --bg: var(--black-09);

      :global(.dark) & {
        --bg: var(--dark-on-unpinned-surface-horizontal-hover) !important;
      }
      @include utils.squircle($fill: var(--bg), $radius: 16px);
    }
  }

  .hide-btn {
    display: none !important;
    background-color: transparent;
  }

  .hide-btn {
    display: none !important;
    background-color: transparent;
  }

  /* Pulse effect for tooltip targets */
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
    display: block;
    border-radius: inherit;
    border-radius: calc(inherit + 8px);
    z-index: -1;
    animation: pulse 2s infinite;
    filter: blur(4px);
  }

  /// UTILS

  .custom-button-color {
    :global(.custom) & {
      color: var(--contrast-color) !important;
    }
  }

  .create-space-btn {
    background: #f73b95;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px;

    margin-top: 1rem;
    font-size: 1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }
</style>
