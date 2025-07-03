<script lang="ts">
  import {
    useLogScope,
    tooltip as tooltip2,
    getFileKind,
    getHostname,
    checkIfSecureURL
  } from '@horizon/utils'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import type { BookmarkTabState, Tab, TabSpace } from '../../types/browser.types'
  import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
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
    CreateSpaceEventFrom,
    DeleteTabEventTrigger,
    OpenInMiniBrowserEventFrom,
    PageChatUpdateContextEventTrigger,
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
  import { newContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { SelectDropdown, type SelectItem } from '../Atoms/SelectDropdown/index'
  import { useDesktopManager } from '../../service/desktop'
  import SoundVisualizerBars from '../Effects/SoundVisualizerBars.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { isGeneratedResource } from '../../utils/resourcePreview'

  export let tab: Tab
  export let activeTabId: Writable<string>
  export let bookmarkingState: BookmarkTabState = 'idle'

  export let horizontalTabs = true
  export let isMediaPlaying: Readable<boolean> = writable(false)

  export let pinned: boolean
  export let isSelected = false
  export let isUserSelected: boolean
  export let isMagicActive = false

  export let showButtons: boolean = true
  export let inStuffBar = false
  export let disableContextmenu = false
  export let showClose = false
  export let enableEditing = false
  export let showExcludeOthersButton: boolean = false
  export let showIncludeButton: boolean = false

  export const inputUrl = writable<string>('')
  export let tabSize: number | undefined = undefined
  export let removeHighlight = false

  export let spaces: Writable<OasisSpace[]>

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
    'chat-with-tab': string
    'remove-bookmark': string
    Drop: { drag: DragculaDragEvent; spaceId: string }
    DragEnd: DragculaDragEvent
    edit: void
    mouseenter: string
    mouseleave: string
    'create-new-space': void
    'rename-tab': string
  }>()

  const SHOW_INSECURE_WARNING_TIMEOUT = 3000

  const log = useLogScope(`Tab::${tab.id}`)
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const userConfig = useConfig()
  const oasis = useOasis()
  const toasts = useToasts()
  const ai = useAI()
  const desktopManager = useDesktopManager()
  const globalMiniBrowser = useGlobalMiniBrowser()
  const scopedMiniBrowser = useScopedMiniBrowserAsStore(`tab-${tab.id}`)

  const desktopVisible = desktopManager.activeDesktopVisible
  const userSettings = userConfig.settings
  const chatContext = ai.activeContextManager
  const selectedTabs = tabsManager.selectedTabs
  const activeSpaceId = tabsManager.activeScopeId
  const sortedSpaces = oasis.sortedSpacesListFlat

  const liveSpacePopoverOpened = writable(false)
  const saveToSpacePopoverOpened = writable(false)
  const tabStyles = writable<string>('')
  const spaceSearchValue = writable<string>('')
  const resource = writable<Resource | null>(null)
  const resourceSpaceIds = writable<string[]>([])

  let addressInputEl: HTMLInputElement
  let spaceData: OasisSpace['data'] | null = null
  let insecureWarningTimeout: ReturnType<typeof setTimeout>

  let isDragging = false
  let isHovered = false
  let popoverVisible = false
  let showInsecureWarningText = false
  let isContextMenuOpen = false

  // TODO: CAN WE NUKE THIS SHIT?
  let space: OasisSpace | null = null

  const MIN_TAB_WIDTH = 92
  const HIDE_SAVE_BUTTON_BELOW = 120

  // Calculate padding based on active space's folder name length
  // Max width is 15ch, for each character the padding is reduced
  $: currentSpace = $spaces.find((space) => space.id === $activeSpaceId)
  $: TAB_HORIZONTAL_PADDING = 36

  // Why is there no better way in Svelte :/
  $: isScopedMiniBrowserOpenStore = $scopedMiniBrowser ? $scopedMiniBrowser.isOpen : null
  $: isScopedMiniBrowserOpen = $isScopedMiniBrowserOpenStore ?? false

  $: resourceSpaceIdsStore = $resource?.spaceIds
  $: isActive = tab.id === $activeTabId && !removeHighlight && !$desktopVisible
  $: tabsInContext = $chatContext.tabsInContext
  $: isInChatContext = $tabsInContext.findIndex((e) => e.id === tab.id) !== -1
  $: isSavedInSpace = $activeSpaceId && ($resourceSpaceIdsStore ?? []).includes($activeSpaceId)
  $: isBookmarkedByUser =
    tab.type === 'page' ? tab.resourceBookmarkedManually : tab.type === 'resource' && isSavedInSpace
  $: url =
    (tab.type === 'page' && (tab.currentLocation || tab.currentDetectedApp?.canonicalUrl)) || null
  $: isInsecureUrl = tab.type === 'page' && url && !checkIfSecureURL(url)
  $: hostname = url ? getHostname(url) : null
  $: sanitizedTitle = tab.type === 'space' ? '' : tab.title

  $: showLiveSpaceButton = $userSettings.live_spaces && checkIfLiveSpacePossible(tab)

  $: {
    if (tab.type === 'page') {
      if (tab.resourceBookmark) {
        fetchResource(tab.resourceBookmark)
      } else {
        resource.set(null)
        resourceSpaceIds.set([])
      }
    } else if (tab.type === 'resource') {
      fetchResource(tab.resourceId)
    }
  }

  $: if (tab.type === 'page' && !isRenamingTab) {
    if (hostname) {
      $inputUrl = isInsecureUrl ? `http://${hostname}` : hostname
    } else {
      $inputUrl = tab.title
    }
  }
  $: tabStyles.set(getTabStyles({ isActive, pinned, horizontalTabs, tab, isSelected }))

  $: hovered = isHovered && !isContextMenuOpen

  $: resourceSpaceIds.set($resourceSpaceIdsStore ?? [])

  export const renameTab = async () => {
    if (tab.type !== 'page' || tab.pinned) return
    isRenamingTab = true
    editableTitle = tab.customTitle || tab.title
    await tick()
    titleInputEl?.focus()
    titleInputEl?.setSelectionRange(0, titleInputEl.value.length)
  }

  export const blur = () => {
    addressInputEl?.blur()
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      dispatch('input-enter', $inputUrl)
    } else if (event.key === 'Escape') {
      addressInputEl?.blur()
    }
  }

  /// EVENT HANDLERS

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
    } else if (clickedElement !== addressInputEl) {
      e.preventDefault()
      e.stopPropagation()

      desktopManager.setVisible(false)
      dispatch('select', tab.id)
    }

    if (clickedElement === addressInputEl) {
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

  // TODO: Can we nuke?
  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 1 && !pinned) {
      e.preventDefault()
      handleArchive(DeleteTabEventTrigger.Click)
    }
  }

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

  const handleRemoveSpaceFromSidebar = (_e: MouseEvent) => {
    dispatch('remove-from-sidebar', tab.id)
  }

  const handleArchive = (trigger: DeleteTabEventTrigger = DeleteTabEventTrigger.Click) => {
    dispatch('delete-tab', { tabId: tab.id, trigger })
  }

  const handleBookmark = (trigger: SaveToOasisEventTrigger = SaveToOasisEventTrigger.Click) => {
    if (isBookmarkedByUser) {
      handleRemoveBookmark()
      return
    }

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
    $chatContext.removeAllExcept(tab.id)
  }

  const handleExcludeTab = () => {
    $chatContext.removeTabItem(tab.id, PageChatUpdateContextEventTrigger.TabSelection)
  }

  const handleIncludeTab = () => {
    if (tab.type === 'page' || tab.type === 'space') {
      $chatContext.addTab(tab, { trigger: PageChatUpdateContextEventTrigger.TabSelection })
    }
  }

  const openResourceDetails = async () => {
    if (!$resource) return

    await oasis.openResourceDetailsSidebar($resource, {
      select: true,
      selectedSpace: 'auto'
    })
  }

  const handleDragStart = async (drag: DragculaDragEvent<DragTypes>) => {
    isDragging = true
    hovered = false
    blur()

    drag.item!.data.setData(DragTypeNames.SURF_TAB, { ...tab, pinned }) // FIX: pinned is not included but needed for reordering to work
    drag.dataTransfer?.setData(DragTypeNames.SURF_TAB_ID, tab.id)

    if (tab.type === 'page' && tab.currentLocation) {
      drag.dataTransfer?.setData('text/uri-list', tab.currentLocation)
      drag.dataTransfer?.setData('text/plain', tab.currentLocation)
      drag.dataTransfer?.setData('text/html', `<a href="${tab.currentLocation}">${tab.title}</a>`)
    }

    // @ts-ignore
    const resourceId = tab.resourceBookmark ?? tab.resourceId
    if (resourceId) {
      drag.dataTransfer?.setData(DragTypeNames.SURF_RESOURCE_ID, resourceId)
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

  /// MISC

  const contextMenuMoveTabsToSpaces = derived(
    [sortedSpaces, tabsManager.activeScopeId],
    ([spaces, activeScopeId]) => {
      const handleMove = async (spaceId: string | null, label: string, makeActive = false) => {
        try {
          await tabsManager.scopeTab(tab.id, spaceId)

          if (makeActive) {
            await tabsManager.makeActive(tab.id)
            toasts.success(`Tabs moved to ${label}!`)
          } else {
            toasts.success(`Tabs moved to ${label}!`, {
              action: {
                label: 'Switch',
                handler: () => {
                  tabsManager.makeActive(tab.id)
                }
              }
            })
          }
        } catch (e) {
          toasts.error(`Failed to add to ${label}`)
        }
      }

      return [
        {
          type: 'action',
          icon: newContext.icon,
          text: newContext.label,
          action: async () => {
            const space = await oasis.createNewBrowsingSpace(
              ChangeContextEventTrigger.Tab,
              CreateSpaceEventFrom.ContextMenu,
              {
                newTab: false
              }
            )
            await handleMove(space.id, space.dataValue.folderName, true)
          }
        } as CtxItem,
        ...spaces
          .filter(
            (e) =>
              e.id !== 'all' &&
              e.id !== 'inbox' &&
              e.dataValue?.folderName?.toLowerCase() !== '.tempspace' &&
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

  const saveToSpaceItems = derived(
    [sortedSpaces, spaceSearchValue, resourceSpaceIds],
    ([sortedSpaces, searchValue, resourceSpaceIds]) => {
      const spaceItems = sortedSpaces.map(
        (space) =>
          ({
            id: space.id,
            label: space.dataValue.folderName,
            disabled: resourceSpaceIds.includes(space.id),
            icon: resourceSpaceIds.includes(space.id) ? 'check' : undefined,
            data: space
          }) as SelectItem
      )

      if (!searchValue) return spaceItems

      return spaceItems.filter((item) =>
        item.label.toLowerCase().includes(searchValue.toLowerCase())
      )
    }
  )

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

  const fetchResource = async (id: string) => {
    try {
      if ($resource?.id === id) return
      const fetchedResource = await resourceManager.getResource(id)
      resource.set(fetchedResource)
      resourceSpaceIds.set(fetchedResource?.spaceIdsValue ?? [])
    } catch (error) {
      log.error('Failed to fetch resource:', error)
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
      // 'active:scale-[98%]',
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
      activeClasses = 'active sticky'
    } else if (!pinned && horizontalTabs) {
      //activeClasses = 'bg-sky-100/60 dark:bg-gray-800/60'
    }

    // Special state classes
    const selectedClasses = isSelected && !isActive ? '' : ''

    // Layout classes based on pin state and orientation
    let styleClasses = ''
    if (pinned) {
      if (horizontalTabs) {
        styleClasses = 'w-[40px] h-[40px] min-w-fit px-[0.563rem] py-[0.438rem]'
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
    return [baseClasses, activeClasses, selectedClasses, styleClasses].join(' ')
  }

  let isRenamingTab = false
  let titleInputEl: HTMLInputElement
  let editableTitle = tab.customTitle || tab.title

  const startRenameTab = async () => {
    if (tab.pinned) return
    isRenamingTab = true
    editableTitle = tab.customTitle || tab.title
    await tick()

    if (titleInputEl) {
      titleInputEl.focus()
      titleInputEl.select()
      // Backup selection in case the first one doesn't work
      setTimeout(() => titleInputEl?.select(), 0)
    }
  }

  const handleTitleInputBlur = () => {
    if (editableTitle !== tab.title || editableTitle !== tab.customTitle) {
      tabsManager.update(tab.id, { customTitle: editableTitle })
    }
    isRenamingTab = false
    isHovered = false
  }

  const handleTitleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (editableTitle !== tab.title || editableTitle !== tab.customTitle) {
        tabsManager.update(tab.id, { customTitle: editableTitle })
      }
      isRenamingTab = false
    } else if (event.key === 'Escape') {
      editableTitle = tab.customTitle || tab.title
      isRenamingTab = false
    }
  }

  const getContextMenuItems = async (): Promise<CtxItem[]> => {
    return [
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
        hidden: !isBookmarkedByUser,
        icon: 'info',
        text: 'View Details',
        action: () => openResourceDetails()
      },
      {
        type: 'action',
        hidden: tab.type !== 'space',
        icon: 'circle-dot',
        text: 'Open Context',
        action: () => {
          if (tab.type !== 'space') return
          tabsManager.changeScope(tab.spaceId, ChangeContextEventTrigger.Tab)
        }
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
        text: `${isInChatContext ? 'Remove from' : 'Add to'} Chat`,
        action: () => (isInChatContext ? handleExcludeTab() : handleIncludeTab())
      },
      { type: 'separator' },
      {
        type: 'sub-menu',
        icon: 'arrow.right',
        text: 'Move Tab to Context',
        search: true,
        items: $contextMenuMoveTabsToSpaces
      },
      {
        type: 'action',
        icon: tab.pinned ? `pinned-off` : `pin`,
        text: tab.pinned ? 'Unpin' : 'Pin',
        action: () => (tab.pinned ? dispatch('unpin', tab.id) : dispatch('pin', tab.id))
      },
      {
        type: 'action',
        icon: 'edit',
        text: 'Rename Tab',
        disabled: tab.pinned,
        hidden: tab.type !== 'page',
        action: startRenameTab
      },
      {
        type: 'action',
        icon: 'close',
        text: 'Close',
        kind: 'danger',
        action: () => handleArchive(DeleteTabEventTrigger.ContextMenu)
      }
    ]
  }

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

<div
  draggable={true}
  id="tab-{tab.id}"
  class={$tabStyles}
  class:pinned
  class:active={isActive}
  class:hovered
  class:selected={isSelected}
  class:user-selected={isUserSelected && !$desktopVisible}
  class:combine-border={// Combine border class if:
  // 1. Magic is active and tab is magical, or
  // 2. Magic is inactive but tab is selected/active
  !$desktopVisible && isSelected}
  class:magic={isInChatContext && isMagicActive}
  class:inStuffBar
  class:collapsed={!isActive && tabSize && tabSize < MIN_TAB_WIDTH}
  style={tabSize
    ? `min-width: ${isActive && !pinned ? 292 : tabSize - TAB_HORIZONTAL_PADDING}px;`
    : ''}
  role="none"
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
    isHovered = true
    dispatch('mouseenter', tab.id)
  }}
  on:mouseleave={() => {
    if (!popoverVisible) isHovered = false
    dispatch('mouseleave', tab.id)
  }}
  use:contextMenu={{
    canOpen:
      (isMagicActive ||
        $selectedTabs.size <= 1 ||
        Array.from($selectedTabs.values()).find((e) => e.id === tab.id) === undefined) &&
      !disableContextmenu,
    items: getContextMenuItems
  }}
>
  <div
    class="tab-favicon icon-wrapper flex-shrink-0"
    class:media-playing={$userSettings.turntable_favicons && $isMediaPlaying}
    class:emoji-adjustment={$spaceData?.emoji}
    class:group-hover:!hidden={(!isActive &&
      showClose &&
      ((tabSize && tabSize > MIN_TAB_WIDTH && horizontalTabs) || !horizontalTabs) &&
      !pinned &&
      hovered &&
      !(tabSize && tabSize < MIN_TAB_WIDTH)) ||
      (isActive && showClose && !pinned && hovered)}
  >
    <!--     style:view-transition-name="tab-icon-{tab.id}" -->
    {#if $resource}
      {#if isGeneratedResource($resource)}
        <Icon name="code-block" size="16px" />
      {:else if $resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
        <Icon name="docs" size="16px" />
      {:else}
        <Image
          src={`https://www.google.com/s2/favicons?domain=${$resource?.metadata?.sourceURI}&sz=64`}
          alt={tab.title}
          fallbackIcon="squircle"
        />
      {/if}
    {:else if tab.icon}
      <Image src={tab.icon} alt={tab.title} fallbackIcon="squircle" />
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

  {#if showClose && ((tabSize && tabSize > MIN_TAB_WIDTH && horizontalTabs) || !horizontalTabs || isActive) && hovered}
    {#if tab.type == 'space'}
      <button
        on:click|stopPropagation={handleRemoveSpaceFromSidebar}
        class="items-center hidden group-hover:!flex justify-center appearance-none border-none p-1 -m-1 h-min-content rounded-lg"
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
        class="items-center hidden group-hover:!flex justify-center appearance-none border-none p-1 -m-1 h-min-content rounded-lg"
      >
        {#if tab.archived}
          <Icon name="trash" size="16px" />
        {:else}
          <Icon name="close" size="16px" />
        {/if}
      </button>
    {/if}
  {/if}
  {#if (!tab.pinned || !pinned) && ((horizontalTabs && isActive) || !(horizontalTabs && tabSize && tabSize < MIN_TAB_WIDTH))}
    <div class="title relative flex-grow truncate mr-1">
      {#if isRenamingTab && !tab.pinned && tab.type === 'page'}
        <input
          bind:this={titleInputEl}
          bind:value={editableTitle}
          on:blur={handleTitleInputBlur}
          on:keydown={handleTitleInputKeydown}
          on:click|stopPropagation
          class="w-full bg-transparent outline-none text-inherit font-inherit px-0.5"
          spellcheck="false"
          placeholder="Enter tab name"
          on:focus|preventDefault={() => {
            titleInputEl?.select()
            setTimeout(() => titleInputEl?.select(), 0)
          }}
        />
      {:else}
        <div
          role="none"
          on:click={(e) => {
            if (tab.type === 'page' && !isRenamingTab && isActive) {
              e.stopPropagation()
              e.preventDefault()
              dispatch('edit')
            }
          }}
          class={hovered && isActive && tab.type === 'page' && !isRenamingTab
            ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-sky-900 to-sky-900 via-sky-500 dark:from-sky-100 dark:to-sky-100 dark:via-sky-300 bg-[length:250%_100%] z-[60]'
            : `whitespace-nowrap overflow-hidden truncate max-w-full ${isMagicActive && isInChatContext ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 dark:from-violet-100 dark:to-blue-100 dark:via-rose-300 bg-[length:250%_100%]' : ''}`}
        >
          {#if hovered && isActive && tab.type === 'page' && !isRenamingTab && !inStuffBar}
            {$inputUrl}
          {:else if tab.type === 'space'}
            {tab.title}
          {:else}
            {tab.customTitle || sanitizedTitle}
          {/if}
        </div>
      {/if}
    </div>

    {#if showButtons && (hovered || $liveSpacePopoverOpened || $saveToSpacePopoverOpened) && (isActive || (tabSize && tabSize > HIDE_SAVE_BUTTON_BELOW) || !horizontalTabs) && !showExcludeOthersButton}
      <div class="items-center flex justify-end flex-row gap-3 right-0">
        {#if tab.type === 'page' && isActive && showLiveSpaceButton}
          <CustomPopover position="right" popoverOpened={liveSpacePopoverOpened}>
            <button
              slot="trigger"
              class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content rounded-lg"
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
                  class="flex items-center justify-center w-full p-2 m-1 transition-colors rounded-md"
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

        {#if tab.type === 'page' || tab.type === 'resource'}
          {#key isBookmarkedByUser}
            <SelectDropdown
              items={saveToSpaceItems}
              search={$spaces.length > 0 ? 'manual' : 'disabled'}
              searchValue={spaceSearchValue}
              footerItem={newContext}
              inputPlaceholder="Select a context to save to…"
              open={saveToSpacePopoverOpened}
              openOnHover={500}
              disabled={disableContextmenu}
              side="right"
              keepHeightWhileSearching
              on:select={handleSaveResourceInSpace}
            >
              <button
                on:click|stopPropagation={() => handleBookmark()}
                class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content rounded-lg"
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
      </div>
    {:else if (showExcludeOthersButton || showIncludeButton) && hovered}
      <div class="items-center flex justify-end flex-row space-x-2 right-0">
        {#if showExcludeOthersButton}
          <button
            on:click|stopPropagation={handleExcludeOthers}
            class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content rounded-lg"
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
    {:else if !hovered && $isMediaPlaying}
      <SoundVisualizerBars style="flex-shrink: 0; opacity: 0.35;" size="1.5ch" />
    {/if}

    <!-- TODO (maxi): This is broken (on base already as well) -->
    {#if isScopedMiniBrowserOpen}
      <div
        class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content rounded-lg"
      >
        <Icon name="eye" />
      </div>
    {/if}

    {#if isInsecureUrl && isActive}
      <InsecurePageWarningIndicator showText={showInsecureWarningText} />
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  @keyframes spin {
    from {
      rotate: 0deg;
    }
    to {
      rotate: 360deg;
    }
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

  .tab {
    view-transition-class: tab !important;
    padding: 0.68rem 0.85rem;
    font-weight: 400;
    -webkit-font-smoothing: auto;
    letter-spacing: 0.00925em;
    position: relative;
    overflow: visible;

    &.collapsed {
      padding: 0 !important;
    }

    @include utils.light-dark-custom(
      'color',
      rgb(2, 19, 39),
      rgb(216, 233, 253),
      var(--contrast-color)
    );
    color: var(--color);

    .tab-favicon {
      @apply cursor-default;

      &.media-playing {
        animation: spin 13.5s linear infinite;
      }
    }

    &.active {
      @include utils.light-dark-custom(
        'fill',
        var(--white-88),
        var(--white-26),
        var(--white-55),
        var(--white-26)
      );

      :global(body:not(.dark)) & {
        // Removed because shadows push the background inwards, which looks shitty
        //--squircle-shadow: 0px 2px 2px -1px var(--black-09);
        --squircle-inner-shadow: inset 0px -0.5px 2px -1px var(--ring-color-shade),
          inset 0px -3px 5px -7px rgba(0, 0, 0, 0.4), inset 0px 1.25px 0px -1.25px var(--white-60),
          inset 1.25px 0px 0px -1.25px var(--white-60),
          inset -1.25px 0px 0px -1.25px var(--white-60),
          inset 0px -1.25px 0px -1.25px var(--white-60), inset 0px 1px 2px -1px var(--white-60),
          inset 0px 2px 5px -9px var(--white-85), inset 0px 0px 0px 0.75px var(--white-40);
      }
      :global(body.dark) & {
        // --squircle-outline-width: 1.5px;
        // --squircle-outline-color: var(--ring-color);
      }
    }

    button {
      color: var(--color);
      --fill: none;
      @apply cursor-default;

      &:hover {
        background: var(--fill);
        @include utils.light-dark-custom('fill', var(--black-09), var(--white-15), var(--black-09));
      }
    }
  }

  // Horizontal Tabs
  :global(.app-contents.horizontalTabs) {
    .tab {
      --radius: 14px;
      @include utils.squircle($fill: var(--fill), $radius: var(--radius), $smooth: 0.28);
      max-width: 292px !important;
      gap: 0.533rem;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: subpixel-antialiased;

      padding: 0.5rem 0.75rem 0.5rem 0.75rem;

      &:not(.active) {
        @include utils.light-dark-custom(
          'fill',
          transparent,
          transparent,
          transparent,
          transparent
        );

        &:not(.pinned) {
          width: -webkit-fill-available;
        }
      }

      &.hovered:not(.active) {
        // TODO: THis should be lighter in dark mode to highligt hover state
        @include utils.light-dark-custom(
          'fill',
          var(--white-55),
          var(--dark-on-unpinned-surface-horizontal),
          var(--white-55),
          var(--dark-on-unpinned-surface-horizontal)
        );
      }

      &.pinned {
        padding: 0.2rem;
        --fill: var(--white-20);
        --squircle-inner-shadow: inset 0px 0px 0px 0.75px var(--white-40);
        --squircle-shadow: 0px 2px 2px -1px var(--black-01);
        --radius: 12.5px;
        @include utils.squircle($fill: var(--fill), $radius: var(--radius), $smooth: 0.24);
      }

      &.pinned.active {
        @include utils.light-dark-custom(
          'fill',
          var(--white),
          var(--white-26),
          var(--white-55),
          var(--white-35)
        );
      }

      &.pinned.hovered:not(.active) {
        @include utils.light-dark-custom(
          'fill',
          var(--white-60),
          var(--white-15),
          var(--white-25),
          var(--white-15)
        );
      }

      /// Radii definitions
      &:not(.pinned) {
        &.combine-border {
          &:not(.active) {
            @include utils.light-dark-custom(
              'fill',
              var(--white-65),
              var(--black-45),
              var(--white-40),
              var(--black-45)
            );
          }

          &:not(.active) {
            :global(body:not(.dark)) & {
              --squircle-inner-shadow: inset 0px 2px 0px -1px var(--white-80),
                inset 2px 0px 0px -1px var(--white-80), inset -2px 0px 0px -1px var(--white-80),
                inset 0px -2px 0px -1px var(--white-80);
            }
            :global(body.dark) & {
              --squircle-outline-width: 1.5px;
              --squircle-outline-color: color-mix(in srgb, var(--ring-color), 20% transparent);
            }
          }
        }
      }
    }
  }

  // Vertical Tabs
  :global(.app-contents.verticalTabs) {
    .tab {
      --fill: transparent;
      --radius: 16px;
      @include utils.squircle($fill: var(--fill), $radius: var(--radius), $smooth: 0.33);

      gap: 0.7rem;

      &.hovered:not(.active) {
        @include utils.light-dark-custom(
          'fill',
          var(--white-60),
          var(--dark-on-unpinned-surface-horizontal-hover),
          var(--black-26),
          var(--dark-on-unpinned-surface-horizontal-hover)
        );
      }

      &.pinned {
        padding: 0.95rem;
        --fill: var(--white-15);
        --squircle-inner-shadow: inset 0px 0px 0px 0.75px var(--white-26);
        --squircle-shadow: 0px 2px 2px -1px var(--black-01);
      }

      /// Radii definitions
      &:not(.pinned) {
        &.combine-border {
          &:not(.active) {
            @include utils.light-dark-custom(
              'fill',
              var(--white-55),
              var(--black-45),
              var(--white-40)
            );
          }

          & {
            @include utils.squricle-radii($radius: 0px);
          }

          &:not(.combine-border + .combine-border) {
            @include utils.squricle-radii(
              $top-left: var(--radius),
              $top-right: var(--radius),
              $bottom-left: 0px,
              $bottom-right: 0px
            );
          }

          &:not(:has(+ .combine-border)) {
            @include utils.squricle-radii(
              $top-left: 0px,
              $top-right: 0px,
              $bottom-left: var(--radius),
              $bottom-right: var(--radius)
            );
          }

          &:not(.combine-border + .combine-border):not(:has(+ .combine-border)) {
            @include utils.squricle-radii($radius: var(--radius));
          }
        }
      }
    }
  }

  // Weirdo inside stuff
  :global(.drawer-content) {
    .tab {
      --radius: 11px;
      @include utils.squircle($fill: var(--fill), $radius: 8px, $smooth: 0.28);

      &:not(.active) {
        @include utils.light-dark-custom(
          'fill',
          var(--black-03),
          var(--dark-on-unpinned-surface-horizontal),
          var(--black-03),
          var(--dark-on-unpinned-surface-horizontal)
        );
      }

      &.hovered:not(.active) {
        // TODO: THis should be lighter in dark mode to highligt hover state
        @include utils.light-dark-custom(
          'fill',
          var(--black-09),
          var(--dark-on-unpinned-surface-horizontal),
          var(--black-09),
          var(--dark-on-unpinned-surface-horizontal)
        );
      }
    }
  }

  /*
// TODO: Move the magic shit & animations into here
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
  }*/

  // Global styles
  :global(.tab:not(.active)[data-context-menu-anchor]) {
    @include utils.light-dark-custom(
      'fill',
      var(--white-55),
      var(--dark-on-unpinned-surface),
      var(--white-33)
    );
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
      --squircle-fill: color-mix(in hsl, var(--base-color), hsla(0, 80%, 0%, 0.2)) !important;
    }
    :global(.dark.custom) & {
      --squircle-fill: color-mix(in hsl, var(--base-color), hsla(0, 80%, 50%, 0.65)) !important;
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
      --squircle-fill: color-mix(in hsl, var(--base-color), hsla(0, 80%, 0%, 0.75)) !important;
    }
    :global(.dark.custom) & {
      --squircle-fill: color-mix(in hsl, var(--base-color), hsla(0, 80%, 50%, 0.55)) !important;
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

  .title {
    font-size: 1rem;
    letter-spacing: 0.0075em;
    font-weight: 420 !important;
    margin-bottom: 0.5px;
    @include utils.font-smoothing;
    input {
      height: 100%;
      min-width: 0;
      font-size: inherit;
      letter-spacing: inherit;
      line-height: inherit;
      font-family: inherit;
      @include utils.font-smoothing;

      &:focus {
        outline: none;
        background: var(--color-input-bg);
        border-radius: 4px;
      }
    }
  }
</style>
