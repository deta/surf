<script lang="ts">
  import {
    useLogScope,
    tooltip as tooltip2,
    getFileKind,
    getHostname,
    checkIfSecureURL
  } from '@horizon/utils'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import { Icon } from '@horizon/icons'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import type { BookmarkTabState, Tab, TabPage, TabSpace } from '../../types/browser.types'
  import { derived, writable, type Writable } from 'svelte/store'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { HTMLDragZone, HTMLDragItem, DragculaDragEvent } from '@horizon/dragcula'
  import { Resource, useResourceManager } from '../../service/resources'
  import { ResourceTypes, type DragTypes, DragTypeNames } from '../../types'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import { contextMenu, type CtxItem } from './ContextMenu.svelte'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import { useTabsManager } from '../../service/tabs'
  import {
    ChangeContextEventTrigger,
    DeleteTabEventTrigger,
    OpenInMiniBrowserEventFrom,
    SaveToOasisEventTrigger
  } from '@horizon/types'
  import InsecurePageWarningIndicator from '../Atoms/InsecurePageWarningIndicator.svelte'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { useHomescreen } from '../Oasis/homescreen/homescreen'
  import {
    useGlobalMiniBrowser,
    useScopedMiniBrowserAsStore
  } from '@horizon/core/src/lib/service/miniBrowser'
  import { useOasis, type OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { generalContext, newContext } from '@horizon/core/src/lib/constants/browsingContext'

  export let tab: Tab
  export let activeTabId: Writable<string>
  export let pinned: boolean
  export let showButtons: boolean = true
  export let showExcludeOthersButton: boolean = false
  export let showIncludeButton: boolean = false
  export let bookmarkingState: BookmarkTabState = 'idle'
  export let isUserSelected: boolean
  export let enableEditing = false
  export let showClose = false
  export let spaces: Writable<OasisSpace[]>
  export const inputUrl = writable<string>('')
  export let hibernated = false
  export let tabSize: number | undefined = undefined
  export let horizontalTabs = true
  export let removeHighlight = false
  export let isSelected = false
  export let isMagicActive = false

  const log = useLogScope('Tab')
  const tabsManager = useTabsManager()
  const userConfig = useConfig()
  const oasis = useOasis()
  const toasts = useToasts()
  const homescreen = useHomescreen()
  const globalMiniBrowser = useGlobalMiniBrowser()
  const scopedMiniBrowser = useScopedMiniBrowserAsStore(`tab-${tab.id}`)

  const homescreenVisible = homescreen.visible
  const userSettings = userConfig.settings

  // Why is there no better way in Svelte :/
  $: isScopedMiniBrowserOpenStore = $scopedMiniBrowser ? $scopedMiniBrowser.isOpen : null
  $: isScopedMiniBrowserOpen = $isScopedMiniBrowserOpenStore ?? false

  export const editAddress = async () => {
    isEditing = true
    await tick()
    if (addressInputElem) {
      addressInputElem.focus()
      // Set cursor to end of input
      addressInputElem.setSelectionRange(
        addressInputElem.value.length,
        addressInputElem.value.length
      )
    } else {
      log.error('addressInputElem is not defined')
    }
  }

  export const blur = () => {
    addressInputElem?.blur()
  }

  const dispatch = createEventDispatcher<{
    select: string
    'multi-select': string
    'passive-select': string
    'remove-from-sidebar': string
    'delete-tab': { tabId: string; trigger: DeleteTabEventTrigger }
    'input-enter': string
    bookmark: { trigger: SaveToOasisEventTrigger }
    pin: string
    unpin: string
    'save-resource-in-space': OasisSpace
    'create-live-space': void
    'add-source-to-space': OasisSpace
    'exclude-other-tabs': string
    'exclude-tab': string
    'include-tab': string
    'chat-with-tab': string
    'remove-bookmark': string
    Drop: { drag: DragculaDragEvent; spaceId: string }
    DragEnd: DragculaDragEvent
    edit: void
    mouseenter: string
    mouseleave: string
  }>()
  const resourceManager = useResourceManager()

  const liveSpacePopoverOpened = writable(false)
  const saveToSpacePopoverOpened = writable(false)
  const selectedTabs = tabsManager.selectedTabs
  const tabStyles = writable<string>('')

  const SHOW_INSECURE_WARNING_TIMEOUT = 3000

  let addressInputElem: HTMLInputElement
  let space: OasisSpace | null = null
  let isDragging = false
  let isEditing = false
  let hovered = false
  let popoverVisible = false
  let popoverLiveSpaceVisible = false
  let showInsecureWarningText = false
  let pdfResource: Resource | null = null

  $: {
    if (
      tab?.type === 'page' &&
      tab.currentDetectedApp?.resourceType === 'application/pdf' &&
      tab.resourceBookmark
    ) {
      resourceManager
        .getResource(tab.resourceBookmark)
        .then((resource) => (pdfResource = resource))
        .catch((error) => console.error('error loading PDF resource:', error))
    }
  }

  // $: acceptDrop = tab.type === 'space'
  $: isActive = tab.id === $activeTabId && !removeHighlight && !$homescreenVisible
  $: isBookmarkedByUser = tab.type === 'page' && tab.resourceBookmarkedManually
  $: url =
    (tab.type === 'page' && (tab.currentLocation || tab.currentDetectedApp?.canonicalUrl)) || null

  $: isInsecureUrl = tab.type === 'page' && url && !checkIfSecureURL(url)
  $: hostname = url ? getHostname(url) : null

  $: if (tab.type === 'page' && !isEditing) {
    if (hostname) {
      $inputUrl = isInsecureUrl ? `http://${hostname}` : hostname
    } else {
      $inputUrl = tab.title
    }
  }

  $: showLiveSpaceButton = $userSettings.live_spaces && checkIfLiveSpacePossible(tab)
  $: tabStyles.set(getTabStyles({ isActive, pinned, horizontalTabs, tab, isSelected }))

  // $: if (tab.type === 'space') {
  //   fetchSpace(tab.spaceId)
  // }

  $: sanitizedTitle = tab.type === 'space' ? '' : tab.title
  // $: sanitizedTitle = tab.title
  //   ? tab.type !== 'space'
  //     ? (() => {
  //         if (tab.title.startsWith('http') || tab.title.startsWith('surf://')) {
  //           return tab.title
  //         }
  //         let title = tab.title
  //           .replace(/\[.*?\]|\(.*?\)|\{.*?\}|\<.*?\>/g, '')
  //           .replace(/[\/\\]/g, '–')
  //         return title !== tab.title ? title.replace(/^\w/, (c) => c.toUpperCase()) : title
  //       })()
  //     : tab.title
  //   : ''

  let insecureWarningTimeout: ReturnType<typeof setTimeout>
  const handleTabUrlChange = (url: string | null) => {
    log.debug('handleTabUrlChange', url)
    if (insecureWarningTimeout) {
      clearTimeout(insecureWarningTimeout)
    }
    if (url && !checkIfSecureURL(url)) {
      showInsecureWarningText = true

      insecureWarningTimeout = setTimeout(() => {
        showInsecureWarningText = false
      }, SHOW_INSECURE_WARNING_TIMEOUT)
    } else {
      showInsecureWarningText = false
    }
  }

  const checkIfLiveSpacePossible = (tab: Tab) => {
    if (tab.type !== 'page') return false

    if (tab.currentDetectedApp?.rssFeedUrl) return true

    if (tab.currentDetectedApp?.appId === 'youtube') {
      return true
    }

    return false
  }

  const handleClick = (e: MouseEvent) => {
    const clickedElement = e.target as HTMLElement

    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()

      if (tab.pinned) {
        if (tab.type === 'page' && url) {
          globalMiniBrowser.openWebpage(url, { from: OpenInMiniBrowserEventFrom.PinnedTab })
          return
        }
      }

      blur()

      dispatch('multi-select', tab.id)
      return
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      blur()

      dispatch('passive-select', tab.id)
      return
    } else if (clickedElement !== addressInputElem) {
      e.preventDefault()
      e.stopPropagation()

      homescreen.setVisible(false)
      dispatch('select', tab.id)
    }

    if (clickedElement === addressInputElem) {
      // && (e.shiftKey || e.metaKey || e.ctrlKey)
      e.preventDefault()
      //e.stopImmediatePropagation()
      e.stopPropagation()
      return
      //blur()
    }
  }

  const handleRemoveSpaceFromSidebar = (_e: MouseEvent) => {
    dispatch('remove-from-sidebar', tab.id)
  }

  const handleArchive = (trigger: DeleteTabEventTrigger = DeleteTabEventTrigger.Click) => {
    dispatch('delete-tab', { tabId: tab.id, trigger })
  }

  const handleInputFocus = () => {
    isEditing = true
    if (url) {
      $inputUrl = url
    }

    // Use setTimeout to ensure this runs after the input value has been updated
    setTimeout(() => {
      addressInputElem.setSelectionRange(0, addressInputElem.value.length)
      addressInputElem.scrollLeft = addressInputElem.scrollWidth
    }, 0)
  }

  const handleInputBlur = () => {
    isEditing = false
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      dispatch('input-enter', $inputUrl)
    } else if (event.key === 'Escape') {
      if (addressInputElem) {
        addressInputElem.blur()
      } else {
        log.error('addressInputElem is not defined')
      }
    }
  }

  const fetchSpace = async (id: string) => {
    try {
      space = await oasis.getSpace(id)
    } catch (error) {
      log.error('Failed to fetch space:', error)
    }
  }

  const handleBookmark = (trigger: SaveToOasisEventTrigger = SaveToOasisEventTrigger.Click) => {
    saveToSpacePopoverOpened.set(false)
    dispatch('bookmark', { trigger })
  }

  const handleRemoveBookmark = () => {
    dispatch('remove-bookmark', tab.id)
  }

  const handleCreateLiveSpace = () => {
    liveSpacePopoverOpened.set(false)
    dispatch('create-live-space')
  }

  const handleAddSourceToSpace = (event: CustomEvent<OasisSpace>) => {
    liveSpacePopoverOpened.set(false)
    dispatch('add-source-to-space', event.detail)
  }

  const handleSaveResourceInSpace = (event: CustomEvent<OasisSpace>) => {
    saveToSpacePopoverOpened.set(false)
    dispatch('save-resource-in-space', event.detail)
  }

  const handleExcludeOthers = () => {
    dispatch('exclude-other-tabs', tab.id)
  }

  const handleExcludeTab = () => {
    dispatch('exclude-tab', tab.id)
  }

  const handleIncludeTab = () => {
    dispatch('include-tab', tab.id)
  }

  const handleDragStart = async (drag: DragculaDragEvent<DragTypes>) => {
    isDragging = true
    isEditing = false
    hovered = false
    blur()

    drag.item!.data.setData(DragTypeNames.SURF_TAB, { ...tab, pinned }) // FIX: pinned is not included but needed for reordering to work

    if (tab.type === 'page' && tab.currentLocation)
      drag.dataTransfer?.setData('text/uri-list', tab.currentLocation)

    // @ts-ignore
    const resourceId = tab.resourceBookmark ?? tab.resourceId
    if (resourceId) {
      drag.dataTransfer?.setData('application/vnd.space.dragcula.resourceId', resourceId)
      drag.item!.data.setData(DragTypeNames.SURF_RESOURCE_ID, resourceId)
      drag.item!.data.setData(DragTypeNames.ASYNC_SURF_RESOURCE, () =>
        resourceManager.getResource(resourceId)
      )
    }

    if (tab.type === 'space') {
      if (space === null) {
        await fetchSpace(tab.spaceId)
      }
      drag.item!.data.setData(DragTypeNames.SURF_SPACE, space)
    }

    drag.continue()
  }

  const handleDragEnd = (drag: DragculaDragEvent) => {
    isDragging = false
    dispatch('DragEnd', drag)
  }

  const handleDrop = async (drag: DragculaDragEvent) => {
    dispatch('Drop', { drag, spaceId: (tab as TabSpace).spaceId })
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 1 && !pinned) {
      e.preventDefault()
      handleArchive(DeleteTabEventTrigger.Click)
    }
  }

  function getTabStyles({
    isActive,
    pinned,
    horizontalTabs,
    tab,
    isSelected
  }: {
    isActive: boolean
    pinned: boolean
    horizontalTabs: boolean
    tab: Tab
    isSelected: boolean
  }) {
    const baseClasses =
      'tab no-drag flex items-center group transform active:scale-[98%] group cursor-pointer gap-3  justify-center relative text-sky-900 dark:text-sky-100 font-medium text-md overflow-hidden min-w-[48px]'
    const activeClasses = isActive
      ? 'active text-sky-950 dark:text-gray-100 bg-sky-200 dark:bg-gray-600 sticky shadow-inner ring-[0.5px]'
      : pinned
        ? ''
        : horizontalTabs
          ? 'bg-sky-100/60 dark:bg-gray-800/60'
          : '' // Default background when not active if unpinned
    const magicClasses = tab.magic && !isActive ? 'shadow-inner ring-[0] ring-pink-600' : ''
    const selectedClasses = isSelected && !isActive ? '' : ''
    const hoverClasses = 'hover:bg-sky-100 dark:hover:bg-gray-600'

    let styleClasses = ''
    if (pinned && horizontalTabs) {
      styleClasses =
        'rounded-lg bg-sky-100/60 dark:bg-gray-700/60 w-full min-w-fit px-[0.563rem] py-[0.438rem]'
    } else if (pinned && !horizontalTabs) {
      styleClasses = 'w-full rounded-2xl p-3 border-2 border-white/10 bg-sky-100/10'
    } else if (!pinned && horizontalTabs) {
      styleClasses = 'px-[0.625rem] !rounded-[0.625rem] text-[0.938rem] h-full'
    } else {
      styleClasses = 'px-4 py-2.5 rounded-2xl'
    }

    return `${baseClasses} ${activeClasses} ${magicClasses} ${selectedClasses} ${styleClasses} ${hoverClasses}`
  }

  const contextMenuMoveTabsToSpaces = derived(
    [spaces, tabsManager.activeScopeId],
    ([spaces, activeScopeId]) => {
      const handleMove = async (spaceId: string | null, label: string, makeActive = false) => {
        try {
          await tabsManager.scopeTab(tab.id, spaceId)

          if (makeActive) {
            await tabsManager.makeActive(tab.id)
          }

          toasts.success(`Tabs moved to ${label}!`)
        } catch (e) {
          toasts.error(`Failed to add to ${label}`)
        }
      }

      return [
        {
          type: 'action',
          icon: generalContext.icon,
          text: generalContext.label,
          action: () => handleMove(null, generalContext.label)
        } as CtxItem,
        {
          type: 'action',
          icon: newContext.icon,
          text: newContext.label,
          action: async () => {
            const space = await oasis.createNewBrowsingSpace(ChangeContextEventTrigger.Tab, {
              newTab: false
            })
            await handleMove(space.id, space.dataValue.folderName, true)
          }
        } as CtxItem,
        ...spaces
          .filter(
            (e) =>
              e.id !== 'all' &&
              e.id !== 'inbox' &&
              e.dataValue?.folderName?.toLowerCase() !== '.tempspace' &&
              !e.dataValue.builtIn &&
              e.id !== activeScopeId
          )
          .map(
            (space) =>
              ({
                type: 'action',
                icon: space.dataValue.colors,
                text: space.dataValue.folderName,
                action: () => handleMove(space.id, space.dataValue.folderName)
              }) as CtxItem
          )
      ]
    }
  )

  onMount(() => {
    if (tab.type === 'space') {
      fetchSpace(tab.spaceId)
    } else if (tab.type === 'page') {
      const unsubURLChangeEvent = tabsManager.on('url-changed', (updatedTab, newUrl) => {
        if (tab.id === updatedTab.id) {
          handleTabUrlChange(newUrl)
        }
      })

      return unsubURLChangeEvent
    }
  })
