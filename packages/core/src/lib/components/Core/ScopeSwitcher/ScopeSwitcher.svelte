<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import { isModKeyPressed, useLogScope, wait } from '@deta/utils'
  import { sortSpacesByLastUsed } from '@horizon/core/src/lib/service/contexts'
  import { Icon } from '@horizon/icons'
  import {
    SelectDropdown,
    SelectDropdownItem,
    type SelectItem
  } from '../../Atoms/SelectDropdown/index'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import {
    ChangeContextEventTrigger,
    CreateSpaceEventFrom,
    OpenHomescreenEventTrigger
  } from '@deta/types'
  import { useToasts } from '@deta/ui'
  import { configureBrowsingContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { tick } from 'svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useDesktopManager } from '@horizon/core/src/lib/service/desktop'
  import { HTMLDragArea } from '@horizon/dragcula'
  import ScopeActionButtons from './ScopeActionButtons.svelte'
  import BrowsingContextSelector from '../../Browser/BrowserFullscreenDialog/BrowsingContextSelector.svelte'
  import { applyBrowsingContextSelection } from '@horizon/core/src/lib/service/migration'

  export let horizontalTabs = false
  export let backgroundImage: Readable<{ path: string } | undefined>

  const log = useLogScope('SpaceSwitcher')
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const toasts = useToasts()
  const desktopManager = useDesktopManager()

  const spaces = oasis.spaces
  const activeScopeId = tabsManager.activeScopeId
  const lastUsedScopes = tabsManager.lastUsedScopes
  const desktopVisible = desktopManager.activeDesktopVisible
  const showBrowsingContextSelector = tabsManager.showBrowsingContextSelector

  const focused = writable(false)
  const editName = writable(false)
  const searchValue = writable('')
  const titleHovered = writable(false)
  const forceShowTitle = writable(false)
  const dropdownOpen = writable(false)

  let inputElem: HTMLInputElement

  $: log.debug('lastUsedScopes', $lastUsedScopes)

  const activeSpace = derived([spaces, activeScopeId], ([spaces, activeScopeId]) => {
    return spaces.find((space) => space.id === activeScopeId)
  })

  // Helper function to convert spaces to SelectItems
  const spacesToSelectItems = (spaces: OasisSpace[]) => {
    return spaces.map((space) => ({
      id: space.id,
      label: space.dataValue.folderName,
      data: space
    }))
  }

  // Filtered spaces for browsing context display
  const allSpaceItems = derived([spaces, lastUsedScopes], ([spaces, lastUsedScopes]) => {
    const sortedSpaces = [...spaces].sort((a, b) => sortSpacesByLastUsed(a, b, lastUsedScopes))
    return spacesToSelectItems(sortedSpaces)
  })

  const directSearchResults = derived(
    [spaces, lastUsedScopes, searchValue],
    ([$spaces, $lastUsedScopes, $searchValue]) => {
      if (!$searchValue) return []

      const lowerSearchValue = $searchValue.toLowerCase()
      const filteredSpaces = $spaces
        .filter((space) => space.dataValue.folderName.toLowerCase().includes(lowerSearchValue))
        .sort((a, b) => sortSpacesByLastUsed(a, b, $lastUsedScopes))
        .sort((a, b) => {
          const aUseAsBrowsingContext = a.data.dataValue?.useAsBrowsingContext ? 1 : 0
          const bUseAsBrowsingContext = b.data.dataValue?.useAsBrowsingContext ? 1 : 0
          return bUseAsBrowsingContext - aUseAsBrowsingContext
        })

      return spacesToSelectItems(filteredSpaces)
    }
  )

  // Filtered spaces for browsing context selection
  const items = derived([spaces, lastUsedScopes], ([spaces, lastUsedScopes]) => {
    const spaceItems = spaces
      .filter((space) => {
        // Filter spaces based on useAsBrowsingContext flag
        try {
          const spaceData = space.dataValue
          return spaceData.useAsBrowsingContext === true
        } catch (error) {
          log.error('Error filtering spaces:', error)
          return false
        }
      })
      .sort((a, b) => sortSpacesByLastUsed(a, b, lastUsedScopes))
      .map((space) => ({
        id: space.id,
        label: space.dataValue.folderName,
        data: space
      }))

    return spaceItems
  })

  // Items for display - when searching, use direct search results; otherwise use filtered browsing contexts
  const filterdItems = derived(
    [items, allSpaceItems, searchValue, directSearchResults],
    ([$items, $allSpaceItems, $searchValue, $directSearchResults]) => {
      // If not searching, use the filtered browsing contexts
      if (!$searchValue) {
        return $items
      }

      // When searching, use direct search results if available
      if ($directSearchResults.length > 0) {
        return $directSearchResults
      }

      // Fallback to filtering allSpaceItems if direct results aren't ready yet
      return $allSpaceItems.filter(
        (item) =>
          item.label.toLowerCase().includes($searchValue.toLowerCase()) &&
          item.data.dataValue?.useAsBrowsingContext
      )
    }
  )

  $: activeSpaceData = $activeSpace?.data

  const switchSpace = async (spaceId: string) => {
    log.debug('Switching space:', spaceId)

    if (spaceId === 'new') {
      await oasis.createNewBrowsingSpace(
        ChangeContextEventTrigger.ContextSwitcher,
        CreateSpaceEventFrom.ContextSwitcher
      )

      // Hide any overlay when creating new context
      toasts.success('New Context created!')

      await tick()
      tabsManager.showNewTabOverlay.set(0)
      await wait(100)
      handleEditName()
      return
    }

    await tabsManager.changeScope(spaceId, ChangeContextEventTrigger.ContextSwitcher)
  }

  const updateSpaceName = async () => {
    if ($activeSpace) {
      await $activeSpace.updateData({
        folderName: $activeSpaceData?.folderName
      })
    }
  }

  const configureContexts = () => {
    dropdownOpen.set(false)
    showBrowsingContextSelector.set(true)
  }

  const createNewContext = async () => {
    dropdownOpen.set(false)
    await switchSpace('new')
  }

  const handleChange = async (e: CustomEvent<string>) => {
    const value = e.detail

    if (value === 'configure') {
      showBrowsingContextSelector.set(true)
      return
    }

    if (value !== 'new') {
      await oasis.toggleBrowsingContext(value, true)
    }

    await switchSpace(value)
  }

  const handleFocus = (e: Event) => {
    $focused = true
  }

  const handleBlur = async (e: Event) => {
    $focused = false
    $editName = false
    await updateSpaceName()
    // Show command menu after name update
    tabsManager.showNewTabOverlay.set(1)
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      await updateSpaceName()
      inputElem.blur()
    } else if (e.key === 'Escape') {
      inputElem.blur()
    }
  }

  const handleClick = (e: PointerEvent) => {
    log.debug('click', e)
    if ($editName) return

    if (isModKeyPressed(e) && $activeScopeId && $activeSpace) {
      tabsManager.addSpaceTab($activeSpace, { scopeId: $activeScopeId, active: e.shiftKey })
    } else if (e.shiftKey) {
      handleOpenSpaceInOasis()
    } else {
      clearTimeout(hideTimeout)
      forceShowTitle.set(true)
      toggleHomescreen()

      // No delay
      forceShowTitle.set(false)
    }
  }

  const handleEditName = async () => {
    if ($activeScopeId === null) {
      return
    }

    $editName = true
    await tick()
    inputElem.focus()
    inputElem.select()
  }

  const handleOpenSpaceInOasis = async (spaceId?: string) => {
    const scopeId = spaceId ?? $activeScopeId
    if (scopeId === null) {
      return
    }

    await wait(200)

    if ($editName) {
      return
    }

    oasis.changeSelectedSpace(scopeId)
    tabsManager.showNewTabOverlay.set(2)
  }

  const toggleHomescreen = () => {
    desktopManager.setVisible(!$desktopVisible, { trigger: OpenHomescreenEventTrigger.Click })
  }

  let hideTimeout: ReturnType<typeof setTimeout>

  const handleTitleMouseEnter = () => {
    clearTimeout(hideTimeout)
    titleHovered.set(true)
  }

  const handleTitleMouseLeave = () => {
    // No delay
    titleHovered.set(false)
  }

  const useAsBrowsingContext = (space: OasisSpace) => {
    oasis.toggleBrowsingContext(space.id, true)
  }

  const removeFromBrowsingContext = (space: OasisSpace) => {
    oasis.toggleBrowsingContext(space.id, false)
  }

  const handleBrowsingContextSelection = async (
    event: CustomEvent<{ selectedSpaces: string[] }>
  ) => {
    const selectedSpaceIds = event.detail.selectedSpaces
    log.debug('Applying browsing context selection for spaces:', selectedSpaceIds)
    await applyBrowsingContextSelection({ oasis }, selectedSpaceIds)
    showBrowsingContextSelector.set(false)
  }
