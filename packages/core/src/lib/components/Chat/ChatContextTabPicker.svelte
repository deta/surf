<script lang="ts" context="module">
  // prettier-ignore
  export type TabItem = {
    id: string
    type: 'page' | 'space' | 'resource' | 'built-in' | 'context-item'
    label: string | Writable<string>
    section?: string
    value: string
    data?: any
    icon?: string
    iconUrl?: string
    iconSpaceId?: string
    searchOnly?: boolean
    aliases?: string[]
    selected?: boolean
    description?: string
    descriptionIcon?: string
    canRetryProcessing?: boolean
  };
</script>

<script lang="ts">
  import { Command, createState } from '@horizon/cmdk-sv'
  import { cn } from '../../utils/tailwind'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type AddContextItemEvent,
    type Tab
  } from '../../types'
  import { createEventDispatcher, onMount } from 'svelte'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import {
    clickOutside,
    conditionalArrayItem,
    getFileKind,
    getFileType,
    tooltip,
    truncateURL,
    useDebounce,
    useLogScope
  } from '@horizon/utils'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { ResourceManager, useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { PageChatUpdateContextEventTrigger } from '@horizon/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import {
    type ContextItem,
    type ContextManager,
    ContextItemTypes,
    ContextItemResource
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import { requestUserScreenshot } from '../Core/ScreenPicker.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import {
    ACTIVE_CONTEXT_MENTION,
    EVERYTHING_MENTION,
    INBOX_MENTION,
    ACTIVE_TAB_MENTION,
    WIKIPEDIA_SEARCH_MENTION
  } from '@horizon/core/src/lib/constants/chat'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import ChatContextTabPickerItem from './ChatContextTabPickerItem.svelte'

  export let tabs: Readable<Tab[]>
  export let contextManager: ContextManager
  export let excludeActiveTab: boolean = false

  const log = useLogScope('ChatContextTabPicker')
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const config = useConfig()
  const ai = useAI()

  const userConfigSettings = config.settings
  const spaces = oasis.spaces
  const activeScopeId = tabsManager.activeScopeId
  const selectedModel = ai.selectedModel

  const contextItems = contextManager.items
  const tabsInContext = contextManager.tabsInContext
  const spacesInContext = contextManager.spacesInContext
  const resourcesInContext = contextManager.resourcesInContext

  const dispatch = createEventDispatcher<{
    'add-context-item': AddContextItemEvent
    'pick-screenshot': void
    close: void
  }>()

  let ref: HTMLDivElement
  const state = createState({
    value: `tab;;${$tabs[0].id}`
  })

  const searchResult = writable<TabItem[]>([])
  const isSearching = writable(false)
  const searchValue = writable('')

  const activeTabItem = {
    ...ACTIVE_TAB_MENTION,
    label: ACTIVE_TAB_MENTION.suggestionLabel,
    value: ACTIVE_TAB_MENTION.id,
    canRetryProcessing: true
  } as TabItem

  const activeContextItem = {
    ...ACTIVE_CONTEXT_MENTION,
    label: ACTIVE_CONTEXT_MENTION.suggestionLabel,
    value: ACTIVE_CONTEXT_MENTION.id
  } as TabItem

  const inboxContextItem = {
    ...INBOX_MENTION,
    label: INBOX_MENTION.suggestionLabel,
    value: INBOX_MENTION.id
  } as TabItem

  const everythingContextItem = {
    ...EVERYTHING_MENTION,
    label: EVERYTHING_MENTION.suggestionLabel,
    value: EVERYTHING_MENTION.id
  } as TabItem

  const wikipediaContextItem = {
    ...WIKIPEDIA_SEARCH_MENTION,
    label: WIKIPEDIA_SEARCH_MENTION.suggestionLabel,
    value: WIKIPEDIA_SEARCH_MENTION.id,
    searchOnly: true
  } as TabItem

  function tabToTabItem(tab: Tab) {
    return {
      id: tab.id,
      type: 'page',
      label: tab.title,
      value: `${ContextItemTypes.PAGE_TAB};;${tab.id}`,
      description: 'Tab',
      canRetryProcessing: true,
      ...(tab.type === 'space' ? { iconSpaceId: tab.spaceId } : { iconUrl: tab.icon })
    } as TabItem
  }

  function spaceToTabItem(space: OasisSpace) {
    return {
      id: space.id,
      type: 'space',
      label: space.dataValue.folderName,
      value: `${ContextItemTypes.SPACE};;${space.id}`,
      description: 'Context',
      iconSpaceId: space.id
    } as TabItem
  }

  function resourceToTabItem(resource: Resource) {
    log.debug('search result item', resource)

    const canonicalURL =
      (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
        ?.value || resource.metadata?.sourceURI

    return {
      id: resource.id,
      type: 'resource',
      label:
        resource.metadata?.name ||
        (canonicalURL ? truncateURL(canonicalURL, 15) : getFileType(resource.type)),
      value: `resource;;${resource.id}`,
      description: 'Stuff',
      ...(canonicalURL
        ? {
            iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(canonicalURL)}`
          }
        : { icon: getFileKind(resource.type) }),
      canRetryProcessing:
        (Object.values(ResourceTypes) as string[]).includes(resource.type) ||
        resource.type === 'application/pdf'
    } as TabItem
  }

  function contextItemToTabItem(item: ContextItem) {
    return {
      id: item.id,
      type: 'context-item',
      label: item.label,
      value: `context-item;;${item.id}`,
      section: 'Note Context',

      data: item,
      icon: item.iconStringValue,
      selected: true,
      descriptionIcon: 'close',
      canRetryProcessing:
        (item instanceof ContextItemResource &&
          ((Object.values(ResourceTypes) as string[]).includes(item.data.type) ||
            item.data.type === 'application/pdf')) ||
        item.id === 'active-tab'
    } as TabItem
  }

  const builtInItems = derived(userConfigSettings, (userConfigSettings) => {
    return [
      ...conditionalArrayItem(!excludeActiveTab, activeTabItem),
      activeContextItem,
      ...conditionalArrayItem(!userConfigSettings.save_to_active_context, inboxContextItem),
      everythingContextItem,
      ...conditionalArrayItem(userConfigSettings.experimental_chat_web_search, wikipediaContextItem)
    ]
  })

  const tabItems = derived(
    [
      searchResult,
      contextItems,
      tabsInContext,
      spacesInContext,
      resourcesInContext,
      tabs,
      searchValue,
      activeScopeId,
      builtInItems
    ],
    ([
      searchResult,
      contextItems,
      tabsInContext,
      spacesInContext,
      resourcesInContext,
      tabs,
      searchValue,
      activeScopeId,
      builtInItems
    ]) => {
      const filteredBuiltInItems = builtInItems.filter(
        (item) => contextItems.findIndex((ci) => ci.id === item.id) === -1
      )

      const itemsInContext = contextItems.map((item) => contextItemToTabItem(item))

      if (searchValue.length === 0) {
        const currentScopeTabs = tabs.filter((tab) => tab.scopeId === (activeScopeId ?? undefined))
        // const tabItems = currentScopeTabs.map(tabToTabItem)
        return [
          ...filteredBuiltInItems
            .filter((item) => !item.searchOnly)
            .map((item) => ({ ...item, section: 'Suggested' })),
          ...itemsInContext
        ]
      }

      const spaceMatches = $spaces.filter(
        (space) =>
          spacesInContext.findIndex((ci) => ci.id === space.id) === -1 &&
          space.dataValue.folderName.toLowerCase().includes(searchValue.toLowerCase())
      )

      const tabMatches = tabs.filter(
        (tab) =>
          tab.title.toLowerCase().includes(searchValue.toLowerCase()) &&
          tabsInContext.findIndex((ci) => ci.id === tab.id) === -1 &&
          !(tab.type === 'space' && spaceMatches.findIndex((ci) => ci.id === tab.spaceId) !== -1) &&
          !(tab.type === 'space' && spacesInContext.findIndex((ci) => ci.id === tab.spaceId) !== -1)
      )

      const stuffMatches = searchResult.filter(
        (item) =>
          resourcesInContext.findIndex((ci) => ci.id === item.id) === -1 &&
          tabMatches.findIndex((t) => t.type === 'page' && t.chatResourceBookmark === item.id) ===
            -1
      )

      const builtInMatches = filteredBuiltInItems.filter(
        (item) =>
          (typeof item.label === 'string' ? item.label : get(item.label))
            .toLowerCase()
            .includes(searchValue.toLowerCase()) ||
          item.aliases?.some((alias) => alias.toLowerCase().includes(searchValue.toLowerCase()))
      )

      const tabItems = tabMatches.map(tabToTabItem)
      const spaceItems = spaceMatches.slice(0, 5).map((space) => spaceToTabItem(space))
      const stuffItems = stuffMatches

      const searchResultsCombined = [
        ...builtInMatches,
        ...tabItems,
        ...spaceItems,
        ...stuffItems
      ].map((item) => ({ ...item, section: 'Search Results' }))
      return [...searchResultsCombined, ...itemsInContext]
    }
  )

  const tabItemsSectioned = derived(tabItems, ($tabItems) => {
    const sections = new Set($tabItems.map((item) => item.section ?? 'Other'))
    return Array.from(sections).map((section) => ({
      section,
      items: $tabItems.filter((item) => item.section === section)
    }))
  })

  $: handleSearchValueChange($searchValue)

  async function handleSubmitItem() {
    try {
      const value = $state.value
      const [type, id] = value.split(';;')

      log.debug('submitting item', type, id)

      const item = $tabItems.find((item) => item.value === value)
      if (!item) {
        log.error('item not found', value)
        return
      }

      if (item.type === 'context-item' && item.selected) {
        contextManager.removeContextItem(
          item.id,
          PageChatUpdateContextEventTrigger.ChatAddContextMenu
        )
        return
      }

      if (type === ContextItemTypes.PAGE_TAB) {
        contextManager.addTab(id, { trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu })
      } else if (type === ContextItemTypes.SPACE) {
        contextManager.addSpace(id, {
          trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
        })
      } else if (type === ContextItemTypes.RESOURCE) {
        contextManager.addResource(id, {
          trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
        })

        // for built-in items 'type' is the value
      } else if (type === ContextItemTypes.ACTIVE_TAB) {
        contextManager.addActiveTab({
          trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
        })
      } else if (type === ContextItemTypes.ACTIVE_SPACE) {
        contextManager.addActiveSpaceContext(undefined, {
          trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
        })
      } else if (type === ContextItemTypes.INBOX) {
        contextManager.addInboxContext({
          trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
        })
      } else if (type === ContextItemTypes.EVERYTHING) {
        contextManager.addEverythingContext({
          trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
        })
      } else if (type === ContextItemTypes.WIKIPEDIA) {
        contextManager.addWikipediaContext({
          trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
        })
      }

      // $searchValue = ''
      const inpEl = ref?.querySelector('input') as HTMLInputElement
      inpEl?.focus()
    } catch (e) {
      log.error('submit error', e)
    }
  }

  async function searchStuff(value: string) {
    try {
      if (!value) {
        $searchResult = []
        return
      }

      log.debug('searching for', value)

      $isSearching = true

      const result = await resourceManager.searchResources(
        value,
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)
        ],
        {
          semanticEnabled: $userConfigSettings.use_semantic_search
        }
      )

      const items = result.resources.slice(0, 5).map((item) => {
        const resource = item.resource

        log.debug('search result item', resource)

        const canonicalURL =
          (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
            ?.value || resource.metadata?.sourceURI

        return {
          id: resource.id,
          type: 'resource',
          label:
            resource.metadata?.name ||
            (canonicalURL ? truncateURL(canonicalURL, 15) : getFileType(resource.type)),
          value: `resource;;${resource.id}`,
          ...(canonicalURL
            ? {
                iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(canonicalURL)}`
              }
            : { icon: getFileKind(resource.type) })
        } as TabItem
      })

      log.debug('search result', items)

      $searchResult = items
    } catch (e) {
      log.error('search error', e)
    } finally {
      $isSearching = false
    }
  }

  const debouncedSearch = useDebounce(searchStuff, 300)

  function handleSearchValueChange(value: string) {
    $isSearching = true
    debouncedSearch(value)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      dispatch('close')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      handleSubmitItem()
    }
  }

  async function handleMouseUp(e: MouseEvent) {
    // bit crude to ignore if open button butt well
    function hasClassOrParentWithClass(el: Element, className: string) {
      if (el.classList.contains(className)) return true
      if (el.parentElement) return hasClassOrParentWithClass(el.parentElement, className)
      return false
    }

    // NOTE: e.target === window if passthrough from webview
    if (
      e.target === window ||
      (ref &&
        !ref.contains(e.target as Node) &&
        !hasClassOrParentWithClass(e.target as Element, 'open-tab-picker'))
    ) {
      dispatch('close')
      return
    }
    const inpEl = ref?.querySelector('input') as HTMLInputElement
    inpEl?.focus()
  }

  onMount(() => {
    // wtf are we doing at this point.. svelte component libaries which dont fucking expose their stuf.f.. aaa
    ref = document.querySelector('[data-cmdk-root]') as HTMLDivElement

    clickOutside(ref, () => dispatch('close'))
  })
