<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import {
    conditionalArrayItem,
    copyToClipboard,
    getHostname,
    getHumanFormattedDate,
    getNormalizedHostname,
    isModKeyPressed,
    normalizeURL,
    parseStringIntoUrl,
    tooltip,
    useLogScope
  } from '@deta/utils'
  import { CreateTabEventTrigger, DragTypeNames } from '@deta/types'
  import { type DragTypes, type HistoryEntry, type OpenAndChatEvent } from '../../types'
  import { useTabsManager } from '../../service/tabs'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import {
    contextMenu,
    type CtxItem
  } from '@horizon/core/src/lib/components/Core/ContextMenu.svelte'
  import { type Toast, useToasts } from '@deta/ui'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { derived } from 'svelte/store'
  import { DragculaDragEvent, HTMLDragItem, HTMLDragZone } from '@deta/dragcula'
  import { savePageToContext } from '@horizon/core/src/lib/service/saving'
  import { Icon } from '@deta/icons'

  export let entry: HistoryEntry
  export let full: boolean = false

  const log = useLogScope('LinkPreview')
  const tabsManager = useTabsManager()
  const resourceManager = useResourceManager()
  const oasis = useOasis()
  const toasts = useToasts()

  const sortedSpaces = oasis.sortedSpacesListFlat

  const dispatch = createEventDispatcher<{
    'delete-history-entry': string
    'open-page-mini-browser': string
    'open-and-chat': OpenAndChatEvent
  }>()

  let title = ''
  let subtitle = ''
  let error = ''

  const contextMenuSpaces = derived([sortedSpaces], ([spaces]) => {
    return spaces
      .filter(
        (e) =>
          e.id !== 'all' &&
          e.id !== 'inbox' &&
          e.dataValue?.folderName?.toLowerCase() !== '.tempspace'
      )
      .map(
        (space) =>
          ({
            type: 'action',
            icon: space,
            text: space.dataValue.folderName,
            action: () => addEntryToSpace(space)
          }) as CtxItem
      )
  })

  const openAsTab = (active = false) => {
    if (!entry.url) return

    if (active) {
      tabsManager.showNewTabOverlay.set(0)
    }

    tabsManager.addPageTab(entry.url, {
      active: active,
      trigger: CreateTabEventTrigger.History
    })
  }

  const openInMiniBrowser = () => {
    if (!entry.url) return

    dispatch('open-page-mini-browser', entry.url)
  }

  const copyURL = () => {
    if (!entry.url) return

    copyToClipboard(entry.url)
    toasts.success('Copied URL to clipboard!')
  }

  const openAndChat = async () => {
    if (!entry.url) return

    let toast: Toast | undefined = undefined

    try {
      toast = toasts.loading('Preparing page for chat…')

      const tab = await tabsManager.addPageTab(entry.url, {
        active: true,
        trigger: CreateTabEventTrigger.History
      })

      if (!tab) {
        throw new Error('Failed to open tab')
      }

      tabsManager.showNewTabOverlay.set(0)

      log.debug('Created tab from history entry:', tab)
      toast.success('Opened in chat!')
      dispatch('open-and-chat', { type: 'tab', id: tab.id })
    } catch (error) {
      log.error('Error preparing resource for chat:', error)

      const msg = 'Failed to prepare resource for chat'
      if (toast) {
        toast.error(msg)
      } else {
        toasts.error(msg)
      }
    }
  }

  const addEntryToSpace = async (space: OasisSpace) => {
    if (!entry.url) return

    try {
      await savePageToContext({ url: entry.url, title: entry.title }, space.id, {
        oasis,
        resourceManager,
        toasts
      })
    } catch (error) {
      log.error('Error saving page to context:', error)
    }
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()

    if (!entry.url) return

    if (e.shiftKey && !isModKeyPressed(e)) {
      openInMiniBrowser()
    } else {
      const active = isModKeyPressed(e) ? e.shiftKey : true
      openAsTab(active)
    }
  }

  const handleDragStart = async (drag: DragculaDragEvent<DragTypes>) => {
    drag.item!.data.setData(DragTypeNames.SURF_HISTORY_ENTRY, entry)
    drag.dataTransfer?.setData(DragTypeNames.SURF_HISTORY_ENTRY_ID, entry.id)

    if (entry.url) {
      drag.dataTransfer?.setData('text/uri-list', entry.url)
      drag.dataTransfer?.setData('text/plain', entry.url)
      drag.dataTransfer?.setData('text/html', `<a href="${entry.url}">${entry.title}</a>`)
    }

    drag.continue()
  }

  $: contextMenuItems = [
    {
      type: 'action',
      icon: 'arrow.up.right',
      text: 'Open as Tab',
      tagIcon: 'cursor-arrow-rays',
      action: () => openAsTab(true)
    },
    {
      type: 'action',
      icon: 'eye',
      text: 'Mini Browser',
      tagIcon: 'cursor-arrow-rays',
      tagText: 'shift + ',
      action: () => openInMiniBrowser()
    },
    { type: 'separator' },
    ...conditionalArrayItem<CtxItem>($contextMenuSpaces.length > 0, [
      {
        type: 'sub-menu',
        icon: 'add',
        disabled: $contextMenuSpaces.length === 0,
        text: 'Save to Context',
        search: true,
        items: $contextMenuSpaces
      },
      { type: 'separator' }
    ]),
    // ...conditionalArrayItem<CtxItem>($selectedItemIds.length === 0 && origin !== 'homescreen', {
    //   type: 'action',
    //   icon: 'circle.check',
    //   text: 'Select',
    //   action: () => {
    //     addSelectionById(resource.id)
    //   }
    // }),
    ...conditionalArrayItem<CtxItem>(!!entry.url, {
      type: 'action',
      icon: 'copy',
      text: 'Copy URL',
      action: () => copyURL()
    }),
    {
      type: 'action',
      icon: 'chat',
      text: 'Use in Chat',
      action: () => openAndChat()
    },
    { type: 'separator' },
    {
      type: 'action',
      icon: 'trash',
      text: 'Delete Entry',
      kind: 'danger',
      action: () => dispatch('delete-history-entry', entry.id)
    }
  ] as CtxItem[]

  onMount(async () => {
    try {
      if (!entry.url) {
        error = 'Invalid URL: ' + entry.url
        return
      }

      const url = parseStringIntoUrl(entry.url)
      if (!url) {
        title = 'Invalid URL'
        subtitle = entry.url
        return
      }

      const hostname = getNormalizedHostname(url.href) ?? url.host
      const topLevelHostname = url.hostname.split('.').slice(-2, -1).join('')
      title =
        entry.title ||
        (topLevelHostname
          ? topLevelHostname[0].toUpperCase() + topLevelHostname.slice(1)
          : hostname)
      subtitle = normalizeURL(`${hostname}${url.pathname}`)

      log.debug('history entry:', entry)
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  id="history-entry-{entry.id}"
  class="entry text-gray-900 dark:text-gray-100"
  class:full
  data-selectable={true}
  draggable={true}
  on:click={handleClick}
  use:HTMLDragItem.action={{}}
  on:DragStart={handleDragStart}
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      return false
    }
  }}
  use:contextMenu={{
    items: contextMenuItems
  }}
