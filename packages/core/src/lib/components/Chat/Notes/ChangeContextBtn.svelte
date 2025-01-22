<script lang="ts">
  import { derived, readable, writable } from 'svelte/store'
  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import { createEventDispatcher } from 'svelte'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { generalContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { tooltip } from '@horizon/utils'

  export let activeSpace = readable<OasisSpace | undefined>(undefined)
  export let selectedContext = writable<string | null>(null)
  export let spaces = readable<OasisSpace[]>([])
  export let disabled: boolean = false

  const dispatch = createEventDispatcher<{
    select: string
  }>()

  const searchValue = writable('')
  const open = writable(false)

  const selectedSpace = derived(
    [selectedContext, activeSpace, spaces],
    ([selectedContext, activeSpace, spaces]) => {
      return selectedContext ? spaces.find((space) => space.id === selectedContext) : activeSpace
    }
  )

  const saveToSpaceItems = derived(
    [spaces, searchValue, selectedSpace, selectedContext, activeSpace],
    ([spaces, searchValue, selectedSpace, selectedContext, activeSpace]) => {
      const spaceItems = spaces
        .filter((space) => space.id !== selectedSpace?.id)
        .sort((a, b) => {
          return a.indexValue - b.indexValue
        })
        .map(
          (space) =>
            ({
              id: space.id,
              label: space.dataValue.folderName,
              data: space
            }) as SelectItem
        )

      const hideGeneral =
        selectedContext === generalContext.id || (!activeSpace && !selectedContext)
      if (!hideGeneral) {
        spaceItems.unshift(generalContext)
      }

      if (selectedContext !== 'everything') {
        spaceItems.unshift({
          id: 'everything',
          label: 'All My Stuff',
          icon: 'save',
          data: undefined
        })
      }

      if (selectedContext !== 'active-context') {
        spaceItems.unshift({
          id: 'active-context',
          label: 'Active Context',
          icon: 'sparkles',
          data: undefined
        })
      }

      if (selectedContext !== 'tabs') {
        spaceItems.unshift({
          id: 'tabs',
          label: 'Your Tabs',
          icon: 'world',
          data: undefined
        })
      }

      if (!searchValue) return spaceItems

      return spaceItems.filter((item) =>
        item.label.toLowerCase().includes(searchValue.toLowerCase())
      )
    }
  )
</script>

<SelectDropdown
  items={saveToSpaceItems}
  search={$spaces.length > 0 ? 'manual' : 'disabled'}
  {searchValue}
  inputPlaceholder="Select context for this note"
  {open}
  {disabled}
  side="bottom"
  keepHeightWhileSearching
  on:select
>
  <button
    on:click
    use:tooltip={{ text: 'Change Context', position: 'left' }}
    class="flex items-center justify-center appearance-none border-4 border-transparent h-min-content rounded-lg hover:border-gray-200 dark:hover:border-[#3e3e3e]"
  >
    {#if $selectedContext === generalContext.id}
      <Icon name={generalContext.icon} />
    {:else if $selectedContext === 'everything'}
      <Icon name="save" />
    {:else if $selectedContext === 'active-context'}
      <Icon name="sparkles" />
    {:else if $selectedContext === 'tabs'}
      <Icon name="world" />
    {:else if $selectedSpace}
      <DynamicIcon name={$selectedSpace.getIconString()} />
    {:else}
      <Icon name="circle-dot" />
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
