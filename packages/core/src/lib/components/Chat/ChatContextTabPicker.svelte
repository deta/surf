<script lang="ts" context="module">
  export type TabItem = {
    id: string
    type: 'page' | 'space' | 'resource'
    label: string
    value: string
    icon?: string
    iconUrl?: string
    iconSpaceId?: string
  }
</script>

<script lang="ts">
  import { Command, createState } from '@horizon/cmdk-sv'
  import { cn } from '../../utils/tailwind'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type AddContextItemEvent,
    type ContextItem,
    type Tab
  } from '../../types'
  import { createEventDispatcher, onMount } from 'svelte'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import {
    getFileKind,
    getFileType,
    tooltip,
    truncateURL,
    useDebounce,
    useLogScope
  } from '@horizon/utils'
  import { useOasis } from '../../service/oasis'
  import { ResourceManager, useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import { derived, writable, type Readable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { PageChatUpdateContextEventTrigger } from '@horizon/types'

  export let tabs: Readable<Tab[]>
  export let contextItems: Readable<ContextItem[]>

  const log = useLogScope('ChatContextTabPicker')
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const config = useConfig()

  const userConfigSettings = config.settings
  const spaces = oasis.spaces

  const dispatch = createEventDispatcher<{
    'include-tab': string
    'add-context-item': AddContextItemEvent
    close: void
  }>()

  let ref: HTMLDivElement
  const state = createState({
    value: `tab;;${$tabs[0].id}`
  })

  const searchResult = writable<TabItem[]>([])
  const isSearching = writable(false)
  const searchValue = writable('')

  const tabItems = derived(
    [searchResult, contextItems, tabs, searchValue],
    ([searchResult, contextItems, tabs, searchValue]) => {
      const result: TabItem[] = []

      if (searchValue.length > 0) {
        const filteredSpaces = $spaces.filter(
          (space) =>
            contextItems.findIndex((ci) => ci.type === 'space' && ci.data.id === space.id) === -1 &&
            space.dataValue.folderName.toLowerCase().includes(searchValue.toLowerCase())
        )

        const spaceItems = filteredSpaces.slice(0, 5).map(
          (space) =>
            ({
              id: space.id,
              type: 'space',
              label: space.dataValue.folderName,
              value: `space;;${space.id}`,
              iconSpaceId: space.id
            }) as TabItem
        )

        result.push(...spaceItems)
      }

      const searchItems = searchResult.filter(
        (item) =>
          contextItems.findIndex((ci) => ci.type === 'resource' && ci.data.id === item.id) === -1
      )

      const tabItems = tabs
        .filter((tab) => tab.title.toLowerCase().includes(searchValue.toLowerCase()))
        .map(
          (tab) =>
            ({
              id: tab.id,
              type: 'page',
              label: tab.title,
              value: `tab;;${tab.id}`,
              ...(tab.type === 'space' ? { iconSpaceId: tab.spaceId } : { iconUrl: tab.icon })
            }) as TabItem
        )

      return [...result, ...searchItems, ...tabItems]
    }
  )

  $: handleSearchValueChange($searchValue)

  async function handleSubmitItem() {
    const value = $state.value
    const [type, id] = value.split(';;')

    log.debug('submitting item', type, id)

    if (type === 'tab') {
      dispatch('include-tab', id)
      $searchValue = ''
    } else if (type === 'space') {
      const space = await oasis.getSpace(id)
      if (!space) {
        log.error('space not found', id)
        return
      }

      dispatch('add-context-item', {
        item: {
          id,
          type: 'space',
          data: space
        },
        trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
      })
    } else {
      const resource = await resourceManager.getResource(id)
      if (!resource) {
        log.error('resource not found', id)
        return
      }

      dispatch('add-context-item', {
        item: {
          id,
          type: 'resource',
          data: resource
        },
        trigger: PageChatUpdateContextEventTrigger.ChatAddContextMenu
      })
    }

    // $searchValue = ''
    const inpEl = ref.querySelector('input') as HTMLInputElement
    inpEl?.focus()
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

      const items = result.slice(0, 5).map((item) => {
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
    const inpEl = ref.querySelector('input') as HTMLInputElement
    inpEl?.focus()
  }

  onMount(() => {
    // wtf are we doing at this point.. svelte component libaries which dont fucking expose their stuf.f.. aaa
    ref = document.querySelector('.chat [data-cmdk-root]') as HTMLDivElement
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
>
  {#if $tabItems.length > 0}
    <button
      on:click={() => {
        for (const t of $tabItems) {
          dispatch('include-tab', t.id)
        }
        dispatch('close')
      }}
      class="add-app-btn active:scale-95 shadow-xl appearance-none w-fit mx-auto border-0 group margin-0 flex items-center px-3 py-1 bg-sky-200 dark:bg-gray-800 hover:bg-sky-200/50 dark:hover:bg-gray-600/50 transition-colors duration-200 rounded-xl text-sky-800 dark:text-gray-100 cursor-pointer text-xs"
      use:tooltip={{
        text: '⌘ + Shift + A',
        position: 'left'
      }}
    >
      Add all
    </button>
  {/if}
  <Command.List>
    <Command.Empty>
      {#if $isSearching}
        Searching your stuff…
      {:else}
        No tabs to add.
      {/if}
    </Command.Empty>
    {#each $tabItems as item, idx (item.id + idx)}
      <Command.Item value={item.value} on:click={handleSubmitItem}>
        <div class="flex items-center justify-center select-none shrink-0 aspect-square w-4">
          {#if item.iconUrl}
            <img
              src={item.iconUrl}
              alt={item.label}
              class="w-full h-full object-contain"
              style="transition: transform 0.3s;"
              loading="lazy"
            />
          {:else if item.iconSpaceId}
            {#await oasis.getSpace(item.iconSpaceId) then fetchedSpace}
              {#if fetchedSpace}
                <SpaceIcon folder={fetchedSpace} size="sm" interactive={false} />
              {/if}
            {/await}
          {:else if item.icon}
            <FileIcon kind={item.icon} />
          {:else}
            <Icon name="world" size="100%" />
          {/if}
        </div>
        <span class="truncate">{item.label}</span>
      </Command.Item>
    {/each}
  </Command.List>
  <Command.Input
    bind:value={$searchValue}
    autofocus
    on:keydown={handleKeyDown}
    placeholder="Search tabs or your stuff"
    class={cn('rounded-lg px-2 py-1 mt-2')}
  />
  {#if $isSearching}
    <div class="absolute right-[0.85rem] bottom-[0.85rem] z-10 opacity-75">
      <Icon name="spinner" size="17px" />
    </div>
  {/if}
</Command.Root>

<style lang="scss">
  /* NOTE: WHyyyy only tailwind? cant select anything by a meaningful name any more :') */
  :global([aria-labelledby='chat'] [data-cmdk-root]) {
    position: absolute;
    /* we should just use isolation: isolate for contained things like the sidebar insted of these zindices */
    z-index: 99999999;
    top: -0.75rem;
    right: 0;
    transform: translateY(-100%);
    min-width: 30ch;
    max-width: 30ch;

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

    :global(.add-app-btn) {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translate(-50%, -50%);
      padding-block: 0.3rem;
    }
  }
</style>