>
  {#if error}
    <div class="title">
      {error}
    </div>
  {:else}
    <div class="title">
      {title}
    </div>

    <div class="subtitle">
      <div class="source">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${entry.url}&sz=64`}
          alt="favicon"
        />

        <div class="hostname">
          {subtitle}
        </div>
      </div>

      {#if entry.type.startsWith('import')}
        <div
          class="type"
          use:tooltip={{
            text: `Imported ${getHumanFormattedDate(entry.createdAt)}`,
            position: 'left'
          }}
        >
          <Icon name="save" size="15px" style="transform: rotate(180deg)" />
        </div>
      {:else}
        <div
          class="type"
          use:tooltip={{
            text: `Viewed ${getHumanFormattedDate(entry.createdAt)}`,
            position: 'left'
          }}
        >
          <Icon name="history" size="15px" />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .entry {
    --background: #fff;
    --text-color: #281b53;
    --text-muted-opacity: 0.7;

    :global(.dark) & {
      --background: #1f2937;
      --text-color: #fff;
    }

    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 1rem;

    background: var(--background);
    border-radius: 1.1em;
    border: 1px solid rgba(50, 50, 50, 0.075);
    box-shadow:
      0 0 0 1px rgba(50, 50, 93, 0.06),
      0 2px 5px 0 rgba(50, 50, 93, 0.04),
      0 1px 1.5px 0 rgba(0, 0, 0, 0.01);
    overflow: hidden;
    outline: 0px solid transparent;
    transition: outline 125ms ease;

    position: relative;
    overflow: hidden;

    font-size: 0.85em;
    letter-spacing: 0.025em;
    font-weight: 420;
    font-family: -apple-system, system-ui, Avenir, Helvetica, Arial, sans-serif;
    font-family: 'Inter', sans-serif;
    line-height: 1.5;
    font-synthesis: none;
    text-rendering: optimizeSpeed;

    &.full {
      width: 100%;
      height: 100%;
      justify-content: space-between;
    }

    &:hover {
      outline: 2px solid rgba(50, 50, 50, 0.175);
    }

    :global(.dark) & {
      &:hover {
        outline-color: rgba(250, 250, 250, 0.2);
      }
    }
  }

  .title {
    width: fit-content;
    max-width: 100%;

    font-family: SN Pro;
    font-weight: 650;

    font-weight: 550;
    font-size: 1.5em;
    line-height: 1.25em;
    letter-spacing: 0.002em;

    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow-wrap: break-word;
    text-wrap: balance;
    text-overflow: ellipsis;
  }

  .subtitle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    overflow: hidden;
  }

  .source {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
  }

  .favicon {
    --size: 1.25em;
    width: var(--size);
    height: var(--size);
    border-radius: 0.25rem;
  }

  .hostname {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
  }

  .type {
    opacity: 0.75;

    &:hover {
      opacity: 1;
    }
  }
</style>
