<script lang="ts">
  import { derived, writable } from 'svelte/store'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import { conditionalArrayItem, isModKeyPressed, useLogScope, wait } from '@horizon/utils'
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
      toasts.success('New Space created!')
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
      toggleHomescreen()
    }
  }

  const handleDeleteSpace = async (space: OasisSpace) => {
    try {
      const confirmed = confirm(`Are you sure you want to delete ${space.dataValue.folderName}?`)
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
      toasts.success('Space deleted!')
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
        text: 'Open as Context',
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
        text: 'Rename Space',
        action: () => handleRenameSpace(space)
      },
      {
        type: 'action',
        icon: 'trash',
        text: 'Delete Space',
        kind: 'danger',
        action: () => handleDeleteSpace(space)
      }
    ] satisfies CtxItem[]
</script>

<div
  class="wrapper no-drag"
  class:horizontal={horizontalTabs}
  class:activated={$desktopVisible}
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
        text: 'Rename Space',
        action: () => $activeSpace && handleRenameSpace($activeSpace)
      },
      {
        type: 'action',
        icon: 'trash',
        text: 'Delete Space',
        kind: 'danger',
        action: () => $activeSpace && handleDeleteSpace($activeSpace)
      }
    ]
  }}
>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="title" on:click={handleClick} on:dblclick={handleEditName}>
    {#if $activeSpace}
      <button class="context-icon" on:click|stopPropagation={() => handleOpenSpaceInOasis()}>
        <SpaceIcon folder={$activeSpace} interactive={false} size="md" />
      </button>
    {:else}
      <Icon name={generalContext.icon} size="1.5rem" />
    {/if}

    {#if $activeSpaceData && $editName}
      <input
        type="text"
        class="input"
        bind:this={inputElem}
        bind:value={$activeSpaceData.folderName}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeyDown}
        placeholder="Space Name"
        disabled={$activeScopeId === null}
      />
    {:else if $activeSpaceData}
      <div class="input">
        {$activeSpaceData.folderName}
      </div>
    {:else}
      <div class="input">
        {generalContext.label}
      </div>
    {/if}
  </div>

  <SelectDropdown
    items={filterdItems}
    selected={$activeScopeId}
    footerItem={newContext}
    {searchValue}
    search="manual"
    inputPlaceholder="Search your Spaces…"
    on:select={handleChange}
  >
    <div class="trigger">
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
    gap: 0.5rem;
    padding: 0.25rem;
    padding-left: 0.75rem;
    border-radius: 1rem;
    color: #465b86;
    background-color: rgb(247, 252, 255);
    border: 1px solid rgb(186 230 253); // border-sky-200

    // background-color: rgba(224,242,254,.1); // bg-sky-100/10
    // border: 1px solid hsla(0,0%,100%,.1); // border-white/10

    &.horizontal {
      padding: 0.1rem 0.1rem;
      padding-left: 0.5rem;
      border-radius: 0.75rem;
    }

    &.activated {
      color: #465b86;
      background-color: rgb(215, 238, 252);
      border: 1px solid rgb(135, 207, 245); // border-sky-200

      :global(.dark) & {
        background-color: rgb(58, 68, 83);
        border-color: rgb(58, 68, 83);
        color: rgb(232, 235, 238);
      }
    }

    :global(.dark) & {
      background-color: rgb(58, 68, 83);
      border-color: rgb(58, 68, 83);
      color: rgb(232, 235, 238);
    }
  }

  .title {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .context-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    cursor: pointer;

    div {
      pointer-events: none;
    }
  }

  .input {
    width: 100%;
    padding: 0.25rem 0.25rem;
    border-radius: calc(10px - 0.25rem);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    border: none;
    background: none;
    color: inherit;
    white-space: nowrap;

    &:focus {
      outline: 1px solid rgb(2 132 199); // border-sky-600
    }
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.5rem;
    border-radius: calc(1rem - 0.25rem);
    font-size: 1rem;
    font-weight: 400;
    cursor: pointer;
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
    }

    &:focus {
      outline: none;
    }
  }

  .horizontal {
    .trigger {
      padding: 0.15rem;
      font-size: 0.9rem;
      height: 2rem;
      width: 2rem;
      border-radius: calc(10px - 0.15rem);
    }

    input {
      font-size: 0.9rem;
      padding: 0.15rem;
    }
  }
</style>
