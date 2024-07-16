<script lang="ts" context="module">
  export type ShortcutMenuEvents = {
    'create-tab-from-space': Space
    'create-new-space': { name: string; processNaturalLanguage: boolean }
    'create-new-history-tab': void
    'create-new-tab': void
  }
</script>

<script lang="ts">
  import { everythingSpace, ResourceManager } from '../../service/resources'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { writable, derived, type Writable } from 'svelte/store'
  import type { Space } from '../../types'
  import { ContextMenu } from 'bits-ui'

  export let spaces: Writable<Space[]>

  let selectedSpaceIndex = 0
  let isLoading = true
  let inputRef: HTMLInputElement
  const searchQuery = writable('')
  let isOpen = false

  const dispatch = createEventDispatcher<ShortcutMenuEvents>()

  const isCreatingNewSpace = writable(false)
  let newSpaceName = ''

  const filteredSpaces = derived([spaces, searchQuery], ([spaces, searchQuery]) => {
    const hasEverythingSpace = spaces.some((space) => space.id === everythingSpace.id)
    const everything = hasEverythingSpace ? spaces : [everythingSpace, ...spaces]
    return everything.filter((space) => {
      if (space.name.showInSidebar) {
        return false
      }

      if (searchQuery) {
        return space.name.folderName.toLowerCase().includes(searchQuery.toLowerCase())
      }

      return true
    })
  })
  const handleCreateNewHistoryTab = () => {
    console.log('Dispatching custom event from handleCreateNewHistoryTab')
    dispatch('create-new-history-tab')
    isOpen = false
  }

  const handleCreateNewTab = () => {
    console.log('Dispatching custom event from handleCreateNewTab')
    dispatch('create-new-tab')
    isOpen = false
  }

  const handleClick = (index: number) => {
    selectedSpaceIndex = index
    console.log('Dispatching custom event from handleClick')
    dispatch('create-tab-from-space', $filteredSpaces[selectedSpaceIndex])
    isOpen = false
  }

  const focusInput = () => {
    if (inputRef) {
      inputRef.focus()
    }
  }

  const startCreatingNewSpace = async (e: any) => {
    isOpen = true
    isCreatingNewSpace.set(true)
    await tick().then(() => {
      inputRef.focus()
    })
  }

  const cancelCreatingNewSpace = () => {
    isCreatingNewSpace.set(false)
    newSpaceName = ''
  }

  const confirmCreatingNewSpace = (processNaturalLanguage: boolean) => {
    console.log('Confirming creation of new space')
    dispatch('create-new-space', { name: newSpaceName, processNaturalLanguage })
    isCreatingNewSpace.set(false)
    newSpaceName = ''
  }

  onMount(() => {
    focusInput()
  })
</script>

<ContextMenu.Root open={isOpen} loop >
  <ContextMenu.Trigger class="select-none items-center justify-center ">
    <button
      class="transform active:scale-95 appearance-none border-0 margin-0 group flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer"
      on:click={handleCreateNewTab}
    >
      <Icon name="add" />
    </button>
  </ContextMenu.Trigger>
  <ContextMenu.Content
    class="z-50 w-full max-w-[250px] rounded-xl bg-neutral-100 px-1 py-1.5 shadow-md outline-none"
  >
    <!-- <ContextMenu.Item
      class="flex select-none items-center  py-4 pl-3 pr-1.5 cursor-pointer font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-neutral-200"
    >
      <div class="flex items-center space-x-2">
        <Icon name="add" />
        <span>Create Space</span>
      </div>
    </ContextMenu.Item> -->
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger
        class="flex  select-none items-center  py-4 pl-3 pr-1.5 cursor-pointer  font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-neutral-200 data-[state=open]:bg-neutral-200"
      >
        <div class="flex items-center space-x-2">
          <Icon name="sparkles" />
          <span> Open Space </span>
        </div>
      </ContextMenu.SubTrigger>
      <ContextMenu.SubContent
        class="z-50 w-full max-w-[260px] max-h-[400px] overflow-y-scroll rounded-xl bg-neutral-100 px-1 py-1.5 shadow-md outline-none"
      >
      {#if $filteredSpaces.length > 0}
      {#each $filteredSpaces as space, index}
      <ContextMenu.Item
      class="flex  select-none items-center  py-4 pl-3 pr-1.5 cursor-pointer  font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-neutral-200 data-[state=open]:bg-neutral-200"
      on:click={() => handleClick(index)}
    >
      {space.name.folderName}
    </ContextMenu.Item>
      {/each}
    {:else}
      <span>No spaces available</span>
    {/if}
        <ContextMenu.Item asChild>
          {#if $isCreatingNewSpace}
            <div
              class="flex select-none items-center py-4 pl-3 pr-1.5 space-x-2 cursor-pointer font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-neutral-200 data-[state=open]:bg-neutral-200"
            >
              <input
                class="search-input"
                bind:this={inputRef}
                bind:value={newSpaceName}
                on:keydown={(event) => {
                  if (event.key === 'Enter') {
                    confirmCreatingNewSpace(event.shiftKey)
                  } else if (event.key === 'Escape') {
                    cancelCreatingNewSpace()
                  }
                }}
                placeholder="Name your new space"
                data-keep-open
              />
            </div>
          {:else}
            <span
              class="flex select-none items-center py-4 pl-3 pr-1.5 space-x-2 cursor-pointer font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-neutral-200 data-[state=open]:bg-neutral-200"
              aria-hidden="true"
              on:click={startCreatingNewSpace}
            >
              <Icon name="add" color="#7d7448" />
              Create new Space
            </span>
          {/if}
        </ContextMenu.Item>
      </ContextMenu.SubContent>
    </ContextMenu.Sub>
    <ContextMenu.Separator class="my-1 block h-px bg-neutral-200" />
    <ContextMenu.Item
      class="flex  select-none items-center  py-4 pl-3 pr-1.5 cursor-pointer  font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-neutral-200"
      on:click={handleCreateNewHistoryTab}
    >
      <div class="flex items-center space-x-2">
        <Icon name="history" />
        <span>New History Tab</span>
      </div>
      <div class="ml-auto flex items-center gap-px">
        <kbd
          class="inline-flex size-5 items-center justify-center border border-dark-10 bg-neutral-200 text-[13px] text-neutral-500 shadow-xs"
        >
          ⌘
        </kbd>
        <kbd
          class="inline-flex size-5 items-center justify-center border border-dark-10 bg-neutral-200 text-[11px] text-neutral-500 shadow-xs"
        >
          Y
        </kbd>
      </div>
    </ContextMenu.Item>
    <ContextMenu.Item
      class="flex  select-none items-center  py-4 pl-3 pr-1.5 cursor-pointer  font-medium outline-none rounded-xl !ring-0 !ring-transparent data-[highlighted]:bg-neutral-200"
      on:click={handleCreateNewTab}
    >
      <div class="flex items-center space-x-2">
        <Icon name="add" />
        <span>New Tab</span>
      </div>
      <div class="ml-auto flex items-center gap-px">
        <kbd
          class="inline-flex size-5 items-center justify-center border border-dark-10 bg-neutral-200 text-[13px] text-neutral-500 shadow-xs"
        >
          ⌘
        </kbd>
        <kbd
          class="inline-flex size-5 items-center justify-center border border-dark-10 bg-neutral-200 text-[11px] text-neutral-500 shadow-xs"
        >
          T
        </kbd>
      </div>
    </ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