</script>

<svelte:window on:mouseup={handleMouseUp} />

<!-- NOTE: NIE id=...!! CMDvK breakt sondt >:( -->
<Command.Root
  loop
  {state}
  shouldFilter={false}
  label="chat-add-context-tabs"
  class={cn(
    'bg-sky-100 dark:bg-gray-900 shadow-xl p-2 border-sky-200 dark:border-gray-800 border-2 rounded-xl relative'
  )}
  data-ignore-click-outside
>
  <div class="picker-actions" data-ignore-click-outside>
    {#if $tabItems.length > 0}
      <button
        on:click={() => {
          for (const t of $tabItems) {
            contextManager.addTab(t.id)
          }
          dispatch('close')
        }}
        class="active:scale-95 shadow-xl appearance-none w-fit border-0 group margin-0 flex items-center px-3 py-1 bg-sky-200 dark:bg-gray-800 hover:bg-sky-300 dark:hover:bg-gray-600/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100 text-xs"
        use:tooltip={{
          text: '⌘ + Shift + A',
          position: 'left'
        }}
      >
        Add All Tabs
      </button>
    {/if}

    {#if $selectedModel.vision}
      <button
        on:click={async () => {
          dispatch('close')
          const blob = await requestUserScreenshot()
          if (!blob) return

          contextManager.addScreenshot(blob, {
            trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
          })
        }}
        class="active:scale-95 shadow-xl appearance-none w-fit border-0 group margin-0 flex items-center px-3 py-1 bg-sky-200 dark:bg-gray-800 hover:bg-sky-300 dark:hover:bg-gray-600/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100 text-xs"
      >
        Take Screenshot
      </button>
    {/if}
  </div>
  <Command.List>
    <Command.Empty>
      {#if $isSearching}
        Searching your stuff…
      {:else if $searchValue.length > 0}
        No results found.
      {:else}
        No tabs open, try searching your stuff
      {/if}
    </Command.Empty>

    {#each $tabItemsSectioned as blocks}
      {#if blocks.section !== 'Other'}
        <Command.Group heading={blocks.section}>
          {#each blocks.items as item, idx (item.id + idx)}
            <ChatContextTabPickerItem
              {item}
              on:click={handleSubmitItem}
              on:open-as-tab
              on:retry-processing
              on:remove-from-ctx={handleSubmitItem}
              disableCtxMenu={blocks.section === 'Suggested'}
            />
          {/each}
        </Command.Group>
      {:else}
        {#each blocks.items as item, idx (item.id + idx)}
          <ChatContextTabPickerItem {item} on:click={handleSubmitItem} />
        {/each}
      {/if}
    {/each}

    <!-- {#each $tabItems as item, idx (item.id + idx)}
      <ChatContextTabPickerItem
        item={item}
        on:click={handleSubmitItem}
      />
    {/each} -->
  </Command.List>
  <Command.Input
    bind:value={$searchValue}
    autofocus
    on:keydown={handleKeyDown}
    placeholder="Search tabs or your stuff"
    class={cn('rounded-lg px-2 py-1 mt-2')}
    data-ignore-click-outside
  />
  {#if $isSearching}
    <div class="absolute right-[0.85rem] bottom-[0.85rem] z-10 opacity-75">
      <Icon name="spinner" size="17px" />
    </div>
  {/if}
</Command.Root>

<style lang="scss">
  /* NOTE: WHyyyy only tailwind? cant select anything by a meaningful name any more :') */
  // NOTE: Please for god sake let us remember to remove these war crimes
  :global(.text-resource-wrapper:has(.editor-input-bar.bottom) [data-cmdk-root]) {
    transform: none;
    bottom: 7rem;
    right: 2rem;
    position-anchor: unset;
    position-area: unset;
  }
  :global(.text-resource-wrapper:has(.editor-input-bar:not(.bottom).floaty) [data-cmdk-root]) {
    bottom: calc(anchor(--floaty-bar-attach top) - 2.5rem);
  }
  :global(.text-resource-wrapper:has(.editor-input-bar.floaty.flip-picker) [data-cmdk-root]) {
    top: calc(anchor(--floaty-bar-attach bottom) + 3.75rem);
  }
  :global(.text-resource-wrapper:has(.editor-input-bar.flip-picker) [data-cmdk-root]) {
    bottom: unset !important;
    top: calc(anchor(--floaty-bar-attach bottom) + 3rem);
  }
  :global([data-cmdk-root]) {
    position: absolute;
    position-anchor: --floaty-bar-attach;
    bottom: calc(anchor(--floaty-bar-attach top) - 1.75rem);
    right: anchor(--floaty-bar-attach right);

    /* we should just use isolation: isolate for contained things like the sidebar insted of these zindices */
    z-index: 99999999;
    //top: -0.75rem;
    //right: 0;
    //transform: translateY(-100%);
    min-width: 30ch;
    max-width: 30ch;
    margin-right: 1.25rem;

    :global([data-cmdk-empty]) {
      opacity: 0.8;
    }

    :global([data-cmdk-list]) {
      height: var(--cmdk-list-height);
      max-height: 310px;
      transition: height 100ms ease-out;
      scroll-padding-block-start: 8px;
      scroll-padding-block-end: 8px;
      overflow: hidden;
      overflow-y: auto;
      font-size: 0.9em;
    }

    :global(input[type='text']) {
      width: 100%;

      &:focus {
        outline: 1.5px solid rgba(202, 205, 212, 1);
      }
    }

    :global([data-cmdk-item]) {
      padding: 0.25rem 0.5rem;
      border-radius: 0.5rem;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 0.4rem;

      :global(.color-icon) {
        min-width: unset;
        min-height: unset;
      }
    }

    :global([data-selected='true']) {
      background-color: rgba(0, 0, 0, 0.1);
    }

    :global([data-item-selected='true']) {
      opacity: 0.65;
    }

    :global([data-cmdk-group-heading]) {
      font-size: 0.9em;
      font-weight: 400;
      letter-spacing: 0.01em;
      opacity: 0.5;
      padding: 3px 0;
      color: light-dark(black, white);
    }

    :global(.picker-actions) {
      //position: absolute;
      //top: 0;
      //left: 0;
      width: 100%;
      //transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;

      button {
        flex-shrink: 0;
      }
    }
  }
</style>
