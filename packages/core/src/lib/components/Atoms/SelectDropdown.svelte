<script lang="ts" context="module">
  export type SelectItem = {
    id: string
    label: string
    icon?: Icons
    data: any
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { derived, writable, type Readable } from 'svelte/store'
  import { DropdownMenu, type CustomEventHandler } from 'bits-ui'

  import { flyAndScale, focus } from '@horizon/utils'
  import type { Icons } from '@horizon/icons'

  export let items: Readable<SelectItem[]>
  export let selected: string | null = null
  export let footerItem: SelectItem | null = null
  export let search: 'auto' | 'manual' | 'disabled' = 'disabled'
  export let searchValue = writable<string>('')
  export let inputPlaceholder = 'Filter...'

  const dispatch = createEventDispatcher<{ select: string }>()

  const inputFocused = writable(false)

  let listElem: HTMLDivElement
  let inputElem: HTMLInputElement
  let overflowBottom = false
  let overflowTop = false

  const filterdItems = derived([items, searchValue], ([$items, $searchValue]) => {
    if (search === 'manual' || search === 'disabled' || !$searchValue) return $items

    return $items.filter((item) => item.label.toLowerCase().includes($searchValue.toLowerCase()))
  })

  const handleKeyDown = (e: CustomEventHandler<KeyboardEvent, HTMLDivElement>) => {
    if ($inputFocused) return

    // is letter or other visble key
    const event = e.detail.originalEvent
    if (event.key.length === 1) {
      $searchValue = $searchValue + event.key
    } else if (event.key === 'Backspace') {
      inputElem.focus()
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      handleScrollCheck()
    } else {
      $searchValue = ''
    }
  }

  const checkOverflow = async (_items: SelectItem[]) => {
    await tick()

    if (!listElem) return

    if (listElem.scrollHeight > listElem.clientHeight) {
      overflowBottom = true
      overflowTop = true
    } else {
      overflowBottom = false
      overflowTop = false
    }

    // Remove the class when scrolled to the bottom of the list
    const isScrolledToBottom =
      Math.abs(
        Math.floor(listElem.scrollHeight - listElem.scrollTop) - Math.floor(listElem.clientHeight)
      ) <= 1
    if (isScrolledToBottom) {
      overflowBottom = false
    }

    // Remove the class when scrolled to the top of the list
    const isScrolledToTop = listElem.scrollTop === 0
    if (isScrolledToTop) {
      overflowTop = false
    }
  }

  const handleScrollCheck = () => {
    checkOverflow($filterdItems)
  }

  $: checkOverflow($filterdItems)

  onMount(() => {
    handleScrollCheck()
  })
</script>

<DropdownMenu.Root onOpenChange={handleOpenChange} loop typeahead={search === 'disabled'}>
  <DropdownMenu.Trigger
    class="focus-visible inline-flex items-center justify-center active:scale-98 focus:outline-none"
  >
    <slot></slot>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    class="w-full max-w-[229px] max-h-[400px] overflow-auto flex flex-col rounded-xl border border-gray-200 bg-white shadow-xl no-drag focus:outline-none"
    transition={flyAndScale}
    sideOffset={8}
    on:keydown={handleKeyDown}
  >
    {#if search !== 'disabled'}
      <div class="flex-shrink-0 px-1.5 py-1.5 pb-1" class:bottom-shadow={overflowTop}>
        <input
          bind:this={inputElem}
          bind:value={$searchValue}
          placeholder={inputPlaceholder}
          class="w-full px-3 py-1.5 text-base font-medium bg-gray-100 border border-gray-200 rounded-lg outline-1 outline outline-sky-700 focus:outline focus:outline-1"
          use:focus={inputFocused}
        />
      </div>
    {/if}

    <div
      class="w-full h-full overflow-auto px-1 py-1.5"
      bind:this={listElem}
      on:scroll={handleScrollCheck}
    >
      {#each $filterdItems as item, idx (item.id + idx)}
        <DropdownMenu.Item
          on:click={() => dispatch('select', item.id)}
          class="flex h-10 select-none items-center rounded-lg py-3 pl-3 pr-1.5 text-base font-medium !ring-0 !ring-transparent data-[highlighted]:bg-gray-200 focus:outline-none cursor-pointer {selected ===
          item.id
            ? 'text-sky-600'
            : ''}"
        >
          <slot name="item" {item}></slot>
        </DropdownMenu.Item>
      {/each}
    </div>

    {#if footerItem}
      <div
        class="flex-shrink-0 border-t border-gray-200 px-0.5 py-0.5"
        class:top-shadow={overflowBottom}
      >
        <DropdownMenu.Item
          on:click={() => dispatch('select', footerItem.id)}
          class="flex h-10 select-none items-center rounded-lg py-3 pl-3 pr-1.5 text-base font-medium !ring-0 !ring-transparent data-[highlighted]:bg-gray-200 focus:outline-none cursor-pointer {selected ===
          footerItem.id
            ? 'text-sky-600'
            : ''}"
        >
          <slot name="item" item={footerItem}></slot>
        </DropdownMenu.Item>
      </div>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style lang="scss">
  .top-shadow {
    // shadow to show that the list content continues underneath this element
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .bottom-shadow {
    // shadow to show that the list content continues underneath this element
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.25);
  }
</style>
