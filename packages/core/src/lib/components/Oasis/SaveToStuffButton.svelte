<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable, derived } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import { newContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import type { BookmarkTabState } from '@horizon/core/src/lib/types'
  import type { Resource } from '@horizon/core/src/lib/service/resources'

  export let resource: Resource | undefined = undefined
  export let disabled: boolean = false
  export let side: 'top' | 'right' | 'bottom' | 'left' | undefined = undefined
  export let state = writable<BookmarkTabState>('idle')
  export let className: string = ''
  export let showCreate = false

  const oasis = useOasis()
  const dispatch = createEventDispatcher<{
    save: string | undefined
  }>()

  const spaces = oasis.spaces

  const searchValue = writable('')
  const popoverOpened = writable(false)
  const resourceSpaceIds = writable<string[]>([])

  $: resourceSpaceIdsStore = resource?.spaceIds
  $: resourceSpaceIds.set($resourceSpaceIdsStore ?? [])

  const saveToSpaceItems = derived(
    [spaces, searchValue, resourceSpaceIds],
    ([spaces, searchValue, resourceSpaceIds]) => {
      const spaceItems = spaces
        .sort((a, b) => {
          return a.indexValue - b.indexValue
        })
        .map(
          (space) =>
            ({
              id: space.id,
              label: space.dataValue.folderName,
              disabled: resourceSpaceIds.includes(space.id),
              icon: resourceSpaceIds.includes(space.id) ? 'check' : undefined,
              data: space
            }) as SelectItem
        )

      if (!searchValue) return spaceItems

      return spaceItems.filter((item) =>
        item.label.toLowerCase().includes(searchValue.toLowerCase())
      )
    }
  )

  const handleSave = () => {
    dispatch('save', undefined)
  }

  const handleSelect = (e: CustomEvent<string>) => {
    dispatch('save', e.detail)
  }
</script>

<SelectDropdown
  items={saveToSpaceItems}
  search={$spaces.length > 0 ? 'manual' : 'disabled'}
  {searchValue}
  footerItem={showCreate ? footerItem : undefined}
  inputPlaceholder="Select a Context to save to…"
  open={popoverOpened}
  openOnHover={500}
  {disabled}
  {side}
  keepHeightWhileSearching
  on:select={handleSelect}
>
  <button
    on:click={() => handleSave()}
    class={className
      ? className
      : 'flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-25 rounded-lg'}
  >
    {#if $state === 'in_progress'}
      <Icon name="spinner" size="16px" />
    {:else if $state === 'success'}
      <Icon name="check" size="16px" />
    {:else if $state === 'error'}
      <Icon name="close" size="16px" />
    {:else if $state === 'saved'}
      <Icon name="bookmarkFilled" size="16px" />
    {:else}
      <Icon name="save" size="16px" />
    {/if}
  </button>

  <div slot="empty" class="flex flex-col justify-center gap-2 h-full">
    {#if $searchValue.length > 0 || $saveToSpaceItems.length === 0}
      <div class="h-full flex flex-col justify-center">
        <p class="text-gray-400 dark:text-gray-400 text-center py-6">No Contexts found</p>
      </div>
    {/if}
  </div>
</SelectDropdown>
