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
  import { createState } from '@horizon/cmdk-sv'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type AddContextItemEvent,
    type Tab
  } from '../../../types'
  import { createEventDispatcher, onMount } from 'svelte'
  import {
    conditionalArrayItem,
    getFileKind,
    getFileType,
    truncateURL,
    useDebounce,
    useLogScope
  } from '@horizon/utils'
  import { OasisSpace, useOasis } from '../../../service/oasis'
  import { ResourceManager, useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useConfig } from '@horizon/core/src/lib/service/config'
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
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import {
    ACTIVE_CONTEXT_MENTION,
    EVERYTHING_MENTION,
    INBOX_MENTION,
    ACTIVE_TAB_MENTION,
    WIKIPEDIA_SEARCH_MENTION
  } from '@horizon/core/src/lib/constants/chat'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import { SelectDropdown } from '../../Atoms/SelectDropdown'
  import AppBarButton from '../../Browser/AppBarButton.svelte'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'

  export let tabs: Readable<Tab[]>
  export let contextManager: ContextManager
  export let excludeActiveTab: boolean = false
  export let pickerOpen: Writable<boolean> = writable(false)

  const log = useLogScope('ChatContextTabPicker')
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const config = useConfig()
  const ai = useAI()

  const userConfigSettings = config.settings
  const spaces = oasis.spaces
  const activeScopeId = tabsManager.activeScopeId

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
      iconUrl: tab.icon,
      data: tab.type === 'space' ? { type: 'space', spaceId: tab.spaceId } : tab
    } as TabItem
  }

  function spaceToTabItem(space: OasisSpace) {
    return {
      id: space.id,
      type: 'space',
      label: space.dataValue.folderName,
      value: `${ContextItemTypes.SPACE};;${space.id}`,
      description: 'Context',
      data: space
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
        const tabItems = currentScopeTabs.map(tabToTabItem)
        return [
          ...filteredBuiltInItems
            .filter((item) => !item.searchOnly)
            .map((item) => ({ ...item, section: 'Suggested' })),
          ...tabItems
          //...itemsInContext
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
    // Filter out items that are already in context
    const availableItems = $tabItems.filter((item) => !item.selected)

    // First group items by section
    const sections = new Set(availableItems.map((item) => item.section ?? 'Other'))

    // Create sectioned items in the format SelectDropdown expects
    return Array.from(sections).flatMap((section) => {
      const sectionItems = availableItems.filter((item) => (item.section ?? 'Other') === section)
      return [
        // Add section header
        {
          id: `section-${section}`,
          label: section,
          value: `section-${section}`,
          data: { type: 'section-header' },
          isSection: true
        },
        // Add section items
        ...sectionItems.map((item) => ({
          id: item.id,
          label: typeof item.label === 'string' ? item.label : get(item.label),
          value: item.value,
          icon: item.icon,
          iconUrl: item.iconUrl,
          description: item.description,
          descriptionIcon: item.descriptionIcon,
          data: item,
          selected: item.selected
        }))
      ]
    })
  })

  $: handleSearchValueChange($searchValue)

  async function handleRetryProcessing(event: CustomEvent<string>) {
    const itemId = event.detail
    log.debug('re-processing context item tab resource', itemId)
    await resourceManager.refreshResourceData(itemId)
  }

  function handleOpenAsTab(event: CustomEvent<string>) {
    const itemId = event.detail
    dispatch('open-as-tab', itemId)
  }

  function handleRemoveFromContext(event: CustomEvent<string>) {
    const itemId = event.detail
    dispatch('remove-from-ctx', itemId)
  }

  async function handleSubmitItem(event: CustomEvent<string>) {
    try {
      const itemId = event.detail
      const item = $tabItems.find((item) => item.id === itemId)
      if (!item) {
        log.error('item not found', itemId)
        return
      }

      const [type, id] = item.value.split(';;')

      log.debug('submitting item', type, id)

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

      const items = result.slice(0, 5).map((item) => resourceToTabItem(item.resource))

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
        !hasClassOrParentWithClass(e.target as Element, 'open-tab-picker') &&
        // Don't close if clicking on a menu item or inside the dropdown
        !hasClassOrParentWithClass(e.target as Element, 'radix-dropdown-content') &&
        !hasClassOrParentWithClass(e.target as Element, 'cmdk-item'))
    ) {
      dispatch('close', null)
      return
    }
    const inpEl = ref?.querySelector('input') as HTMLInputElement
    inpEl?.focus()
  }

  onMount(() => {
    // wtf are we doing at this point.. svelte component libaries which dont fucking expose their stuf.f.. aaa
    ref = document.querySelector('[data-cmdk-root]') as HTMLDivElement
  })
</script>

<SelectDropdown
  items={tabItemsSectioned}
  search={'manual'}
  {searchValue}
  inputPlaceholder="Search tabs or your stuff"
  open={pickerOpen}
  side="left"
  on:select={handleSubmitItem}
  on:retry-processing={handleRetryProcessing}
  on:open-as-tab={handleOpenAsTab}
  on:remove-from-ctx={handleRemoveFromContext}
>
  <AppBarButton active={$pickerOpen}>
    <Icon name="add" size="1rem" />
  </AppBarButton>

  <svelte:fragment slot="item" let:item>
    {#if item?.isSection}
      <div class="section text-xs font-medium text-gray-500 dark:text-gray-400">
        {item.label}
      </div>
    {:else if item}
      <div class="flex items-center gap-2 w-full">
        {#if item.data?.type === 'resource'}
          <Icon name="file" width="1rem" height="1rem" />
        {:else if item.data?.type === 'space'}
          {#await oasis.getSpace(item.data.spaceId || item.data.id) then space}
            {#if space}
              <SpaceIcon folder={space} size="sm" interactive={false} />
            {/if}
          {/await}
        {:else if item.iconUrl}
          <img src={item.iconUrl} alt="" class="w-4 h-4" />
        {:else if item.icon}
          <DynamicIcon name={item.icon} size="1rem" />
        {/if}
        <span class="flex-1 truncate" style="font-weight: 400;text-overflow: ellipsis;"
          >{item.label}</span
        >
        {#if item.description}
          <span class="text-xs text-gray-500">{item.description}</span>
        {/if}
        {#if item.data?.descriptionIcon}
          <Icon name={item.data.descriptionIcon} size="1rem" class="text-gray-500" />
        {/if}
      </div>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="empty">
    <div class="flex flex-col justify-center gap-2 h-full">
      <div class="h-full flex flex-col justify-center">
        <p class="text-gray-400 dark:text-gray-400 text-center py-6">No Contexts found</p>
      </div>
    </div>
  </svelte:fragment>
</SelectDropdown>

<svelte:window on:mouseup={handleMouseUp} />

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

  // Holy fuck, fire me for this code.. but our icon components are just doing whatever they want
  :global(div[role='menuitem']) {
    //overflow: hidden;
    :global(div.list.space-icon) {
      width: 1.25rem;
    }
  }
  :global(div[role='menuitem']:has(> div.section)) {
    pointer-events: none !important;
    background: none !important;
    &[data-highlighted] {
      background: none !important;
    }
  }
</style>
