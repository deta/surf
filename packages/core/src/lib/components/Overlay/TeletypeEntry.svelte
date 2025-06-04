<script lang="ts" context="module">
  // prettier-ignore
  export type TeletypeEntryEvents = {
    'ask': string | undefined
    'open-url': string
    'open-url-in-minibrowser': string
    'open-resource-in-minibrowser': string
    'open-space': any
    'open-stuff': string
    'create-chat': string
    'activate-tab': string
    'close-active-tab': void
    'toggle-bookmark': void
    'toggle-sidebar': void
    'show-history-tab': void
    'zoom-in': void
    'zoom-out': void
    'reset-zoom': void
    'create-note': string | undefined
    'reload': void
    'create-new-space': void
  };
</script>

<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte'
  import { get, writable, derived } from 'svelte/store'
  import { TeletypeProvider, Teletype, type TeletypeSystem } from '@deta/teletype/src'
  import { ChangeContextEventTrigger, CreateTabEventTrigger } from '@horizon/types'
  import NewFeatureDialog from '../Onboarding/Dialog/NewFeatureDialog.svelte'
  import FloatyButton from '../Atoms/FloatyButton.svelte'
  import { Icon } from '@horizon/icons'
  import { versions, completedFeatures, showFeatureModal } from '../Onboarding/featured'

  import DesktopPreview from '../Chat/DesktopPreview.svelte'

  import {
    copyToClipboard,
    parseStringIntoBrowserLocation,
    useCancelableDebounce,
    useLogScope
  } from '@horizon/utils'
  import { type HandlerAction, type ParentAction } from '@deta/teletype/src'
  import { useCommandComposer } from '../Overlay/service/commandComposer'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { useConfig } from '../../service/config'
  import { Resource, useResourceManager } from '../../service/resources'
  import { teletypeActionStore, TeletypeAction } from './service/teletypeActions'
  import { useTabsManager } from '../../service/tabs'
  import type {
    TeletypeActionEvent,
    TeletypeActionHandler,
    TeletypeActionHandlerReturnValue
  } from './service/teletypeActions'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../../constants/searchEngines'
  import {
    optimisticCheckIfURLOrIPorFile,
    optimisticCheckIfUrl,
    prependProtocol
  } from '@horizon/utils'

  import { createActionsFromResults } from './horizontal'
  import TeletypeHeader from './TeletypeHeader.svelte'
  import TeletypeIconRenderer from './TeletypeIconRenderer.svelte'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { type HistoryEntry, type Tab } from '@horizon/core/src/lib/types'

  export let open: boolean

  const log = useLogScope('TeletypeEntry')
  const config = useConfig()
  const oasis = useOasis()
  const toasts = useToasts()
  const tabsManager = useTabsManager()
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<TeletypeEntryEvents>()
  const commandComposer = useCommandComposer(oasis, config, tabsManager)
  const userConfigSettings = config.settings

  const selectedSpace = oasis.selectedSpace

  let teletype: TeletypeSystem
  let unsubscribe: () => void

  const showWhatsNew = showFeatureModal
  const inputValue = writable('')
  const showActionsPanel = writable(false)

  const hasUntriedFeatures = derived(completedFeatures, ($completedFeatures) =>
    versions.some((v) => !$completedFeatures.includes(v.featureID))
  )

  const searchEngine = writable($userConfigSettings.search_engine)

  // Static actions that are always available
  const staticActions: (HandlerAction | ParentAction)[] = [
    {
      id: 'create',
      name: 'Create New...',
      icon: 'add',
      childActions: [],
      hiddenOnRoot: true
    },
    {
      id: 'ask',
      name: 'Ask Current Page',
      icon: 'face',
      hiddenOnRoot: true,
      handler: () => {
        dispatch('ask')
      }
    }
  ]

  $: if (open) {
    teletype?.open()
  } else {
    teletype?.close()
  }

  const handleInput = (e: CustomEvent) => {
    const input = e.detail
    inputValue.set(input)
  }

  const handleShowActionPanel = (event: CustomEvent<boolean>) => {
    showActionsPanel.set(event.detail)
  }
  const handleSearch = async (value: string) => {
    log.debug('Search:', value)
    const askActions = get(commandComposer.askActions)
    const stuffActions = get(commandComposer.stuffActions)
    const createActions = get(commandComposer.createActionsTeletype)

    const createChildActions = createActions.map((action) => ({
      id: action.id,
      name: action.name,
      description: action.description,
      icon: action.icon,
      keywords: action.keywords,
      section: 'Create',
      component: action.component,
      view: action.view,
      handler: async (_: any, tt: any) => {
        try {
          const result = action
          await result.handler?.(result)
          tt.closeWithSuccess(`Created ${result.name}`)
        } catch (error) {
          log.error('Failed to execute create action:', error)
          tt.showError(`Failed to create: ${error.message}`)
        }
      }
    }))

    const updatedStaticActions = staticActions.map((action) =>
      action.id === 'create' ? { ...action, childActions: createChildActions } : action
    )

    teletype.setLoading(true)
    try {
      if (value) {
        commandComposer.updateSearchValue(value)
        const searchResults = get(commandComposer.defaultActionsTeletype)
        const dynamicActions = await createActionsFromResults(searchResults, resourceManager, oasis)
        await tick()

        teletype.setActions([
          ...stuffActions,
          ...updatedStaticActions,
          ...dynamicActions,
          ...askActions
        ])
      } else {
        teletype.setActions(updatedStaticActions)
      }
    } finally {
      teletype.setLoading(false)
    }
  }

  const searchDebounce = useCancelableDebounce(handleSearch, 100)

  $: {
    if (teletype?.inputValue) {
      teletype.inputValue.subscribe((value: string) => {
        searchDebounce.execute(value)
      })
    }
  }

  // Event handlers for each action type
  const handleGeneralSearch: TeletypeActionHandler<{ query: string }> = (payload) => {
    const isValidURL =
      optimisticCheckIfURLOrIPorFile(payload.query) || optimisticCheckIfUrl(payload.query)
    if (isValidURL) {
      dispatch('open-url', prependProtocol(payload.query))
    } else {
      const engine =
        SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
        SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
      if (!engine) throw new Error('No search engine / default engine found, config error?')
      log.debug('engine', engine)
      dispatch('open-url', engine.getUrl(encodeURIComponent(payload.query)))
    }
  }

  const handleOpenGeneralSearchInMiniBrowser: TeletypeActionHandler<{ query: string }> = (
    payload
  ) => {
    const isValidURL =
      optimisticCheckIfURLOrIPorFile(payload.query) || optimisticCheckIfUrl(payload.query)
    if (isValidURL) {
      dispatch('open-url-in-minibrowser', prependProtocol(payload.query))
    } else {
      const engine =
        SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
        SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
      if (!engine) throw new Error('No search engine / default engine found, config error?')
      log.debug('engine', engine)
      dispatch('open-url-in-minibrowser', engine.getUrl(encodeURIComponent(payload.query)))
    }
  }

  const handleCopyGeneralSearch: TeletypeActionHandler<{ query: string }> = (payload) => {
    const isValidURL =
      optimisticCheckIfURLOrIPorFile(payload.query) || optimisticCheckIfUrl(payload.query)
    if (isValidURL) {
      copyToClipboard(prependProtocol(payload.query))
      toasts.success('Copied URL to clipboard!')
    } else {
      const engine =
        SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
        SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
      if (!engine) throw new Error('No search engine / default engine found, config error?')
      copyToClipboard(engine.getUrl(encodeURIComponent(payload.query)))
      toasts.success('Copied URL to clipboard!')
    }
  }

  const handleNavigate: TeletypeActionHandler<{ url: string }> = (payload) => {
    const validUrl = parseStringIntoBrowserLocation(payload.url)
    if (!validUrl) {
      log.error('Invalid URL:', payload.url)
      return
    }

    dispatch('open-url', validUrl)
  }

  const handleOpenURLInMiniBrowser: TeletypeActionHandler<{ url: string }> = (payload) => {
    const validUrl = parseStringIntoBrowserLocation(payload.url)
    if (!validUrl) {
      log.error('Invalid URL:', payload.url)
      return
    }

    dispatch('open-url-in-minibrowser', validUrl)
  }

  const handleOpenResourceInMiniBrowser: TeletypeActionHandler<{ resource: Resource }> = (
    payload
  ) => {
    dispatch('open-resource-in-minibrowser', payload.resource.id)
  }

  const handleOpenSuggestionAsTab: TeletypeActionHandler<{ suggestion: string }> = (payload) => {
    const engine =
      SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
      SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
    if (!engine) throw new Error('No search engine / default engine found, config error?')

    dispatch('open-url', engine.getUrl(encodeURIComponent(payload.suggestion)))
  }

  const handleCopySuggestion: TeletypeActionHandler<{ suggestion: string }> = async (payload) => {
    const engine =
      SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
      SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
    if (!engine) throw new Error('No search engine / default engine found, config error?')

    copyToClipboard(engine.getUrl(encodeURIComponent(payload.suggestion)))
    toasts.success('Copied URL to clipboard!')
  }

  const handleOpenSuggestionInMiniBrowser: TeletypeActionHandler<{ suggestion: string }> = (
    payload
  ) => {
    const engine =
      SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
      SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
    if (!engine) throw new Error('No search engine / default engine found, config error?')

    dispatch('open-url-in-minibrowser', engine.getUrl(encodeURIComponent(payload.suggestion)))
  }

  const handleCopyURL: TeletypeActionHandler<{ url: string }> = async (payload) => {
    copyToClipboard(payload.url)
    toasts.success('Copied URL to clipboard!')

    return {
      preventClose: true
    }
  }

  const handleHistory: TeletypeActionHandler<{ entry: HistoryEntry }> = (payload) => {
    dispatch('open-url', payload.entry.url ?? '')
  }

  const handleSuggestionHostname: TeletypeActionHandler<{ entry: HistoryEntry }> = (payload) => {
    dispatch('open-url', payload.entry.url ?? '')
  }

  const handleResource: TeletypeActionHandler<{ resource: Resource }> = async (payload) => {
    await tabsManager.openResourceAsTab(payload.resource, {
      active: true,
      trigger: CreateTabEventTrigger.AddressBar
    })
  }

  const handleTab: TeletypeActionHandler<{ tab: Tab }> = (payload) => {
    dispatch('activate-tab', payload.tab.id)
  }

  const handleOpenSpaceInStuff: TeletypeActionHandler<{ space: OasisSpace }> = async (payload) => {
    const space = payload.space
    log.debug('open-space-in-stuff', payload)

    oasis.selectedSpace.set(space.id)
    await tick()
    tabsManager.showNewTabOverlay.set(2)

    return {
      preventClose: true
    }
  }

  const handleOpenSpaceAsContext: TeletypeActionHandler<{ space: OasisSpace }> = async (
    payload
  ) => {
    const space = payload.space
    log.debug('open-space-as-context', payload)

    tabsManager.changeScope(space.id, ChangeContextEventTrigger.CommandMenu)
  }

  const handleOpenSpaceAsTab: TeletypeActionHandler<{ space: OasisSpace }> = async (payload) => {
    const space = payload.space
    log.debug('open-space-as-tab', payload)

    tabsManager.addSpaceTab(space, {
      active: true,
      trigger: CreateTabEventTrigger.AddressBar
    })
  }

  const handleOpenStuff: TeletypeActionHandler<{ searchValue: string }> = (
    payload,
    searchValue
  ) => {
    log.debug('open-stuff', searchValue)
    dispatch('open-stuff', searchValue || '')

    return {
      preventClose: true
    }
  }

  const handleBrowserCommand: TeletypeActionHandler<{ command: string }> = (payload) => {
    if (payload.command === 'create-chat') {
      dispatch('create-chat', get(teletype?.inputValue))
    } else {
      // TODO: properly type the browser commands
      dispatch(payload.command as keyof TeletypeEntryEvents)
    }
  }

  const handleAsk: TeletypeActionHandler<{}> = () => {
    dispatch('ask', get(teletype?.inputValue))
  }

  const handleCreateSpace: TeletypeActionHandler<{}> = () => {
    dispatch('create-new-space')

    return {
      preventClose: true
    }
  }

  const handleCreate: TeletypeActionHandler<{ id: string; url: string }> = (payload) => {
    const validUrl = parseStringIntoBrowserLocation(payload.url)
    if (!validUrl) {
      log.error('Invalid URL:', payload.url)
      return
    }

    dispatch('open-url', validUrl)
  }

  const handleRemoveHostnameSuggestion = async (payload: { entry: HistoryEntry }) => {
    try {
      const entries = await resourceManager.findHistoryEntriesByHostname(payload.entry.url || '')
      for (const entry of entries) {
        await resourceManager.deleteHistoryEntry(entry.id)
      }

      teletype.close()
    } catch (error) {
      log.error('Failed to delete history entries:', error)
    }
  }

  const handleShowCreate = async () => {
    if (teletype) {
      teletype.executeAction('create')
      teletype.open()
      await tick()
      const inputElem = document.getElementById(`teletype-input-default`)
      inputElem?.focus()
    }
  }

  const handleTeletypeClose = () => {
    if (teletype) {
      tabsManager.showNewTabOverlay.set(0)
    }
  }

  onMount(() => {
    const handlers = {
      [TeletypeAction.NavigateGeneralSearch]: handleGeneralSearch,
      [TeletypeAction.NavigateURL]: handleNavigate,
      [TeletypeAction.OpenURLInMiniBrowser]: handleOpenURLInMiniBrowser,
      [TeletypeAction.OpenGeneralSearchInMiniBrowser]: handleOpenGeneralSearchInMiniBrowser,
      [TeletypeAction.OpenSuggestionInMiniBrowser]: handleOpenSuggestionInMiniBrowser,
      [TeletypeAction.OpenResourceInMiniBrowser]: handleOpenResourceInMiniBrowser,
      [TeletypeAction.NavigateSuggestion]: handleOpenSuggestionAsTab,
      [TeletypeAction.NavigateHistoryElement]: handleHistory,
      [TeletypeAction.NavigateSuggestionHostname]: handleSuggestionHostname,
      [TeletypeAction.OpenResource]: handleResource,
      [TeletypeAction.OpenTab]: handleTab,
      [TeletypeAction.OpenSpaceInStuff]: handleOpenSpaceInStuff,
      [TeletypeAction.OpenSpaceAsContext]: handleOpenSpaceAsContext,
      [TeletypeAction.OpenSpaceAsTab]: handleOpenSpaceAsTab,
      [TeletypeAction.OpenStuff]: handleOpenStuff,
      [TeletypeAction.CopyURL]: handleCopyURL,
      [TeletypeAction.CopySuggestion]: handleCopySuggestion,
      [TeletypeAction.CopyGeneralSearch]: handleCopyGeneralSearch,
      [TeletypeAction.ExecuteBrowserCommand]: handleBrowserCommand,
      [TeletypeAction.Create]: handleCreate,
      [TeletypeAction.Ask]: handleAsk,
      [TeletypeAction.RemoveHostnameSuggestion]: handleRemoveHostnameSuggestion,
      [TeletypeAction.CreateSpace]: handleCreateSpace,
      [TeletypeAction.Reload]: () => dispatch('reload'),
      [TeletypeAction.CloseTab]: () => dispatch('close-active-tab'),
      [TeletypeAction.ToggleBookmark]: () => dispatch('toggle-bookmark'),
      [TeletypeAction.ToggleSidebar]: () => dispatch('toggle-sidebar'),
      [TeletypeAction.ShowHistoryTab]: () => dispatch('show-history-tab'),
      [TeletypeAction.ZoomIn]: () => dispatch('zoom-in'),
      [TeletypeAction.ZoomOut]: () => dispatch('zoom-out'),
      [TeletypeAction.ResetZoom]: () => dispatch('reset-zoom'),
      [TeletypeAction.CreateNote]: () => dispatch('create-note')
    }

    unsubscribe = teletypeActionStore.subscribe(async (event: TeletypeActionEvent | null) => {
      if (!event) return

      if (!event.success) {
        log.error('Action failed:', event.error)
        return
      }
      const handler = handlers[event.execute as keyof typeof handlers]
      const searchValue = get(teletype?.inputValue)

      if (handler) {
        const returnValue = (await handler(
          event.payload,
          searchValue
        )) as TeletypeActionHandlerReturnValue
        if (returnValue?.preventClose) {
          return
        }

        await tick()
        tabsManager.showNewTabOverlay.set(0)
      } else {
        log.warn('Unknown action type:', event.execute)
      }
    })

    if (teletype?.isOpen) {
      const inputElem = document.getElementById('teletype-input-default')
      inputElem?.focus()
    }
  })

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe()
    }
    // Clean up debounce function
    if (searchDebounce) {
      searchDebounce.cancel()
    }
  })
