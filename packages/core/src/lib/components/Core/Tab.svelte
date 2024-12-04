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
  import { derived, get, writable, type Writable } from 'svelte/store'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { HTMLDragZone, HTMLDragItem, DragculaDragEvent } from '@horizon/dragcula'
  import { Resource, useResourceManager } from '../../service/resources'
  import { ResourceTypes, type DragTypes, DragTypeNames } from '../../types'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import { contextMenu, type CtxItem } from './ContextMenu.svelte'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import { useTabsManager } from '../../service/tabs'
  import { useColorService } from '../../service/colors'
  import {
    ChangeContextEventTrigger,
    DeleteTabEventTrigger,
    OpenInMiniBrowserEventFrom,
    SaveToOasisEventTrigger
  } from '@horizon/types'
  import InsecurePageWarningIndicator from '../Atoms/InsecurePageWarningIndicator.svelte'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import {
    useGlobalMiniBrowser,
    useScopedMiniBrowserAsStore
  } from '@horizon/core/src/lib/service/miniBrowser'
  import { useOasis, type OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { generalContext, newContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { SelectDropdown, type SelectItem } from '../Atoms/SelectDropdown/index'
  import { useDesktopManager } from '../../service/desktop'

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
  export let disableContextmenu = false
  export let inStuffBar = false

  const log = useLogScope('Tab')
  const tabsManager = useTabsManager()
  const userConfig = useConfig()
  const oasis = useOasis()
  const toasts = useToasts()
  const desktopManager = useDesktopManager()
  const colorService = useColorService()
  const globalMiniBrowser = useGlobalMiniBrowser()
  const scopedMiniBrowser = useScopedMiniBrowserAsStore(`tab-${tab.id}`)

  const desktopVisible = desktopManager.activeDesktopVisible
  const activeDesktopColorScheme = desktopManager.activeDesktopColorScheme

  const colorScheme = colorService.colorScheme
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
    'create-new-space': void
  }>()
  const resourceManager = useResourceManager()

  const liveSpacePopoverOpened = writable(false)
  const saveToSpacePopoverOpened = writable(false)
  const selectedTabs = tabsManager.selectedTabs
  const tabStyles = writable<string>('')
  const spaceSearchValue = writable<string>('')

  const SHOW_INSECURE_WARNING_TIMEOUT = 3000

  let addressInputElem: HTMLInputElement
  let space: OasisSpace | null = null
  let spaceData: OasisSpace['data'] | null = null
  let isDragging = false
  let isEditing = false
  let hovered = false
  let popoverVisible = false
  let popoverLiveSpaceVisible = false
  let showInsecureWarningText = false
  let pdfResource: Resource | null = null

  const saveToSpaceItems = derived([spaces, spaceSearchValue], ([spaces, searchValue]) => {
    const spaceItems = spaces
      .sort((a, b) => {
        return a.indexValue - b.indexValue
      })
      .map(
        (space) =>
          ({
            id: space.id,
            label: space.dataValue.folderName,
            data: space
          }) as SelectItem
      )

    if (!searchValue) return spaceItems

    return spaceItems.filter((item) => item.label.toLowerCase().includes(searchValue.toLowerCase()))
  })

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
  $: isActive = tab.id === $activeTabId && !removeHighlight && !$desktopVisible
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

      desktopManager.setVisible(false)
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

  const handleDoubleClick = (e: MouseEvent) => {
    log.debug('handleDoubleClick', e)

    // find the tab that was active before the first click
    const lastTabId = get(tabsManager.activeTabsHistory)
      .reverse()
      .find((e) => e !== tab.id)

    // Restore previous active tab from before the first click
    if (lastTabId && tabsManager.activeTabIdValue !== lastTabId) {
      tabsManager.addTabToScopedActiveTabs(lastTabId)
    }

    // remove the tab from the selected tabs as the first click will have selected it
    if (isUserSelected || isSelected) {
      dispatch('passive-select', tab.id)
    }

    if (tab.type === 'space') {
      tabsManager.changeScope(tab.spaceId, ChangeContextEventTrigger.Tab)
      return
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
      if (space) {
        spaceData = space.data
      }
    } catch (error) {
      log.error('Failed to fetch space:', error)
    }
  }

  const handleBookmark = (trigger: SaveToOasisEventTrigger = SaveToOasisEventTrigger.Click) => {
    dispatch('bookmark', { trigger })
    saveToSpacePopoverOpened.set(false)
  }

  const handleRemoveBookmark = () => {
    dispatch('remove-bookmark', tab.id)
  }

  const handleCreateLiveSpace = () => {
    liveSpacePopoverOpened.set(false)
    dispatch('create-live-space')
  }

  const handleCreateNewSpace = () => {
    saveToSpacePopoverOpened.set(false)
    dispatch('create-new-space')
  }

  const handleAddSourceToSpace = (event: CustomEvent<OasisSpace>) => {
    liveSpacePopoverOpened.set(false)
    dispatch('add-source-to-space', event.detail)
  }

  const handleSaveResourceInSpace = (event: CustomEvent<string>) => {
    const spaceId = event.detail
    log.debug('selected space to save to', spaceId)

    if (spaceId === 'new') {
      handleCreateNewSpace()
      return
    }

    const space = $spaces.find((space) => space.id === spaceId)

    if (!space) {
      log.error('Space not found:', spaceId)
      return
    }

    dispatch('save-resource-in-space', space)
    saveToSpacePopoverOpened.set(false)
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
    // Core tab styling classes
    const baseClasses = [
      'tab',
      'no-drag',
      'flex',
      'items-center',
      'group',
      'transform',
      'active:scale-[98%]',
      'cursor-pointer',
      'gap-3',
      'justify-center',
      'relative',
      'text-sky-900 dark:text-sky-100',
      'font-medium',
      'text-md',
      'overflow-hidden',
      'min-w-[48px]'
    ].join(' ')

    // Active state classes
    let activeClasses = ''
    if (isActive) {
      activeClasses = 'active text-sky-950 dark:text-gray-100 sticky'
    } else if (!pinned && horizontalTabs) {
      activeClasses = 'bg-sky-100/60 dark:bg-gray-800/60'
    }

    // Special state classes
    const magicClasses = tab.magic && !isActive ? 'ring-[0] ring-pink-600' : ''
    const selectedClasses = isSelected && !isActive ? '' : ''
    const hoverClasses = 'hover:bg-sky-100 dark:hover:bg-gray-600'

    // Layout classes based on pin state and orientation
    let styleClasses = ''
    if (pinned) {
      if (horizontalTabs) {
        styleClasses =
          'bg-sky-100/60 dark:bg-gray-700/60 w-full min-w-fit px-[0.563rem] py-[0.438rem]'
      } else {
        styleClasses = 'w-full p-3'
      }
    } else {
      if (horizontalTabs) {
        styleClasses = 'px-[0.625rem] text-[0.938rem] h-full'
      } else {
        styleClasses = 'px-4 py-2.5'
      }
    }

    // Combine all classes
    return [
      baseClasses,
      activeClasses,
      magicClasses,
      selectedClasses,
      styleClasses,
      hoverClasses
    ].join(' ')
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
                icon: space,
                text: space.dataValue.folderName,
                action: () => handleMove(space.id, space.dataValue.folderName)
              }) as CtxItem
          )
      ]
    }
  )

  onMount(() => {
    log.warn('onMount', tab.id, tab.type)
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

  let canEdit = false
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
    !$desktopVisible}
  class:bg-sky-200={isActive &&
    $inputUrl !== 'surf.featurebase.app' &&
    !tab.magic &&
    !$desktopVisible}
  class:active={tab.id === $activeTabId && !$desktopVisible}
  class:pinned
  class:horizontalTabs
  class:inStuffBar
  {horizontalTabs}
  class:hovered
  class:selected={isSelected && !$desktopVisible}
  class:combine-border={// Combine border class if:
  // 1. Magic is active and tab is magical, or
  // 2. Magic is inactive but tab is selected/active
  !$desktopVisible &&
    ((isMagicActive && tab.magic) || (!isMagicActive && (isSelected || isActive)))}
  class:magic={tab.magic}
  style={tabSize
    ? `width: ${tabSize}px; min-width: ${isActive && !pinned ? 260 : tabSize}px; max-width: ${tabSize}px;`
    : ''}
  style:position="relative"
  style:--custom-color={$colorScheme.color}
  style:--contrast-color={$colorScheme.contrastColor}
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
  on:dblclick={handleDoubleClick}
  on:mousedown={handleMouseDown}
  on:mouseenter={() => {
    hovered = true
    dispatch('mouseenter', tab.id)
  }}
  on:mouseleave={() => {
    if (!popoverVisible) hovered = false
    dispatch('mouseleave', tab.id)
  }}
  use:contextMenu={{
    canOpen:
      (isMagicActive ||
        $selectedTabs.size <= 1 ||
        Array.from($selectedTabs.values()).find((e) => e.id === tab.id) === undefined) &&
      !disableContextmenu,
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
        hidden: tab.type !== 'space',
        icon: generalContext.icon,
        text: 'Open Context',
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
        text: 'Create Live Context',
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
      {
        type: 'sub-menu',
        icon: 'circle.dot',
        text: 'Move Tabs to Context',
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
    class="custom-text-color"
    class:icon-wrapper={true}
    class:flex-shrink-0={true}
    class:emoji-adjustment={$spaceData?.emoji}
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
      <Icon name="save" size="16px" style="transform: rotate(180deg)" />
    {:else if tab.type === 'history'}
      <Icon name="history" size="16px" />
    {:else if tab.type === 'space' && space}
      <SpaceIcon folder={space} interactive={false} />
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
        class="custom-text-color items-center hidden group-hover:flex justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
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
        class="custom-text-color items-center hidden group-hover:flex justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
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
      {#if (tab.type === 'page' || tab.type === 'empty') && isActive && enableEditing && isEditing}
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
          on:mousedown={() => {
            isEditing = true
            tick().then(() => {
              setTimeout(() => {
                addressInputElem?.focus()
              }, 175)
            })
          }}
          class={hovered && isActive && tab.type === 'page'
            ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-sky-900 to-sky-900 via-sky-500 dark:from-sky-100 dark:to-sky-100 dark:via-sky-300 bg-[length:250%_100%] z-[60] cursor-text'
            : `whitespace-nowrap overflow-hidden truncate max-w-full ${isMagicActive && tab.magic ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 dark:from-violet-100 dark:to-blue-100 dark:via-rose-300 bg-[length:250%_100%]' : ''}`}
        >
          {#if hovered && isActive && tab.type === 'page' && !inStuffBar}
            {$inputUrl}
          {:else if tab.type === 'space'}
            {tab.title}
          {:else}
            {sanitizedTitle}
          {/if}
        </div>
      {/if}
    </div>

    {#if showButtons && !isEditing && (hovered || $liveSpacePopoverOpened || $saveToSpacePopoverOpened) && (isActive || (tabSize && tabSize > 64) || !horizontalTabs) && !showExcludeOthersButton}
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
                infoText="or add updates from this site as a source to existing Context:"
              />
              <span class="p-4 py-4 mt-8 w-full text-xs text-gray-500 text-center">
                A Live Context will automatically pull in new <br /> items from the page
              </span>
            </div>
          </CustomPopover>
        {/if}

        {#if tab.type === 'page'}
          {#key isBookmarkedByUser}
            <SelectDropdown
              items={saveToSpaceItems}
              search={$spaces.length > 0 ? 'manual' : 'disabled'}
              searchValue={spaceSearchValue}
              footerItem={newContext}
              inputPlaceholder="Select a Context to save to…"
              open={saveToSpacePopoverOpened}
              openOnHover={500}
              disabled={disableContextmenu}
              side="right"
              keepHeightWhileSearching
              on:select={handleSaveResourceInSpace}
            >
              <button
                on:click|stopPropagation={() => handleBookmark()}
                class="custom-text-color flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 dark:text-gray-200 hover:text-sky-950 dark:hover:text-gray-50 hover:bg-sky-200/80 dark:hover:bg-gray-700/80 rounded-full cursor-pointer"
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

              <div slot="empty" class="flex flex-col justify-center gap-2 h-full">
                {#if $spaceSearchValue.length > 0 || $saveToSpaceItems.length === 0}
                  <div class="h-full flex flex-col justify-center">
                    <p class="text-gray-400 dark:text-gray-400 text-center py-6">
                      No Contexts found
                    </p>
                  </div>
                {/if}
              </div>
            </SelectDropdown>
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
  // TODO!!: We should move these to browser.svelte soon, as these will override the globals, so when
  // we start theming the rest of the app, these should move!
  :root {
    --red: rgba(255, 0, 0, 1);
    --dark-on-pinned-surface: rgba(75, 85, 99, 1);
    --dark-on-unpinned-surface-horizontal: rgba(25, 35, 55, 1);
    --dark-on-unpinned-surface-horizontal-hover: rgba(30, 34, 39, 0.9);
    --dark-on-unpinned-surface: rgba(45, 55, 69, 1);
    --ring-color: rgba(59, 130, 246, 0.75);
    --ring-color-muted: rgba(59, 130, 246, 0.5);
    --ring-color-shade: rgba(59, 130, 246, 0.12);
    --dark-on-unpinned-surface-ring: inset 0px 1.5px 0px -0.75px rgba(59, 130, 246, 0.33),
      inset 1.5px 0px 0px -0.75px rgba(59, 130, 246, 0.33),
      inset -1.5px 0px 0px -0.75px rgba(59, 130, 246, 0.33),
      inset 0px -1.5px 0px -0.75px rgba(59, 130, 246, 0.33);
    --white: rgba(255, 255, 255, 1);
    --white-95: rgba(255, 255, 255, 0.95);
    --white-85: rgba(255, 255, 255, 0.85);
    --white-80: rgba(255, 255, 255, 0.8);
    --white-75: rgba(255, 255, 255, 0.75);
    --white-65: rgba(255, 255, 255, 0.65);
    --white-60: rgba(255, 255, 255, 0.6);
    --white-55: rgba(255, 255, 255, 0.55);
    --white-40: rgba(255, 255, 255, 0.4);
    --white-33: rgba(255, 255, 255, 0.33);
    --white-26: rgba(255, 255, 255, 0.26);
    --white-15: rgba(255, 255, 255, 0.15);
    --white-09: rgba(255, 255, 255, 0.09);

    --black: rgba(0, 0, 0, 1);
    --black-85: rgba(0, 0, 0, 0.85);
    --black-45: rgba(0, 0, 0, 0.45);
    --black-33: rgba(0, 0, 0, 0.33);

    --black-09: rgba(0, 0, 0, 0.09);
    --black-08: rgba(0, 0, 0, 0.08);
    --black-01: rgba(0, 0, 0, 0.01);
    --black-00: rgba(0, 0, 0, 0);
    --sky-gray: rgba(88, 104, 132, 1);
    --sky-gray-09: rgba(88, 104, 132, 0.09);
    --sky-gray-03: rgba(88, 104, 132, 0.03);

    --sky-blue: #e0f2fe;
    --dark-outline: rgba(5, 5, 25, 0.3);
  }

  .tab {
    view-transition-class: tab !important;
    padding: 0.725rem 1rem;
    font-weight: 400;
    -webkit-font-smoothing: auto;
    letter-spacing: 0.00925em;
    transition:
      0s ease-in-out,
      transform 0s;

    .title {
      color: var(--contrast-color) !important;
    }
    :global(.verticalTabs)
      &.active:not(.combine-border + .combine-border):not(.combine-border ~ .combine-border):not(
        :has(+ .combine-border)
      ) {
      background: paint(squircle) !important;
      --squircle-radius-top-left: 16px;
      --squircle-radius-top-right: 16px;
      --squircle-radius-bottom-left: 16px;
      --squircle-radius-bottom-right: 16px;
      --squircle-smooth: 0.33;
      --squircle-shadow: 0px 2px 2px -1px var(--black-09);
      --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
        inset 0px 1.25px 0px -1.25px var(--white-60), inset 1.25px 0px 0px -1.25px var(--white-60),
        inset -1.25px 0px 0px -1.25px var(--white-60), inset 0px -1.25px 0px -1.25px var(--white-60);
      --squircle-fill: var(--white-75);
      border-radius: 0 !important;

      :global(.dark:not(.custom)) & {
        --squircle-shadow: 0 !important;
        --squircle-inner-shadow: 0 !important;
        --squircle-outline-width: 1.5px !important;
        --squircle-outline-color: var(--ring-color) !important;
        --squircle-fill: var(--dark-on-unpinned-surface) !important;
      }

      :global(.custom) & {
        --squircle-shadow: 0 !important;
        --squircle-inner-shadow: 0 !important;
        --squircle-outline-width: 1.5px !important;
        --squircle-outline-color: transparent !important;
        --squircle-fill: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 0%, 0.2)) !important;
      }

      :global(.custom.dark) & {
        --squircle-shadow: 0 !important;
        --squircle-inner-shadow: 0 !important;
        --squircle-outline-width: 1.5px !important;
        --squircle-outline-color: transparent !important;
        --squircle-fill: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 50%, 0.65)) !important;
      }
    }

    // Unpinned tabs
    &:not(.pinned) {
      // Vertical unpinned
      &:not(.horizontalTabs) {
        &:hover {
          background: paint(squircle);
          --squircle-radius: 16px;
          --squircle-smooth: 0.33;
          --squircle-fill: var(--black-09);
          // TODO: (MERGE) ?
          //--squircle-shadow: 0px 2px 2px -1px rgba(0, 0, 0, 0), 0px -2px 2px -1px rgba(0, 0, 0, 0);

          :global(.dark) & {
            --squircle-fill: var(--dark-on-unpinned-surface-horizontal-hover) !important;
          }
        }
      }

      // Horizontal unpinned
      &.horizontalTabs:not(.inStuffBar) {
        background: paint(squircle);
        --squircle-radius: 8px;
        --squircle-smooth: 0.28;
        --squircle-fill: var(--white-33);

        :global(.dark:not(.custom)) & {
          --squircle-fill: var(--dark-on-unpinned-surface-horizontal) !important;
        }

        :global(.custom) & {
          --squircle-fill: color-mix(
            in hsl,
            var(--custom-color),
            hsla(0, 80%, 70%, 0.65)
          ) !important;
        }

        :global(.custom.dark) & {
          --squircle-fill: color-mix(
            in hsl,
            var(--custom-color),
            hsla(0, 40%, 33%, 0.8)
          ) !important;
        }

        &:hover {
          --squircle-fill: var(--white-55);

          :global(.dark) & {
            --squircle-fill: var(--dark-on-unpinned-surface-horizontal) !important;
          }
        }

        &.selected {
          background: paint(squircle);
          --squircle-outline-color: var(--black-00);
          --squircle-inner-shadow: inset 0px 2px 0px -1px var(--white-80),
            inset 2px 0px 0px -1px var(--white-80), inset -2px 0px 0px -1px var(--white-80),
            inset 0px -2px 0px -1px var(--white-80);
          --squircle-fill: var(--white-40);
        }

        &.active {
          padding: 15.25px 1rem 15px 1rem;
          margin-top: -1.25px;
          background: paint(squircle);
          --squircle-radius-top-left: 9px !important;
          --squircle-radius-top-right: 9px !important;
          --squircle-radius-bottom-left: 9px !important;
          --squircle-radius-bottom-right: 9px !important;
          --squircle-smooth: 0.25 !important;
          --squircle-fill: var(--white-80);
          --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
            inset 0px 1.5px 0px -1px var(--white-85), inset 1.5px 0px 0px -1px var(--white-85),
            inset -1.5px 0px 0px -1px var(--white-85), inset 0px -1.5px 0px -1px var(--white-85);
          --squircle-shadow: 0px 2px 2px -1px var(--sky-gray-09),
            0px -2px 0px -1px var(--sky-gray-03);
        }
      }

      &.inStuffBar {
        background: paint(squircle);
        --squircle-radius: 8px;
        --squircle-smooth: 0.28;
        --squircle-fill: rgba(224, 242, 254, 0.6);

        :global(.dark) & {
          --squircle-fill: var(--dark-on-unpinned-surface-horizontal) !important;
        }

        &:hover {
          --squircle-fill: rgb(224 242 254);
          :global(.dark) & {
            --squircle-fill: var(--dark-on-unpinned-surface-horizontal-hover) !important;
          }
        }

        &.selected {
          background: paint(squircle);
          --squircle-outline-color: rgba(0, 0, 0, 0);
          --squircle-inner-shadow: inset 0px 2px 0px -1px rgba(255, 255, 255, 0.8),
            inset 2px 0px 0px -1px rgba(255, 255, 255, 0.8),
            inset -2px 0px 0px -1px rgba(255, 255, 255, 0.8),
            inset 0px -2px 0px -1px rgba(255, 255, 255, 0.8);
          --squircle-fill: rgb(190, 229, 255);
        }

        &.active {
          margin-top: -1.25px;
          background: paint(squircle);
          --squircle-radius-top-left: 9px !important;
          --squircle-radius-top-right: 9px !important;
          --squircle-radius-bottom-left: 9px !important;
          --squircle-radius-bottom-right: 9px !important;
          --squircle-smooth: 0.25 !important;
          --squircle-fill: rgb(221, 241, 255);
          // --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
          //   inset 0px 1.5px 0px -1px rgba(255, 255, 255, 0.85),
          //   inset 1.5px 0px 0px -1px rgba(255, 255, 255, 0.85),
          //   inset -1.5px 0px 0px -1px rgba(255, 255, 255, 0.85),
          //   inset 0px -1.5px 0px -1px rgba(255, 255, 255, 0.85);
          // --squircle-shadow: 0px 2px 2px -1px rgba(88, 104, 132, 0.09),
          //   0px -2px 0px -1px rgba(88, 104, 132, 0.03);
        }
      }
    }

    // Pinned tabs
    &.pinned {
      // Vertical pinned
      &:not(.horizontalTabs) {
        padding: 0.95rem;
        background: paint(squircle);
        --squircle-radius: 16px;
        --squircle-smooth: 0.33;
        --squircle-inner-shadow: inset 0px 0px 0px 0.75px var(--white-26);
        --squircle-shadow: 0px 2px 2px -1px var(--black-00) !important;
        --squircle-fill: var(--white-15);
        :global(.dark) & {
          --squircle-fill: var(--white-09) !important;
        }

        &.active {
          background: paint(squircle) !important;
          --squircle-radius: 16px !important;
          --squircle-smooth: 0.33 !important;
          // flag
          --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
            inset 0px 0px 0px 0.75px var(--white-26) !important;
          --squircle-shadow: 0px 2px 2px -1px var(--black-08) !important;
          --squircle-fill: var(--white-60) !important;
          :global(.dark) & {
            --squircle-fill: var(--dark-on-pinned-surface) !important;
          }
        }

        &.selected {
          background: paint(squircle);
          --squircle-smooth: 0.33;
          --squircle-outline-color: var(--black-00);
          --squircle-inner-shadow: inset 0px 2px 0px -1px var(--white-80),
            inset 2px 0px 0px -1px var(--white-80), inset -2px 0px 0px -1px var(--white-80),
            inset 0px -2px 0px -1px var(--white-80);
          --squircle-shadow: 0px 2px 2px -1px var(--black-08);
          --squircle-fill: var(--white-40);
        }

        &:hover {
          background: paint(squircle);
          --squircle-radius: 16px !important;
          --squircle-smooth: 0.33 !important;
          --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
            inset 0px 0px 0px 0.75px var(--white-26) !important;
          --squircle-shadow: 0px 2px 2px -1px var(--black-01);
          --squircle-fill: var(--white-60) !important;
          :global(.dark) & {
            --squircle-fill: var(--dark-on-pinned-surface) !important;
          }
        }
      }

      // Horizontal pinned
      &.horizontalTabs {
        padding: 0.5rem;
        background: paint(squircle);
        --squircle-radius: 8px;
        --squircle-smooth: 0.28;
        --squircle-shadow: 0px 2px 2px -1px var(--black-00) !important;
        --squircle-fill: var(--white-33);
        :global(.dark) & {
          --squircle-fill: var(--dark-on-unpinned-surface-horizontal) !important;
          --squircle-shadow: 0px 0px 0px 0px var(--black-00) !important;
        }

        &.selected {
          background: paint(squircle);
          --squircle-outline-color: var(--black-00);
          --squircle-inner-shadow: inset 0px 2px 0px -1px var(--white-80),
            inset 2px 0px 0px -1px var(--white-80), inset -2px 0px 0px -1px var(--white-80),
            inset 0px -2px 0px -1px var(--white-80);
          --squircle-shadow: 0px 2px 2px -1px var(--black-08);
          --squircle-fill: var(--white-40);
        }

        &.active {
          background: paint(squircle);
          --squircle-radius-top-left: 8px !important;
          --squircle-radius-top-right: 8px !important;
          --squircle-radius-bottom-left: 8px !important;
          --squircle-radius-bottom-right: 8px !important;
          --squircle-smooth: 0.28 !important;
          --squircle-fill: var(--white-65) !important;
          --squircle-outline-width: 0px;
          --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
            inset 0px 1.5px 0px -1px var(--white-85), inset 1.5px 0px 0px -1px var(--white-85),
            inset -1.5px 0px 0px -1px var(--white-85), inset 0px -1.5px 0px -1px var(--white-85);
          --squircle-shadow: 0px 2px 2px -1px var(--black-08) !important;
        }

        &:hover {
          --squircle-fill: var(--white-55);
          // TODO: (MERGE) ? prob using base styles so we can delete
          /*--squircle-outline-width: 0px;
          --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
            inset 0px 1.5px 0px -1px rgba(255, 255, 255, 0.85),
            inset 1.5px 0px 0px -1px rgba(255, 255, 255, 0.85),
            inset -1.5px 0px 0px -1px rgba(255, 255, 255, 0.85),
            inset 0px -1.5px 0px -1px rgba(255, 255, 255, 0.85);
          --squircle-shadow: 0px 2px 2px -1px rgba(0, 0, 0, 0.08) !important;*/

          :global(.dark) & {
            --squircle-outline-width: 1.5px !important;
            --squircle-outline-color: var(--ring-color-muted) !important;
            --squircle-fill: var(--dark-on-unpinned-surface-horizontal-hover) !important;
          }
        }
      }

      // Magic states
      &.magic:not(.pinned) {
        position: relative;
        &::after {
          position: absolute;
          z-index: -1;
          filter: blur(4px);
          content: '';
          inset: 0px;
          border-radius: 15px;
          @apply bg-gradient-to-r from-sky-600 to-blue-700 via-sky-400 bg-[length:250%_100%];
          animation: text-shimmer 2s infinite linear;
        }
      }

      &.magic.pinned:not(.horizontalTabs) {
        position: relative;
        &::after {
          position: absolute;
          z-index: -1;
          width: 22px;
          height: 22px;
          filter: blur(2px);
          content: '';
          inset: 50%;
          transform: translate(-50%, -50%);
          border-radius: 12px;
          @apply bg-gradient-to-r from-sky-600 to-blue-700 via-sky-400 bg-[length:250%_100%];
          animation: text-shimmer 1.5s infinite linear;
        }
      }

      &.magic.pinned.horizontalTabs {
        position: relative;
        &::after {
          position: absolute;
          z-index: -1;
          margin: 5.5px 5.5px;
          filter: blur(2px);
          content: '';
          inset: 0px;
          border-radius: 8px;
          @apply bg-gradient-to-r from-sky-600 to-blue-700 via-sky-400 bg-[length:250%_100%];
          animation: text-shimmer 1.5s infinite linear;
        }
      }
    }

    // Selected and active states
    &.selected:not(.active) {
      opacity: 1;
      background: var(--white-55);
      outline: none;

      :global(.dark) & {
        @apply bg-gray-700/70;
      }
    }

    &.active {
      background: var(--hover-color);
      outline: none;

      :global(.dark) & {
        @apply bg-gray-600;
      }
    }
  }

  // Global styles
  :global(.tab[data-context-menu-anchor]) {
    opacity: 1;
    background: var(--white-55);
    outline: none;
  }

  :global(.tab img) {
    user-select: none;
  }

  :global(.tab[data-dragging-item]) {
    background: var(--sky-blue);
    opacity: 1;
  }

  :global(.tab[data-drag-preview]) {
    width: var(--drag-width, auto) !important;
    height: var(--drag-height, auto) !important;

    background: paint(squircle);
    --squircle-radius: 20px;
    --squircle-smooth: 0.33;
    --squircle-shadow: 0px 2px 2px -1px var(--black-09), 0px -2px 0px -1px var(--black-03);
    --squircle-fill: var(--white);

    box-shadow: none !important;
    // TODO: Fix squircle shadow

    :global(.custom) & {
      --squircle-fill: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 0%, 0.2)) !important;
    }
    :global(.dark.custom) & {
      --squircle-fill: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 50%, 0.65)) !important;
    }
  }

  :global(.tab[data-drag-target='sidebar-pinned-tabs']) {
    width: 38px;
    height: 38px;

    > *:not(.icon-wrapper) {
      display: none;
    }
  }

  :global(.tab[data-drag-preview][data-drag-target^='webview']) {
    --squircle-fill: var(--white) !important;
    opacity: 100%;

    :global(.custom) & {
      --squircle-fill: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 0%, 0.75)) !important;
    }
    :global(.dark.custom) & {
      --squircle-fill: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 50%, 0.55)) !important;
    }
  }

  :global(body[data-dragging='true'] .tab:not([data-dragging-item])) {
    // background: transparent !important;
    box-shadow: none;
  }

  :global(.tab[data-drag-target='true']) {
    outline: 1.5px dashed var(--dark-outline) !important;
    outline-offset: -1.5px;
  }

  .icon-wrapper {
    width: 16px;
    height: 16px;
    display: block;
    user-select: none;
    flex-shrink: 0;

    &.emoji-adjustment {
      margin-top: -1.5px;
    }
  }

  // Vertical tabs specific styles
  :global(.vertical-tabs) {
    .tab.combine-border:not(.horizontalTabs) {
      &:has(+ :not(.combine-border)) {
        --squircle-radius-bottom-right: 16px;
        --squircle-radius-bottom-left: 16px;
        --squircle-shadow: 0px 2px 2px -1px var(--black-09), 0px -2px 0px -1px var(--black-03);
      }
    }

    .tab:not(.combine-border):not(.horizontalTabs) + .combine-border:has(+ :not(.combine-border)) {
      background: paint(squircle);
      --squircle-radius: 16px;
      --squircle-smooth: 0.33;
      --squircle-shadow: 0px 0px 0px 0px var(--black-09);
      --squircle-fill: var(--white-80);
    }

    &.active:not(.horizontalTabs):not(.combine-border + .combine-border):not(
        .combine-border ~ .combine-border
      ):not(:has(+ .combine-border)) {
      background: paint(squircle) !important;
      --squircle-radius-top-left: 16px;
      --squircle-radius-top-right: 16px;
      --squircle-radius-bottom-left: 16px;
      --squircle-radius-bottom-right: 16px;
      --squircle-smooth: 0.33;
      --squircle-shadow: 0px 2px 2px -1px var(--black-09), 0px -2px 0px -1px var(--black-03);
      --squircle-fill: var(--white-80);
    }

    /*⚠️ DO NOT CHANGE THE ORDER OF THE FOLLOWING CSS RULES ⚠️*/
    /* First tab of a group */
    .tab.combine-border:not(.horizontalTabs):not(.tab.selected ~ .tab.combine-border):not(
        .tab.combine-border ~ .tab.combine-border
      ):not(:only-child) {
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      background: var(--white);
    }

    /* Middle tabs in sequences */
    .tab.combine-border:not(.horizontalTabs) + .tab.combine-border {
      border-radius: 0;
      background: var(--white-40);
    }

    /* Last tab of a group */
    .tab.combine-border:not(.horizontalTabs):not(:has(+ .tab.combine-border)),
    .tab.combine-border:not(.horizontalTabs):last-of-type {
      border-bottom-left-radius: 16px;
      border-bottom-right-radius: 16px;
    }

    /* Handle gaps */
    .tab:not(.combine-border):not(.horizontalTabs) + .tab.combine-border {
      background: paint(squircle);
      --squircle-radius-top-left: 16px;
      --squircle-radius-top-right: 16px;
      --squircle-radius-bottom-left: 0px;
      --squircle-radius-bottom-right: 0px;
      --squircle-smooth: 0.33;
      --squircle-fill: var(--white-40);
    }
  }

  // Buttons
  .custom-text-color {
    :global(.custom) & {
      color: var(--contrast-color) !important;
      // TODO: (MERGE) ?
      //--squircle-fill: rgba(255, 255, 255, 0.4);
    }
  }
</style>
