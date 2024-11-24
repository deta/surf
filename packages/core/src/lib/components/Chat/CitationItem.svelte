<script lang="ts" context="module">
  export type CitationType = 'image' | 'resource'
</script>

<script lang="ts">
  import { createEventDispatcher, getContext, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import {
    copyToClipboard,
    generateID,
    getFileKind,
    isModKeyPressed,
    parseStringIntoUrl,
    truncate,
    truncateURL,
    useLogScope,
    normalizeURL,
    hover
  } from '@horizon/utils'
  import {
    CITATION_HANDLER_CONTEXT,
    type CitationHandlerContext
  } from './ChatMessageMarkdown.svelte'
  import { DragTypeNames, ResourceTagsBuiltInKeys, type AIChatMessageSource } from '../../types'
  import { Icon } from '@horizon/icons'
  import {
    CONTEXT_MENU_KEY,
    contextMenu,
    type CtxMenuProps,
    type CtxItem
  } from '../Core/ContextMenu.svelte'
  import ResourceHoverPreview from './ResourceHoverPreview.svelte'
  import {
    ResourceJSON,
    useResourceManager,
    type Resource
  } from '@horizon/core/src/lib/service/resources'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import FileIcon from '../Resources/Previews/File/FileIcon.svelte'
  import ResourceSmallImagePreview from '../Resources/ResourceSmallImagePreview.svelte'
  import { Dragcula, HTMLDragItem } from '@horizon/dragcula'

  export let className: string = ''
  export let id: string = ''
  export let general: boolean = false
  export let type: CitationType = 'resource'
  export let skipParsing: boolean = false
  export let allowRemove: boolean = false
  export let maxTitleLength = 42

  const log = useLogScope('CitationItem')
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const tabsManager = useTabsManager()

  const dispatch = createEventDispatcher<{
    'rerun-without-source': void
  }>()

  const citationHandler = getContext<CitationHandlerContext>(CITATION_HANDLER_CONTEXT)
  const highlightedCitation = citationHandler.highlightedCitation

  const uniqueID = generateID()
  const opened = writable(false)
  const hoveringPreview = writable(false)

  const isDraggingSomething = Dragcula.get().isDragging

  let slotElem: HTMLSpanElement
  let citationID: string
  let source: AIChatMessageSource | undefined
  let renderID: string
  let tooltipText: string
  let citationType: CitationType
  let resource: Resource | null = null
  let loadingResource = false

  $: canonicalUrl =
    (resource?.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
      ?.value || resource?.metadata?.sourceURI

  const getID = () => {
    const innerId = slotElem.innerText
    if (innerId) {
      return innerId
    }

    if (id) {
      return id.replace('user-content-', '')
    }

    log.error('Citation item does not have an ID')
    return ''
  }

  const getType = () => {
    if (type) {
      return type.replace('user-content-', '') as CitationType
    }

    return 'resource'
  }

  const getURL = (source: AIChatMessageSource) => {
    const url = parseStringIntoUrl(canonicalUrl || source?.metadata?.url || '')
    if (!url) return null

    if (source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null) {
      const timestamp = Math.floor(source.metadata.timestamp)
      return `${url.href}&t=${timestamp}`
    } else {
      return url.href
    }
  }

  const handleClick = (e?: MouseEvent) => {
    if (general) {
      if (!source) return
      log.debug('General citation clicked', citationID)

      if (e?.shiftKey && !isModKeyPressed(e)) {
        citationHandler.citationClick({ citationID, uniqueID, preview: true })
        return
      }

      const openAsActiveTab = e ? !isModKeyPressed(e) : true

      const url = getURL(source)
      if (!url) {
        if (!resource) {
          log.error('Failed to open citation: no URL or resource')
          toasts.error('Failed to open citation')
          return
        }

        const existingTab = tabsManager.tabsValue.find(
          (tab) => tab.type === 'resource' && tab.resourceId === resource!.id
        )
        if (existingTab && openAsActiveTab) {
          tabsManager.makeActive(existingTab.id)
          return
        }

        tabsManager.openResourceAsTab(resource, {
          active: openAsActiveTab
        })

        return
      }

      // For youtube videos we need to normalize the URL to remove any extra query params like the timestamp
      const normalizeUrlExtra = (url: string) => {
        const parsed = parseStringIntoUrl(url)
        if (!parsed) return url

        if (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') {
          return `${parsed.origin}/watch?v=${parsed.searchParams.get('v')}`
        }

        return normalizeURL(url)
      }

      // TODO: improve this to reuse the same tab selection as clicking a context item in the chat
      const existingTab = tabsManager.tabsValue.find(
        (tab) =>
          tab.type === 'page' &&
          normalizeUrlExtra(
            tab.currentLocation || tab.currentDetectedApp?.canonicalUrl || tab.initialLocation
          ) === normalizeUrlExtra(url)
      )

      if (existingTab && openAsActiveTab) {
        tabsManager.makeActive(existingTab.id)
        return
      }

      tabsManager.addPageTab(url, {
        active: openAsActiveTab
      })
      return
    }

    log.debug('Citation clicked', citationID)

    if (citationType === 'image') {
      toasts.info(`Image citations don't support jumping to the source yet`)
      return
    }

    citationHandler.citationClick({
      citationID,
      uniqueID,
      preview: e?.shiftKey && !isModKeyPressed(e)
    })
  }

  // format number to hh:mm:ss or mm:ss or ss (for seconds add "s" e.g. 5s)
  const formatTimestamp = (timestamp: number) => {
    const hours = Math.floor(timestamp / 3600)
    const minutes = Math.floor((timestamp % 3600) / 60)
    const seconds = Math.floor(timestamp % 60)

    let result = ''
    if (hours > 0) {
      result += hours.toString().padStart(2, '0') + ':'
    }

    if (minutes > 0 || hours > 0) {
      result += minutes.toString().padStart(2, '0') + ':'
    } else {
      result += '00:'
    }

    result += seconds.toString().padStart(2, '0')

    if (result === '') {
      result = '0'
    }

    return result
  }

  const copyURL = () => {
    if (!source) return

    const url = getURL(source)
    if (!url) return

    copyToClipboard(url)
    toasts.success('Source URL copied to clipboard')
  }

  const isURL = (url: string) => {
    const value = parseStringIntoUrl(url)
    return value !== null
  }

  const getOpenItem = (source: AIChatMessageSource) => {
    const base = {
      type: 'action',
      action: () => handleClick()
    }

    log.debug('open item', source?.metadata?.timestamp)

    if (general) {
      return {
        ...base,
        icon: 'arrow.up.right',
        text: 'Open Tab'
      } as CtxItem
    } else if (source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null) {
      return {
        ...base,
        icon: 'arrow.right',
        text: 'Jump to Timestamp'
      } as CtxItem
    } else {
      return {
        ...base,
        icon: 'arrow.right',
        text: 'Jump to Source'
      } as CtxItem
    }
  }

  $: contextMenuKey = `citation-item-${uniqueID}`

  $: contextMenuData = {
    canOpen: !!source || allowRemove,
    key: `citation-item-${uniqueID}`,
    items: source
      ? [
          getOpenItem(source),
          ...(getURL(source)
            ? [
                {
                  type: 'action',
                  icon: 'copy',
                  text: 'Copy URL',
                  action: () => copyURL()
                } as CtxItem
              ]
            : [])
        ]
      : allowRemove
        ? [
            {
              type: 'action',
              icon: 'reload',
              text: `Re-run without ${citationType === 'image' ? 'image' : 'source'}`,
              action: () => dispatch('rerun-without-source')
            } as CtxItem
          ]
        : []
  } satisfies CtxMenuProps

  onMount(async () => {
    citationType = getType()

    if (skipParsing) {
      return
    }

    citationID = getID()

    const info = citationHandler.getCitationInfo(citationID)
    source = info.source
    renderID = info.renderID

    if (source?.metadata?.url) {
      tooltipText = `Source: ${truncateURL(source.metadata.url, maxTitleLength)}`
    } else if (citationType === 'image') {
      tooltipText = 'Source: screenshot or image'
    } else {
      tooltipText = `Source: ${renderID}`
    }

    if (source?.resource_id) {
      loadingResource = true
      resource = await resourceManager.getResource(source.resource_id)
      loadingResource = false

      if (resource) {
        if (resource.metadata?.name) {
          tooltipText = truncate(resource.metadata?.name, maxTitleLength)
        } else if (resource instanceof ResourceJSON) {
          const data = await resource.getParsedData()
          resource.releaseData()

          if (data.title) {
            tooltipText = truncate(data.title, maxTitleLength)
          }
        } else if (canonicalUrl) {
          tooltipText = truncateURL(canonicalUrl, maxTitleLength)
        }
      }
    }
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<citation
  id={citationID}
  data-uid={uniqueID}
  on:click|preventDefault={handleClick}
  class:wide={((source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null) ||
    source?.metadata?.url ||
    (citationType === 'image' && !skipParsing)) &&
    !general}
  class:active={$highlightedCitation === uniqueID}
  class:icon={citationType === 'image' && !skipParsing}
  class={`${className} ${general ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 border-gray-200 dark:border-gray-700' : ''}`}
  data-tooltip-target="chat-citation"
  use:contextMenu={contextMenuData}
  draggable={true}
  use:HTMLDragItem.action={{}}
  on:DragStart={(drag) => {
    if (resource) {
      drag.item.data.setData(DragTypeNames.SURF_RESOURCE, resource)
      drag.dataTransfer?.setData('application/vnd.space.dragcula.resourceId', resource.id)
      drag.item.data.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)
      drag.continue()
    }
  }}
>
  <span bind:this={slotElem} style="display: none;">
    <slot />
  </span>

  <CustomPopover
    position="top"
    openDelay={350}
    sideOffset={10}
    popoverOpened={opened}
    forceOpen={$CONTEXT_MENU_KEY === contextMenuKey}
    disabled={(general && !resource?.type.startsWith('image/')) ||
      citationType === 'image' ||
      ($isDraggingSomething && !$hoveringPreview)}
  >
    <div slot="trigger" class="inline-flex items-center justify-center gap-2 select-none">
      {#if source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null}
        <img
          src="https://www.google.com/s2/favicons?domain=https://youtube.com&sz=40"
          alt="YouTube icon"
        />
        <div class="select-none">
          {#if general}
            {tooltipText}
          {:else}
            {formatTimestamp(source.metadata.timestamp)}
          {/if}
        </div>
      {:else if source?.metadata?.url}
        {#if resource?.type.startsWith('image/')}
          <ResourceSmallImagePreview {resource} />
        {:else if canonicalUrl || isURL(source.metadata.url)}
          <img
            src="https://www.google.com/s2/favicons?domain={canonicalUrl ||
              source.metadata.url}&sz=40"
            alt="source icon"
          />
        {:else if resource?.type}
          <FileIcon kind={getFileKind(resource.type)} width="15px" height="15px" />
        {:else}
          <Icon name="world" size="15px" />
        {/if}
        <div class="font-sans text-xs tracking-wide select-none">
          {#if general}
            {tooltipText}
          {:else}
            <span class="uppercase">#{renderID}</span>
          {/if}
        </div>
      {:else if citationType === 'image'}
        <div class="file-icon">
          <FileIcon kind="image" />
        </div>

        {#if skipParsing}
          <slot></slot>
        {/if}
      {:else}
        {#if resource?.type}
          {#if resource.type.startsWith('image/')}
            <ResourceSmallImagePreview {resource} />
          {:else}
            <FileIcon kind={getFileKind(resource.type)} width="15px" height="15px" />
          {/if}
        {/if}

        <div class="font-sans text-xs tracking-wide select-none">
          {#if general}
            {tooltipText}
          {:else}
            <span class="uppercase">#{renderID}</span>
          {/if}
        </div>
      {/if}
    </div>

    <div
      slot="content"
      class="no-drag bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 relative max-w-96 cursor-pointer"
      on:click={() => handleClick()}
      use:contextMenu={contextMenuData}
      use:hover={hoveringPreview}
    >
      <ResourceHoverPreview {resource} loading={loadingResource} title={tooltipText} />
    </div>
  </CustomPopover>
</citation>

<style lang="scss">
  citation {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0.5rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 500;
    height: auto;
    text-align: center;
    user-select: none;
    overflow: hidden;
    font-feature-settings: 'caps' on;
    line-height: 1;
    padding-top: calc(0.5rem + 1px);
    padding-bottom: calc(0.5rem - 1px);
    min-width: 4rem;

    div {
      font-size: 0.9rem;
      line-height: 1.25rem;
      font-weight: 500;
      white-space: nowrap; // Added to prevent text wrapping
      overflow: hidden; // Added to prevent text overflow
      text-overflow: ellipsis; // Added to show ellipsis for overflowing text
    }

    img {
      width: 1.1rem;
      height: 1.1rem;
      flex-shrink: 0;
      border-radius: 5px;
      margin: 0;
      margin-top: -1px;
    }

    .file-icon {
      width: 1.1rem;
      height: 1.1rem;
      flex-shrink: 0;
      color: #0e53a3;

      :global(.dark) & {
        color: #d1d1c2;
      }
    }

    &.wide {
      height: auto;
      padding: 0.25rem 0.5rem;
      position: relative;
      top: 2px;
    }

    &.icon {
      padding: 0.25rem 0.5rem;
      margin-top: -10px;
    }

    &.active {
      background: #e4d3fd;
      border: 1px solid #aa8df2;

      :global(.dark) & {
        background: #374151;
        border: 1px solid #4b5565;
      }

      &:hover {
        background: rgba(183, 198, 218, 0.2);

        :global(.dark) & {
          background: rgba(183, 198, 218, 0.2);
        }
      }
    }

    &:hover {
      background: rgba(183, 198, 218, 0.2);

      :global(.dark) & {
        background: rgba(183, 198, 218, 0.2);
      }
    }
  }
</style>
