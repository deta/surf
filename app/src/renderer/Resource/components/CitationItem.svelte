<script lang="ts" context="module">
  export type CitationType = 'image' | 'resource'

  export const CITATION_HANDLER_CONTEXT = 'citation-handler'

  export type CitationHandlerContext = {
    citationClick: (data: CitationClickData) => void
    getCitationInfo: (id: string) => CitationInfo
    highlightedCitation: Writable<string | null>
  }
</script>

<script lang="ts">
  import { createEventDispatcher, getContext, onMount } from 'svelte'
  import { type Writable, writable } from 'svelte/store'
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
  } from '@deta/utils'
  import {
    DragTypeNames,
    ResourceTagsBuiltInKeys,
    type AIChatMessageSource,
    type CitationClickData,
    type CitationInfo
  } from '@deta/types'
  import { Icon, DynamicIcon } from '@deta/icons'
  import { ResourceJSON, type Resource, useResourceManager } from '@deta/services/resources'
  import { useToasts, ResourceSmallImagePreview } from '@deta/ui'

  export let className: string = ''
  export let id: string = ''
  export let general: boolean = false
  export let type: CitationType = 'resource'
  export let skipParsing: boolean = false
  export let allowRemove: boolean = false
  export let maxTitleLength = 42
  export let skipContext = false
  export let info: CitationInfo | undefined = undefined

  export let toasts = useToasts()

  const log = useLogScope('CitationItem')
  const resourceManager = useResourceManager()

  const dispatch = createEventDispatcher<{
    click: CitationClickData
    'rerun-without-source': void
  }>()

  const citationHandler = skipContext
    ? undefined
    : getContext<CitationHandlerContext>(CITATION_HANDLER_CONTEXT)
  const highlightedCitation = citationHandler?.highlightedCitation

  const uniqueID = generateID()
  const opened = writable(false)
  const hoveringPreview = writable(false)

  let slotElem: HTMLSpanElement
  let citationID: string
  let source: AIChatMessageSource | undefined
  let renderID: string
  let tooltipText: string
  let hideText = false
  let skipHighlight = false
  let citationType: CitationType
  let resource: Resource | null = null
  let loadingResource = false
  let citationElem: HTMLElement

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

  const getInfo = (citationID: string) => {
    if (info) {
      return info
    }

    if (citationHandler) {
      return citationHandler.getCitationInfo(citationID)
    }

    const infoAttr = citationElem.getAttribute('data-info')
    log.debug('infoAttr', infoAttr)
    if (infoAttr) {
      return JSON.parse(decodeURIComponent(infoAttr)) as CitationInfo
    }

    return undefined
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

  const dispatchClick = (data: CitationClickData) => {
    if (citationHandler) {
      citationHandler.citationClick(data)
    } else {
      dispatch('click', data)
    }
  }

  const handleClick = (e?: MouseEvent) => {
    if (skipHighlight && source) {
      source.content = ''
      if (source.metadata) {
        source.metadata.timestamp = undefined
      }
    }

    if (general) {
      if (!source) return
      log.debug('General citation clicked', citationID)

      if (e?.shiftKey && !isModKeyPressed(e)) {
        dispatchClick({ citationID, uniqueID, source, preview: true, skipHighlight })
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

        // const existingTab = tabsManager.tabsValue.find(
        //   (tab) => tab.type === 'resource' && tab.resourceId === resource!.id
        // )
        // if (existingTab && openAsActiveTab) {
        //   tabsManager.makeActive(existingTab.id)
        //   return
        // }

        // tabsManager.openResourceAsTab(resource, {
        //   active: openAsActiveTab
        // })

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
      // const existingTab = tabsManager.tabsValue.find(
      //   (tab) =>
      //     tab.type === 'page' &&
      //     normalizeUrlExtra(
      //       tab.currentLocation || tab.currentDetectedApp?.canonicalUrl || tab.initialLocation
      //     ) === normalizeUrlExtra(url)
      // )

      // if (existingTab && openAsActiveTab) {
      //   tabsManager.makeActive(existingTab.id)
      //   return
      // }

      // tabsManager.addPageTab(url, {
      //   active: openAsActiveTab
      // })
      return
    }

    log.debug('Citation clicked', citationID)

    if (citationType === 'image') {
      toasts.info(`Image citations don't support jumping to the source yet`)
      return
    }

    const backgroundTab = isModKeyPressed(e) && !e?.shiftKey
    const foregroundTab = isModKeyPressed(e)
    const sidebarTab = e.shiftKey

    dispatchClick({
      citationID,
      uniqueID,
      source,
      skipHighlight,
      preview: backgroundTab
        ? 'background_tab'
        : foregroundTab
          ? 'tab'
          : sidebarTab
            ? 'sidebar'
            : 'auto'
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

  onMount(async () => {
    citationType = getType()

    if (skipParsing) {
      return
    }

    citationID = getID()

    info = getInfo(citationID)
    log.debug('info', info)
    if (!info || (!info.renderID && !info.source)) {
      log.error('Citation item does not have info', citationID)
      citationID = ''
      return
    }

    if (!skipContext) {
      log.debug('Setting citation element data-info', info)
      citationElem.setAttribute('data-info', encodeURIComponent(JSON.stringify(info)))
    }

    source = info.source
    renderID = info.renderID

    if (info.skipHighlight !== undefined) {
      skipHighlight = info.skipHighlight
    }

    if (
      info.hideText !== undefined &&
      (typeof source?.metadata?.timestamp !== 'number' || skipHighlight)
    ) {
      hideText = info.hideText
    }

    if (source?.metadata?.url) {
      tooltipText = truncateURL(source.metadata.url, maxTitleLength)
    } else if (citationType === 'image') {
      tooltipText = 'screenshot or image'
    } else {
      tooltipText = renderID
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
    resource ||
    (citationType === 'image' && !skipParsing)) &&
    !general}
  class:active={highlightedCitation && $highlightedCitation === uniqueID}
  class:icon={citationType === 'image' && !skipParsing}
  class:compact={hideText}
  class={`${className} ${general ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 border-gray-200 dark:border-gray-700' : ''}`}
  data-tooltip-target="chat-citation"
  bind:this={citationElem}
>
  <span bind:this={slotElem} style="display: none;">
    <slot />
  </span>

  {#if skipContext}
    <div class="inline-flex items-center justify-center gap-1 select-none">
      {#if source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null}
        <img
          src="https://www.google.com/s2/favicons?domain=https://youtube.com&sz=40"
          alt="YouTube icon"
        />
        {#if !hideText}
          <div class="select-none">
            {#if general}
              {tooltipText}
            {:else}
              {formatTimestamp(source.metadata.timestamp)}
            {/if}
          </div>
        {/if}
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
          <DynamicIcon name="file;;{getFileKind(resource.type)}" width="1em" height="1em" />
        {:else}
          <Icon name="world" size="1em" />
        {/if}
        {#if !hideText}
          <div class="font-sans text-xs tracking-wide select-none">
            {#if general}
              {tooltipText}
            {:else if renderID || citationID}
              <span class="uppercase">#{renderID || citationID}</span>
            {/if}
          </div>
        {/if}
      {:else if citationType === 'image'}
        <div class="file-icon">
          <DynamicIcon name="file;;image" />
        </div>

        {#if skipParsing}
          <slot></slot>
        {/if}
      {:else}
        {#if resource?.type}
          {#if resource.type.startsWith('image/')}
            <ResourceSmallImagePreview {resource} />
          {:else}
            <DynamicIcon name="file;;{getFileKind(resource.type)}" width="1em" height="1em" />
          {/if}
        {/if}

        {#if !hideText}
          <div class="font-sans text-xs tracking-wide select-none">
            {#if general}
              {tooltipText}
            {:else if renderID || citationID}
              <span class="uppercase">#{renderID || citationID}</span>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="inline-flex items-center justify-center gap-1 select-none">
      {#if source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null}
        <img
          src="https://www.google.com/s2/favicons?domain=https://youtube.com&sz=40"
          alt="YouTube icon"
        />
        {#if !hideText}
          <div class="select-none">
            {#if general}
              {tooltipText}
            {:else}
              {formatTimestamp(source.metadata.timestamp)}
            {/if}
          </div>
        {/if}
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
          <DynamicIcon name="file;;{getFileKind(resource.type)}" width="1em" height="1em" />
        {:else}
          <Icon name="world" size="15px" />
        {/if}

        {#if !hideText}
          <div class="font-sans text-xs tracking-wide select-none">
            {#if general}
              {tooltipText}
            {:else if renderID || citationID}
              <span class="uppercase">#{renderID || citationID}</span>
            {/if}
          </div>
        {/if}
      {:else if citationType === 'image'}
        <div class="file-icon">
          <DynamicIcon name="file;;image" />
        </div>

        {#if skipParsing}
          <slot></slot>
        {/if}
      {:else}
        {#if resource?.type}
          {#if resource.type.startsWith('image/')}
            <ResourceSmallImagePreview {resource} />
          {:else}
            <DynamicIcon name="file;;{getFileKind(resource.type)}" width="1em" height="1em" />
          {/if}
        {/if}

        {#if !hideText}
          <div class="font-sans text-xs tracking-wide select-none">
            {#if general}
              {tooltipText}
            {:else if renderID || citationID}
              <span class="uppercase">#{renderID || citationID}</span>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</citation>

<style lang="scss">
  :global(.response-wrapper citation) {
    padding: 0.45em 0.6em !important;
    display: none;
  }
  :global(.response-wrapper citation img) {
    width: 1.3em !important;
    height: 1.3em !important;
  }
  :global(.response-wrapper citation.wide) {
    padding: 0.3em 0.65em !important;
    padding-bottom: 0.2em !important;
  }

  :global(.response-wrapper citation span) {
    font-size: 1.08rem;
  }
  citation {
    display: inline-flex;
    align-items: center;
    justify-content: start;
    gap: 6px;
    border-radius: 12px;
    font-size: 0.94rem;
    font-weight: 500 !important;
    height: auto;
    text-align: center;
    user-select: none;
    overflow: hidden;
    font-feature-settings: 'caps' on;
    line-height: 0.8;
    padding-top: calc(0.4em + 1px);
    padding-bottom: calc(0.4em - 1px);
    padding-inline: 0.6rem;
    width: fit-content;
    background: light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
    margin-right: 3px;
    cursor: default;
    letter-spacing: 0.1em;
    div {
      font-size: 0.8rem;
      line-height: 1.25em;
      font-weight: 500;
      white-space: nowrap; // Added to prevent text wrapping
      overflow: hidden; // Added to prevent text overflow
      text-overflow: ellipsis; // Added to show ellipsis for overflowing text
    }

    img {
      width: 1em;
      height: 1em;
      flex-shrink: 0;
      border-radius: 5px;
      margin: 0;
      user-select: none;
      pointer-events: none;
    }

    .file-icon {
      width: 1em;
      height: 1em;
      flex-shrink: 0;
      color: light-dark(#0e53a3, #d1d1c2);
    }

    &.wide {
      height: auto;
      padding: 0.25rem 0.45rem;
      position: relative;
      top: 2px;
      font-size: 0.9em;
    }

    &.compact {
      height: auto;
      min-width: auto;
      font-size: 0.95em;
      padding: 0.25em 0.333em;
    }

    &.icon {
      padding: 0.25em 0.5em;
      margin-top: -10px;
    }

    &.active {
      background: light-dark(#e4d3fd, #374151);
      border: 1px solid light-dark(#aa8df2, #4b5565);

      &:hover {
        background: light-dark(rgba(183, 198, 218, 0.2), rgba(183, 198, 218, 0.2));
      }
    }

    &:hover {
      background: light-dark(rgba(183, 198, 218, 0.2), rgba(183, 198, 218, 0.2));
    }
  }

  :global(.notes-editor-wrapper.autocompleting citation) {
    pointer-events: none;
    opacity: 0.75;
  }

  :global(.notes-editor-wrapper.autocompleting span[data-citation-id]) {
    cursor: not-allowed;
    user-select: none;

    // disable the selection highlight
    &::after {
      content: '';
      background: none;
    }
  }
</style>
