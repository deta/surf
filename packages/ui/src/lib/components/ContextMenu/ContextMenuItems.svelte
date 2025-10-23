<script lang="ts">
  import { DynamicIcon, Icon } from '@deta/icons'
  import { closeContextMenu, type CtxItem } from './ContextMenu.svelte'
  import { onMount, tick, getContext, setContext } from 'svelte'
  import { writable, get } from 'svelte/store'

  export let items: CtxItem[]
  export let subMenuRef: string | undefined = undefined
  export let showSearch: boolean = false
  export let isActiveMenu: boolean = subMenuRef === undefined // Root menu is active by default

  let anchor: 'left' | 'right' = 'right'
  let subMenuYOffset = 0
  let searchQuery = writable('')
  let filteredItems = items
  let searchInputElement: HTMLInputElement
  let selectedIndex = -1
  let menuElement: HTMLUListElement
  let isUsingKeyboard = false // Track if user is using keyboard navigation

  // Define the type for our active submenu store
  type ActiveSubMenuStore = import('svelte/store').Writable<string | null>

  // Store to track which sub-menu is currently active
  const parentActiveSubMenuStore: ActiveSubMenuStore =
    subMenuRef === undefined
      ? writable<string | null>(null)
      : getContext<ActiveSubMenuStore>('activeSubMenuStore')

  // Set this context for child menus
  if (subMenuRef === undefined) {
    setContext<ActiveSubMenuStore>('activeSubMenuStore', parentActiveSubMenuStore)
  }

  let focusInterval: number | undefined

  // Update body attribute when active submenu changes
  $: if (subMenuRef === undefined) {
    // Only the root menu should control the body attribute
    const hasActiveSubmenu = get(parentActiveSubMenuStore) !== null
    if (hasActiveSubmenu) {
      document.body.setAttribute('data-has-active-submenu', 'true')
    } else {
      document.body.removeAttribute('data-has-active-submenu')
    }
  }

  onMount(async () => {
    if (subMenuRef !== undefined) {
      await tick()
      const subMenu = document.querySelector(
        `.sub-menu[data-sub-menu-ref="${subMenuRef}"]`
      ) as HTMLElement
      const box = subMenu?.getBoundingClientRect()

      subMenu.classList.add('hidden')

      if (box.left + box.width > window.innerWidth) {
        anchor = 'left'
      }
      if (box.top + box.height > window.innerHeight) {
        subMenuYOffset = window.innerHeight - (box.top + box.height)
      }

      // Initial focus attempt
      await tick()
      tryFocus()

      // Super aggressive approach: try to focus every 250ms until component is destroyed
      focusInterval = window.setInterval(() => {
        tryFocus()
      }, 250)
    }

    // Set initial selection to first non-separator item
    await tick()
    if (filteredItems.length > 0) {
      selectedIndex = findNextSelectableItemIndex(-1, 1)
    }

    // Add keyboard event listener
    if (menuElement) {
      menuElement.addEventListener('keydown', handleKeyDown)
    }

    // Subscribe to active submenu changes
    const unsubscribe = parentActiveSubMenuStore.subscribe((activeRef) => {
      isActiveMenu = subMenuRef === undefined ? activeRef === null : activeRef === subMenuRef
    })

    return () => {
      // Clean up interval when component is destroyed
      if (focusInterval !== undefined) {
        window.clearInterval(focusInterval)
      }
      // Remove keyboard event listener
      if (menuElement) {
        menuElement.removeEventListener('keydown', handleKeyDown)
      }
      // Unsubscribe from store
      unsubscribe()

      // Reset active submenu when this component is destroyed
      if (subMenuRef !== undefined && get(parentActiveSubMenuStore) === subMenuRef) {
        parentActiveSubMenuStore.set(null)
      }

      // Clean up body attribute if this is the root menu
      if (subMenuRef === undefined) {
        document.body.removeAttribute('data-has-active-submenu')
      }
    }
  })

  function tryFocus() {
    if (searchInputElement) {
      searchInputElement.focus()
    } else if (menuElement) {
      menuElement.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Only handle keyboard events if this is the active menu
    if (!isActiveMenu) return

    // Set keyboard navigation flag
    isUsingKeyboard = true

    // Force update all menu items to remove hover styling
    updateHoverStyles()

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedIndex = findNextSelectableItemIndex(selectedIndex, 1)
      scrollSelectedIntoView()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedIndex = findNextSelectableItemIndex(selectedIndex, -1)
      scrollSelectedIntoView()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectCurrentItem()
    } else if (event.key === 'ArrowRight' && selectedIndex >= 0) {
      // Open submenu with right arrow if on a submenu item
      const item = filteredItems[selectedIndex]
      if (item?.type === 'sub-menu' && !item.disabled) {
        event.preventDefault()
        openSubMenu(selectedIndex)
      }
    } else if (event.key === 'ArrowLeft' && subMenuRef !== undefined) {
      // Close current submenu with left arrow if this is a submenu
      event.preventDefault()
      parentActiveSubMenuStore.set(null)
    } else if (event.key === 'Escape') {
      // Handle escape to close menu
      event.preventDefault()
      if (subMenuRef !== undefined) {
        // If this is a submenu, just close this level
        parentActiveSubMenuStore.set(null)
      } else {
        // If this is the root menu, close the entire context menu
        closeContextMenu()
      }
    }
  }

  function openSubMenu(index: number) {
    if (index >= 0 && index < filteredItems.length) {
      const item = filteredItems[index]
      if (item.type === 'sub-menu' && !item.disabled) {
        parentActiveSubMenuStore.set(`${index}`)
      }
    }
  }

  function findNextSelectableItemIndex(currentIndex: number, direction: 1 | -1): number {
    if (filteredItems.length === 0) return -1

    let nextIndex = currentIndex + direction

    // Loop through the array to find a selectable item
    for (let i = 0; i < filteredItems.length; i++) {
      // Wrap around if we go out of bounds
      if (nextIndex < 0) nextIndex = filteredItems.length - 1
      if (nextIndex >= filteredItems.length) nextIndex = 0

      const item = filteredItems[nextIndex]

      // Skip separators and disabled items
      if (item.type !== 'separator' && !item.disabled) {
        return nextIndex
      }

      nextIndex += direction
    }

    return currentIndex // If no selectable item found, keep the current index
  }

  function selectCurrentItem() {
    if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
      const item = filteredItems[selectedIndex]

      if (item.type === 'action' && item.action && !item.disabled) {
        item.action()
        // Close the context menu after selecting an action
        closeContextMenu()
      } else if (item.type === 'sub-menu' && !item.disabled) {
        // Open the submenu when selected with Enter
        openSubMenu(selectedIndex)
      }
    }
  }

  function updateHoverStyles() {
    if (!menuElement) return

    const items = menuElement.querySelectorAll('button, li.sub-item')

    items.forEach((item, i) => {
      if (isUsingKeyboard && i !== selectedIndex) {
        item.classList.add('hover-override')
      } else {
        item.classList.remove('hover-override')
      }
    })
  }

  function scrollSelectedIntoView() {
    if (!menuElement || selectedIndex < 0) return

    tick().then(() => {
      const selectedItem = menuElement.querySelector(`button.selected, li.selected`) as HTMLElement
      if (selectedItem) {
        // Calculate if the item is in view
        const containerRect = menuElement.getBoundingClientRect()
        const itemRect = selectedItem.getBoundingClientRect()

        // Check if item is outside visible area
        const isAbove = itemRect.top < containerRect.top
        const isBelow = itemRect.bottom > containerRect.bottom

        if (isAbove || isBelow) {
          selectedItem.scrollIntoView({
            behavior: 'auto',
            block: isBelow ? 'end' : 'start'
          })
        }
      }
    })
  }

  // Watch for changes to selectedIndex and update hover styles
  $: if (isUsingKeyboard && selectedIndex >= 0) {
    tick().then(() => {
      updateHoverStyles()
      scrollSelectedIntoView()
    })
  }

  // Filter items based on search query
  $: {
    if ($searchQuery) {
      const query = $searchQuery.toLowerCase()
      filteredItems = items.filter((item) => {
        if (item.type === 'separator') return false
        return item.text?.toLowerCase().includes(query)
      })
    } else {
      filteredItems = items
    }
  }
