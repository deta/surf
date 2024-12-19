<script lang="ts">
  import { derived, writable } from 'svelte/store'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import { conditionalArrayItem, hover, isModKeyPressed, useLogScope, wait } from '@horizon/utils'
  import { Icon } from '@horizon/icons'
  import {
    SelectDropdown,
    SelectDropdownItem,
    type SelectItem
  } from '../../Atoms/SelectDropdown/index'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import { contextMenu, type CtxItem } from '../ContextMenu.svelte'
  import {
    ChangeContextEventTrigger,
    DeleteSpaceEventTrigger,
    OpenHomescreenEventTrigger
  } from '@horizon/types'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { generalContext, newContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { tick } from 'svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useDesktopManager } from '@horizon/core/src/lib/service/desktop'
  import { HTMLDragArea } from '@horizon/dragcula'
  import { fade, fly } from 'svelte/transition'
  import { openDialog } from '../Dialog/Dialog.svelte'

  export let horizontalTabs = false

  const log = useLogScope('SpaceSwitcher')
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const toasts = useToasts()
  const desktopManager = useDesktopManager()

  const telemetry = oasis.telemetry
  const spaces = oasis.spaces
  const activeScopeId = tabsManager.activeScopeId
  const lastUsedScopes = tabsManager.lastUsedScopes
  const desktopVisible = desktopManager.activeDesktopVisible

  const focused = writable(false)
  const editName = writable(false)
  const searchValue = writable('')
  const titleHovered = writable(false)
  const forceShowTitle = writable(false)

  let inputElem: HTMLInputElement

  $: log.debug('lastUsedScopes', $lastUsedScopes)

  const activeSpace = derived([spaces, activeScopeId], ([spaces, activeScopeId]) => {
    return spaces.find((space) => space.id === activeScopeId)
  })

  const items = derived(
    [spaces, activeScopeId, lastUsedScopes],
    ([spaces, activeScopeId, lastUsedScopes]) => {
      const spaceItems = spaces
        .filter((space) => space.id !== activeScopeId)
        .sort((a, b) => {
          // Sort by last used at the top
          const aLastUsedIndex = lastUsedScopes.indexOf(a.id)
          const bLastUsedIndex = lastUsedScopes.indexOf(b.id)

          if (aLastUsedIndex !== -1 && bLastUsedIndex !== -1) {
            return aLastUsedIndex - bLastUsedIndex
          }

          if (aLastUsedIndex !== -1) {
            return -1
          }

          if (bLastUsedIndex !== -1) {
            return 1
          }

          return a.indexValue - b.indexValue
        })
        .map((space) => ({
          id: space.id,
          label: space.dataValue.folderName,
          data: space
        }))

      return [
        ...conditionalArrayItem(activeScopeId !== null, generalContext),
        ...spaceItems
      ] as SelectItem[]
    }
  )

  const filterdItems = derived([items, searchValue], ([$items, $searchValue]) => {
    if (!$searchValue) return $items

    return $items.filter((item) => item.label.toLowerCase().includes($searchValue.toLowerCase()))
  })

  $: activeSpaceData = $activeSpace?.data

  const switchSpace = async (spaceId: string) => {
    log.debug('Switching space:', spaceId)
    if (spaceId === 'default') {
      await tabsManager.changeScope(null, ChangeContextEventTrigger.ContextSwitcher)
      return
    }

    if (spaceId === 'new') {
      await oasis.createNewBrowsingSpace(ChangeContextEventTrigger.ContextSwitcher)
      toasts.success('New Context created!')
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

  const handleChange = async (e: CustomEvent<string>) => {
    const value = e.detail

    await switchSpace(value)
  }

  const handleFocus = (e: Event) => {
    $focused = true
  }

  const handleBlur = async (e: Event) => {
    $focused = false
    $editName = false
    await updateSpaceName()
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

      setTimeout(() => {
        forceShowTitle.set(false)
      }, 300)
    }
  }

  const handleDeleteSpace = async (space: OasisSpace) => {
    try {
      const { closeType: confirmed } = await openDialog({
        icon: `space;;${space.id}`,
        message: `Are you sure you want to delete "${space.dataValue.folderName}?"`,
        actions: [
          { title: 'Cancel', type: 'reset' },
          { title: 'Delete', type: 'submit', kind: 'danger' }
        ]
      })

      if (!confirmed) {
        return
      }

      if (space.id === $activeScopeId) {
        await switchSpace('default')
      }

      log.debug('deleting space', space.id)
      await oasis.deleteSpace(space.id)

      await tabsManager.removeSpaceTabs(space.id)

      await telemetry.trackDeleteSpace(DeleteSpaceEventTrigger.SpacesView)
      toasts.success('Context deleted!')
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const handleRenameSpace = async (space: OasisSpace) => {
    if (space.id !== $activeScopeId) {
      await switchSpace(space.id)
      await tick()
    }

    await wait(300)

    handleEditName()
  }

  const handleEditName = async () => {
    if ($activeScopeId === null) {
      return
    }

    $editName = true
    await tick()
    inputElem.focus()
    inputElem.click()
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

  const getSpaceContextItems = (space: OasisSpace, active: boolean) =>
    [
      {
        type: 'action',
        icon: generalContext.icon,
        hidden: active,
        text: 'Open',
        action: () => switchSpace(space.id)
      },
      {
        type: 'action',
        icon: 'arrow.right',
        hidden: active,
        text: 'Open in Stuff',
        action: () => handleOpenSpaceInOasis(space.id)
      },
      { type: 'separator', hidden: active },
      {
        type: 'action',
        icon: 'edit',
        text: 'Rename Context',
        action: () => handleRenameSpace(space)
      },
      {
        type: 'action',
        icon: 'trash',
        text: 'Delete Context',
        kind: 'danger',
        action: () => handleDeleteSpace(space)
      }
    ] satisfies CtxItem[]

  let hideTimeout: ReturnType<typeof setTimeout>

  const handleTitleMouseEnter = () => {
    clearTimeout(hideTimeout)
    titleHovered.set(true)
  }

  const handleTitleMouseLeave = () => {
    hideTimeout = setTimeout(() => {
      titleHovered.set(false)
    }, 200)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="wrapper no-drag"
  class:horizontal={horizontalTabs}
  class:activated={$desktopVisible}
  on:mouseleave={handleTitleMouseLeave}
  use:HTMLDragArea.use={{
    accepts: () => true
  }}
  on:DragEnter={() => {
    desktopManager.setVisible(true, { trigger: OpenHomescreenEventTrigger.DragOver })
  }}
  use:contextMenu={{
    canOpen: $activeScopeId !== null,
    items: [
      {
        type: 'action',
        icon: 'arrow.right',
        text: 'Open in Stuff',
        action: () => handleOpenSpaceInOasis()
      },
      {
        type: 'action',
        icon: 'edit',
        text: 'Rename Context',
        action: () => $activeSpace && handleRenameSpace($activeSpace)
      },
      {
        type: 'action',
        icon: 'trash',
        text: 'Delete Context',
        kind: 'danger',
        action: () => $activeSpace && handleDeleteSpace($activeSpace)
      }
    ]
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
    {:else}
      <Icon name={generalContext.icon} size="1.5rem" />
    {/if}

    {#if !horizontalTabs}
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
            placeholder="Context Name"
            disabled={$activeScopeId === null}
          />
        {:else if $titleHovered || $forceShowTitle}
          <div
            id="open-desktop-text"
            class="open-desktop animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-sky-900 to-sky-900 via-sky-500 dark:from-sky-100 dark:to-sky-100 dark:via-sky-300 bg-[length:250%_100%]"
            in:fly={{ delay: 33, duration: 120, y: 10 }}
            out:fly={{ duration: 120, y: 10 }}
          >
            {#if $desktopVisible}
              Hide Desktop
            {:else}
              View Desktop →
            {/if}
          </div>
        {:else}
          <div
            id="context-name"
            class="open-desktop"
            in:fly={{ delay: 33, duration: 120, y: -10 }}
            out:fly={{ duration: 120, y: -10 }}
          >
            {$activeSpaceData ? $activeSpaceData.folderName : generalContext.label}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <SelectDropdown
    items={filterdItems}
    selected={$activeScopeId}
    footerItem={newContext}
    {searchValue}
    search="manual"
    inputPlaceholder="Search your Contexts…"
    on:select={handleChange}
  >
    <div class="trigger cursor-default" on:mouseenter={handleTitleMouseLeave}>
      <Icon name="chevron.down" />
    </div>

    <div
      slot="item"
      class="w-full"
      let:item
      use:contextMenu={{
        canOpen: !!item?.data,
        items: getSpaceContextItems(item?.data, item?.id === $activeScopeId)
      }}
    >
      <SelectDropdownItem {item} />
    </div>
  </SelectDropdown>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    gap: 0.1rem;
    padding: 0.25rem;
    padding-left: 0.5rem;

    color: var(--contrast-color);
    background: paint(squircle) !important;
    --squircle-radius: 16px;
    --squircle-smooth: 0.33;
    --squircle-shadow: 0px 2px 2px -1px var(--black-09);
    --squircle-fill: var(--white-65);
    border-radius: 0 !important;

    :global(.custom) & {
      --squircle-fill: var(--white-75) !important;
      color: var(--black-85);
    }

    :global(.dark) & {
      --squircle-fill: var(--black-33) !important;
      --squircle-fill: var(--white-09) !important;
      color: var(--contrast-color);
    }

    &.horizontal {
      padding: 0rem 0.2rem;
      padding-left: 0.5rem;
      border-radius: 0.75rem;
      .input,
      .title {
        font-size: 0.938rem;
      }

      @apply px-1.5 ml-2 gap-1.5 bg-white/70 py-1.5;
      --squircle-radius: 8px;
      --squircle-smooth: 0.28;
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
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.25rem;
    padding-left: 0.25rem;

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
    width: 100%;
    position: relative;
  }

  .context-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;

    div {
      pointer-events: none;
    }
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
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: 100%;
    padding: 0.25rem 0.25rem;
    border-radius: calc(10px - 0.25rem);
    font-size: 1rem;
    font-weight: 500;

    border: none;
    white-space: nowrap;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.5rem;
    border-radius: calc(1rem - 0.25rem);
    font-size: 1rem;
    font-weight: 400;

    transition: background-color 0.2s;
    border: none;
    background: none;
    color: inherit;
    height: 2.5rem;
    width: 2.5rem;

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
</style>
