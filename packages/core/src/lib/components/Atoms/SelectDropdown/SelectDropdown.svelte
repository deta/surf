<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { derived, writable, type Readable } from 'svelte/store'
  import { DropdownMenu, type CustomEventHandler } from 'bits-ui'

  import { flyAndScale, focus } from '@horizon/utils'
  import type { SelectItem } from '.'
  import SelectDropdownItem from './SelectDropdownItem.svelte'

  export let items: Readable<SelectItem[]>
  export let selected: string | null = null
  export let footerItem: SelectItem | null = null
  export let search: 'auto' | 'manual' | 'disabled' = 'disabled'
  export let searchValue = writable<string>('')
  export let inputPlaceholder = 'Filter...'
  export let emptyPlaceholder = 'No items found'
  export let open = writable(false)
  export let openOnHover: boolean | number = false
  export let closeOnMouseLeave = true
  export let keepHeightWhileSearching = false
  export let side: 'top' | 'right' | 'bottom' | 'left' | undefined = undefined
  export let disabled: boolean = false

  const dispatch = createEventDispatcher<{ select: string }>()

  const inputFocused = writable(false)

  let listElem: HTMLDivElement
  let inputElem: HTMLInputElement
  let overflowBottom = false
  let overflowTop = false
  let listElemHeight = 0
  let closeTimeout: ReturnType<typeof setTimeout>
  let openTimeout: ReturnType<typeof setTimeout>

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

  const handleTriggerMouseEnter = (_e: MouseEvent) => {
    clearTimeout(closeTimeout)

    if (typeof openOnHover === 'number') {
      openTimeout = setTimeout(() => {
        open.set(true)
      }, openOnHover)
    } else {
      open.set(true)
    }
  }

  const handleMouseEnter = (_e: MouseEvent) => {
    open.set(true)
    clearTimeout(closeTimeout)
  }

  const handleMouseLeave = (_e: MouseEvent) => {
    clearTimeout(openTimeout)

    closeTimeout = setTimeout(() => {
      open.set(false)
      $searchValue = ''
    }, 150)
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

{#if disabled}
  <slot></slot>
{:else}
  <DropdownMenu.Root
    bind:open={$open}
    onOpenChange={handleOpenChange}
    loop
    typeahead={search === 'disabled'}
  >
    <DropdownMenu.Trigger
      class="focus-visible inline-flex items-center justify-center active:scale-98 focus:outline-none"
    >
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        on:mouseenter={(e) => openOnHover && handleTriggerMouseEnter(e)}
        on:mouseleave={(e) => openOnHover && handleMouseLeave(e)}
      >
        <slot></slot>
      </div>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      class="w-full max-w-[229px] rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-xl no-drag focus:outline-none"
      transition={flyAndScale}
      sideOffset={8}
      {side}
      on:keydown={handleKeyDown}
    >
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        bind:clientHeight={listElemHeight}
        class="w-full max-h-[400px] overflow-auto flex flex-col"
        style:height={keepHeightWhileSearching && $searchValue ? listElemHeight + 'px' : 'auto'}
        on:mouseenter={(e) => closeOnMouseLeave && handleMouseEnter(e)}
        on:mouseleave={(e) => closeOnMouseLeave && handleMouseLeave(e)}
      >
        {#if search !== 'disabled'}
          <div class="flex-shrink-0 px-1.5 py-1.5 pb-1 z-10" class:bottom-shadow={overflowTop}>
            <input
              bind:this={inputElem}
              bind:value={$searchValue}
              placeholder={inputPlaceholder}
              class="w-full px-3 py-1.5 font-medium dark:text-gray-100 bg-gray-100 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-lg outline-1 outline outline-sky-700 focus:outline focus:outline-1"
              use:focus={inputFocused}
            />
          </div>
        {/if}

        <div
          class="w-full h-full overflow-auto px-1 py-1.5"
          bind:this={listElem}
          on:scroll={handleScrollCheck}
        >
          {#if $filterdItems.length > 0}
            {#each $filterdItems as item, idx (item.id + idx)}
              <DropdownMenu.Item
                on:click={() => dispatch('select', item.id)}
                class="flex h-10 select-none items-center rounded-lg py-3 pl-3 pr-1.5 text-base font-medium !ring-0 !ring-transparent data-[highlighted]:bg-gray-200 dark:data-[highlighted]:bg-gray-700 focus:outline-none {selected ===
                item.id
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'dark:text-gray-100'}"
              >
                <slot name="item" {item}>
                  <SelectDropdownItem {item} />
                </slot>
              </DropdownMenu.Item>
            {/each}
          {:else}
            <slot name="empty">
              <div class="flex items-center justify-center h-20 text-gray-400 dark:text-gray-500">
                {emptyPlaceholder}
              </div>
            </slot>
          {/if}
        </div>

        {#if footerItem}
          <div
            class="flex-shrink-0 border-t border-gray-200 dark:border-gray-600 px-0.5 py-0.5"
            class:top-shadow={overflowBottom}
          >
            <DropdownMenu.Item
              on:click={() => dispatch('select', footerItem.id)}
              class="flex h-10 select-none items-center rounded-lg py-3 pl-3 pr-1.5 text-base font-medium !ring-0 !ring-transparent data-[highlighted]:bg-gray-200 dark:data-[highlighted]:bg-gray-700 focus:outline-none  {selected ===
              footerItem.id
                ? 'text-sky-600 dark:text-sky-400'
                : 'dark:text-gray-100'}"
            >
              <slot name="item" item={footerItem}>
                <SelectDropdownItem item={footerItem} />
              </slot>
            </DropdownMenu.Item>
          </div>
        {/if}
      </div>
      <DropdownMenu.Arrow />
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/if}

<style lang="scss">
  .top-shadow {
    // shadow to show that the list content continues underneath this element
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

    :global(.dark) & {
      box-shadow: 0 2px 10px rgba(255, 255, 255, 0.15);
    }
  }

  .bottom-shadow {
    // shadow to show that the list content continues underneath this element
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.25);

    :global(.dark) & {
      box-shadow: 0 -2px 10px rgba(255, 255, 255, 0.15);
    }
  }
</style>
