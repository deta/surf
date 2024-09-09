<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import { generateID, tooltip, truncateURL, useLogScope } from '@horizon/utils'
  import {
    CITATION_HANDLER_CONTEXT,
    type CitationHandlerContext
  } from './ChatMessageMarkdown.svelte'
  import type { AIChatMessageSource } from '../../types'
  import { active } from 'd3'

  const log = useLogScope('CitationItem')

  const citationHandler = getContext<CitationHandlerContext>(CITATION_HANDLER_CONTEXT)
  const highlightedCitation = citationHandler.highlightedCitation

  const uniqueID = generateID()

  let slotElem: HTMLSpanElement
  let citationID: string
  let source: AIChatMessageSource | undefined
  let renderID: string
  let tooltipText: string

  const getID = () => {
    const id = slotElem.innerText
    if (!id) {
      log.error('Citation item does not have an ID')
    }

    return id
  }

  const handleClick = (event: MouseEvent) => {
    event.preventDefault()
    log.debug('Citation clicked', citationID)

    citationHandler.citationClick({ citationID, uniqueID })
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

  onMount(() => {
    citationID = getID()
    const info = citationHandler.getCitationInfo(citationID)
    source = info.source
    renderID = info.renderID

    if (source?.metadata?.url) {
      tooltipText = truncateURL(source.metadata.url, 42)
    } else {
      tooltipText = renderID
    }
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<citation
  id={citationID}
  data-uid={uniqueID}
  on:click={handleClick}
  class:wide={(source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null) ||
    source?.metadata?.url}
  class:active={$highlightedCitation === uniqueID}
  use:tooltip={{ text: tooltipText }}
>
  <span bind:this={slotElem} style="display: none;">
    <slot />
  </span>

  {#if source?.metadata?.timestamp !== undefined && source.metadata.timestamp !== null}
    <img
      src="https://www.google.com/s2/favicons?domain=https://youtube.com&sz=40"
      alt="YouTube icon"
    />
    <div>{formatTimestamp(source.metadata.timestamp)}</div>
  {:else if source?.metadata?.url}
    <img
      src="https://www.google.com/s2/favicons?domain={source.metadata.url}&sz=40"
      alt="source icon"
    />
    <div class="font-sans text-xs uppercase tracking-wide">#{renderID}</div>
  {:else}
    <div class="font-sans text-xs uppercase tracking-wide">#{renderID}</div>
  {/if}
</citation>

<style lang="scss">
  citation {
    cursor: pointer;
    color: #333;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0.5rem;
    background: white;
    border: 0.5px solid rgba(183, 198, 218, 0.4);
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 500;
    width: 100%;
    max-width: 6rem;
    height: auto;
    text-align: center;
    user-select: none;
    overflow: hidden;
    text-transform: uppercase;
    font-feature-settings: 'caps' on;
    line-height: 1;
    padding-top: calc(0.5rem + 1px);
    padding-bottom: calc(0.5rem - 1px);

    div {
      font-size: 0.9rem;
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

    &.wide {
      height: auto;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      position: relative;
      top: 2px;
    }

    &.active {
      background: #e4d3fd;
      border: 1px solid #aa8df2;

      &:hover {
        background: rgba(183, 198, 218, 0.2);
      }
    }

    &:hover {
      background: rgba(183, 198, 218, 0.2);
    }
  }
</style>
