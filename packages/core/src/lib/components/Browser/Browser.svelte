<script lang="ts">
  import { onMount, tick } from 'svelte'
  import SplashScreen from '../SplashScreen.svelte'
  import { writable, derived } from 'svelte/store'
  import WebviewWrapper from '../Cards/Browser/WebviewWrapper.svelte'
  import { HistoryEntriesManager } from '../../service/history'
  import { useLogScope } from '../../utils/log'
  import { Icon } from '@horizon/icons'
  import { generateID } from '../../utils/id'
  import { parseStringIntoBrowserLocation, parseStringIntoUrl } from '../../utils/url'
  import { isModKeyAndKeyPressed, isModKeyPressed } from '../../utils/keyboard'
  import { copyToClipboard } from '../../utils/clipboard'
  import { getChatData } from './examples'
  import { writableAutoReset } from '../../utils/time'
  import { Telemetry } from '../../service/telemetry'
  import { ResourceManager, type ResourceObject } from '../../service/resources'
  import { type Horizon as HorizonClass, HorizonsManager } from '../../service/horizon'
  import { API } from '../../service/api'
  import BrowserTab, { type NewTabEvent } from './BrowserTab.svelte'
  import Horizon from '../Horizon/Horizon.svelte'
  import BrowserHomescreen from './BrowserHomescreen.svelte'

  import '../Horizon/index.scss'
  import type { Tab, TabChat, TabEmpty, TabHorizon, TabPage } from './types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../Cards/Browser/searchEngines'
  import DrawerWrapper from '../Horizon/DrawerWrapper.svelte'
  import type { Drawer } from '@horizon/drawer'
  import Chat from './Chat.svelte'
  import { HorizonDatabase } from '../../service/storage'
  import type { Optional } from '../../types'
  import { useLocalStorageStore } from '../../utils/localstorage'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'

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
  const sidebarTab = writable<'active' | 'archive'>('active')
  const browserTabs = writable<Record<string, BrowserTab>>({})
  const bookmarkingInProgress = writable(false)

  const bookmarkingSuccess = writableAutoReset(false, 1000)

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
      const horizon = $horizons.find((horizon) => horizon.id === tab.id)
      if (horizon) {
        addressValue.set(horizon.data.name)
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

  $: log.debug('Active Tab', $activeTab?.createdAt)
  $: log.debug(
    'Tabs',
    $tabs.find((tab) => tab.id === $activeTabId)
  )

  const resetActiveTab = () => {
    const tabsInView = $tabs.filter((tab) =>
      $sidebarTab === 'active' ? !tab.archived : tab.archived
    )
    const newActiveTabId = tabsInView[0]?.id
    if (!newActiveTabId) {
      log.error('No active tab found')
      return
    }
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
    await persistTabChanges(tabId, updates)
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
  }

  const closeActiveTab = async () => {
    if (!$activeTab) {
      log.error('No active tab')
      return
    }

    if ($activeTab.archived) {
      await deleteTab($activeTab.id)
    } else {
      await archiveTab($activeTab.id)
    }

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

  const handleBlur = () => {
    addressBarFocus = false

    if (!$addressValue) {
      return
    }

    if ($activeTab?.type === 'horizon') {
      const horizon = $horizons.find((horizon) => horizon.id === $activeTabId)
      if (horizon) {
        horizon.updateData({ name: $addressValue })

        updateTab(horizon.id, { title: $addressValue })
      }
    } else if ($activeTab?.type === 'page') {
      log.debug('Navigating to address', $addressValue)
      const url = getNavigationURL($addressValue)
      $activeBrowserTab.navigate(url)

      // if (url === $activeTabLocation) {
      //     $activeBrowserTab.reload()
      // } else {
      //     updateActiveTab({ initialLocation: url })
      // }
    } else if ($activeTab?.type === 'empty') {
      log.debug('Navigating to address', $addressValue)
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
      icon: 'https://deta.space/favicon.png',
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

  const handleNewTab = (e: CustomEvent<NewTabEvent>) => {
    const { url, active } = e.detail

    if (url) {
      createPageTab(url, active)
    } else {
      createNewEmptyTab()
    }
  }

  const handleOrganize = async () => {
    try {
      loadingOrganize.set(true)
      log.debug('Organizing tabs', $tabs)

      const prompt = `You organize tabs given to you into as few sections as possible. Come up with simple and short but clear section names and move the tabs into the right sections. Try to not change existing sections unless necessary and avoid putting a single tab into its own section. The tabs are given to you are formatted as JSON array with each item having the tab title, url and optional section if it is part of it already. Respond with the sections as JSON keys and the tabs in each section as a list of tab IDs as the value. Only respond with JSON.`
      // @ts-ignore
      const response = await window.api.createAIChatCompletion(
        `Organize these tabs:\n${JSON.stringify(
          $tabs.map((tab) => ({
            id: tab.id,
            title: tab.title,
            url: tab.initialLocation,
            ...(tab.section !== '_all' && tab.section !== 'Unorganised'
              ? { section: tab.section }
              : {})
          })),
          null,
          2
        )}`,
        prompt
      )

      log.debug('Organize response', response)

      const json = JSON.parse(response)
      log.debug('Organize response JSON', json)

      tabs.update((tabs) => {
        const updatedTabs = tabs.map((tab) => {
          const section = Object.keys(json).find((section) => json[section].includes(tab.id))
          if (section) {
            return {
              ...tab,
              section
            }
          }
          return tab
        })

        return updatedTabs
      })
    } catch (err) {
      log.error('Error organizing tabs', err)
    } finally {
      loadingOrganize.set(false)
    }
  }

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

  async function handleBookmark() {
    try {
      if (!$activeTabLocation || $activeTab?.type !== 'page') return

      if ($activeTab.resourceBookmark) {
        log.debug('already bookmarked', $activeTab.resourceBookmark)
        drawer.openItem($activeTab.resourceBookmark)
        return
      }

      log.debug('bookmarking', $activeTabLocation)
      bookmarkingInProgress.set(true)

      const detectedResource = await $activeBrowserTab.detectResource()
      log.debug('extracted resource data', detectedResource)

      if (!detectedResource) {
        log.debug('no resource detected')
        return
      }

      const resource = await resourceManager.createResourceOther(
        new Blob([JSON.stringify(detectedResource.data)], { type: detectedResource.type }),
        { name: $activeTab?.title ?? '', sourceURI: $activeTabLocation, alt: '' }
      )

      log.debug('created resource', resource)

      if ($activeTab.type === 'page') updateActiveTab({ resourceBookmark: resource.id })

      // automatically resets after some time
      bookmarkingSuccess.set(true)
    } catch (e) {
      log.error('error creating resource', e)
    } finally {
      bookmarkingInProgress.set(false)
    }
  }

  function handleWebviewTabNavigation(e: CustomEvent<string>, tab: Tab) {
    log.debug('webview navigation', e.detail, tab)

    updateTab(tab.id, { resourceBookmark: null })
  }

  function handleCreateChat(e: CustomEvent<string>) {
    log.debug('create chat', e.detail)

    updateActiveTab({ type: 'chat', query: e.detail, title: e.detail, icon: '' })
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

    // setTimeout(() => {
    //     async function runTabs() {
    //         for (const tab of $tabs) {
    //             activeTabId.set(tab.id)
    //             await wait(1000)
    //         }
    //     }

    //     runTabs()
    // }, 4000)
  })
</script>

<SplashScreen />

<svelte:window on:keydown={handleKeyDown} />

{#if $masterHorizon}
  <DrawerWrapper bind:drawer horizon={$masterHorizon} {resourceManager} />
{:else}
  <div>Should not happen error: Failed to load main Horizon</div>
{/if}

<div class="app-wrapper">
  <div class="sidebar">
    <!-- <h1>Horizon Browser</h1> -->

    <div class="tab-selector">
      <button
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
      </button>
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
    </div>

    {#if $activeBrowserTab}
      <div class="actions nav-buttons">
        <button
          class="nav-button"
          disabled={!canGoBack}
          on:click={$activeBrowserTab?.goBack}
          use:tooltip={{
            content: 'Go Back',
            action: 'hover',
            position: 'top',
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
            position: 'top',
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
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          <Icon name="reload" />
        </button>
      </div>
    {/if}

    <div class="tabs">
      <!-- {#each $tabs as tab, idx (tab.id)}
                svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events
                <div
                    class="tab"
                    class:selected={tab.id === $activeTabId}
                    on:click={() => ($activeTabId = tab.id)}
                >
                    <img src={tab.favicon} alt={tab.title} />
                    {tab.title}
                </div>
            {/each} -->

      {#each $tabsInView as tab (tab.id)}
        <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
        <div
          class="tab"
          class:selected={tab.id === $activeTabId}
          on:click={() => ($activeTabId = tab.id)}
        >
          {#if tab.icon}
            <div class="icon-wrapper">
              <Image src={tab.icon} alt={tab.title} fallbackIcon="world" />
            </div>
          {:else if tab.type === 'chat'}
            <div class="icon-wrapper">
              <Icon name="sparkles" size="20px" />
            </div>
          {:else}
            <div class="icon-wrapper">
              <Icon name="world" size="20px" />
            </div>
          {/if}

          <div class="title">
            {tab.title}
          </div>

          {#if tab.archived}
            <button
              on:click|stopPropagation={() => unarchiveTab(tab.id)}
              class="close"
              use:tooltip={{
                content: 'Move back to active tabs',
                action: 'hover',
                position: 'left',
                animation: 'fade',
                delay: 500
              }}
            >
              <Icon name="arrowbackup" size="20px" />
            </button>
          {/if}

          <button
            on:click|stopPropagation={() => (tab.archived ? deleteTab(tab.id) : archiveTab(tab.id))}
            class="close"
            use:tooltip={{
              content: tab.archived ? 'Delete this tab (⌘ + W)' : 'Archive this tab (⌘ + W)',
              action: 'hover',
              position: 'left',
              animation: 'fade',
              delay: 500
            }}
          >
            {#if tab.archived}
              <Icon name="trash" size="20px" />
            {:else}
              <Icon name="close" size="20px" />
            {/if}
          </button>
        </div>
      {/each}
    </div>

    <div class="actions">
      <!-- <button on:click|preventDefault={handleOrganize}>
                {#if $loadingOrganize}
                    <Icon name="spinner" />
                {:else}
                    <Icon name="sparkles" />
                {/if}
            </button> -->
      <button
        on:click|preventDefault={() => toggleOasis()}
        use:tooltip={{
          content: 'Oasis (⌘ + O)',
          action: 'hover',
          position: 'top',
          animation: 'fade',
          delay: 500
        }}
      >
        <Icon name="leave" />
      </button>
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

    <div class="bar-wrapper">
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
            style="z-index: 100000;"
            use:tooltip={{
              content: $activeTab?.resourceBookmark
                ? 'Open bookmark (⌘ + D)'
                : 'Bookmark this page (⌘ + D)',
              action: 'hover',
              position: 'right',
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

    <!-- <div class="page-actions">
            <button
              class="nav-button icon-button"
              on:click={handleBookmark}
            >
                {#if $bookmarkingInProgress}
                    <Icon name="spinner" size="15px" />
                {:else if $bookmarkingSuccess}
                    <Icon name="check" size="15px" />
                    <p>Saved to Oasis!</p>
                {:else}
                    <Icon name="bookmark" size="15px" />
                {/if}
            </button>
        </div> -->
  </div>

  <div class="browser-window-wrapper">
    {#each $activeTabs as tab (tab.id)}
      <div class="browser-window" style="--scaling: 1;" class:active={$activeTabId === tab.id}>
        {#if tab.type === 'page'}
          <BrowserTab
            bind:this={$browserTabs[tab.id]}
            bind:tab={$tabs[$tabs.findIndex((t) => t.id === tab.id)]}
            active={$activeTabId === tab.id}
            {historyEntriesManager}
            on:newTab={handleNewTab}
            on:navigation={(e) => handleWebviewTabNavigation(e, tab)}
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
          />
        {:else}
          <BrowserHomescreen
            {historyEntriesManager}
            on:navigate={handleTabNavigation}
            on:chat={handleCreateChat}
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
          />
        {:else}
          <BrowserHomescreen
            {historyEntriesManager}
            on:navigate={handleTabNavigation}
            on:chat={handleCreateChat}
          />
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .app-wrapper {
    display: flex;
    // flex-direction: row-reverse;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #fcfcfc;
  }

  .sidebar {
    width: 380px;
    height: 100vh;
    padding: 0.5rem 0.75rem 0.75rem 0.75rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .browser-window-wrapper {
    padding: 0.5rem;
    padding-left: 0;
    height: 100vh;
    width: 100%;
  }

  .browser-window {
    height: 100%;
    width: 100%;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    position: absolute;
    top: 0;
    opacity: 0;

    &.active {
      z-index: 1;
      position: relative;
      opacity: 100%;
    }
  }

  .bar-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 0.75rem;

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

      background-color: #e4e4e4;
      padding: 10px;

      &:hover {
        background: rgb(220, 220, 220);
      }
    }
  }

  .search {
    flex: 1;
    width: 100%;
  }

  input {
    width: 100%;
    padding: 10px 100px 10px 10px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 1rem;
    background-color: #e4e4e4;
    color: #3f3f3f;

    &:hover {
      background: rgb(220, 220, 220);
    }

    &:focus {
      outline: none;
      border-color: #f73b95;
      color: #000;
      background-color: #ffffff;
    }
  }

  .tabs {
    flex: 1;
    overflow: auto;
    margin-top: 2rem;
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

  .tab {
    display: flex;
    align-items: center;
    padding: 10px;
    border-radius: 5px;
    cursor: pointer;
    gap: 10px;
    position: relative;

    .icon-wrapper {
      width: 20px;
      height: 20px;
      display: block;
    }

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
      background-color: #ffd6ed;
    }
  }

  .actions {
    margin-top: 10px;
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
        background-color: #e4e4e4;
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
        background: rgb(220, 220, 220);
      }
    }
  }

  .nav-buttons {
    position: absolute;
    z-index: 10000;
    bottom: 16px;
    left: 162px;
  }

  .page-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 10px;
    background-color: #e4e4e4;
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
    width: calc(100% + 10px);
    display: flex;
    align-items: center;
    margin-bottom: -22px;
    margin-left: -10px;
    padding-left: 16rem;

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
</style>
