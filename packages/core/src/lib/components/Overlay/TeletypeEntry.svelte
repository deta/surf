<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte'
  import { get, readable, writable } from 'svelte/store'
  import { TeletypeProvider, Teletype } from '@deta/teletype/src'
  import { CreateTabEventTrigger } from '@horizon/types'
  import { parseStringIntoBrowserLocation, useLogScope } from '@horizon/utils'
  import {
    type Action,
    type HandlerAction,
    type ParentAction,
    type HorizontalAction
  } from '@deta/teletype/src'
  import { Icon } from '@horizon/icons'
  import { useCommandComposer } from '../Overlay/service/commandComposer'
  import { useOasis } from '../../service/oasis'
  import { useConfig } from '../../service/config'
  import { useResourceManager } from '../../service/resources'
  import { teletypeActionStore, TeletypeAction } from './service/teletypeActions'
  import type { TabsManager } from '../../service/tabs'
  import type { TeletypeActionEvent } from './service/teletypeActions'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../../constants/searchEngines'
  import {
    optimisticCheckIfURLOrIPorFile,
    optimisticCheckIfUrl,
    prependProtocol
  } from '@horizon/utils'

  import { createActionsFromResults } from './horizontal'
  import TeletypeHeader from './TeletypeHeader.svelte'

  export let tabsManager: TabsManager
  export let open: boolean

  const log = useLogScope('TeletypeEntry')
  const config = useConfig()
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher()
  const commandComposer = useCommandComposer(oasis, config)
  const userConfigSettings = config.settings
  let teletype: TeletypeProvider
  let unsubscribe: () => void

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

  $: {
    if (teletype?.inputValue) {
      teletype.inputValue.subscribe(async (value: string) => {
        const askActions = get(commandComposer.askActions)

        const stuffActions = get(commandComposer.stuffActions)

        // First get create actions
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
          handler: async (_, tt) => {
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

        // Update create action with child actions
        const updatedStaticActions = staticActions.map((action) =>
          action.id === 'create' ? { ...action, childActions: createChildActions } : action
        )

        // Then handle search if there's input
        teletype.setLoading(true)
        try {
          if (value) {
            commandComposer.updateSearchValue(value)
            const searchResults = get(commandComposer.defaultActionsTeletype)
            const dynamicActions = await createActionsFromResults(searchResults, resourceManager)
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
      })
    }
  }

  // Event handlers for each action type
  function handleGeneralSearch(payload: { query: string }) {
    const isValidURL =
      optimisticCheckIfURLOrIPorFile(payload.query) || optimisticCheckIfUrl(payload.query)
    if (isValidURL) {
      dispatch('open-url', prependProtocol(payload.query))
    } else {
      const engine =
        SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
        SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
      if (!engine) throw new Error('No search engine / default engine found, config error?')
      console.log('engine', engine)
      dispatch('open-url', engine.getUrl(encodeURIComponent(payload.query)))
    }
  }

  function handleNavigate(payload: { url: string }) {
    const validUrl = parseStringIntoBrowserLocation(payload.url)
    if (!validUrl) {
      log.error('Invalid URL:', payload.url)
      return
    }

    dispatch('open-url', validUrl)
  }

  function handleOpenURLInMiniBrowser(payload: { url: string }) {
    const validUrl = parseStringIntoBrowserLocation(payload.url)
    if (!validUrl) {
      log.error('Invalid URL:', payload.url)
      return
    }

    dispatch('open-url-in-minibrowser', validUrl)
  }

  function handleSuggestion(payload: { suggestion: string }) {
    const engine =
      SEARCH_ENGINES.find((e) => e.key === $searchEngine) ??
      SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
    if (!engine) throw new Error('No search engine / default engine found, config error?')

    dispatch('open-url', engine.getUrl(encodeURIComponent(payload.suggestion)))
  }

  function handleHistory(payload: { entry: any }) {
    dispatch('open-url', payload.entry.url)
  }

  function handleSuggestionHostname(payload: { entry: any }) {
    dispatch('open-url', payload.entry.url)
  }

  async function handleResource(payload: { resource: any }) {
    await tabsManager.openResourceAsTab(payload.resource, {
      active: true,
      trigger: CreateTabEventTrigger.AddressBar
    })
  }

  async function handleSpaceItem(payload: { resource: any }) {
    await tabsManager.openResourceAsTab(payload.resource, {
      active: true,
      trigger: CreateTabEventTrigger.AddressBar
    })
  }

  function handleTab(payload: { tab: any }) {
    dispatch('activate-tab', payload.tab.id)
  }

  function handleSpace(payload: { data: any; searchValue: string }) {
    const space = payload.data
    console.log('open-space', payload)
    dispatch('open-space', space)
  }

  function handleOpenStuff(payload: { data: any; searchValue: string }) {
    const searchValue = payload.searchValue || ''
    dispatch('open-stuff', searchValue)
  }

  function handleBrowserCommand(payload: { command: string }) {
    if (payload.command === 'create-chat') {
      dispatch('create-chat', teletype?.inputValue)
    } else {
      dispatch(payload.command)
    }
  }

  function handleAsk() {
    dispatch('ask', get(teletype?.inputValue))
  }

  function handleCreate(payload: { id: string; url: string }) {
    const validUrl = parseStringIntoBrowserLocation(payload.url)
    if (!validUrl) {
      log.error('Invalid URL:', payload.url)
      return
    }

    dispatch('open-url', validUrl)
  }

  const handleShowCreate = () => {
    if (teletype) {
      teletype.executeAction('create')
      teletype.open()
    }
  }

  onMount(() => {
    const handlers = {
      [TeletypeAction.NavigateGeneralSearch]: handleGeneralSearch,
      [TeletypeAction.NavigateURL]: handleNavigate,
      [TeletypeAction.OpenURLInMiniBrowser]: handleOpenURLInMiniBrowser,
      [TeletypeAction.NavigateSuggestion]: handleSuggestion,
      [TeletypeAction.NavigateHistoryElement]: handleHistory,
      [TeletypeAction.NavigateSuggestionHostname]: handleSuggestionHostname,
      [TeletypeAction.OpenResource]: handleResource,
      [TeletypeAction.OpenTab]: handleTab,
      [TeletypeAction.OpenSpace]: handleSpace,
      [TeletypeAction.OpenStuff]: handleOpenStuff,
      [TeletypeAction.ExecuteBrowserCommand]: handleBrowserCommand,
      [TeletypeAction.Create]: handleCreate,
      [TeletypeAction.OpenSpaceItem]: handleSpaceItem,
      [TeletypeAction.Ask]: handleAsk,
      [TeletypeAction.Reload]: () => dispatch('reload'),
      [TeletypeAction.CloseTab]: () => dispatch('close-active-tab'),
      [TeletypeAction.ToggleBookmark]: () => dispatch('toggle-bookmark'),
      [TeletypeAction.ToggleSidebar]: () => dispatch('toggle-sidebar'),
      [TeletypeAction.ShowHistoryTab]: () => dispatch('show-history-tab'),
      [TeletypeAction.ZoomIn]: () => dispatch('zoom-in'),
      [TeletypeAction.ZoomOut]: () => dispatch('zoom-out'),
      [TeletypeAction.ResetZoom]: () => dispatch('reset-zoom'),
      [TeletypeAction.CreateNote]: () => dispatch('create-note'),
      [TeletypeAction.CreateSpace]: () => dispatch('create-new-space')
    }

    unsubscribe = teletypeActionStore.subscribe((event: TeletypeActionEvent | null) => {
      if (!event) return

      if (!event.success) {
        log.error('Action failed:', event.error)
        return
      }
      const handler = handlers[event.execute as keyof typeof handlers]

      if (handler) {
        handler(event.payload)
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
  })
</script>

<TeletypeProvider
  bind:teletype
  actions={staticActions}
  class="teletype-provider"
  options={{
    iconComponent: Icon,
    showHelper: true,
    placeholder: 'Search the web, enter URL or ask a question...',
    localSearch: true,
    autoFocus: true,
    animations: false,
    nestedSearch: true
  }}
>
  <Teletype on:close>
    <div slot="header" class="custom-header">
      <TeletypeHeader on:ask={handleAsk} on:create={handleShowCreate} />
    </div>
  </Teletype>
</TeletypeProvider>

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
  .dark {
    --text: #ffffff; // white
    --text-light: #cccccc; // light gray
    --background-dark: #121212; // very dark gray
    --background-accent: #1e1e1e; // dark gray
    --border-color: #33333383; // dark gray with opacity
    --outline-color: #33333337; // dark gray with low opacity
    --primary: #4d73e0; // default
    --primary-dark: #a48e8e;
    --green: #0ec463; // default
    --red: #f24441; // default
    --orange: #fa870c; // default

    --border-radius: 8px;
  }

  :global(.tty-default) {
    max-width: 100%;
  }

  :global(#tty-default .resource-preview) {
    height: 100%;
    :global(.preview) {
      height: 100%;
      border: 0 !important;
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
      }
    }
  }
</style>
