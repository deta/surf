<svelte:options immutable={true} />

<script lang="ts">
  import { onMount, setContext, tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import { tooltip } from '@svelte-plugins/tooltips'
  import { popover } from '../Atoms/Popover/popover'
  import SplashScreen from '../SplashScreen.svelte'
  import { writable, derived, get } from 'svelte/store'
  import { type WebViewWrapperEvents } from '../Cards/Browser/WebviewWrapper.svelte'
  import { useLogScope } from '../../utils/log'
  import { Icon } from '@horizon/icons'
  import { generateID } from '../../utils/id'
  import { parseStringIntoBrowserLocation } from '../../utils/url'
  import { isModKeyAndKeyPressed, isModKeyPressed } from '../../utils/keyboard'
  import { copyToClipboard } from '../../utils/clipboard'
  import { wait, writableAutoReset } from '../../utils/time'
  import { Telemetry } from '../../service/telemetry'
  import { useDebounce } from '@horizon/core/src/lib/utils/debounce'
  import { processDrop } from '../../service/mediaImporter'

  import DragDropList, {
    VerticalDropZone,
    HorizontalDropZone,
    HorizontalCenterDropZone,
    reorder,
    type DropEvent
  } from 'svelte-dnd-list'

  import {
    Resource,
    ResourceAnnotation,
    ResourceManager,
    ResourceTag,
    createResourceManager
  } from '../../service/resources'

  import { type HistoryEntry, type Space, type SpaceSource } from '../../types'

  import { HorizonsManager } from '../../service/horizon'
  import { API } from '../../service/api'
  import BrowserTab, { type NewTabEvent } from './BrowserTab.svelte'
  import Horizon from '../Horizon/Horizon.svelte'
  import BrowserHomescreen from './BrowserHomescreen.svelte'
  import OasisSidebar from '../Oasis/OasisSidebar.svelte'
  import TabItem from './Tab.svelte'
  import TabSearch from './TabSearch.svelte'
  import ShortcutMenu from '../Shortcut/ShortcutMenu.svelte'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'

  import '../Horizon/index.scss'
  import type {
    AIChatMessage,
    AIChatMessageParsed,
    PageHighlight,
    PageMagic,
    PageMagicResponse,
    Tab,
    TabChat,
    TabEmpty,
    TabHorizon,
    TabImporter,
    TabPage,
    TabSpace,
    TabOasisDiscovery,
    AIChatMessageRole,
    DroppedTab
  } from './types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../Cards/Browser/searchEngines'
  import type { Drawer } from '@horizon/drawer'
  import Chat from './Chat.svelte'
  import { HorizonDatabase } from '../../service/storage'
  import { ResourceTypes, type Optional } from '../../types'
  import { useLocalStorageStore } from '../../utils/localstorage'
  import { WebParser, type DetectedWebApp } from '@horizon/web-parser'
  import Importer from './Importer.svelte'
  import OasisDiscovery from './OasisDiscovery.svelte'
  import { handleInlineAI, parseChatResponseSources, summarizeText } from '../../service/ai'
  import MagicSidebar from './MagicSidebar.svelte'
  import {
    WebViewEventReceiveNames,
    type AnnotationCommentData,
    type AnnotationRangeData,
    type ResourceDataAnnotation,
    type WebViewEventAnnotation
  } from '@horizon/types'
  import {
    inlineHighlightStylingCode,
    inlineHighlightTextCode,
    inlineTextReplaceCode,
    inlineTextReplaceStylingCode,
    scrollToTextCode
  } from './inline'
  import { SFFS } from '../../service/sffs'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { provideOasis } from '../../service/oasis'
  import OasisSpace from '../Oasis/OasisSpace.svelte'

  import AnnotationsSidebar from './AnnotationsSidebar.svelte'
  import ToastsProvider from '../Toast/ToastsProvider.svelte'
  import { provideToasts, type Toasts } from '../../service/toast'
  import { INLINE_PROMPTS, LEGACY_PAGE_CITATION_SUMMARY_PROMPT } from '../../constants/prompts'
  import {
    PromptIDs,
    getPrompt,
    getPrompts,
    resetPrompt,
    updatePrompt
  } from '../../service/prompts'

  let addressInputElem: HTMLInputElement
  let drawer: Drawer
  let addressBarFocus = false
  let showTabSearch = false
  let showSidebar = true
  let annotationsSidebar: AnnotationsSidebar

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
  const loadingOrganize = writable(false)
  const visorSearchTerm = writable('')
  const sidebarTab = writable<'active' | 'archive' | 'oasis'>('active')
  const browserTabs = writable<Record<string, BrowserTab>>({})
  const bookmarkingInProgress = writable(false)
  const magicInputValue = writable('')
  const activeTabMagic = writable<PageMagic>()
  const bookmarkingSuccess = writableAutoReset(false, 1000)
  const showURLBar = writable(false)
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)
  const showAnnotationsSidebar = writable(false)
  const activeTabsHistory = writable<string[]>([])
  const isCreatingLiveSpace = writable(false)

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

  $: if ($activeTabMagic) {
    // Reset all tabs from the magic
    if (!$activeTabMagic.showSidebar) {
      resetTabsFromMagic()
    }
    log.debug('Active tab magic', $activeTabMagic)
  }

  $: log.debug('xx active tabs history', $activeTabsHistory)

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
      const currentEntry = historyEntriesManager.getEntry(
        tab.historyStackIds[tab.currentHistoryIndex]
      )
      addressValue.set(currentEntry?.url ?? tab.initialLocation)
    } else if (tab?.type === 'chat') {
      addressValue.set(tab.title)
    } else {
      addressValue.set('')
    }

    persistTabChanges(tab?.id, tab)
  })

  sidebarTab.subscribe((tab) => {
    log.debug('Sidebar tab', tab)

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

  $: log.debug(
    'active tab',
    $tabs.find((tab) => tab.id === $activeTabId)
  )

  $: log.debug('tabs', $tabs)

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
      makeTabActive($unpinnedTabs[$unpinnedTabs.length - 1].id)
    }
  }

  const createTab = async <T extends Tab>(
    tab: Optional<T, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'pinned' | 'index'>
  ) => {
    const newTab = await tabsDB.create({
      archived: false,
      pinned: false,
      index: Date.now(),
      ...tab
    })
    log.debug('Created tab', newTab)
    tabs.update((tabs) => [...tabs, newTab])

    return newTab
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
    }, 100)

    addressBarFocus = false

    if (!$addressValue) {
      return
    }

    if ($activeTab?.type === 'horizon') {
      const horizon = $horizons.find((horizon) => horizon.id === $activeTab.horizonId)
      if (horizon) {
        horizon.updateData({ name: $addressValue })

        updateActiveTab({ title: $addressValue })
      }
    } else if ($activeTab?.type === 'page') {
      log.debug('Navigating to address from page', $addressValue)
      const url = getNavigationURL($addressValue)
      $activeBrowserTab.navigate(url)

      // if (url === $activeTabLocation) {
      //     $activeBrowserTab.reload()
      // } else {
      //     updateActiveTab({ initialLocation: url })
      // }
    } else if ($activeTab?.type === 'empty') {
      log.debug('Navigating to address from empty tab', $addressValue)
      const url = getNavigationURL($addressValue)
      log.debug('Converting empty tab to page', url)
      updateActiveTab({
        type: 'page',
        initialLocation: url,
        historyStackIds: [],
        currentHistoryIndex: -1
      })
    } else if ($activeTab?.type === 'chat') {
      log.debug('Renaming chat tab', $addressValue)
      updateActiveTab({ title: $addressValue })
    }
  }

  const handleFocus = () => {
    addressBarFocus = true
    addressInputElem.select()
  }

  const handleCopyLocation = useDebounce(() => {
    if ($activeTabLocation) {
      log.debug('Copying location to clipboard', $activeTabLocation)
      // @ts-ignore
      window.api.copyToClipboard($activeTabLocation)
      toasts.success('Copied to Clipboard!')
    }
  }, 200)

  // fix the syntax error
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && addressBarFocus) {
      handleBlur()
      addressInputElem.blur()
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
    } else if (isModKeyAndKeyPressed(e, 'h')) {
      showSidebar = !showSidebar
      window.api.updateTrafficLightsVisibility(showSidebar)
    } else if (isModKeyAndKeyPressed(e, 'n')) {
      handleNewHorizon()
    } else if (isModKeyAndKeyPressed(e, 'r')) {
      $activeBrowserTab?.reload()
    } else if (isModKeyAndKeyPressed(e, 'i')) {
      createImporterTab()
    } else if (isModKeyAndKeyPressed(e, 'y')) {
      createOasisDiscoveryTab()
    } else if (e.ctrlKey && e.key === 'Tab') {
      debouncedCycleActiveTab(e.shiftKey)
    } else if (isModKeyAndKeyPressed(e, 'l')) {
      addressInputElem.focus()
      handleFocus()
    } else if (isModKeyAndKeyPressed(e, 'j')) {
      showTabSearch = true
    }
  }

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

    const newTab = await createTab<TabEmpty>({ title: 'New Tab', icon: '', type: 'empty' })
    makeTabActive(newTab.id)

    addressInputElem.focus()
    addressValue.set('')
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

  const handleNewTab = (e: CustomEvent<NewTabEvent>) => {
    const { url, active } = e.detail

    if (url) {
      createPageTab(url, active)
    } else {
      createNewEmptyTab()
    }
  }

  // const handleOrganize = async () => {
  //   try {
  //     loadingOrganize.set(true)
  //     log.debug('Organizing tabs', $tabs)

  //     const prompt = `You organize tabs given to you into as few sections as possible. Come up with simple and short but clear section names and move the tabs into the right sections. Try to not change existing sections unless necessary and avoid putting a single tab into its own section. The tabs are given to you are formatted as JSON array with each item having the tab title, url and optional section if it is part of it already. Respond with the sections as JSON keys and the tabs in each section as a list of tab IDs as the value. Only respond with JSON.`
  //     // @ts-ignore
  //     const response = await window.api.createAIChatCompletion(
  //       `Organize these tabs:\n${JSON.stringify(
  //         $tabs.map((tab) => ({
  //           id: tab.id,
  //           title: tab.title,
  //           url: tab.initialLocation,
  //           ...(tab.section !== '_all' && tab.section !== 'Unorganised'
  //             ? { section: tab.section }
  //             : {})
  //         })),
  //         null,
  //         2
  //       )}`,
  //       prompt
  //     )

  //     log.debug('Organize response', response)

  //     const json = JSON.parse(response)
  //     log.debug('Organize response JSON', json)

  //     tabs.update((tabs) => {
  //       const updatedTabs = tabs.map((tab) => {
  //         const section = Object.keys(json).find((section) => json[section].includes(tab.id))
  //         if (section) {
  //           return {
  //             ...tab,
  //             section
  //           }
  //         }
  //         return tab
  //       })

  //       return updatedTabs
  //     })
  //   } catch (err) {
  //     log.error('Error organizing tabs', err)
  //   } finally {
  //     loadingOrganize.set(false)
  //   }
  // }

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

  async function bookmarkPage(tab: TabPage) {
    let resource: Resource | null = null
    if (tab.chatResourceBookmark) {
      resource = await resourceManager.getResource(tab.chatResourceBookmark)
    }

    if (!resource) {
      const currentEntry = historyEntriesManager.getEntry(
        tab.historyStackIds[tab.currentHistoryIndex]
      )
      let url = currentEntry?.url ?? tab.initialLocation

      // strip &t from url suffix
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
      log.debug('bookmarking', url)

      const browserTab = $browserTabs[tab.id]
      if (!browserTab) {
        log.error('no browser tab found')
        throw new Error('No browser tab found')
      }
      const detectedResource = await browserTab.detectResource()
      log.debug('extracted resource data', detectedResource)

      if (!detectedResource) {
        log.debug('no resource detected')
        throw new Error('No resource detected')
      }

      resource = await resourceManager.createResourceOther(
        new Blob([JSON.stringify(detectedResource.data)], { type: detectedResource.type }),
        { name: tab.title ?? '', sourceURI: url, alt: '' },
        [ResourceTag.canonicalURL(url)]
      )
      log.debug('created resource', resource)
    }

    if (resource?.id)
      updateTab(tab.id, { resourceBookmark: resource.id, chatResourceBookmark: resource.id })

    return resource
  }

  async function handleBookmark() {
    try {
      if (!$activeTabLocation || $activeTab?.type !== 'page') return

      if ($activeTab.resourceBookmark) {
        log.debug('already bookmarked', $activeTab.resourceBookmark)
        openResource($activeTab.resourceBookmark)
        return
      }

      bookmarkingInProgress.set(true)

      const resource = await bookmarkPage($activeTab)

      // automatically resets after some time
      toasts.success('Bookmarked Page!')
      bookmarkingSuccess.set(true)

      return resource
    } catch (e) {
      log.error('error creating resource', e)
    } finally {
      bookmarkingInProgress.set(false)
    }
  }

  function handleWebviewTabNavigation(
    e: CustomEvent<WebViewWrapperEvents['navigation']>,
    tab: Tab
  ) {
    const { url, oldUrl } = e.detail
    log.debug('webview navigation', { url, oldUrl }, tab)

    if (tab.type !== 'page' || !tab.resourceBookmark) return

    if (url !== oldUrl) {
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

  async function handleWebviewBookmark(e: CustomEvent<WebViewWrapperEvents['bookmark']>) {
    log.debug('webview bookmark', e.detail)

    if ($activeTab?.type !== 'page') return

    if (!$activeTab.resourceBookmark) {
      const resource = await resourceManager.createResourceLink(
        new Blob([JSON.stringify({ url: e.detail.url })], { type: ResourceTypes.LINK }),
        { name: $activeTab?.title ?? '', sourceURI: e.detail.url, alt: '' },
        [ResourceTag.canonicalURL(e.detail.url)]
      )

      log.debug('created resource', resource)

      if ($activeTab?.type === 'page') {
        updateActiveTab({ resourceBookmark: resource.id })
      }
    }

    if (e.detail.text) {
      log.debug('creating note for bookmark', e.detail.text)
      const resource = await resourceManager.createResourceNote(e.detail.text, {
        name: $activeTab?.title ?? '',
        sourceURI: e.detail.url,
        alt: ''
      })
      log.debug('created resource', resource)
    }
  }

  function updateActiveMagicPage(updates: Partial<PageMagic>) {
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

  async function handleWebviewAppDetection(e: CustomEvent<DetectedWebApp>, tab: TabPage) {
    log.debug('webview app detection', e.detail, tab)

    if (tab.type !== 'page') return
    let pageMagic = $activeTabMagic
    await updateTab(tab.id, {
      currentDetectedApp: e.detail
    })
    if (!pageMagic) {
      let responses: AIChatMessageParsed[] = []
      if (tab?.chatId) {
        const chat = await sffs.getAIChat(tab.chatId)
        if (chat) {
          const userMessages = chat.messages.filter((message) => message.role === 'user')
          const queries = userMessages.map((message) => message.content) // TODO: persist the query saved in the AIChatMessageParsed instead of using the actual content
          const systemMessages = chat.messages.filter((message) => message.role === 'system')

          responses = systemMessages.map((message, idx) => {
            message.sources = message.sources
            log.debug('Message', message)
            return {
              id: generateID(),
              role: message.role,
              query: queries[idx],
              content: message.content.replace('<answer>', '').replace('</answer>', ''),
              sources: message.sources,
              status: 'success'
            }
          })
        }
      }
      pageMagic = {
        showSidebar: false,
        running: false,
        responses: responses
      } as PageMagic
      activeTabMagic.set(pageMagic)
    }

    const browserTab = $browserTabs[tab.id]
    if (!browserTab) {
      log.error('Browser tab not found', tab.id)
      return
    }

    const currentEntry = historyEntriesManager.getEntry(
      tab.historyStackIds[tab.currentHistoryIndex]
    )

    const url = currentEntry?.url ?? tab.initialLocation
    let normalized_url = url
    let youtubeHostnames = [
      'youtube.com',
      'youtu.be',
      'youtube.de',
      'www.youtube.com',
      'www.youtu.be',
      'www.youtube.de'
    ]
    if (youtubeHostnames.includes(new URL(url).host)) {
      normalized_url = normalized_url.replace(/&t.*/g, '')
    }

    log.debug('getting resources from source url', url, normalized_url)
    // measure time it takes to get resources
    const start = performance.now()
    const matchingResources = await resourceManager.getResourcesFromSourceURL(normalized_url)
    const end = performance.now()
    log.debug('getting resources took', Math.round(end - start), 'ms')
    log.debug('matching resources', matchingResources)

    const bookmarkedResource = matchingResources.find(
      (resource) => resource.type !== ResourceTypes.ANNOTATION
    )

    log.debug('bookmarked resource', bookmarkedResource)
    if (bookmarkedResource) {
      await updateTab(tab.id, {
        resourceBookmark: bookmarkedResource.id,
        chatResourceBookmark: bookmarkedResource.id
      })
    }

    const annotationResources = matchingResources.filter(
      (resource) => resource.type === ResourceTypes.ANNOTATION
    ) as ResourceAnnotation[]

    await wait(500)

    annotationResources.forEach(async (annotationResource) => {
      const annotation = await annotationResource.getParsedData()
      log.debug('annotation data', annotation)

      log.debug('sending annotation to webview', annotation)
      browserTab.sendWebviewEvent(WebViewEventReceiveNames.RestoreAnnotation, {
        id: annotationResource.id,
        data: annotation
      })
    })

    // if ($activeTabId === tab.id) {
    //   summarizePage(pageMagic)
    // }
  }

  async function handleWebviewTransform(
    e: CustomEvent<WebViewWrapperEvents['transform']>,
    tab: TabPage
  ) {
    log.debug('webview transformation', e.detail)

    const browserTab = $browserTabs[tab.id]
    const detectedResource = await browserTab.detectResource()
    log.debug('extracted resource data', detectedResource)
    if (!detectedResource) {
      log.debug('no resource detected')
      return
    }

    const transformation = await handleInlineAI(e.detail, detectedResource)

    log.debug('transformation output', transformation)

    $activeBrowserTab.sendWebviewEvent(WebViewEventReceiveNames.TransformationOutput, {
      text: transformation
    })
  }

  const handleWebviewInlineTextReplace = async (
    e: CustomEvent<WebViewWrapperEvents['inlineTextReplace']>,
    tabId: string
  ) => {
    const browserTab = $browserTabs[tabId]
    if (!browserTab) {
      log.error('Browser tab not found', tabId)
      return
    }

    const { target, content } = e.detail
    log.debug('webview inline text replace', e.detail)

    // add mark styles to the page
    await $activeBrowserTab.executeJavaScript(inlineTextReplaceStylingCode())

    log.debug('executing code')
    const code = inlineTextReplaceCode(target, content)
    await $activeBrowserTab.executeJavaScript(code)
  }

  const getTextElementsFromHtml = (html: string): string[] => {
    let textElements: string[] = []
    const body = new DOMParser().parseFromString(html, 'text/html').body
    body.querySelectorAll('p').forEach((p) => {
      textElements.push(p.textContent?.trim() ?? '')
    })
    return textElements
  }

  const getTabsInChatContext = () => {
    let tabs = $magicTabs
    if (tabs.length == 0) {
      return $unpinnedTabs
    }
    return tabs
  }

  const highlightWebviewText = async (resourceId: string, answerText: string) => {
    for (const tab of getTabsInChatContext()) {
      const t = tab as TabPage
      if (t.resourceBookmark === resourceId) {
        const browserTab = $browserTabs[t.id]
        if (!browserTab) {
          log.error('Browser tab not found', t.id)
          return
        }
        makeTabActive(t.id)
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

  // const summarizePage = async (magicPage: PageMagic) => {
  //   let response: PageMagicResponse | null = null

  //   try {
  //     log.debug('Magic button clicked')

  //     const tab = $tabs.find((tab) => tab.id === magicPage.tabId)
  //     if (!tab) {
  //       log.error('Tab not found', magicPage.tabId)
  //       return
  //     }

  //     const browserTab = $browserTabs[tab.id]

  //     const detectedResource = await browserTab.detectResource()
  //     log.debug('extracted resource data', detectedResource)

  //     if (!detectedResource) {
  //       log.debug('no resource detected')
  //       return
  //     }

  //     response = {
  //       id: generateID(),
  //       role: 'system',
  //       query: 'Summary',
  //       status: 'pending',
  //       content: '',
  //       citations: {}
  //     } as PageMagicResponse

  //     updateMagicPage(magicPage.tabId, { running: true })
  //     addPageMagicResponse(magicPage.tabId, response)

  //     const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
  //     log.debug('content', content)

  //     log.debug('calling the AI')

  //     // if ($magicInputValue) {
  //     //   log.debug('user query', $magicInputValue)
  //     //   return
  //     // }

  //     // @ts-expect-error
  //     const output = await window.api.createAIChatCompletion(
  //       content.plain,
  //       LEGACY_PAGE_CITATION_SUMMARY_PROMPT,
  //       { response_format: { type: 'json_object' } }
  //     )

  //     log.debug('Magic response', output)
  //     const json = JSON.parse(output)
  //     log.debug('json', json)

  //     if (!json.content || !json.citations) {
  //       log.debug('Invalid response')
  //       return
  //     }

  //     response = {
  //       ...response,
  //       status: 'success',
  //       content: json.content,
  //       citations: json.citations
  //     } as PageMagicResponse

  //     updatePageMagicResponse(magicPage.tabId, response.id, response)

  //     // add mark styles to the page
  //     await browserTab.executeJavaScript(inlineHighlightStylingCode())

  //     await Promise.all(
  //       Object.entries(json.citations).map(async ([id, citation]) => {
  //         await highlightWebviewText(tab.id, {
  //           type: 'important',
  //           color: (citation as any).color as string,
  //           text: (citation as any).text as string
  //         })
  //       })
  //     )

  //     log.debug('Magic done')
  //   } catch (e) {
  //     log.error('Error doing magic', e)
  //     if (response) {
  //       updatePageMagicResponse(magicPage.tabId, response.id, {
  //         status: 'error',
  //         content: (e as any).message ?? 'Failed to generate response.'
  //       })
  //     }
  //   } finally {
  //     updateMagicPage(magicPage.tabId, { running: false })
  //   }
  // }

  const sendSidebarChatMessage = async (
    tabsInContext: Tab[],
    magicPage: PageMagic,
    prompt: string,
    role: AIChatMessageRole = 'user',
    query?: string
  ) => {
    if (tabsInContext.length === 0) {
      log.debug('No tabs in context')
      return
    }
    const pageTabs = tabsInContext.filter((tab) => tab.type === 'page')
    const chatId = (pageTabs[0] as TabPage).chatId

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
      if (resourceIds.length === 0) {
        log.debug('No resource IDs found from tabs in context')
        return
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
          resourceIds: resourceIds
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

  const updateChatIdsForPageChat = (newChatId: string) => {
    for (const tab of getTabsInChatContext()) {
      if (tab.type === 'page') {
        updateTab(tab.id, { chatId: newChatId })
      }
    }
  }

  const handleChatClear = async (createNewChat: boolean) => {
    log.debug('clearing chat')
    let pageMagic = $activeTabMagic
    if (!pageMagic) return

    try {
      let chatId: string | null = null
      await deleteChatsForPageChat()
      if (createNewChat) {
        chatId = await sffs.createAIChat('')
        if (!chatId) {
          log.error('Failed to create new chat aftering clearing the old one')
          return
        }
      }
      pageMagic.responses = []
      updateChatIdsForPageChat(chatId!)
    } catch (e) {
      log.error('Error clearing chat:', e)
    }
  }

  const bookmarkPageTabsInContext = async () => {
    log.debug('Bookmarking all page tabs in context')
    for (const tab of getTabsInChatContext()) {
      if (tab.type === 'page' && !tab.resourceBookmark) {
        await bookmarkPage(tab)
      }
    }
  }

  const handleToggleMagicSidebar = async () => {
    const tab = $activeTab as TabPage | null

    if (!$activeTabMagic) return
    if (!tab) return

    if (!$activeTabMagic.showSidebar) {
      if (!tab?.chatId) {
        const chatId = await sffs.createAIChat('')
        if (!chatId) {
          log.error('Failed to create chat')
          return
        }
        updateChatIdsForPageChat(chatId)
      }
      await bookmarkPageTabsInContext()
    }
    activeTabMagic.update((magic) => {
      return {
        ...magic,
        showSidebar: !magic.showSidebar
      }
    })
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

      const resource = await bookmarkPage($activeTab)
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

  const handleWebviewAnnotation = async (
    e: CustomEvent<WebViewWrapperEvents['annotate']>,
    tabId: string
  ) => {
    const tab = $tabs.find((tab) => tab.id === tabId)
    if (!tab || tab.type !== 'page') {
      log.debug('tab is not a page')
      return
    }

    const browserTab = $browserTabs[tabId]
    if (!browserTab) {
      log.error('Browser tab not found', tabId)
      return
    }

    const annotationData = e.detail
    log.debug('webview annotation', annotationData)

    let bookmarkedResource = tab.resourceBookmark

    if (!bookmarkedResource) {
      log.debug('no bookmarked resource')

      const resource = await bookmarkPage(tab)
      bookmarkedResource = resource.id
    }

    const currentEntry = historyEntriesManager.getEntry(
      tab.historyStackIds[tab.currentHistoryIndex]
    )

    const url = annotationData?.data?.url ?? currentEntry?.url ?? tab.initialLocation

    const hashtags = (annotationData.data as AnnotationCommentData)?.tags ?? []
    if (hashtags.length > 0) {
      log.debug('hashtags', hashtags)
    }

    const annotationResource = await resourceManager.createResourceAnnotation(
      annotationData,
      { sourceURI: url },
      [
        // link the annotation to the page using its canonical URL so we can later find it
        ResourceTag.canonicalURL(url),

        // link the annotation to the bookmarked resource
        ResourceTag.annotates(bookmarkedResource),

        // add tags as hashtags
        ...hashtags.map((tag) => ResourceTag.hashtag(tag))
      ]
    )

    log.debug('created annotation resource', annotationResource)

    log.debug('highlighting text in webview')
    browserTab.sendWebviewEvent(WebViewEventReceiveNames.RestoreAnnotation, {
      id: annotationResource.id,
      data: annotationData
    })

    if (annotationsSidebar) {
      annotationsSidebar.reload()
    }
  }

  const handleWebviewAnnotationClick = async (
    e: CustomEvent<WebViewWrapperEvents['annotationClick']>,
    tabId: string
  ) => {
    const annotationId = e.detail.id

    log.debug('webview annotation click', annotationId)

    const tab = $tabs.find((tab) => tab.id === tabId) as TabPage | undefined
    if (tab && tab.resourceBookmark) {
      openResource(tab.resourceBookmark)
    }
  }

  const handleWebviewAnnotationRemove = async (
    e: CustomEvent<WebViewWrapperEvents['annotationRemove']>,
    tabId: string
  ) => {
    const annotationId = e.detail

    log.debug('webview annotation remove', annotationId)

    await resourceManager.deleteResource(annotationId)

    toasts.success('Annotation deleted!')

    if (annotationsSidebar) {
      annotationsSidebar.reload()
    }

    const browserTab = $browserTabs[tabId]
    if (browserTab) {
      browserTab.reload()
    }
  }

  const handleWebviewAnnotationUpdate = async (
    e: CustomEvent<WebViewWrapperEvents['annotationUpdate']>,
    tabId: string
  ) => {
    const { id, data } = e.detail

    log.debug('webview annotation update', id)

    const annotationResource = (await resourceManager.getResource(id)) as ResourceAnnotation
    const annotationData = await annotationResource.getParsedData()

    if (annotationData.type !== 'comment') {
      return
    }

    const newData = {
      ...annotationData,
      data: {
        ...annotationData.data,
        ...data
      }
    } as ResourceDataAnnotation

    log.debug('updating annotation data', newData)
    await annotationResource.updateParsedData(newData)

    // await tick()

    if (annotationsSidebar) {
      log.debug('reloading annotations sidebar')
      annotationsSidebar.reload(true)
    }

    // const browserTab = $browserTabs[tabId]
    // if (browserTab) {
    //   browserTab.reload()
    // }
  }

  const openResource = async (id: string) => {
    // $sidebarTab = 'oasis'

    // await tick()

    // drawer.openItem(id)
    openResourceDetailsModal(id)
  }

  const handleSpaceItemClick = (e: CustomEvent<string>) => {
    const resourceId = e.detail

    log.debug('space item click', resourceId)

    openResourceDetailsModal(resourceId)
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

  const handleSaveResourceInSpace = async (e: CustomEvent) => {
    console.log('hhh', e.detail)

    try {
      const resource = await handleBookmark(e.detail)
      console.log('BOOKMARKED', resource)

      if (resource) {
        console.log('will add item', resource.id, 'to space', e.detail.id)
        resourceManager.addItemsToSpace(e.detail.id, [resource.id])
      }
    } finally {
      console.log('Bookmark handling completed')
    }
  }

  const handleCreateNewSpace = async (e: CustomEvent) => {
    try {
      log.debug('Create new Space with Name', e.detail)

      const newSpace = await oasis.createSpace({
        folderName: e.detail,
        colors: ['#FFBA76', '#FB8E4E'],
        showInSidebar: false,
        liveModeEnabled: false,
        hideViewed: false
      })

      log.debug('New Folder:', newSpace)

      const userPrompt = JSON.stringify(e.detail)
      let response = await resourceManager.getResourcesViaPrompt(userPrompt)
      if (typeof response === 'string') {
        response = JSON.parse(response)
      }

      log.debug(`Automatic Folder Generation request`, response)

      const results = response.embedding_search_results || response.sql_query_results
      log.debug('Automatic Folder generated with', results)

      if (!results) {
        log.warn('No results found for', userPrompt, response)
        return
      }

      await oasis.addResourcesToSpace(newSpace.id, results)

      toasts.success('Folder created with AI!')
      await tick()
    } catch (error) {
      log.error('Failed to create new space:', error)
    }
  }

  const handleCreateLiveSpace = async (_e: MouseEvent) => {
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
        hideViewed: false
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
      deleteTab(tab.id)
    }
  }

  onMount(async () => {
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

    console.log('xxxx', $tabs)
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
    console.log('spaceid', spaceId)

    try {
      const spaces = await oasis.loadSpaces()
      const space = spaces.find((space) => space.id === spaceId)
      if (space) {
        await oasis.updateSpaceData(space.id, {
          showInSidebar: false
        })

        await tick()

        await archiveTab(tabId)

        toasts.success('Space removed from sidebar!')
      }
    } catch (error) {
      log.error('Failed to remove space from sidebar:', error)
    }
  }

  const resetTabsFromMagic = async () => {
    const magicTabsArray = get(magicTabs)
    const unpinnedTabsArray = get(unpinnedTabs)
    const pinnedTabsArray = get(pinnedTabs)

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

    // Update the indices of the tabs in all lists
    const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }))

    const newUnpinnedTabsArray = updateIndices(unpinnedTabsArray)
    const newPinnedTabsArray = updateIndices(pinnedTabsArray)
    const newMagicTabsArray = updateIndices(magicTabsArray)

    // Combine all lists back together
    const newTabs = [...newUnpinnedTabsArray, ...newPinnedTabsArray, ...newMagicTabsArray]

    log.debug('Reverted tabs', newTabs)

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
</script>

<SplashScreen />

<svelte:window on:keydown={handleKeyDown} />

<ToastsProvider service={toasts} />

<div class="app-wrapper">
  {#if showTabSearch}
    <TabSearch
      onClose={() => {
        showTabSearch = false
      }}
      activeTabs={$activeTabs}
      on:activateTab={handleTabSelect}
    />
  {/if}
  {#if showSidebar}
    <div class="sidebar" class:magic={$magicTabs.length === 0 && $activeTabMagic?.showSidebar}>
      <div class="tab-bar-selector">
        <div class="tab-selector" class:actions={$sidebarTab !== 'oasis'}>
          <!-- <button
        on:click={() => ($sidebarTab = 'active')}
        class:active={$sidebarTab === 'active'}
        use:tooltip={{
          content: 'Active Tabs (⌘ + G)',
          action: 'hover',
          position: 'bottom',
          animation: 'fade',
          delay: 500
        }}
      >
        <Icon name="list" />
      </button> -->
          <!--
      <button
        on:click={() => ($sidebarTab = 'archive')}
        class:active={$sidebarTab === 'archive'}
        use:tooltip={{
          content: 'Archived Tabs (⌘ + Y)',
          action: 'hover',
          position: 'bottom',
          animation: 'fade',
          delay: 500
        }}
      >
        <Icon name="archive" />
      </button>
      -->
          <!-- <button
        on:click={() => {
          $sidebarTab = 'oasis'
          toggleOasis()
        }}
        class:active={$sidebarTab === 'oasis'}
        use:tooltip={{
          content: 'Open Oasis (⌘ + O)',
          action: 'hover',
          position: 'bottom',
          animation: 'fade',
          delay: 500
        }}
      >
        <Icon name="leave" />
      </button> -->
          {#if $sidebarTab !== 'oasis'}
            <div class="tabs-list">
              <button
                class="nav-button"
                disabled={!canGoBack}
                on:click={$activeBrowserTab?.goBack}
                use:tooltip={{
                  content: 'Go Back',
                  action: 'hover',
                  position: 'bottom',
                  animation: 'fade',
                  delay: 500
                }}
              >
                <Icon name="arrow.left" />
              </button>
              <button
                class="nav-button"
                disabled={!canGoForward}
                on:click={$activeBrowserTab?.goForward}
                use:tooltip={{
                  content: 'Go Forward',
                  action: 'hover',
                  position: 'bottom',
                  animation: 'fade',
                  delay: 500
                }}
              >
                <Icon name="arrow.right" />
              </button>
              <button
                class="nav-button"
                on:click={$activeBrowserTab?.reload}
                use:tooltip={{
                  content: 'Reload Page (⌘ + R)',
                  action: 'hover',
                  position: 'bottom',
                  animation: 'fade',
                  delay: 500
                }}
              >
                <Icon name="reload" />
              </button>
            </div>
          {:else if $sidebarTab === 'oasis'}
            <div>
              <button class="action-back-to-tabs" on:click={() => sidebarTab.set('active')}>
                <Icon name="chevron.left" />
                <span class="label">Back to Tabs</span>
              </button>
            </div>
          {/if}
        </div>

        {#if $sidebarTab !== 'oasis'}
          <div
            class="bar-wrapper"
            aria-label="Collapse URL bar"
            on:keydown={(e) => handleAddressBarKeyDown}
            tabindex="0"
            role="button"
          >
            <div class="address-bar-wrapper">
              <div class="address-bar-content">
                <div class="search">
                  <input
                    bind:this={addressInputElem}
                    disabled={$activeTab?.type !== 'page' &&
                      $activeTab?.type !== 'chat' &&
                      $activeTab?.type !== 'empty'}
                    bind:value={$addressValue}
                    on:blur={handleBlur}
                    on:focus={handleFocus}
                    type="text"
                    placeholder={$activeTab?.type === 'page'
                      ? 'Search or Enter URL'
                      : $activeTab?.type === 'chat'
                        ? 'Chat Title'
                        : 'Search or Enter URL'}
                  />
                </div>

                {#if $activeTab?.type === 'page'}
                  {#key $activeTab.resourceBookmark}
                    <button
                      on:click={handleBookmark}
                      use:tooltip={{
                        content: $activeTab?.resourceBookmark
                          ? 'Open bookmark (⌘ + D)'
                          : 'Bookmark this page (⌘ + D)',
                        action: 'hover',
                        position: 'left',
                        animation: 'fade',
                        delay: 500
                      }}
                    >
                      {#if $bookmarkingInProgress}
                        <Icon name="spinner" />
                      {:else if $bookmarkingSuccess}
                        <Icon name="check" />
                      {:else if $activeTab?.resourceBookmark}
                        <Icon name="bookmarkFilled" />
                      {:else}
                        <Icon name="leave" />
                      {/if}
                    </button>
                  {/key}
                {/if}

                {#if $activeTab?.type === 'page' && $activeTab.currentDetectedApp?.rssFeedUrl}
                  <button
                    on:click={handleCreateLiveSpace}
                    use:tooltip={{
                      content: `Create ${$activeTab.currentDetectedApp.appName} live Space`,
                      action: 'hover',
                      position: 'left',
                      animation: 'fade',
                      delay: 500
                    }}
                    on:save-resource-in-space={handleSaveResourceInSpace}
                    use:popover={{
                      content: {
                        component: ShortcutSaveItem,
                        props: { resourceManager, spaces }
                      },
                      action: 'hover',
                      position: 'right-top',
                      style: {
                        backgroundColor: '#F8F7F1'
                      },
                      animation: 'fade',
                      delay: 1200
                    }}
                  >
                    <Icon name="news" />
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>

      {#if $sidebarTab !== 'oasis'}
        <div class="tabs">
          <!-- {#each $unpinnedTabs as tab (tab.id)}
          {#if tab.type === 'chat'}
            <TabItem
              {tab}
              {activeTabId}
              {deleteTab}
              {unarchiveTab}
              pinned={tab.pinned}
              on:select={handleTabSelect}
              on:remove-from-sidebar={handleRemoveFromSidebar}
            />
          {/if}
        {/each} -->

          <!-- <div class="divider"></div> -->
          {#if $activeTabMagic}
            {#if $activeTabMagic.showSidebar}
              <div class="magic-tabs-wrapper" class:magic={$magicTabs.length > 0}>
                <DragDropList
                  id="magic-tabs"
                  type={VerticalDropZone}
                  itemSize={48}
                  itemCount={$magicTabs.length || 1}
                  on:drop={async (event) => {
                    onDrop(event, 'unpin')
                  }}
                  let:index
                >
                  {#if $magicTabs.length === 0}
                    <div class="debug">
                      <div class="ai-wrapper">
                        <Icon name="ai" size={32 * 0.75 + 'px'} />
                      </div>
                      <span class="label"
                        >You are chatting with all tabs. Drop tabs here to filter.</span
                      >
                    </div>
                  {:else}
                    <TabItem
                      tab={$magicTabs[index]}
                      {activeTabId}
                      {deleteTab}
                      {unarchiveTab}
                      pinned={false}
                      on:select={handleTabSelect}
                      on:remove-from-sidebar={handleRemoveFromSidebar}
                    />
                  {/if}
                </DragDropList>
              </div>
            {/if}
          {/if}

          <div class="unpinned-tabs-wrapper">
            <DragDropList
              id="tabs"
              type={VerticalDropZone}
              itemSize={48}
              itemCount={$unpinnedTabs.length}
              on:drop={async (event) => {
                onDrop(event, 'unpin')
              }}
              let:index
            >
              <TabItem
                tab={$unpinnedTabs[index]}
                {activeTabId}
                {deleteTab}
                {unarchiveTab}
                pinned={false}
                on:select={handleTabSelect}
                on:remove-from-sidebar={handleRemoveFromSidebar}
                on:drop={handleDrop}
              />

              {#if index === $unpinnedTabs.length - 1}
                <button
                  class="add-tab-button"
                  on:click|preventDefault={() => createNewEmptyTab()}
                  on:create-tab-from-space={handleCreateTabFromPopover}
                  on:create-new-space={handleCreateNewSpace}
                  use:popover={{
                    content: {
                      component: ShortcutMenu,
                      props: { resourceManager, spaces }
                    },
                    action: 'hover',
                    position: 'right-top',
                    style: {
                      backgroundColor: '#F8F7F1'
                    },
                    animation: 'fade',
                    delay: 1200
                  }}
                >
                  <Icon name="add" color="#7d7448" />
                  <span class="label">New Tab</span>
                </button>
              {/if}
            </DragDropList>
          </div>
        </div>

        <div class="pinned-tabs-wrapper">
          <DragDropList
            id="pinned-tabs"
            type={HorizontalCenterDropZone}
            itemSize={$pinnedTabs.length === 0 ? 200 : 54}
            itemCount={$pinnedTabs.length || 1}
            on:drop={async (event) => {
              onDrop(event, 'pin')
            }}
            let:index
          >
            {#if $pinnedTabs.length === 0}
              <div class="description-text">Drop Tabs here to pin them.</div>
            {:else}
              <!-- The key block is required for the tab item to properly re-render and prevent data missmatches -->
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
            {/if}
          </DragDropList>
        </div>
      {:else}
        <OasisSidebar on:createTab={handleCreateTabFromSpace} />
      {/if}
    </div>
  {/if}

  <div
    class="browser-window-wrapper"
    class:hasNoTab={!$activeBrowserTab}
    class:sidebarHidden={!showSidebar}
  >
    {#if $sidebarTab === 'oasis'}
      <div class="browser-window active" style="--scaling: 1;">
        <OasisSpace
          spaceId={$selectedSpace}
          active
          on:open={handleSpaceItemClick}
          on:create-resource-from-oasis={handeCreateResourceFromOasis}
          on:deleted={handleDeletedSpace}
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
        class="browser-window"
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
            bind:this={$browserTabs[tab.id]}
            bind:tab={$tabs[$tabs.findIndex((t) => t.id === tab.id)]}
            active={$activeTabId === tab.id}
            {historyEntriesManager}
            on:newTab={handleNewTab}
            on:navigation={(e) => handleWebviewTabNavigation(e, tab)}
            on:bookmark={handleWebviewBookmark}
            on:transform={(e) => handleWebviewTransform(e, tab)}
            on:appDetection={(e) => handleWebviewAppDetection(e, tab)}
            on:inlineTextReplace={(e) => handleWebviewInlineTextReplace(e, tab.id)}
            on:annotate={(e) => handleWebviewAnnotation(e, tab.id)}
            on:annotationClick={(e) => handleWebviewAnnotationClick(e, tab.id)}
            on:annotationRemove={(e) => handleWebviewAnnotationRemove(e, tab.id)}
            on:annotationUpdate={(e) => handleWebviewAnnotationUpdate(e, tab.id)}
            on:keyDown={(e) => handleKeyDown(e.detail)}
            on:webviewKeydown={(e) => handleKeyDown(e.detail)}
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
            openedMiniBrowser={$showResourceDetails && !!$resourceDetailsModalSelected}
            on:open={handleSpaceItemClick}
            on:create-resource-from-oasis={handeCreateResourceFromOasis}
            on:deleted={handleDeletedSpace}
          />
        {:else}
          <BrowserHomescreen
            {historyEntriesManager}
            on:navigate={handleTabNavigation}
            on:chat={handleCreateChat}
            on:rag={handleRag}
            on:create-tab-from-space={handleCreateTabFromSpace}
          />
        {/if}
      </div>
    {/each}

    {#if !$activeTabs && !$activeTab}
      <div class="browser-window active" style="--scaling: 1;">
        <BrowserHomescreen
          {historyEntriesManager}
          on:navigate={handleTabNavigation}
          on:chat={handleCreateChat}
          on:rag={handleRag}
        />
      </div>
    {/if}

    {#if $sidebarTab === 'active' && $activeTab?.type === 'page'}
      {#if $activeTabMagic}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          class="sidebar-magic-toggle"
          on:click={handleToggleMagicSidebar}
          use:tooltip={{
            content: 'Toggle Page Chat',
            action: 'hover',
            position: 'left',
            animation: 'fade',
            delay: 500
          }}
        >
          {#if $activeTabMagic.showSidebar}
            <Icon name="close" />
          {:else if $activeTabMagic.running}
            <Icon name="spinner" />
          {:else}
            <Icon name="message" />
          {/if}
        </div>
      {/if}

      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div
        class="sidebar-annotations-toggle"
        on:click={() => ($showAnnotationsSidebar = !$showAnnotationsSidebar)}
        use:tooltip={{
          content: 'Toggle Annotations',
          action: 'hover',
          position: 'left',
          animation: 'fade',
          delay: 500
        }}
      >
        {#if $showAnnotationsSidebar}
          <Icon name="close" />
        {:else}
          <Icon name="marker" />
        {/if}
      </div>
    {/if}
  </div>

  {#if $activeTab && $activeTab.type === 'page' && $activeTabMagic && $activeTabMagic?.showSidebar}
    <div transition:slide={{ axis: 'x' }} class="sidebar sidebar-magic">
      <MagicSidebar
        magicPage={$activeTabMagic}
        bind:inputValue={$magicInputValue}
        on:highlightText={(e) => scrollWebviewToText(e.detail.tabId, e.detail.text)}
        on:highlightWebviewText={(e) =>
          highlightWebviewText(e.detail.resourceId, e.detail.answerText)}
        on:seekToTimestamp={(e) => handleSeekToTimestamp(e.detail.resourceId, e.detail.timestamp)}
        on:navigate={(e) => {
          $browserTabs[$activeTabId].navigate(e.detail.url)
        }}
        on:saveText={(e) => saveTextFromPage(e.detail, undefined, undefined, 'chat_ai')}
        on:chat={() => handleChatSubmit($activeTabMagic)}
        on:clearChat={() => handleChatClear(true)}
        on:prompt={handleMagicSidebarPromptSubmit}
      />
    </div>
  {:else if $showAnnotationsSidebar && $activeTab?.type === 'page'}
    <div transition:slide={{ axis: 'x' }} class="sidebar sidebar-magic">
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

<style lang="scss">
  .app-wrapper {
    display: flex;
    // flex-direction: row-reverse;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #eeece0;
    --sidebar-width-left: 320px;
    --sidebar-width-right: 450px;
  }

  .sidebar {
    position: relative;
    flex-shrink: 0;
    width: var(--sidebar-width-left);
    height: 100vh;
    padding: 0.5rem 0.75rem 0.75rem 0.75rem;
    display: flex;
    flex-direction: column;

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
    position: absolute;
    top: 4rem;
    right: 0.45rem;
    z-index: 100000;
    transform: translateY(-50%);
    background: #eeece0;
    border-radius: 8px 0 0 8px;
    padding: 1rem;
    cursor: pointer;
    border-top: 1px solid #e4e2d4;
    border-bottom: 1px solid #e4e2d4;
    border-left: 1px solid #e4e2d4;
  }

  .sidebar-annotations-toggle {
    position: absolute;
    top: 8rem;
    right: 0.45rem;
    z-index: 100000;
    transform: translateY(-50%);
    background: #eeece0;
    border-radius: 8px 0 0 8px;
    padding: 1rem;
    cursor: pointer;
    border-top: 1px solid #e4e2d4;
    border-bottom: 1px solid #e4e2d4;
    border-left: 1px solid #e4e2d4;
  }

  .sidebar-magic {
    width: var(--sidebar-width-right);
    z-index: 1;
  }

  .browser-window-wrapper {
    flex: 1;
    padding: 0.5rem;
    padding-left: 0;
    height: 100vh;
    position: relative;

    &.hasNoTab {
      padding: 0.5rem;
      height: calc(100vh - 0.25rem);
    }

    &.sidebarHidden {
      padding-left: 0.5rem;
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

  .address-bar-wrapper {
    border-radius: 12px;
    padding: 0.5rem;
    width: 100%;
    background: #f7f7f7;
    display: flex;
    flex-direction: column;
    gap: 15px;
    position: relative;
  }

  .address-bar-content {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
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

  .search {
    flex: 1;
    width: 100%;
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 1rem;
    background-color: #fff;
    color: #3f3f3f;

    &:hover {
      background: #eeece0;
    }

    &:focus {
      outline: none;
      border-color: #f73b95;
      color: #000;
      background-color: #ffffff;
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
    margin-top: 0.5rem;
    gap: 0.5rem;
    padding-bottom: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;

    h2 {
      font-size: 1.1rem;
      font-weight: 500;
      margin-top: 15px;
      margin-bottom: 10px;
      color: #a9a9a9;
    }

    .unpinned-tabs-wrapper {
      height: 100%;
      max-height: calc(100vh - 20rem);
    }

    .magic-tabs-wrapper {
      border-radius: 12px;
      padding: 0.5rem;
      border: 1px dashed rgba(88, 81, 48, 0.4);
      margin: 0.5rem 0 0.25rem 0;

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
      width: 100%;
      background: transparent;
      border-radius: 12px;

      &:hover {
        background-color: #e0e0d1;
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
    padding: 0.5rem;
    margin-top: 2rem;
    bottom: 2rem;
    left: 0.5rem;
    right: 0.5rem;
    gap: 1rem;

    background: #f7f7f7;
    border-radius: 18px;
    width: calc(100% - 1rem);
    overflow-y: visible;
    box-shadow:
      0.849px 0.85px 7.85px 0px rgba(255, 255, 255, 0.2) inset,
      0px 7.007px 7.935px 0px rgba(0, 0, 0, 0.03),
      0px 16.84px 16.867px 0px rgba(0, 0, 0, 0.04),
      0px 31.708px 27.854px 0px rgba(0, 0, 0, 0.05);

    .description-text {
      opacity: 0.4;
    }
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
    display: flex;
    align-items: center;
    padding: 10px;
    border-radius: 5px;
    cursor: pointer;
    gap: 10px;
    position: relative;
    color: #7d7448;
    font-weight: 500;
    letter-spacing: 0.0025em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    .title {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 1.1rem;
    }

    .close {
      display: none;
      align-items: center;
      justify-content: center;
      appearance: none;
      border: none;
      padding: 0;
      margin: 0;
      height: min-content;
      background: none;
      color: #a9a9a9;
      cursor: pointer;
    }

    &:hover .close {
      display: flex;
    }

    &.selected {
      color: #585130;
      background-color: #fff;
    }
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

  .tab-selector {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    z-index: 10;
    padding-top: 5px;
    padding-bottom: 5px;

    .tabs-list {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

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

  :global(citation) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    font-size: 1rem;
    background: rgb(255, 164, 164);
    border-radius: 100%;
    user-select: none;
    cursor: pointer;
    overflow: hidden;
  }

  :global(div[data-dnd-zone]) {
    overflow: visible !important;
    background: transparent !important;
  }

  .tab-bar-selector {
    display: flex;
    flex-direction: column;
  }

  :global(.magic-tabs-wrapper [data-dnd-zone]) {
    min-height: 4rem !important;
    height: fit-content !important;
  }

  .debug {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    span {
      border: none;
      background: transparent;
      color: #7d7448;
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.3;
      letter-spacing: 0.0025em;
      max-width: 15rem;
      opacity: 0.8;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      outline: none;
      width: fit-content;
    }
  }

  .ai-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(72px * 0.75);
    height: calc(72px * 0.75);
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