</script>

<TeletypeProvider
  bind:teletype
  actions={staticActions}
  class="teletype-provider"
  options={{
    iconComponent: TeletypeIconRenderer,
    showHelper: true,
    placeholder: 'Search the web, enter URL or ask a question...',
    localSearch: true,
    autoFocus: true,
    animations: false,
    nestedSearch: true
  }}
>
  <Teletype on:close on:input={handleInput} on:actions-rendered={handleShowActionPanel}>
    <div slot="header" class="custom-header">
      <TeletypeHeader
        on:ask={handleAsk}
        on:create={handleShowCreate}
        on:open-chat-with-tab
        on:open-space-and-chat
        on:openScreenshot
        on:create-note
        {showActionsPanel}
      />
    </div>
    <div slot="sidecar-right" class="tty-sidecar-right">
      <DesktopPreview willReveal={true} desktopId={$selectedSpace} />
    </div>
  </Teletype>
</TeletypeProvider>

{#if $hasUntriedFeatures && $inputValue == '' && !$showActionsPanel}
  {#if $showWhatsNew}
    <NewFeatureDialog
      on:dismiss={() => {
        document.startViewTransition(() => {
          showWhatsNew.set(false)
        })
      }}
    />
  {:else}
    <div class="floaty-button">
      <FloatyButton
        onClick={() => {
          document.startViewTransition(() => {
            showWhatsNew.set(!$showWhatsNew)
          })
        }}
        id="whatsnew"
        config={{
          attractionThreshold: 80,
          snapThreshold: 90,
          friction: 0.25,
          attraction: 0.05,
          maxVelocity: 12,
          movementScale: 1.15,
          scaleFactor: 1.075
        }}
      >
        <div class="label">
          <Icon name="bolt" /> <span>Whats New in Surf</span>
        </div>
      </FloatyButton>
    </div>
  {/if}
{/if}

<div class="teletype-close-wrapper" on:click={handleTeletypeClose}></div>

<style lang="scss" is:global>
  :root {
    --text: #586884;
    --text-p3: color(display-p3 0.3571 0.406 0.5088);
    --text-light: #666666;
    --background-dark: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      #eef4ff 0%,
      #ecf3ff 50%,
      #d2e2ff 100%
    );
    --background-dark-p3: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      color(display-p3 0.9373 0.9569 1) 0%,
      color(display-p3 0.9321 0.9531 1) 50%,
      color(display-p3 0.8349 0.8849 0.9974) 100%
    );
    --background-accent: #ffffff;
    --background-accent-p3: color(display-p3 1 1 1);
    --border-color: #e0e0e088;
    --outline-color: #e0e0e080;
    --primary: #2a62f1;
    --primary-dark: #a48e8e;
    --green: #0ec463;
    --red: #f24441;
    --orange: #fa870c;
    --border-width: 0.5px;
    --border-color: #58688460;

    --border-radius: 18px;
  }
  // unused?
  //.dark {
  //  --text: #ffffff; // white
  //  --text-light: #cccccc; // light gray
  //  --background-dark: #121212; // very dark gray
  //  --background-accent: #1e1e1e; // dark gray
  //  --border-color: #33333383; // dark gray with opacity
  //  --outline-color: #33333337; // dark gray with low opacity
  //  --primary: #4d73e0; // default
  //  --primary-dark: #a48e8e;
  //  --green: #0ec463; // default
  //  --red: #f24441; // default
  //  --orange: #fa870c; // default

  //  --border-radius: 8px;
  //}

  :global(#tty-default) {
    view-transition-name: teletype;
    max-width: 100%;
    anchor-name: --teletype;
  }

  :global(#tty-default .resource-preview) {
    height: 100%;
    // TODO: This override is dumb
    --text-color: currentColor !important;
    :global(.preview) {
      height: 100%;
      font-size: 0.8em;
      --MAX_title_lines: 3 !important;
      --MAX_content_lines: 6 !important;
      :global(> .inner :last-child:not(.media)) {
        margin-bottom: 0.3em;
      }
      /*border: 0 !important;
      :global(.preview-card .inner) {
        height: 100%;
        :global(.image) {
          height: 100%;
          object-fit: cover;
          :global(img) {
            height: 100%;
            object-fit: cover;
          }
        }
      }*/
    }
  }
  :global(.resource-preview[data-origin='cmdt'][data-drag-preview]) {
    background: #fff !important;
    width: var(--drag-width, auto) !important;
    height: var(--drag-height, auto) !important;
    border-radius: 0.75em !important;
    overflow: clip !important;
  }

  .floaty-button {
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;

    .label {
      display: flex;
      align-items: center;
      margin-top: 2px;
      gap: 2px;
      height: 100%;
    }
  }

  :global(.desktop-preview-wrapper) {
    position: absolute;
    right: 4rem;
    bottom: 4rem;
    width: 12rem;
    height: 8rem;
    padding: 0.25rem;

    background: var(--white);
    border-radius: 24px;
    box-shadow:
      0px 2px 4px rgba(0, 0, 0, 0.01),
      0px 2px 3px rgba(0, 0, 0, 0.02),
      0px 4px 8px rgba(0, 0, 0, 0.04);
  }

  :global(.tty-sidecar-right) {
    position: absolute;

    bottom: anchor(--teletype bottom);
    left: calc(anchor(--teletype right) + 1.25em);

    z-index: -1;
  }

  .teletype-close-wrapper {
    display: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100vh;
    width: 100vw;
    background: transparent;
  }

  :global(body.onboarding .teletype-motion .inner-wrapper) {
    bottom: -100% !important;
  }
</style>