</script>

<ul
  class="context-menu-items"
  class:sub-menu={subMenuRef !== undefined}
  data-sub-menu-ref={subMenuRef}
  class:sub-items={subMenuRef !== undefined}
  class:anchor-left={anchor === 'left'}
        class:hidden={$parentActiveSubMenuStore !== subMenuRef}
  style={subMenuRef !== undefined
    ? `position:fixed; --sub-id: --sub-${subMenuRef}; --y-offset: ${subMenuYOffset}px;`
    : ''}
  bind:this={menuElement}
  tabindex="0"
  on:mousemove={() => isUsingKeyboard && ((isUsingKeyboard = false), updateHoverStyles())}
>
  {#if showSearch}
    <div class="search-container">
      <input
        type="text"
        placeholder="Search..."
        bind:value={$searchQuery}
        bind:this={searchInputElement}
        class="search-input"
      />
    </div>
  {/if}
  {#each filteredItems as item, i}
    {#if item !== undefined && item.hidden !== true}
      {#if item.type === 'separator'}
        <hr />
      {:else if item.type === 'action'}
        <button
          type="submit"
          on:click={() => {
            if (item.action) {
              item.action()
              closeContextMenu()
            }
          }}
          on:mouseenter={() => {
            isUsingKeyboard = false
            selectedIndex = i
            updateHoverStyles()
          }}
          class:danger={item.kind === 'danger'}
          class:selected={i === selectedIndex}
          disabled={item.disabled}
        >
          {#if item.icon}
            {#if typeof item.icon === 'string'}
              <Icon name={item.icon} size="1.2em" />
            {:else if Array.isArray(item.icon)}
              <DynamicIcon name={`colors;;${item.icon}`} size="1.1em" />
            {:else if typeof item.icon.contents !== 'undefined'}
              <div class="space-icon">
                <DynamicIcon name={item.icon} interactive={false} size="sm" />
              </div>
            {/if}
          {/if}
          <span class="truncate" style="flex: 1; width:100%; max-width: 20ch;">{item.text}</span>
          {#if item.tagText || item.tagIcon}
            <span class="truncate item-tag">
              {#if item.tagText}
                {item.tagText}
              {/if}
              {#if item.tagIcon}
                <DynamicIcon name={item.tagIcon} size="15px" />
              {/if}
            </span>
          {/if}
        </button>
      {:else if item.type === 'sub-menu'}
        <li
          class="sub-item"
          class:danger={item.kind === 'danger'}
          class:selected={i === selectedIndex}
          style="anchor-name: --sub-{i};"
          on:mouseenter={() => {
            isUsingKeyboard = false
            selectedIndex = i
            parentActiveSubMenuStore.set(`${i}`)
            updateHoverStyles()
          }}
          on:mouseleave={() => {
            parentActiveSubMenuStore.set(undefined)
          }}
        >
          {#if item.icon}
            {#if typeof item.icon === 'string'}
              <Icon name={item.icon} size="1.2em" />
            {:else if Array.isArray(item.icon)}
              <DynamicIcon name={`colors;;${item.icon}`} size="1.1em" />
            {:else if typeof item.icon.contents !== 'undefined'}
              <div class="space-icon">
                <DynamicIcon name={item.icon} interactive={false} size="sm" />
              </div>
            {/if}
          {/if}
          <span style="flex: 1; width:100%;">{item.text} </span>
          <Icon name="chevron.right" size="1.2em" style="align-self: flex-end;" />
        </li>
        <svelte:self
          items={item.items}
          subMenuRef={`${i}`}
          showSearch={item.search === true}
          isActiveMenu={get(parentActiveSubMenuStore) === `${i}`}
        />
      {/if}
    {/if}
  {/each}
</ul>

<style lang="scss">
  // Safe are experiment
  /*@keyframes clip {
    from {
      visibility: visible;
    }
    99% {
    }
    100% {
      visibility: hidden;
    }
  }*/

  /* NOTE: We only support a single sub-menu right now with this crude css */
  ul.sub-menu {
    height: fit-content;
    max-height: 24.5ch;
    overflow-y: auto;
    background: var(--ctx-background);
    padding: 0.25rem;
    border-radius: 12px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);
    user-select: none;
    position-anchor: var(--sub-id);

    margin: 0px;

    /* Safe area experiment 
    &::before {
      content: '';
      position: fixed;
      position-anchor: var(--sub-id);
      top: anchor(start);
      left: anchor(start);
      right: anchor(end);
      height: 100%;
      background: rgba(0, 0, 0, 0.25);
      clip-path: polygon(0 0, 100% 100%, 100% 0);

      //animation: clip 0.1s forwards;
    }
    */
    &.hidden {
      display: none;
    }

    &:not(.anchor-left) {
      top: anchor(top);
      transform: translateY(var(--y-offset));
      left: anchor(right);
      margin-left: -3px;
    }

    &.anchor-left {
      top: anchor(top);
      transform: translateY(var(--y-offset));
      right: anchor(left);
      left: unset;
      margin-right: -3px;
    }
  }
  ul.sub-menu:hover {
    display: flex;
  }
  :global(li.sub-item:hover + .sub-menu) {
    display: flex;
  }
  :global(li.sub-item:has(+ .sub-menu:hover)) {
    background: var(--ctx-item-submenu-open);
  }

  // Define a CSS variable for the submenu state
  :global(body[data-has-active-submenu='true']) ul:not(.sub-menu) > button.selected,
  :global(body[data-has-active-submenu='true']) ul:not(.sub-menu) > li.selected {
    // Mute the highlight when a submenu is open
    background: rgba(var(--ctx-item-hover-rgb, 36, 151, 233), 0.3);
    color: var(--ctx-item-text);
  }

  ul {
    width: auto;
    flex-direction: column;
    outline: none; /* Remove focus outline */
    &:not(.sub-menu) {
      display: flex;
    }

    > button,
    > li {
      display: flex;
      align-items: center;
      gap: 0.35em;
      padding: 0.4em 0.55em;
      padding-bottom: 0.385rem;
      border-radius: 9px;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.0125rem;
      font-size: 0.99em;
      text-align: left;

      color: var(--ctx-item-text);
      font-family: 'Inter', sans-serif;
      -webkit-font-smoothing: antialiased;

      &:hover:not(.hover-override) {
        background: var(--ctx-item-hover);
        color: var(--ctx-item-text-hover);
        outline: none;

        .item-tag {
          opacity: 1;
        }
      }

      &.hover-override & {
        background: transparent;
        color: var(--ctx-item-text);

        .item-tag {
          opacity: 0.75;
        }
      }

      &.selected {
        background: var(--ctx-item-hover);
        color: var(--ctx-item-text-hover);
        outline: none;

        .item-tag {
          opacity: 1;
        }
      }
      &:focus {
        // FIX: This should share with :hover, buut
        // html autofocus the first element, so it looks weird and doesnt go away
        // when using the mouse
        outline: none;
      }

      &:disabled {
        opacity: 45%;

        &:hover {
          cursor: not-allowed;
          background: inherit;
          color: inherit;
        }
      }

      & * {
        pointer-events: none;
      }

      &.danger {
        --ctx-item-hover: var(--ctx-item-danger-hover);
        --ctx-item-text-hover: #fff;
      }

      :global(svg) {
        color: currentColor;
      }
    }

    hr {
      margin-inline: 1.2ch;
      margin-block: 0.25rem;
      border-top: 0.07rem solid
        light-dark(var(--border-subtle, rgba(0, 0, 0, 0.15)), var(--border-subtle-dark, rgba(255, 255, 255, 0.18)));
    }
  }

  .space-icon {
    width: 1.1em;
    height: 1.1em;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .item-tag {
    width: fit-content;
    margin-left: auto;
    padding-left: 0.5rem;

    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0.75;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    font-size: 0.85em;
    font-weight: 450;
    letter-spacing: 0.025em;
  }

  .search-container {
    margin-bottom: 0.25rem;
  }

  .search-input {
    width: 100%;
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    border: 1px solid
      light-dark(var(--border-subtle, rgba(0, 0, 0, 0.15)), var(--border-subtle-dark, rgba(255, 255, 255, 0.25)));
    background: transparent;
    font-size: 0.9em;
    font-weight: 500;
    color: var(--ctx-item-text);
    outline: none;
  }

  .search-input:focus {
    border: 1px solid
      light-dark(var(--overlay-medium, rgba(0, 0, 0, 0.4)), var(--accent-muted-dark, rgba(129, 146, 255, 0.45)));
  }
</style>
