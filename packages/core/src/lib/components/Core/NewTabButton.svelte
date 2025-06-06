<script lang="ts" context="module">
  export type ShortcutMenuEvents = {
    'create-tab-from-space': OasisSpace
    'create-new-space': { name: string; processNaturalLanguage: boolean }
    'create-new-history-tab': void
    'create-new-tab': void
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { writable, derived, type Writable } from 'svelte/store'
  import { DropdownMenu } from 'bits-ui'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let spaces: Writable<OasisSpace[]>

  let selectedSpaceIndex = 0
  let inputRef: HTMLInputElement
  const searchQuery = writable('')
  let isOpen = false

  const dispatch = createEventDispatcher<ShortcutMenuEvents>()

  const isCreatingNewSpace = writable(false)
  let newSpaceName = ''

  const filteredSpaces = derived([spaces, searchQuery], ([spaces, searchQuery]) => {
    return spaces.filter((space) => {
      if (searchQuery) {
        return space.dataValue.folderName.toLowerCase().includes(searchQuery.toLowerCase())
      }

      return true
    })
  })

  const handleClick = (index: number) => {
    selectedSpaceIndex = index
    dispatch('create-tab-from-space', $filteredSpaces[selectedSpaceIndex])
    isOpen = false
  }

  const focusInput = () => {
    if (inputRef) {
      inputRef.focus()
    }
  }

  const handleBlur = () => {
    isCreatingNewSpace.set(false)
  }

  const cancelCreatingNewSpace = () => {
    isCreatingNewSpace.set(false)
    newSpaceName = ''
  }

  const confirmCreatingNewSpace = (processNaturalLanguage: boolean) => {
    dispatch('create-new-space', { name: newSpaceName, processNaturalLanguage })
    isCreatingNewSpace.set(false)
    newSpaceName = ''
  }

  onMount(() => {
    focusInput()
  })
</script>

<DropdownMenu.Root open={isOpen} loop typeahead={!isCreatingNewSpace}>
  <DropdownMenu.Trigger class="select-none items-center justify-center ">
    <button
      class="transform active:scale-95 appearance-none border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800"
    >
      <Icon name="save" />
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    class="z-50 w-full max-w-[250px] rounded-xl bg-gray-100 px-1 py-1.5 shadow-md outline-none"
  >
    <DropdownMenu.Group class="max-h-[300px] overflow-y-scroll">
      {#if $filteredSpaces.length > 0}
        {#each $filteredSpaces as space, index}
          <DropdownMenu.Item
            class="flex  select-none items-center group  py-4 pl-3 pr-1.5  space-x-4 justify-between  font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-gray-200 data-[state=open]:bg-gray-200"
            on:click={() => handleClick(index)}
          >
            <div class="truncate">{space.dataValue.folderName}</div>
            <div
              class="items-center gap-px text-[10px] hidden group-focus:flex opacity-50 ease-in-out flex-shrink-0"
            >
              Open Space
            </div>
          </DropdownMenu.Item>
        {/each}
      {:else}
        <DropdownMenu.Item
          class="flex  select-none items-center  py-4 pl-3 pr-1.5 cursor-not-allowed  font-medium outline-none rounded-xl !ring-0 !ring-transparent "
        >
          No spaces available
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Group>

    <DropdownMenu.Separator class="my-1 block h-px bg-gray-200" />
    <DropdownMenu.Item asChild>
      <input
        class="w-full py-4 pl-3 pr-1.5 space-x-2 font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-gray-200 data-[state=open]:bg-gray-200"
        bind:this={inputRef}
        bind:value={newSpaceName}
        on:blur={handleBlur}
        on:keydown={(event) => {
          if (event.key === 'Enter') {
            confirmCreatingNewSpace(event.shiftKey)
          } else if (event.key === 'Escape') {
            cancelCreatingNewSpace()
          }
        }}
        placeholder="Create a new Space"
        data-keep-open
        tabindex="0"
      />
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