</script>

<BrowsingContextSelector
  {spaces}
  open={$showBrowsingContextSelector}
  allowCancel={true}
  on:close={handleBrowsingContextSelection}
  on:cancel={() => {
    showBrowsingContextSelector.set(false)
  }}
/>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="wrapper no-drag"
  class:horizontal={horizontalTabs}
  class:activated={$desktopVisible}
  on:mouseleave={handleTitleMouseLeave}
  style:--background-image={$backgroundImage?.path}
  use:HTMLDragArea.use={{
    accepts: () => true
  }}
  on:DragEnter={() => {
    desktopManager.setVisible(true, { trigger: OpenHomescreenEventTrigger.DragOver })
  }}
>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="title"
    on:click={handleClick}
    on:dblclick={handleEditName}
    on:mouseenter={handleTitleMouseEnter}
  >
    {#if $activeSpace}
      <button class="context-icon">
        <SpaceIcon folder={$activeSpace} interactive={false} size="md" />
      </button>
    {/if}

    <div class="name-wrapper">
      {#if $activeSpaceData && $editName}
        <input
          type="text"
          class="input"
          bind:this={inputElem}
          bind:value={$activeSpaceData.folderName}
          on:focus={handleFocus}
          on:blur={handleBlur}
          on:keydown={handleKeyDown}
        />
      {:else}
        <div
          id="context-name"
          class="open-desktop"
          class:hover-effect={$titleHovered || $forceShowTitle}
        >
          <span>{$activeSpaceData ? $activeSpaceData.folderName : 'Switch Context'}</span>
        </div>

        {#if $titleHovered || $forceShowTitle}
          <ScopeActionButtons
            onShowDesktop={toggleHomescreen}
            onOpenInOasis={() => handleOpenSpaceInOasis()}
          />
        {/if}
      {/if}
    </div>
  </div>

  <SelectDropdown
    items={filterdItems}
    selected={$activeScopeId}
    footerItem={true}
    open={dropdownOpen}
    {searchValue}
    search="manual"
    inputPlaceholder="Search your contexts…"
    on:select={handleChange}
  >
    <div class="trigger cursor-default" on:mouseenter={handleTitleMouseLeave}>
      <Icon name="chevron.down" />
    </div>

    <div slot="item" class="w-full" let:item>
      {#if item}
        <SelectDropdownItem {item} />
      {/if}
    </div>

    <div slot="footer" class="switcher-actions">
      <button
        on:click={() => createNewContext()}
        class="switcher-action-btn switcher-action-btn-full"
      >
        <Icon name="add" />
        New Context
      </button>

      <button on:click={() => configureContexts()} class="switcher-action-btn">
        <Icon name="settings" />
      </button>
    </div>
  </SelectDropdown>
</div>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  .wrapper {
    display: flex;
    align-items: center;
    position: relative;
    gap: 0.5rem;
    padding: 0.25rem 0.25rem 0.25rem 0.45rem;
    padding-left: 0.5rem;

    color: var(--contrast-color);
    background: paint(squircle) !important;
    --squircle-radius: 14px;
    --squircle-smooth: 0.33;
    --squircle-fill: var(--white-85);
    border-radius: 0 !important;

    :global(.custom) & {
      color: var(--black-85);

      border-radius: 12px !important;
      background-image: var(--background-image) !important;
      background-size: cover !important;
      background-position: center center !important;
      background-repeat: no-repeat !important;
      // outline: 1.5px solid var(--base-color);

      &.horizontal {
        height: calc(100% - 13.5px);
      }
    }

    :global(.dark) & {
      --squircle-fill: var(--black-33) !important;
      --squircle-fill: var(--white-09) !important;
      color: var(--contrast-color);
    }

    &.horizontal {
      padding: 0.3rem 0.5rem;
      border-radius: 12px !important;
      height: calc(100% - 12px);
      .input,
      .title {
        width: 100%;
        font-size: 0.938rem;
      }

      @apply ml-2 gap-1.5 bg-white/70;
      --squircle-radius: 12px;
      --squircle-smooth: 0.33;
    }

    &.activated {
      --squircle-fill: var(--white-95) !important;

      :global(.dark) & {
        --squircle-fill: var(--black-45) !important;
      }

      :global(.custom) & {
        color: var(--contrast-color) !important;
        --squircle-fill: color-mix(in hsl, var(--base-color), hsla(0, 80%, 0%, 0.2)) !important;
      }
      :global(.custom.dark) & {
        --squircle-fill: color-mix(in hsl, var(--base-color), hsla(0, 80%, 50%, 0.65)) !important;
      }
    }
  }

  .title {
    width: calc(100% - 3rem);
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.25rem;
    text-box-trim: trim-both cap alphabetic;
    z-index: 2;

    :global(.custom) & {
      &:before {
        content: '';
        display: block;
        position: absolute;
        width: 100%;
        height: 66%;
        top: 7px;
        left: 4px;
        bottom: 4px;
        background: linear-gradient(to right, var(--base-color) 0%, transparent 100%);
        z-index: -1;
        filter: blur(3.3px);
        mix-blend-mode: screen;
        pointer-events: none;
        border-radius: 8px;
      }
    }

    &:hover {
      color: rgb(2 132 199); // text-sky-600
      background: rgba(2, 132, 199, 0.1);
      border-radius: 8px;

      :global(.dark) & {
        color: rgb(2 132 199); // text-sky-600
        background-color: rgb(59, 80, 111);
      }

      :global(.custom) & {
        color: var(--contrast-color) !important;
        background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 90%, 0.3)) !important;
      }
      :global(.custom.dark) & {
        background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 00%, 0.65)) !important;
      }
    }

    &:focus {
      outline: none;
    }
  }

  .name-wrapper {
    width: 95%;
    position: relative;
    max-width: -webkit-fill-available;
    justify-self: auto;
  }

  .context-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;

    // TODO: This was unused as this class is not set on context-icon but only on context-name
    //&.hover-effect {
    //  color: rgb(2 132 199);
    //  background: rgba(2, 132, 199, 0.1);

    //  :global(.dark) & {
    //    color: rgb(2 132 199);
    //    background-color: rgb(59, 80, 111);
    //  }

    //  :global(.custom) & {
    //    color: var(--contrast-color) !important;
    //    background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 90%, 0.3)) !important;
    //  }
    //  :global(.custom.dark) & {
    //    background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 00%, 0.65)) !important;
    //  }
    //}
  }

  .input {
    width: 100%;
    border-radius: calc(10px - 0.25rem);
    font-size: 1rem;
    font-weight: 500;

    transition: background-color 0.2s;
    border: none;
    background: none;
    color: inherit;
    white-space: nowrap;

    &:focus {
      outline: 1px solid rgb(2 132 199); // border-sky-600
    }
  }

  .open-desktop {
    position: relative;
    width: 100%;
    padding: 0.275rem 0.275rem;
    border-radius: calc(10px - 0.25rem);
    font-size: 1.05rem;
    font-weight: 450;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;

    @include utils.font-smoothing;

    border: none;
    white-space: nowrap;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.5rem;
    border-radius: 0.7rem;
    font-size: 1rem;
    font-weight: 400;

    transition: background-color 0.2s;
    border: none;
    background: none;
    color: inherit;
    height: 2.5rem;
    width: 2.5rem;

    :global(.custom) & {
      color: var(--contrast-color) !important;
      background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 90%, 0.1)) !important;
      opacity: 0.8;
    }

    :global(.custom.dark) & {
      background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 00%, 0.1)) !important;
      opacity: 0.8;
    }

    &:hover {
      color: rgb(2 132 199); // text-sky-600
      background: rgba(2, 132, 199, 0.1);

      :global(.dark) & {
        color: rgb(2 132 199); // text-sky-600
        background-color: rgb(59, 80, 111);
      }

      :global(.custom) & {
        color: var(--contrast-color) !important;
        background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 90%, 0.3)) !important;
      }
      :global(.custom.dark) & {
        background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 00%, 0.65)) !important;
      }
    }

    &:focus {
      outline: none;
    }
  }

  .horizontal {
    .name-wrapper {
      width: fit-content;
      display: flex;
      max-width: 15ch;
    }

    .title {
      padding: 0;
    }

    .trigger {
      padding: 0.15rem;
      font-size: 0.9rem;
      height: 1.5rem;
      width: 1.5rem;
      border-radius: calc(10px - 0.15rem);
    }

    input {
      font-size: 0.9rem;
      padding: 0.15rem;
    }
  }

  .switcher-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    padding: 0.15rem;
    border-top: 1px solid var(--border-color);
    background-color: var(--background-color);

    :global(.dark) & {
      border-top-color: var(--dark-border-color);
      background-color: var(--dark-background-color);
    }

    .switcher-action-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;

      &:hover {
        background-color: rgba(2, 132, 199, 0.1);
        color: rgb(2 132 199); // text-sky-600

        :global(.dark) & {
          background-color: rgb(59, 80, 111);
          color: rgb(2 132 199); // text-sky-600
        }
      }
    }

    .switcher-action-btn-full {
      flex: 1;
    }
  }
</style>
