<script lang="ts">
  import { onMount, setContext, tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import SplashScreen from '../SplashScreen.svelte'
  import { writable, derived } from 'svelte/store'
  import { type WebViewWrapperEvents } from '../Cards/Browser/WebviewWrapper.svelte'
  import { useLogScope } from '../../utils/log'
  import { Icon } from '@horizon/icons'
  import { generateID } from '../../utils/id'
  import { parseStringIntoBrowserLocation } from '../../utils/url'
  import { isModKeyAndKeyPressed, isModKeyPressed } from '../../utils/keyboard'
  import { copyToClipboard } from '../../utils/clipboard'
  import { wait, writableAutoReset } from '../../utils/time'
  import { Telemetry } from '../../service/telemetry'
  import { Resource, ResourceManager, ResourceTag } from '../../service/resources'
  import { HorizonsManager } from '../../service/horizon'
  import { API } from '../../service/api'
  import BrowserTab, { type NewTabEvent } from './BrowserTab.svelte'
  import Horizon from '../Horizon/Horizon.svelte'
  import BrowserHomescreen from './BrowserHomescreen.svelte'
  import OasisSidebar from './OasisSidebar.svelte'
  import TabItem from './Tab.svelte'

  import { selectedFolder } from '../../stores/oasis'

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
    TabPage
  } from './types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../Cards/Browser/searchEngines'
  import DrawerWrapper from '../Horizon/DrawerWrapper.svelte'
  import type { Drawer } from '@horizon/drawer'
  import Chat from './Chat.svelte'
  import { HorizonDatabase } from '../../service/storage'
  import { ResourceTypes, type Optional } from '../../types'
  import { useLocalStorageStore } from '../../utils/localstorage'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import { WebParser, type DetectedWebApp } from '@horizon/web-parser'
  import Importer from './Importer.svelte'
  import { parseChatResponseSources, summarizeText } from '../../service/ai'
  import MagicSidebar from './MagicSidebar.svelte'
  import {
    ResourceTagsBuiltInKeys,
    WebViewEventReceiveNames,
    type AnnotationRangeData
  } from '@horizon/types'
  import {
    inlineHighlightStylingCode,
    inlineHighlightTextCode,
    inlineTextReplaceCode,
    inlineTextReplaceStylingCode,
    scrollToTextCode
  } from './inline'
  import { SFFS } from '../../service/sffs'

  let addressInputElem: HTMLInputElement
  let drawer: Drawer
  let addressBarFocus = false

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
  const resourceManager = new ResourceManager(telemetry)
  const horizonManager = new HorizonsManager(api, resourceManager, telemetry)
  const storage = new HorizonDatabase()
  const sffs = new SFFS()

  const tabsDB = storage.tabs
  const horizons = horizonManager.horizons
  const historyEntriesManager = horizonManager.historyEntriesManager

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
  const magicPages = writable<PageMagic[]>([])
  const bookmarkingSuccess = writableAutoReset(false, 1000)
  const showURLBar = writable(false)

  // Set global context
  setContext('selectedFolder', 'all')

  const activeTabs = derived([tabs], ([tabs]) => {
    return tabs
      .filter((tab) => !tab.archived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  const tabsInView = derived([tabs, sidebarTab], ([tabs, sidebarTab]) => {
    if (sidebarTab === 'active') {
      return tabs
        .filter((tab) => !tab.archived)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else {
      return tabs
        .filter((tab) => tab.archived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
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

  const activeTabMagic = derived([activeTab, magicPages], ([activeTab, magicPages]) => {
    return magicPages.find((page) => page.tabId === activeTab?.id)
  })

  $: canGoBack = $activeTab?.type === 'page' && $activeTab?.currentHistoryIndex > 0
  $: canGoForward =
    $activeTab?.type === 'page' &&
    $activeTab?.currentHistoryIndex < $activeTab.historyStackIds.length - 1

  $: if ($activeTab?.archived !== ($sidebarTab === 'archive')) {
    log.debug('Active tab is not in view, resetting')
    resetActiveTab()
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
      activeTabId.set(tabsInView[0].id)
    } else if (tab === 'active' && $activeTab?.archived) {
      activeTabId.set(tabsInView[0].id)
    }
  })

  $: log.debug(
    'active tab',
    $tabs.find((tab) => tab.id === $activeTabId)
  )

  $: log.debug('tabs', $tabs)

  const resetActiveTab = () => {
    const tabsInView = $tabs.filter((tab) =>
      $sidebarTab === 'active' ? !tab.archived : tab.archived
    )
    if (tabsInView.length === 0) {
      log.debug('No tabs in view')
      activeTabId.set('')
      return
    }
    const newActiveTabId = tabsInView[0]?.id
    log.debug('Resetting active tab', newActiveTabId)
    activeTabId.set(newActiveTabId)
  }

  const createTab = async <T extends Tab>(
    tab: Optional<T, 'id' | 'createdAt' | 'updatedAt' | 'archived'>
  ) => {
    const newTab = await tabsDB.create({ archived: false, ...tab })
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

    updateTab(tabId, { archived: true })

    await tick()

    if ($activeTabId === tabId) {
      resetActiveTab()
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
      activeTabId.set(tabId)
    }, 50)
  }

  const deleteTab = async (tabId: string) => {
    const tab = $tabs.find((tab) => tab.id === tabId)
    if (!tab) {
      log.error('Tab not found', tabId)
      return
    }

    tabs.update((tabs) => tabs.filter((tab) => tab.id !== tabId))

    if ($activeTabId === tabId) {
      resetActiveTab()
    }

    await tabsDB.delete(tabId)
  }

  const persistTabChanges = async (tabId: string, updates: Partial<Tab>) => {
    await tabsDB.update(tabId, updates)
  }

  const updateTab = async (tabId: string, updates: Partial<Tab>) => {
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

  const updateActiveTab = (updates: Partial<Tab>) => {
    if (!$activeTab) {
      log.error('No active tab')
      return
    }

    updateTab($activeTab.id, updates)
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

  // fix the syntax error
  const handleKeyDown = (e: KeyboardEvent) => {
    log.debug('key down', e.key)
    if (e.key === 'Enter' && addressBarFocus) {
      handleBlur()
      addressInputElem.blur()
    } else if (isModKeyPressed(e) && e.shiftKey && e.key === 'c') {
      copyToClipboard($activeTabLocation ?? '')
    } else if (isModKeyPressed(e) && e.key === 't') {
      createNewEmptyTab()
    } else if (isModKeyAndKeyPressed(e, 'o')) {
      toggleOasis()
    } else if (isModKeyAndKeyPressed(e, 'w')) {
      closeActiveTab()
    } else if (isModKeyAndKeyPressed(e, 'd')) {
      handleBookmark()
    } else if (isModKeyAndKeyPressed(e, 'y')) {
      sidebarTab.set('archive')
    } else if (isModKeyAndKeyPressed(e, 'g')) {
      sidebarTab.set('active')
    } else if (isModKeyAndKeyPressed(e, 'n')) {
      handleNewHorizon()
    } else if (isModKeyAndKeyPressed(e, 'r')) {
      $activeBrowserTab?.reload()
    } else if (isModKeyAndKeyPressed(e, 'i')) {
      createImporterTab()
    } else if (isModKeyAndKeyPressed(e, 'b')) {
      $activeBrowserTab?.openDevTools()
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

    activeTabId.set(newTab.id)
    addressValue.set(newHorizon.data.name)
  }

  const createNewEmptyTab = async () => {
    log.debug('Creating new tab')

    const newTab = await createTab<TabEmpty>({ title: 'New Tab', icon: '', type: 'empty' })
    activeTabId.set(newTab.id)

    addressInputElem.focus()
    addressValue.set('')
  }

  const createPageTab = async (url: string, active = true) => {
    log.debug('Creating new page tab')
    const newTab = await createTab<TabPage>({
      title: url,
      icon: '',
      type: 'page',
      initialLocation: url,
      historyStackIds: [],
      currentHistoryIndex: -1
    })

    if (active) {
      activeTabId.set(newTab.id)
    }
  }

  const createChatTab = async (query: string, active = true) => {
    log.debug('Creating new chat tab')
    const newTab = await createTab<TabChat>({ title: query, icon: '', type: 'chat', query: query })

    if (active) {
      activeTabId.set(newTab.id)
    }
  }

  const createImporterTab = async () => {
    log.debug('Creating new importer tab')
    const newTab = await createTab<TabImporter>({
      title: 'Importer',
      icon: '',
      type: 'importer'
    })

    activeTabId.set(newTab.id)
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

  const handleTabSelect = (event) => {
    console.log('Active Tab ID:', event.detail)
    activeTabId.set(event.detail)
  }

  async function bookmarkPage(tab: TabPage) {
    let resource: Resource | null
    if (tab.chatResourceBookmark) {
      resource = await resourceManager.getResource(tab.chatResourceBookmark)
    } else {
      const currentEntry = historyEntriesManager.getEntry(
        tab.historyStackIds[tab.currentHistoryIndex]
      )
      const url = currentEntry?.url ?? tab.initialLocation

      log.debug('bookmarking', url)

      const detectedResource = await $activeBrowserTab.detectResource()
      log.debug('extracted resource data', detectedResource)

      if (!detectedResource) {
        log.debug('no resource detected')
        throw new Error('No resource detected')
      }

      resource = await resourceManager.createResourceOther(
        new Blob([JSON.stringify(detectedResource.data)], { type: detectedResource.type }),
        { name: $activeTab?.title ?? '', sourceURI: url, alt: '' },
        [ResourceTag.canonicalURL(url)]
      )
      log.debug('created resource', resource)
    }

    if (resource) updateTab(tab.id, { resourceBookmark: resource.id })

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

      log.debug('bookmarking', $activeTabLocation)
      bookmarkingInProgress.set(true)

      await bookmarkPage($activeTab)

      // automatically resets after some time
      bookmarkingSuccess.set(true)
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
      updateTab(tab.id, { resourceBookmark: null })
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

  function updateMagicPage(tabId: string, updates: Partial<PageMagic>) {
    magicPages.update((pages) => {
      const updatedPages = pages.map((page) => {
        if (page.tabId === tabId) {
          return {
            ...page,
            ...updates
          }
        }

        return page
      })

      return updatedPages
    })
  }

  function addPageMagicResponse(tabId: string, response: AIChatMessageParsed) {
    magicPages.update((pages) => {
      const updatedPages = pages.map((page) => {
        if (page.tabId === tabId) {
          return {
            ...page,
            responses: [...page.responses, response]
          }
        }

        return page
      })

      return updatedPages
    })
  }

  function updatePageMagicResponse(
    tabId: string,
    responseId: string,
    updates: Partial<AIChatMessageParsed>
  ) {
    magicPages.update((pages) => {
      const updatedPages = pages.map((page) => {
        if (page.tabId === tabId) {
          return {
            ...page,
            responses: page.responses.map((response) => {
              if (response.id === responseId) {
                return {
                  ...response,
                  ...updates
                }
              }

              return response
            })
          }
        }

        return page
      })

      return updatedPages
    })
  }

  async function handleWebviewAppDetection(e: CustomEvent<DetectedWebApp>, tab: TabPage) {
    log.debug('webview app detection', e.detail, tab)

    if (tab.type !== 'page') return
    let pageMagic = $magicPages.find((page) => page.tabId === tab.id)

    if (!pageMagic) {
      let responses: AIChatMessageParsed[] = []
      if (tab?.chatId) {
        const chat = await sffs.getAIChat(tab.chatId)
        if (chat) {
          const userMessages = chat.messages.filter((message) => message.role === 'user')
          const queries = userMessages.map((message) => message.content)
          const systemMessages = chat.messages.filter((message) => message.role === 'system')

          responses = systemMessages.map((message, idx) => {
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
        tabId: tab.id,
        showSidebar: false,
        running: false,
        responses: responses
      } as PageMagic

      magicPages.update((pages) => [...pages, pageMagic!])
    }

    console.log('grep me', pageMagic)
    console.log('grep me', $activeTab)

    const browserTab = $browserTabs[tab.id]
    if (!browserTab) {
      log.error('Browser tab not found', tab.id)
      return
    }

    const currentEntry = historyEntriesManager.getEntry(
      tab.historyStackIds[tab.currentHistoryIndex]
    )

    const url = currentEntry?.url ?? tab.initialLocation

    log.debug('getting resources from source url', url)

    const matchingResources = await resourceManager.getResourcesFromSourceURL(url)
    log.debug('matching resources', matchingResources)

    const bookmarkedResource = matchingResources.find(
      (resource) => resource.type !== ResourceTypes.ANNOTATION
    )

    log.debug('bookmarked resource', bookmarkedResource)
    if (bookmarkedResource) {
      updateTab(tab.id, { resourceBookmark: bookmarkedResource.id })
    }

    const annotationResources = matchingResources.filter(
      (resource) => resource.type === ResourceTypes.ANNOTATION
    )

    await wait(500)

    annotationResources.forEach(async (annotationResource) => {
      const annotation = await annotationResource.getParsedData()
      log.debug('annotation data', annotation)

      if (annotation.type === 'highlight' && annotation.anchor.type === 'range') {
        const anchorData = annotation.anchor.data as AnnotationRangeData
        log.debug('highlight range', anchorData)
        browserTab.sendWebviewEvent(WebViewEventReceiveNames.RestoreHighlight, {
          id: annotationResource.id,
          range: anchorData
        })
      }
    })

    // if ($activeTabId === tab.id) {
    //   summarizePage(pageMagic)
    // }
  }

  async function handleWebviewTransform(e: CustomEvent<WebViewWrapperEvents['transform']>) {
    const { text, query, type } = e.detail
    log.debug('webview transformation', e.detail)

    let transformation = ''
    if (type === 'summarize') {
      transformation = await summarizeText(text, 'Be as concise as possible.')
    } else if (type === 'explain') {
      // @ts-expect-error
      transformation = await window.api.createAIChatCompletion(
        text,
        `Take the following text which has been extracted from a web page like a article or blog post and explain it so it is easily understandable for anyone. Try to be concise. Only respond with the explanation and make sure to escape any special characters in the response.`
      )
    } else if (type === 'translate') {
      // @ts-expect-error
      transformation = await window.api.createAIChatCompletion(
        text,
        `Take the following text which has been extracted from a web page like a article or blog post and translate it into English. If it is english already translate it into German. Stay as close to the original meaning as possible. Only respond with the translation and make sure to escape any special characters in the response.`
      )
    } else if (type === 'grammar') {
      // @ts-expect-error
      transformation = await window.api.createAIChatCompletion(
        text,
        `Take the following text which has been extracted from a web page like a article or blog post or document and fix all grammar mistakes as well as improve the writing. Stay as close to the original meaning as possible but change things were necessary you deem it necessary. Only respond with the improved text and make sure to escape any special characters in the response.`
      )
    } else {
      // @ts-expect-error
      transformation = await window.api.createAIChatCompletion(
        `User instruction: "${query}"\n\nOriginal text:\n${text}`,
        `Take the following text which has been extracted from a web page like a article or blog post and transform it based on the given user instruction or answer the user's question if it is one. Stick to the instruction as close as possible and generally try to be concise but keep true to the meaning. Only respond with the transformed text or your answer and make sure to escape any special characters in the response.`
      )
    }

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

  const highlightWebviewText = async (tabId: string, highlight: PageHighlight) => {
    const browserTab = $browserTabs[tabId]
    if (!browserTab) {
      log.error('Browser tab not found', tabId)
      return
    }

    const html = await browserTab.executeJavaScript(inlineHighlightTextCode(highlight))

    log.debug('HTML', html)
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

  const summarizePage = async (magicPage: PageMagic) => {
    let response: PageMagicResponse | null = null

    try {
      log.debug('Magic button clicked')

      const tab = $tabs.find((tab) => tab.id === magicPage.tabId)
      if (!tab) {
        log.error('Tab not found', magicPage.tabId)
        return
      }

      const browserTab = $browserTabs[tab.id]

      const detectedResource = await browserTab.detectResource()
      log.debug('extracted resource data', detectedResource)

      if (!detectedResource) {
        log.debug('no resource detected')
        return
      }

      response = {
        id: generateID(),
        role: 'system',
        query: 'Summary',
        status: 'pending',
        content: '',
        citations: {}
      } as PageMagicResponse

      updateMagicPage(magicPage.tabId, { running: true })
      addPageMagicResponse(magicPage.tabId, response)

      const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
      log.debug('content', content)

      log.debug('calling the AI')

      // if ($magicInputValue) {
      //   log.debug('user query', $magicInputValue)
      //   return
      // }

      // @ts-expect-error
      const output = await window.api.createAIChatCompletion(
        content.plain,
        'Take the following text which has been extracted from a web page like a article or blog post and generate a short summary for it that mentions the key take aways and the most important information Be as concise as possible. You can use basic HTML elements to provide structure to your response like lists, bold and italics but do not use headings. Separate the response into different paragraphs. Make sure to include inline citations in the response text using the citation element like this <citation style="background: {color};">{id}</citation>. Respond with a JSON object in the following format: `{ "content": "<html text response>", "citations": { "<id>": { "text": "<exact source text>", "color": "<unqiue color>" } } }`. The source text of the citation needs to be an exact match to a part of the original text and the IDs need to match the citations in your response. Use incrementing numbers as the IDs. Give each citation a unique pastel color.',
        { response_format: { type: 'json_object' } }
      )

      log.debug('Magic response', output)
      const json = JSON.parse(output)
      log.debug('json', json)

      if (!json.content || !json.citations) {
        log.debug('Invalid response')
        return
      }

      response = {
        ...response,
        status: 'success',
        content: json.content,
        citations: json.citations
      } as PageMagicResponse

      updatePageMagicResponse(magicPage.tabId, response.id, response)

      // add mark styles to the page
      await browserTab.executeJavaScript(inlineHighlightStylingCode())

      await Promise.all(
        Object.entries(json.citations).map(async ([id, citation]) => {
          await highlightWebviewText(tab.id, {
            type: 'important',
            color: (citation as any).color as string,
            text: (citation as any).text as string
          })
        })
      )

      log.debug('Magic done')
    } catch (e) {
      log.error('Error doing magic', e)
      if (response) {
        updatePageMagicResponse(magicPage.tabId, response.id, {
          status: 'error',
          content: (e as any).message ?? 'Failed to generate response.'
        })
      }
    } finally {
      updateMagicPage(magicPage.tabId, { running: false })
    }
  }

  const handleChatSubmit = async (magicPage: PageMagic) => {
    let response: AIChatMessageParsed | null = null
    const savedInputValue = $magicInputValue

    try {
      log.debug('Magic button clicked')

      if (!$magicInputValue) {
        log.debug('No input value')
        return
      }

      const tab = $tabs.find((tab) => tab.id === magicPage.tabId) as TabPage
      if (!tab) {
        log.error('Tab not found', magicPage.tabId)
        return
      }
      if (!tab.chatId) return
      if (!tab.chatResourceBookmark) return

      const browserTab = $browserTabs[tab.id]

      response = {
        id: generateID(),
        role: 'user',
        query: savedInputValue,
        status: 'pending',
        content: '',
        citations: {}
      } as AIChatMessageParsed

      updateMagicPage(magicPage.tabId, { running: true })
      addPageMagicResponse(magicPage.tabId, response)

      log.debug('calling the AI')
      let step = 'idle'
      let content = ''

      $magicInputValue = ''

      await sffs.sendAIChatMessage(
        tab.chatId,
        savedInputValue,
        (chunk: string) => {
          if (step === 'idle') {
            log.debug('sources chunk', chunk)

            content += chunk

            if (content.includes('</sources>')) {
              const sources = parseChatResponseSources(content)
              log.debug('Sources', sources)

              step = 'sources'
              content = ''

              updatePageMagicResponse(tab.id, response?.id ?? '', {
                sources
              })
            }
          } else {
            content += chunk

            updatePageMagicResponse(tab.id, response?.id!, {
              content: content
                .replace('<answer>', '')
                .replace('</answer>', '')
                .replace('<citation>', '')
                .replace('</citation>', '')
                .replace('<br>', '\n')
            })
          }
        },
        {
          limit: 3,
          resourceIds: [tab.chatResourceBookmark]
        }
      )

      updatePageMagicResponse(magicPage.tabId, response.id, { status: 'success' })
    } catch (e) {
      log.error('Error doing magic', e)
      $magicInputValue = savedInputValue
      if (response) {
        updatePageMagicResponse(magicPage.tabId, response.id, {
          content: (e as any).message ?? 'Failed to generate response.',
          status: 'error'
        })
      }
    } finally {
      updateMagicPage(magicPage.tabId, { running: false })
    }
  }

  const handleToggleMagicSidebar = async () => {
    const tab = $activeTab as TabPage | null

    if (!$activeTabMagic) return
    if (!tab) return

    if (!$activeTabMagic.showSidebar) {
      if (!tab?.chatId) {
        tab.chatId = await sffs.createAIChat('')
        // TODO: log this instead of silently failing
        if (!tab.chatId) return
        updateTab(tab.id, { chatId: tab.chatId })
      }

      if (!tab.chatResourceBookmark) {
        const detectedResource = await $activeBrowserTab.detectResource()
        log.debug('extracted resource data', detectedResource)

        if (!detectedResource) {
          log.debug('no resource detected')
          return
        }

        const resource = await resourceManager.createResourceOther(
          // :doom:
          new Blob([JSON.stringify(detectedResource.data)], {
            //type: `${detectedResource.type}.ignore`
            type: `${detectedResource.type}`
          }),
          { name: $activeTab?.title ?? '', sourceURI: $activeTabLocation ?? '', alt: '' }
        )

        log.debug('created resource', resource)

        updateTab(tab.id, { chatResourceBookmark: resource.id })
      }
    }

    updateMagicPage($activeTabId, { showSidebar: !$activeTabMagic.showSidebar })

    /*
    if ($activeTabMagic.responses.length === 0 && !$activeTabMagic.running) {
      summarizePage($activeTabMagic)
    }
    */
  }

  const saveTextFromPage = async (text: string) => {
    const resource = await resourceManager.createResourceNote(text, {
      name: 'Magic Response',
      sourceURI: $activeTabLocation ?? '',
      alt: ''
    })

    log.debug('created resource', resource)
  }

  const handleWebviewHighlight = async (
    e: CustomEvent<WebViewWrapperEvents['highlight']>,
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

    const { range, url } = e.detail
    log.debug('webview highlight', url, range)

    let bookmarkedResource = tab.resourceBookmark

    if (!bookmarkedResource) {
      log.debug('no bookmarked resource')

      const resource = await bookmarkPage(tab)
      bookmarkedResource = resource.id
    }

    const annotationResource = await resourceManager.createResourceAnnotation(
      {
        type: 'highlight',
        anchor: {
          type: 'range',
          data: range
        },
        data: {}
      },
      { sourceURI: url },
      [
        // link the annotation to the page using its canonical URL so we can later find it
        ResourceTag.canonicalURL(url),

        // link the annotation to the bookmarked resource
        ResourceTag.annotates(bookmarkedResource)
      ]
    )

    log.debug('created annotation resource', annotationResource)

    log.debug('highlighting text in webview')
    browserTab.sendWebviewEvent(WebViewEventReceiveNames.RestoreHighlight, {
      id: annotationResource.id,
      range: range
    })
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

  const openResource = async (id: string) => {
    $sidebarTab = 'oasis'

    await tick()

    drawer.openItem(id)
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

    const tabsList = await tabsDB.all()
    tabs.set(tabsList)

    log.debug('Tabs loaded', tabsList)

    // TODO: for safety we wait a bit before we tell the app that we are ready, we need a better way to do this
    setTimeout(() => {
      // @ts-expect-error
      window.api.appIsReady()
    }, 2000)

    const activeTabs = tabsList.filter((tab) => !tab.archived)
    if (activeTabs.length === 0) {
      createNewEmptyTab()
    } else if (!$activeTabId) {
      activeTabId.set(activeTabs[activeTabs.length - 1].id)
    }
  })
</script>

<SplashScreen />

<svelte:window on:keydown={handleKeyDown} />

<div class="app-wrapper">
  <div class="sidebar">
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
      <div class="tabs">
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
                  disabled={$activeTab?.type !== 'page' && $activeTab?.type !== 'chat'}
                  bind:value={$addressValue}
                  on:blur={handleBlur}
                  on:focus={handleFocus}
                  type="text"
                  placeholder={$activeTab?.type === 'page'
                    ? 'Search or Enter URL'
                    : $activeTab?.type === 'chat'
                      ? 'Chat Title'
                      : 'Empty Tab'}
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
                      position: 'bottom',
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
                      <Icon name="bookmark" />
                    {/if}
                  </button>
                {/key}
              {/if}
            </div>
          </div>
        </div>

        {#each $tabsInView as tab (tab.id)}
          {#if tab.type === 'chat'}
            <TabItem
              {tab}
              {activeTabId}
              {archiveTab}
              {deleteTab}
              {unarchiveTab}
              on:select={handleTabSelect}
            />
          {/if}
        {/each}

        <div class="divider"></div>

        {#each $tabsInView as tab (tab.id)}
          {#if tab.type !== 'chat'}
            <TabItem
              {tab}
              {activeTabId}
              {archiveTab}
              {deleteTab}
              {unarchiveTab}
              on:select={handleTabSelect}
            />
          {/if}
        {/each}
      </div>

      <div class="actions">
        <button
          on:click={() => {
            $sidebarTab = 'oasis'
            toggleOasis()
          }}
          use:tooltip={{
            content: 'Open Oasis (⌘ + O)',
            action: 'hover',
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          <Icon name="leave" />
        </button>
        <!--
        <button
          on:click|preventDefault={handleNewHorizon}
          use:tooltip={{
            content: 'New Horizon (⌘ + N)',
            action: 'hover',
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          <Icon name="layout-grid-add" />
        </button>
        -->
        <button
          on:click|preventDefault={() => createNewEmptyTab()}
          use:tooltip={{
            content: 'New Tab (⌘ + T)',
            action: 'hover',
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          <Icon name="add" />
        </button>
      </div>
    {:else}
      <OasisSidebar {resourceManager} {sidebarTab} {selectedFolder} />
    {/if}
  </div>

  <div class="browser-window-wrapper" class:hasNoTab={!$activeBrowserTab}>
    {#if $sidebarTab === 'oasis'}
      <div class="browser-window active" style="--scaling: 1;">
        {#if $masterHorizon}
          <DrawerWrapper bind:drawer horizon={$masterHorizon} {resourceManager} {selectedFolder} />
        {:else}
          <div>Should not happen error: Failed to load main Horizon</div>
        {/if}
      </div>
    {/if}

    {#each $activeTabs as tab (tab.id)}
      <div
        class="browser-window"
        style="--scaling: 1;"
        class:active={$activeTabId === tab.id}
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
            on:transform={handleWebviewTransform}
            on:appDetection={(e) => handleWebviewAppDetection(e, tab)}
            on:inlineTextReplace={(e) => handleWebviewInlineTextReplace(e, tab.id)}
            on:highlight={(e) => handleWebviewHighlight(e, tab.id)}
            on:annotationClick={(e) => handleWebviewAnnotationClick(e, tab.id)}
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
            {drawer}
            db={storage}
            on:navigate={(e) => createPageTab(e.detail.url, e.detail.active)}
            on:updateTab={(e) => updateTab(tab.id, e.detail)}
            on:openResource={(e) => openResource(e.detail)}
          />
        {:else if tab.type === 'importer'}
          <Importer {resourceManager} />
        {:else}
          <BrowserHomescreen
            {historyEntriesManager}
            on:navigate={handleTabNavigation}
            on:chat={handleCreateChat}
            on:rag={handleRag}
          />
        {/if}
      </div>
    {/each}

    {#if $activeTab && $activeTab?.archived}
      <div class="browser-window active" style="--scaling: 1;">
        {#if $activeTab?.type === 'page'}
          <BrowserTab
            bind:this={$browserTabs[$activeTabId]}
            tab={$activeTab}
            active
            {historyEntriesManager}
            on:newTab={handleNewTab}
            on:navigation={(e) => handleWebviewTabNavigation(e, $activeTab)}
            on:bookmark={handleWebviewBookmark}
            on:transform={handleWebviewTransform}
            on:appDetection={(e) => handleWebviewAppDetection(e, $activeTab)}
            on:inlineTextReplace={(e) => handleWebviewInlineTextReplace(e, $activeTab.id)}
            on:highlight={(e) => handleWebviewHighlight(e, $activeTab.id)}
            on:annotationClick={(e) => handleWebviewAnnotationClick(e, $activeTab.id)}
          />
        {:else if $activeTab?.type === 'horizon'}
          {@const horizon = $horizons.find((horizon) => horizon.id === $activeTab?.horizonId)}
          {#if horizon}
            <Horizon {horizon} active {visorSearchTerm} inOverview={false} {resourceManager} />
          {:else}
            <div>no horizon found</div>
          {/if}
        {:else if $activeTab?.type === 'chat'}
          <Chat
            tab={$activeTab}
            {resourceManager}
            {drawer}
            db={storage}
            on:navigate={(e) => createPageTab(e.detail.url, e.detail.active)}
            on:updateTab={(e) => updateTab($activeTabId, e.detail)}
            on:openResource={(e) => openResource(e.detail)}
          />
        {:else}
          <BrowserHomescreen
            {historyEntriesManager}
            on:navigate={handleTabNavigation}
            on:chat={handleCreateChat}
            on:rag={handleRag}
          />
        {/if}
      </div>
    {/if}

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

    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->

    {#if $activeTabMagic}
      <div class="sidebar-magic-toggle" on:click={handleToggleMagicSidebar}>
        {#if $activeTabMagic.showSidebar}
          <Icon name="close" />
        {:else if $activeTabMagic.running}
          <Icon name="spinner" />
        {:else}
          <Icon name="sparkles" />
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
        on:saveText={(e) => saveTextFromPage(e.detail)}
        on:chat={() => handleChatSubmit($activeTabMagic)}
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
    flex-shrink: 0;
    width: var(--sidebar-width-left);
    height: 100vh;
    padding: 0.5rem 0.75rem 0.75rem 0.75rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
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
    background: rgba(255, 255, 255, 0.9);
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
    flex: 1;
    overflow: auto;
    margin-top: 2rem;
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
    margin-bottom: -22px;
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
</style>