</script>

<!--
NOTE: need to disabled if for now and add back in future -> ONly apply to tabs full yvisible  not scrolled outside
  style:view-transition-name="tab-{tab.id}"

-->
<div
  draggable={true}
  id="tab-{tab.id}"
  class={$tabStyles}
  class:bg-green-200={isActive &&
    $inputUrl === 'surf.featurebase.app' &&
    !tab.magic &&
    !$homescreenVisible}
  class:bg-sky-200={isActive &&
    $inputUrl !== 'surf.featurebase.app' &&
    !tab.magic &&
    !$homescreenVisible}
  class:pinned
  class:horizontalTabs
  {horizontalTabs}
  class:hovered
  class:selected={isSelected && !$homescreenVisible}
  class:combine-border={(isMagicActive && tab.magic) ||
    (!isMagicActive && (isSelected || isActive))}
  class:magic={tab.magic}
  style={tabSize
    ? `width: ${tabSize}px; min-width: ${isActive && !pinned ? 260 : tabSize}px; max-width: ${tabSize}px;`
    : ''}
  style:position="relative"
  aria-hidden="true"
  use:HTMLDragItem.action={{}}
  on:DragStart={handleDragStart}
  on:DragEnd={handleDragEnd}
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (tab.type !== 'space' || tab.spaceId === 'all') return false
      if (
        drag.isNative ||
        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        // Cancel if tab dragged is a space itself
        if (drag.item?.data.getData(DragTypeNames.SURF_TAB)?.type === 'space') {
          return false
        }

        return true
      }
      return false
    }
  }}
  on:Drop={handleDrop}
  on:click={handleClick}
  on:mousedown={handleMouseDown}
  on:mouseenter={() => {
    hovered = true
    dispatch('mouseenter', tab.id)
  }}
  on:mouseleave={() => {
    if (!popoverVisible) hovered = false
    dispatch('mouseleave', tab.id)
  }}
  use:tooltip={pinned
    ? {
        content: sanitizedTitle,
        action: 'hover',
        position: 'top',
        animation: 'fade',
        delay: 500
      }
    : {}}
  use:contextMenu={{
    canOpen:
      isMagicActive ||
      $selectedTabs.size <= 1 ||
      Array.from($selectedTabs.values()).find((e) => e.id === tab.id) === undefined,
    items: [
      {
        type: 'action',
        hidden: tab.type !== 'page',
        disabled: isBookmarkedByUser,
        icon: isBookmarkedByUser ? 'check' : 'save',
        text: isBookmarkedByUser ? 'Saved' : 'Save',
        action: () => handleBookmark(SaveToOasisEventTrigger.ContextMenu)
      },
      {
        type: 'action',
        hidden: tab.type !== 'page' || !isBookmarkedByUser,
        icon: 'trash',
        text: 'Delete from Stuff',
        kind: 'danger',
        action: () => handleRemoveBookmark()
      },
      { type: 'separator', hidden: tab.type !== 'page' },
      {
        type: 'action',
        hidden: tab.type !== 'space' || !$userSettings.experimental_browsing_context,
        icon: generalContext.icon,
        text: 'Open as Context',
        action: () => {
          if (tab.type !== 'space') return
          tabsManager.changeScope(tab.spaceId, ChangeContextEventTrigger.Tab)
        }
      },
      {
        type: 'action',
        hidden: isMagicActive,
        icon: 'chat',
        text: 'Open in Chat',
        action: () => {
          dispatch('select', tab.id)
          dispatch('chat-with-tab', tab.id)
        }
      },
      {
        type: 'action',
        hidden: tab.type !== 'page' || !showLiveSpaceButton,
        icon: 'news',
        text: 'Create Live Space',
        action: () => handleCreateLiveSpace()
      },

      {
        type: 'action',
        hidden: !isMagicActive,
        icon: '',
        text: `${tab.magic ? 'Remove from' : 'Add to'} Chat`,
        action: () =>
          tab.magic ? dispatch('exclude-tab', tab.id) : dispatch('include-tab', tab.id)
      },
      {
        type: 'action',
        hidden: tab.type !== 'page',
        icon: 'link',
        text: 'Copy URL',
        action: () => {
          if (url) navigator.clipboard.writeText(url)
        }
      },
      { type: 'separator', hidden: !$userSettings.experimental_browsing_context },
      {
        type: 'sub-menu',
        hidden: !$userSettings.experimental_browsing_context,
        icon: 'circle.dot',
        text: 'Move Tabs to Space',
        items: $contextMenuMoveTabsToSpaces
      },
      { type: 'separator' },
      {
        type: 'action',
        icon: tab.pinned ? `pinned-off` : `pin`,
        text: tab.pinned ? 'Unpin' : 'Pin',
        action: () => (tab.pinned ? dispatch('unpin', tab.id) : dispatch('pin', tab.id))
      },
      {
        type: 'action',
        icon: 'close',
        text: 'Close',
        kind: 'danger',
        action: () => handleArchive(DeleteTabEventTrigger.ContextMenu)
      }
    ]
  }}
