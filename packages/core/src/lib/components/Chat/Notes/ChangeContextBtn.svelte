<script lang="ts">
  import { derived, readable, writable } from 'svelte/store'
  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import { tooltip } from '@deta/utils'
  import {
    ACTIVE_CONTEXT_MENTION,
    EVERYTHING_MENTION,
    NO_CONTEXT_MENTION,
    TABS_MENTION
  } from '@horizon/core/src/lib/constants/chat'

  export let activeSpace = readable<OasisSpace | undefined>(undefined)
  export let selectedContext = writable<string | null>(null)
  export let spaces = readable<OasisSpace[]>([])
  export let disabled: boolean = false

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
      const createItem = (data: SelectItem, selected: boolean) => {
        return {
          ...data,
          label: selected ? `${data.label} (selected)` : data.label,
          icon: selected ? 'check' : data.icon,
          disabled: selected
        } as SelectItem
      }

      const spaceItems = spaces
        .sort((a, b) => {
          return a.indexValue - b.indexValue
        })
        .map((space) => {
          const selected = space.id === selectedSpace?.id
          return createItem(
            {
              id: space.id,
              label: space.dataValue.folderName,
              icon: space.getIconString(),
              data: space
            } as SelectItem,
            selected
          )
        })

      spaceItems.unshift(
        ...[
          createItem(
            {
              id: NO_CONTEXT_MENTION.id,
              label: NO_CONTEXT_MENTION.suggestionLabel || NO_CONTEXT_MENTION.label,
              icon: NO_CONTEXT_MENTION.icon,
              data: undefined
            },
            selectedContext === NO_CONTEXT_MENTION.id
          ),
          createItem(
            {
              id: EVERYTHING_MENTION.id,
              label: EVERYTHING_MENTION.suggestionLabel || EVERYTHING_MENTION.label,
              icon: EVERYTHING_MENTION.icon,
              data: undefined
            },
            selectedContext === EVERYTHING_MENTION.id
          ),
          createItem(
            {
              id: ACTIVE_CONTEXT_MENTION.id,
              label: ACTIVE_CONTEXT_MENTION.suggestionLabel || ACTIVE_CONTEXT_MENTION.label,
              icon: ACTIVE_CONTEXT_MENTION.icon,
              data: undefined
            },
            selectedContext === ACTIVE_CONTEXT_MENTION.id
          ),
          createItem(
            {
              id: TABS_MENTION.id,
              label: TABS_MENTION.suggestionLabel || TABS_MENTION.label,
              icon: TABS_MENTION.icon,
              data: undefined
            },
            selectedContext === TABS_MENTION.id
          )
        ]
      )

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
    {#if $selectedContext === NO_CONTEXT_MENTION.id}
      <DynamicIcon name={NO_CONTEXT_MENTION.icon} />
    {:else if $selectedContext === EVERYTHING_MENTION.id}
      <DynamicIcon name={EVERYTHING_MENTION.icon} />
    {:else if $selectedContext === ACTIVE_CONTEXT_MENTION.id}
      <DynamicIcon name={ACTIVE_CONTEXT_MENTION.icon} />
    {:else if $selectedContext === TABS_MENTION.id}
      <DynamicIcon name={TABS_MENTION.icon} />
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
