<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { derived, writable, type Readable } from 'svelte/store'
  import { DropdownMenu, type CustomEventHandler } from 'bits-ui'

  import { flyAndScaleDirectional, focus, wait } from '@deta/utils'
  import type { SelectItem } from '.'
  import SelectDropdownItem from './SelectDropdownItem.svelte'
  import { Icon } from '@deta/icons'

  export let items: Readable<SelectItem[]>
  export let selected: string | null = null
  export let footerItem: SelectItem | null | boolean = null
  export let search: 'auto' | 'manual' | 'disabled' = 'disabled'
  export let searchValue = writable<string>('')
  export let inputPlaceholder = 'Filter...'
  export let emptyPlaceholder = 'No items found'
  export let loadingPlaceholder = 'Loading...'
  export let open = writable(false)
  export let openOnHover: boolean | number = false
  export let closeOnMouseLeave = true
  export let keepHeightWhileSearching = false
  export let side: 'top' | 'right' | 'bottom' | 'left' | undefined = undefined
  export let disabled: boolean = false
  export let loading = false

  const dispatch = createEventDispatcher<{ select: string }>()

  const inputFocused = writable(false)

  let listElem: HTMLDivElement
  let inputElem: HTMLInputElement
  let contentElem: HTMLDivElement
  let overflowBottom = false
  let overflowTop = false
  let listElemHeight = 0
  let closeTimeout: ReturnType<typeof setTimeout>
  let openTimeout: ReturnType<typeof setTimeout>
  let oldOpen: boolean | null = null

  const filterdItems = derived([items, searchValue], ([$items, $searchValue]) => {
    if (search === 'manual' || search === 'disabled' || !$searchValue) return $items

    return $items.filter((item) => item.label.toLowerCase().includes($searchValue.toLowerCase()))
  })

  const handleOpen = async () => {
    await wait(5)
  }

  const handleClose = () => {
  }

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
    }, 100)
  }

  const handleContentMouseLeave = (_e: MouseEvent) => {
    if (closeOnMouseLeave && $open) {
      handleMouseLeave(_e)
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

  $: if (oldOpen !== $open) {
    oldOpen = $open
    if ($open) {
      handleOpen()
    } else {
      handleClose()
    }
  }

  onMount(() => {
    try {
      handleScrollCheck()
    } catch (error) {
      // no-op
    }
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
    <DropdownMenu.Trigger class="dropdown-trigger">
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        on:mouseenter={(e) => openOnHover && handleTriggerMouseEnter(e)}
        on:mouseleave={(e) => openOnHover && handleMouseLeave(e)}
      >
        <slot></slot>
      </div>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      class="dropdown-content no-drag"
      transition={(node, params) => flyAndScaleDirectional(node, { ...params, side })}
      sideOffset={8}
      {side}
      onkeydown={handleKeyDown}
    >
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        bind:this={contentElem}
        bind:clientHeight={listElemHeight}
        class="dropdown-inner"
        style:height={keepHeightWhileSearching && $searchValue ? listElemHeight + 'px' : 'auto'}
        on:mouseenter={(e) => closeOnMouseLeave && handleMouseEnter(e)}
        on:mouseleave={(e) => closeOnMouseLeave && handleContentMouseLeave(e)}
      >
        {#if search !== 'disabled'}
          <div class="search-wrapper" class:bottom-shadow={overflowTop}>
            <input
              bind:this={inputElem}
              bind:value={$searchValue}
              placeholder={inputPlaceholder}
              class="search-input"
              use:focus={inputFocused}
            />

            {#if loading}
              <div class="loading-spinner">
                <Icon name="spinner" class="opacity-50" />
              </div>
            {/if}
          </div>
        {/if}

        <div class="list-container" bind:this={listElem} on:scroll={handleScrollCheck}>
          {#if $filterdItems.length > 0}
            {#each $filterdItems as item, idx (item.id + idx)}
              {#if item.topSeparator}
                <DropdownMenu.Separator class="separator" />
              {/if}

              <DropdownMenu.Item
                onclick={() => dispatch('select', item.id)}
                disabled={item.disabled}
                class="dropdown-item {item.disabled ? 'disabled' : ''} {selected === item.id
                  ? 'selected'
                  : ''} {item.kind === 'danger' ? 'danger' : ''}"
              >
                <slot name="item" {item}>
                  <SelectDropdownItem {item} />
                </slot>
              </DropdownMenu.Item>

              {#if item.bottomSeparator}
                <DropdownMenu.Separator class="separator" />
              {/if}
            {/each}
          {:else if loading}
            <div class="placeholder-text">{loadingPlaceholder}</div>
          {:else}
            <slot name="empty">
              <div class="placeholder-text">{emptyPlaceholder}</div>
            </slot>
          {/if}
        </div>

        {#if footerItem}
          <div class="footer-wrapper" class:top-shadow={overflowBottom}>
            <slot name="footer">
              <DropdownMenu.Item
                onclick={() => dispatch('select', footerItem.id)}
                class="dropdown-item {selected === footerItem.id ? 'selected' : ''}"
              >
                <slot name="item" item={footerItem}>
                  <SelectDropdownItem item={footerItem} />
                </slot>
              </DropdownMenu.Item>
            </slot>
          </div>
        {/if}
      </div>
      <DropdownMenu.Arrow />
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/if}

<style lang="scss">
  :global(.dropdown-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    outline: none;

    &:focus-visible {
      outline: 2px solid light-dark(#0ea5e9, #38bdf8);
      outline-offset: 2px;
    }

    &:active {
      transform: scale(0.98);
    }
  }

  :global(.dropdown-content) {
    width: 26ch;
    border-radius: 12px;
    border: 1px solid light-dark(#e5e7eb, #374151);
    background: light-dark(#ffffff, #1f2937);
    box-shadow: 0 20px 25px -5px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.5)),
      0 10px 10px -5px light-dark(rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.3));
    outline: none;
    z-index: 1000;
  }

  .dropdown-inner {
    width: 100%;
    max-height: 400px;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }

  .search-wrapper {
    flex-shrink: 0;
    padding: 0.25rem;
    padding-bottom: 0.25rem;
    z-index: 10;
    position: relative;

    &.bottom-shadow {
      box-shadow: 0 -2px 10px light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.15));
    }
  }

  .search-input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    font-size: 0.95rem;
    font-weight: 450;
    color: light-dark(#1f2937, #f3f4f6);
    background: light-dark(#f3f4f6, rgba(55, 65, 81, 0.8));
    border: 1px solid light-dark(#e5e7eb, #4b5563);
    border-radius: 8px;
    outline: none;
    transition: all 0.2s;

    &:focus {
      outline: 1px solid light-dark(#0369a1, #0ea5e9);
      border-color: light-dark(#0369a1, #0ea5e9);
    }

    &::placeholder {
      color: light-dark(#9ca3af, #6b7280);
    }
  }

  .loading-spinner {
    position: absolute;
    top: 50%;
    right: 0.75rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .list-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: 0.25rem;
  }

  :global(.separator) {
    background: light-dark(#f3f4f6, #374151);
    height: 1px;
    margin: 0.25rem 0;
  }

  :global(.dropdown-item) {
    display: flex;
    height: 2rem;
    user-select: none;
    align-items: center;
    border-radius: 8px;
    padding: 0.25rem 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: light-dark(#1f2937, #f3f4f6);
    outline: none !important;
    cursor: pointer;
    transition: all 0.15s;
    ring: 0 !important;
    box-shadow: none !important;

    &:hover,
    &[data-highlighted] {
      background: light-dark(#e5e7eb, #374151) !important;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;

      &:hover {
        background: transparent !important;
      }
    }

    &.selected {
      color: light-dark(#0284c7, #38bdf8);
    }

    &.danger {
      color: light-dark(#dc2626, #f87171);
    }
  }

  .placeholder-text {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 5rem;
    color: light-dark(#9ca3af, #6b7280);
    font-size: 0.95rem;
  }

  .footer-wrapper {
    flex-shrink: 0;
    border-top: 1px solid light-dark(#e5e7eb, #4b5563);
    padding: 0.125rem;

    &.top-shadow {
      box-shadow: 0 2px 10px light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.15));
    }
  }
</style>