>
  <!-- Temporary DragZone overlay to allow dropping onto space tabs -->
  <!--{#if tab.type === 'space' && tab.spaceId !== 'all'}
    <div
      id="tabZone-{tab.id}"
      class="tmp-tab-drop-zone"
      style="position: absolute; inset-inline: 10%; inset-block: 20%;"
      on:DragEnter={(drag) => {
        /*const dragData = drag.data
        if (
          drag.isNative ||
          (dragData['surf/tab'] !== undefined && dragData['surf/tab'].type !== 'space') ||
          dragData['oasis/resource'] !== undefined
        ) {
          drag.continue() // Allow the drag
          return
        }
        drag.abort()*/
        // TODO: FIX
        drag.continue()
      }}
      on:Drop={handleDrop}
    ></div>
  {/if}-->

  <div
    class:icon-wrapper={true}
    class:flex-shrink-0={true}
    class:group-hover:hidden={(!isActive &&
      showClose &&
      ((tabSize && tabSize > 64 && horizontalTabs) || !horizontalTabs) &&
      !pinned &&
      hovered) ||
      (isActive && showClose && !pinned && hovered)}
  >
    <!--     style:view-transition-name="tab-icon-{tab.id}" -->
    {#if pdfResource}
      <Image
        src={`https://www.google.com/s2/favicons?domain=${pdfResource?.metadata?.sourceURI}&sz=48`}
        alt={tab.title}
        fallbackIcon="world"
      />
    {:else if tab.icon}
      <Image src={tab.icon} alt={tab.title} fallbackIcon="world" />
    {:else if tab.type === 'horizon'}
      <Icon name="grid" size="16px" />
    {:else if tab.type === 'importer'}
      <Icon name="code" size="16px" />
    {:else if tab.type === 'history'}
      <Icon name="history" size="16px" />
    {:else if tab.type === 'space' && space}
      <SpaceIcon folder={space} />
    {:else if tab.type === 'resource'}
      {#if tab.resourceType === ResourceTypes.DOCUMENT_SPACE_NOTE}
        <Icon name="docs" size="16px" />
      {:else}
        <FileIcon kind={getFileKind(tab.resourceType)} />
      {/if}
    {:else}
      <Icon name="world" size="16px" />
    {/if}
  </div>

  {#if showClose && ((tabSize && tabSize > 64 && horizontalTabs) || !horizontalTabs || isActive) && hovered}
    {#if tab.type == 'space'}
      <button
        on:click|stopPropagation={handleRemoveSpaceFromSidebar}
        class="items-center hidden group-hover:flex justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
        use:tooltip2={{
          text: 'Remove from Sidebar (⌘ + W)',
          position: 'right'
        }}
      >
        <Icon name="close" size="16px" />
      </button>
    {:else}
      <button
        on:click|stopPropagation={handleArchive}
        class="items-center hidden group-hover:flex justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
      >
        {#if tab.archived}
          <Icon name="trash" size="16px" />
        {:else}
          <Icon name="close" size="16px" />
        {/if}
      </button>
    {/if}
  {/if}
  {#if (!tab.pinned || !pinned) && ((horizontalTabs && isActive) || !(horizontalTabs && tabSize && tabSize < 48))}
    <div class="title relative flex-grow truncate mr-1">
      {#if (tab.type === 'page' || tab.type === 'empty') && isActive && enableEditing && (hovered || isEditing)}
        <input
          draggable
          on:dragstart|preventDefault|stopPropagation
          type="text"
          bind:value={$inputUrl}
          on:focus={handleInputFocus}
          on:blur={handleInputBlur}
          placeholder="Enter URL or search query"
          on:keydown={handleInputKeydown}
          bind:this={addressInputElem}
          class={`w-full h-full bg-transparent focus:outline-none group-active:select-none
          ${
            !isEditing && !isMagicActive
              ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-sky-900 to-sky-900 via-sky-500 dark:from-sky-100 dark:to-sky-100 dark:via-sky-300 bg-[length:250%_100%] z-[60]'
              : ''
          }`}
        />
      {:else}
        <div
          aria-hidden="true"
          class={`whitespace-nowrap overflow-hidden truncate max-w-full ${isMagicActive && tab.magic ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 dark:from-violet-100 dark:to-blue-100 dark:via-rose-300 bg-[length:250%_100%]' : ''}`}
        >
          {#if tab.type === 'space'}
            {tab.title}
          {:else}
            {sanitizedTitle}
          {/if}
        </div>
      {/if}
    </div>

    {#if showButtons && !isEditing && (hovered || $liveSpacePopoverOpened || $saveToSpacePopoverOpened) && (isActive || (tabSize && tabSize > 64)) && !showExcludeOthersButton}
      <div class="items-center flex justify-end flex-row gap-3 right-0">
        {#if tab.type === 'page' && isActive && showLiveSpaceButton}
          <CustomPopover position="right" popoverOpened={liveSpacePopoverOpened}>
            <button
              slot="trigger"
              class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
            >
              <Icon name="news" />
            </button>

            <div slot="content" class="no-drag p-1">
              <span class="px-4 py-8 mt-8">
                <br />Create a page subscription to <br />
                <span class="p-1 bg-white rounded-sm">
                  {tab.currentDetectedApp?.hostname}
                </span>
              </span>
              <div class="flex w-full">
                <button
                  class="flex items-center justify-center w-full p-2 m-1 transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 cursor-pointer rounded-md"
                  on:click={handleCreateLiveSpace}
                >
                  <Icon name="check" size="16px" />
                  Submit
                </button>
              </div>
              <ShortcutSaveItem
                on:save-resource-in-space={handleAddSourceToSpace}
                {spaces}
                infoText="or add updates from this site as a source to existing Space:"
              />
              <span class="p-4 py-4 mt-8 w-full text-xs text-gray-500 text-center">
                A Live Space will automatically pull in new <br /> items from the page
              </span>
            </div>
          </CustomPopover>
        {/if}

        {#if tab.type === 'page'}
          {#key isBookmarkedByUser}
            <CustomPopover position="right" popoverOpened={saveToSpacePopoverOpened}>
              <button
                slot="trigger"
                class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
                on:click|stopPropagation={handleBookmark}
              >
                {#if bookmarkingState === 'in_progress'}
                  <Icon name="spinner" size="16px" />
                {:else if bookmarkingState === 'success'}
                  <Icon name="check" size="16px" />
                {:else if bookmarkingState === 'error'}
                  <Icon name="close" size="16px" />
                {:else if isBookmarkedByUser}
                  <Icon name="bookmarkFilled" size="16px" />
                {:else}
                  <Icon name="save" size="18px" />
                {/if}
              </button>

              <div slot="content" class="no-drag p-1">
                <ShortcutSaveItem
                  on:save-resource-in-space={handleSaveResourceInSpace}
                  {spaces}
                  infoText="Save page to Space:"
                />
              </div>
            </CustomPopover>
          {/key}
        {/if}

        <!-- {#if tab.magic}
          <button
            on:click|stopPropagation={handleExcludeTab}
            class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-full cursor-pointer"
            use:tooltip={{
              content: 'Add Tab to Context',
              action: 'hover',
              position: 'left',
              animation: 'fade',
              delay: 500
            }}
          >
            <Icon name="minus" size="16px" />
          </button>
        {/if} -->
      </div>
    {:else if (showExcludeOthersButton || showIncludeButton) && hovered}
      <div class="items-center flex justify-end flex-row space-x-2 right-0">
        {#if showExcludeOthersButton}
          <button
            on:click|stopPropagation={handleExcludeOthers}
            class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none text-sky-900 dark:text-gray-200 transition-colors hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
            use:tooltip={{
              content: 'Only use this tab',
              action: 'hover',
              position: 'left',
              animation: 'fade',
              delay: 500
            }}
          >
            <!-- <Icon name="arrow.autofit.up" size="16px" /> -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon icon-tabler icons-tabler-outline icon-tabler-focus-centered"
              ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
                d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"
              /><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path
                d="M16 4h2a2 2 0 0 1 2 2v2"
              /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" /></svg
            >
          </button>
        {/if}
      </div>
    {/if}

    {#if isScopedMiniBrowserOpen}
      <div
        class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content text-sky-950 dark:text-gray-200 bg-sky-200/80 dark:bg-gray-700/80 rounded-full"
      >
        <Icon name="eye" />
      </div>
    {/if}

    {#if isInsecureUrl && isActive}
      <InsecurePageWarningIndicator showText={showInsecureWarningText && !isEditing} />
    {/if}
  {/if}
</div>

<style lang="scss">
  .tab {
    view-transition-class: tab !important;

    transition:
      0s ease-in-out,
      transform 0s;
  }
  :global(.tab[data-context-menu-anchor]) {
    opacity: 1;
    background: rgba(255, 255, 255, 0.55);
    outline: none;
  }
  :global(.tab img) {
    user-select: none;
  }

  :global(.tab[data-dragging-item]) {
    background: #e0f2fe;
    opacity: 1;
  }
  :global(.tab[data-drag-preview]) {
    background: rgba(255, 255, 255, 1);
    opacity: 80%;
    border: 2px solid rgba(10, 12, 24, 0.1);
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;

    width: var(--drag-width, auto);
    height: var(--drag-height, auto);
    transition:
      0s ease-in-out,
      transform 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      outline 175ms cubic-bezier(0.4, 0, 0.2, 1),
      width 175ms cubic-bezier(0.4, 0, 0.2, 1),
      height 175ms cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  :global(.tab[data-drag-target='sidebar-pinned-tabs']) {
    width: 38px;
    height: 38px;

    > *:not(.icon-wrapper) {
      display: none;
    }
  }
  :global(.tab[data-drag-preview][data-drag-target^='webview']) {
    --scale: 0.88;

    /*border-width: 1.5px;
    border-color: rgba(5, 5, 25, 0.3);
    border-style: dashed;*/
    background: #fff;
    border: 2px dotted rgba(5, 5, 25, 0.3);
    opacity: 95%;
    // https://getcssscan.com/css-box-shadow-examples
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;
  }
  :global(body[data-dragging='true'] .tab:not([data-dragging-item])) {
    background: transparent !important;
  }
  :global(body[data-dragging='true'] .tab:not([data-dragging-item])) {
    box-shadow: none;
  }

  :global(.tab[data-drag-target='true']) {
    outline: 1.5px dashed rgba(5, 5, 25, 0.3) !important;
    outline-offset: -1.5px;
  }

  /*:global(.tab[data-dragcula-dragging-item='true'] .tmp-tab-drop-zone) {
    pointer-events: none;
  }
  :global(body:not([data-dragcula-dragging='true']) .tmp-tab-drop-zone) {
    display: none;
  }*/
  .icon-wrapper {
    width: 16px;
    height: 16px;
    display: block;
    user-select: none;
    flex-shrink: 0;
  }

  .tab.selected:not(.active) {
    opacity: 1;
    background: rgba(255, 255, 255, 0.55);
    outline: none;

    :global(.dark) & {
      @apply bg-gray-700/70;
    }
  }
  /*.tab.magic:not(.active) {
    //background: rgba(255, 205, 205, 0.55);
    @apply bg-violet-600/25;
  }*/

  /* #FF729F */

  /*.tab.magic {
    background: #ff8cc6 !important;
    color: #560027;
    &:hover {
      background: #ff578f !important;
      color: #560027;
    }
  }

  .tab.magic.active {
    background: #ffccf1 !important;
    color: #760042;
  }*/

  .tab.active {
    background: #e9f5fd;
    outline: none;

    :global(.dark) & {
      @apply bg-gray-600;
    }
  }

  :global(.vertical-tabs) {
    .tab.combine-border {
      border-radius: 1rem 1rem 0 0;
    }

    .tab.combine-border + .combine-border {
      border-radius: 0;
    }

    .tab.combine-border:has(+ :not(.combine-border)) {
      border-radius: 0 0 1rem 1rem;
    }

    .tab:not(.combine-border) + .combine-border:has(+ :not(.combine-border)) {
      border-radius: 1rem;
    }

    /* This fixes none borders for last element in list if selected. */
    .tab:last-child.combine-border {
      border-bottom-left-radius: 1rem;
      border-bottom-right-radius: 1rem;
    }
    /* This fixes none borders for first element in list if selected. */
    .tab:first-child.combine-border {
      border-top-left-radius: 1rem;
      border-top-right-radius: 1rem;
    }
  }

  :global(.horizontal-tabs) {
    .tab.combine-border {
      border-radius: 0.75rem 0 0 0.75rem;

      position: relative;
      &::after {
        content: '';
        position: absolute;
        right: -5px;
        top: -1.5px;
        bottom: -1.5px;
        width: 3.5px;
        background: inherit;
      }
    }

    .tab.combine-border + .combine-border {
      border-radius: 0;
    }

    .tab.combine-border:has(+ :not(.combine-border)) {
      border-radius: 0 0.75rem 0.75rem 0;

      &::after {
        content: unset;
      }
    }

    .tab:not(.combine-border) + .combine-border:has(+ :not(.combine-border)) {
      border-radius: 0.75rem;
    }

    /* This fixes none borders for last element in list if selected. */
    .tab:last-child.combine-border {
      border-top-right-radius: 0.75rem;
      border-bottom-right-radius: 0.75rem;

      &::after {
        content: unset;
      }
    }
    /* This fixes none borders for first element in list if selected. */
    .tab:first-child.combine-border {
      border-top-left-radius: 0.75rem;
      border-bottom-left-radius: 0.75rem;
    }
  }

  .tab.pinned.magic {
    position: relative;
    &::after {
      position: absolute;
      z-index: -1;
      filter: blur(4px);
      content: '';
      inset: 0px;
      border-radius: 15px;

      //@apply animate-text-shimmer;
      @apply bg-gradient-to-r from-sky-600 to-blue-700 via-sky-400 bg-[length:250%_100%];
      animation: text-shimmer 2s infinite linear;
    }
  }
</style>
