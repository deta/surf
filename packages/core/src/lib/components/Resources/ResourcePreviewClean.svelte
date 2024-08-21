<svelte:options immutable />

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { WebParser } from '@horizon/web-parser'

  import TextPreview from './Previews/Text/TextPreview.svelte'
  import LinkPreview from './Previews/Link/LinkPreview.svelte'

  import {
    ResourceHistoryEntry,
    useResourceManager,
    type Resource,
    type ResourceAnnotation,
    type ResourceArticle,
    type ResourceChatMessage,
    type ResourceChatThread,
    type ResourceDocument,
    type ResourceLink,
    type ResourceNote,
    type ResourcePost
  } from '../../service/resources'
  import FilePreview from './Previews/File/FilePreview.svelte'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type ResourceData,
    type ResourceDataPost
  } from '../../types'
  import FileIcon from './Previews/File/FileIcon.svelte'
  import PostPreview from './Previews/Post/PostPreview.svelte'
  import ChatMessagePreview from './Previews/ChatMessage/ChatMessagePreview.svelte'
  import ArticlePreview from './Previews/Article/ArticlePreview.svelte'
  import DocumentPreview from './Previews/Document/DocumentPreview.svelte'
  import ChatThreadPreview from './Previews/ChatThread/ChatThreadPreview.svelte'
  import YoutubePreview from './Previews/Post/YoutubePreview.svelte'
  import AnnotationPreview from './Previews/Annotation/AnnotationPreview.svelte'

  import HistoryEntryPreview from './Previews/Link/HistoryEntryPreview.svelte'
  import { writable } from 'svelte/store'
  import { slide } from 'svelte/transition'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import { CreateTabEventTrigger } from '@horizon/types'
  import {
    useLogScope,
    getHumanDistanceToNow,
    isModKeyPressed,
    hover,
    getFileKind,
    getFileType
  } from '@horizon/utils'
  import ArticleProperties from './ArticleProperties.svelte'

  export let resource: Resource
  export let selected: boolean = false
  // export let annotations: ResourceAnnotation[] = []
  export let showSummary: boolean = false
  export let showTitles: boolean = true
  export let interactive: boolean = true
  export let showSource: boolean = false
  export let newTabOnClick: boolean = false

  const log = useLogScope('ResourcePreviewClean')
  const resourceManager = useResourceManager()

  const dispatch = createEventDispatcher<{
    click: string
    remove: string
    load: string
    open: string
    'new-tab': BrowserTabNewTabEvent
  }>()

  const isHovered = writable(false)

  const OPENABLE_RESOURCES = [
    ResourceTypes.LINK,
    ResourceTypes.POST,
    ResourceTypes.ARTICLE,
    ResourceTypes.CHAT_MESSAGE,
    ResourceTypes.CHAT_THREAD,
    ResourceTypes.DOCUMENT,
    ResourceTypes.ANNOTATION,
    ResourceTypes.HISTORY_ENTRY
  ]

  // TODO: figure out better way to do this
  $: textResource = resource as ResourceNote
  $: linkResource = resource as ResourceLink
  $: postResource = resource as ResourcePost
  $: articleResource = resource as ResourceArticle
  $: chatMessageResource = resource as ResourceChatMessage
  $: chatThreadResource = resource as ResourceChatThread
  $: documentResource = resource as ResourceDocument
  $: annotationResource = resource as ResourceAnnotation
  $: historyEntryResource = resource as ResourceHistoryEntry

  $: annotations = resource.annotations ?? []

  $: isLiveSpaceResource = !!resource.tags?.find(
    (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
  )

  $: isSilent = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.SILENT)
  $: canonicalUrl =
    resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
    resource.metadata?.sourceURI

  $: canOpenAsTab = !!canonicalUrl && OPENABLE_RESOURCES.some((x) => resource.type.startsWith(x))

  let data: ResourceData | null = null
  const handleData = (e: CustomEvent<ResourceData>) => {
    data = e.detail
  }

  let dragging = false

  const handleDragStart = (e: DragEvent) => {
    dragging = true
    if (data) {
      if (resource.type.startsWith(ResourceTypes.POST)) {
        e.dataTransfer?.setData('text/uri-list', (data as ResourceDataPost)?.url ?? '')
      }

      const content = WebParser.getResourceContent(resource.type, data)
      if (content.plain) {
        e.dataTransfer?.setData('text/plain', content.plain)
      }

      if (content.html) {
        e.dataTransfer?.setData('text/html', content.html)
      }
    }
  }

  const handleClick = async (e: MouseEvent) => {
    if (dragging) {
      dragging = false
      return
    }

    if (!canOpenAsTab) {
      log.debug('Resource cannot be opened as tab', resource)
      return
    }

    if (newTabOnClick) {
      dispatch('new-tab', {
        url: canonicalUrl!,
        active: !isModKeyPressed(e),
        trigger: CreateTabEventTrigger.OasisItem
      })
      return
    }

    if (resource.type === ResourceTypes.ANNOTATION) {
      const annotatesTag = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.ANNOTATES)
      if (annotatesTag) {
        dispatch('open', annotatesTag.value)
        return
      }

      return
    }

    if (isModKeyPressed(e)) {
      dispatch('new-tab', {
        url: canonicalUrl!,
        active: e.shiftKey,
        trigger: CreateTabEventTrigger.OasisItem
      })
      return
    }

    dispatch('open', resource.id)
  }

  const handleLoad = () => {
    dispatch('load', resource.id)
  }

  const handleRemove = (e: MouseEvent) => {
    e.stopImmediatePropagation()
    dispatch('remove', resource.id)
  }

  const handleOpenAsNewTab = (e: MouseEvent) => {
    if (!canonicalUrl || !canOpenAsTab) {
      return
    }

    e.stopImmediatePropagation()
    const payload = {
      url: canonicalUrl,
      active: true,
      trigger: CreateTabEventTrigger.OasisItem
    }

    dispatch('new-tab', payload)
  }

  const getHostname = (raw: string) => {
    try {
      const url = new URL(raw)
      return url.hostname
    } catch (error) {
      return raw
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  on:click={handleClick}
  class="resource-preview"
  class:clickable={newTabOnClick && canOpenAsTab}
  class:isSelected={selected}
  class:background={(isLiveSpaceResource && showSummary && resource.metadata?.userContext) ||
    showSource}
  style="--id:{resource.id};"
  on:dragstart={handleDragStart}
  draggable="true"
>
  <div
    class="preview"
    class:reddit={resource.type === 'application/vnd.space.post.reddit'}
    class:twitter={resource.type === 'application/vnd.space.post.twitter'}
    class:slack={resource.type === 'application/vnd.space.chat-message.slack'}
    class:notion={resource.type === 'application/vnd.space.document.notion'}
  >
    {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
      <TextPreview resource={textResource} on:data={handleData} on:load={handleLoad} />
    {:else if resource.type === ResourceTypes.LINK}
      <LinkPreview resource={linkResource} on:data={handleData} on:load={handleLoad} />
    {:else if resource.type === ResourceTypes.HISTORY_ENTRY}
      <HistoryEntryPreview
        resource={historyEntryResource}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.POST_YOUTUBE)}
      <YoutubePreview
        resource={postResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.POST)}
      <PostPreview
        resource={postResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.ARTICLE)}
      <ArticlePreview resource={articleResource} on:data={handleData} on:load={handleLoad} />
    {:else if resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)}
      <ChatMessagePreview
        resource={chatMessageResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.CHAT_THREAD)}
      <ChatThreadPreview
        resource={chatThreadResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.DOCUMENT)}
      <DocumentPreview
        resource={documentResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.ANNOTATION)}
      <AnnotationPreview resource={annotationResource} on:data={handleData} on:load={handleLoad} />
    {:else}
      <FilePreview {resource} on:load={handleLoad} />
      <!-- {:else}
      <div class="text-base">Unknown</div> -->
    {/if}

    {#if showSource}
      <div class="resource-source" use:hover={isHovered}>
        {#if isSilent}
          <Icon name="history" size="16px" />
          {#if $isHovered}
            <div class="whitespace-nowrap ml-2 leading-4" transition:slide={{ axis: 'x' }}>
              Auto Saved
            </div>
          {/if}
        {:else if isLiveSpaceResource}
          <Icon name="rss" size="16px" />
          {#if $isHovered}
            <div class="whitespace-nowrap ml-2 leading-4" transition:slide={{ axis: 'x' }}>
              Subscription
            </div>
          {/if}
        {:else if resource.type === ResourceTypes.HISTORY_ENTRY}
          <Icon name="history" size="16px" />
          {#if $isHovered}
            <div class="whitespace-nowrap ml-2 leading-4" transition:slide={{ axis: 'x' }}>
              History
            </div>
          {/if}
        {:else}
          <Icon name="leave" size="16px" />
          {#if $isHovered}
            <div class="whitespace-nowrap ml-2 leading-4" transition:slide={{ axis: 'x' }}>
              Saved by You
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
  {#if showTitles}
    <div class="details">
      <div class="type">
        {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
          <!-- <Icon name="docs" size="20px" />
        <div class="">Note</div> -->
        {:else if resource.type === ResourceTypes.LINK}
          <Icon name="link" size="20px" />
          <div class="">Link</div>
        {:else if resource.type.startsWith(ResourceTypes.POST_YOUTUBE)}
          <ArticleProperties {resource} hideURL={isLiveSpaceResource} />
        {:else if resource.type.startsWith(ResourceTypes.POST)}
          <Icon name="link" size="20px" />
          <div class="">Post</div>
        {:else if resource.type.startsWith(ResourceTypes.ARTICLE)}
          <ArticleProperties resource={articleResource} hideURL={isLiveSpaceResource} />
        {:else if resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)}
          <Icon name="docs" size="20px" />
          <div class="">Message</div>
        {:else if resource.type.startsWith(ResourceTypes.CHAT_THREAD)}
          <Icon name="link" size="20px" />
          <div class="">Thread</div>
        {:else if resource.type.startsWith(ResourceTypes.DOCUMENT)}
          <Icon name="docs" size="20px" />
          <div class="">Document</div>
        {:else if resource.type.startsWith(ResourceTypes.ANNOTATION)}
          <Icon name="marker" size="20px" />
          <div class="">Annotation</div>
        {:else if resource.type.startsWith(ResourceTypes.HISTORY_ENTRY)}
          <Icon name="history" size="20px" />
          <div class="">{getHumanDistanceToNow(historyEntryResource.createdAt)}</div>
        {:else}
          <FileIcon kind={getFileKind(resource.type)} width="20px" height="20px" />
          <div class="">{getFileType(resource.type) ?? 'File'}</div>
        {/if}
      </div>

      {#if interactive}
        <div class="remove-wrapper">
          {#if canOpenAsTab}
            <div class="remove rotated" on:click={handleOpenAsNewTab}>
              <Icon name="arrow.right" color="#AAA7B1" />
            </div>
          {/if}
          <div class="remove" on:click={handleRemove}>
            <Icon name="close" color="#AAA7B1" />
          </div>
        </div>
      {/if}

      {#if annotations.length > 0}
        <div class="annotations">
          <Icon name="marker" />
          <div>{annotations.length} Annotation{annotations.length > 1 ? 's' : ''}</div>
        </div>
      {/if}

      {#if isLiveSpaceResource}
        {#if showSummary && resource.metadata?.userContext}
          <div class="summary-wrapper">
            <div class="summary">
              {resource.metadata?.userContext}
            </div>
          </div>
        {/if}

        <div class="annotations">
          {#if canonicalUrl}
            <img
              class="favicon"
              src={`https://www.google.com/s2/favicons?domain=${canonicalUrl}&sz=48`}
              alt={`favicon`}
              loading="lazy"
            />
          {/if}

          <div>
            {canonicalUrl ? getHostname(canonicalUrl) : 'Unknown'}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if interactive}
    <div class="remove-wrapper">
      {#if canOpenAsTab}
        <div class="remove rotated" on:click={handleOpenAsNewTab}>
          <Icon name="arrow.right" color="#AAA7B1" />
        </div>
      {/if}
      <div class="remove" on:click={handleRemove}>
        <Icon name="close" color="#AAA7B1" />
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(30px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .resource-preview {
    position: relative;
    display: flex;
    gap: 8px;
    flex-direction: column;
    border-radius: 16px;
    overflow: visible;
    cursor: default;
    /* animation: 280ms fade-in-up cubic-bezier(0.25, 0.46, 0.45, 0.94); */
    animation-delay: 20ms;
    animation-fill-mode: forwards;
    animation-iteration-count: 1;
    &:hover {
      .remove-wrapper {
        animation: fade-in 120ms forwards;
        animation-iteration-count: 1;
        animation-delay: 60ms;
      }
    }

    &.clickable {
      cursor: pointer;
    }

    &.isSelected {
      .preview {
        outline: 4px solid rgba(0, 123, 255, 0.75);
      }
    }

    &.background {
      background: rgb(255, 255, 255);
      border: 1px solid rgba(228, 228, 228, 0.75);
      box-shadow:
        0px 1px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 1px 0px rgba(0, 0, 0, 0.25);

      .preview:not(.slack):not(.reddit):not(.twitter):not(.notion) {
        background: rgba(255, 255, 255, 0.75);
        border: none;
        box-shadow: none;
      }
    }

    &.details {
      .preview:hover {
        outline: 0;
      }
    }

    & * {
      user-select: none;
      -webkit-user-drag: none;
    }
  }

  .preview {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(228, 228, 228, 0.75);
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    background: rgba(255, 255, 255, 0.75);
    transition: 60ms ease-out;
    position: relative;
    &:hover {
      outline: 3px solid rgba(0, 0, 0, 0.15);
    }
    &.twitter {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #000 0%, #252525 100%) !important;
    }
    &.slack {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #d5ffed 0%, #ecf9ff 100%);
    }
    &.reddit {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #ff4500 0%, #ff7947 100%);
    }
    &.notion {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #fff 0%, #fafafa 100%);
    }
  }

  .details {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.5rem 0.75rem 0.5rem;
    gap: 0.5rem;
    color: var(--color-text-muted);
    width: 100%;
  }

  .remove-wrapper {
    position: absolute;
    display: flex;
    gap: 0.75rem;
    top: 0;
    padding: 1rem;
    right: 1.5rem;
    transform: translateX(45%) translateY(-45%);
    opacity: 0;
    margin-left: 0.5rem;
    cursor: default;
    .remove {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      transition: 60ms ease-out;
      background: white;
      &.rotated {
        transform: rotate(-45deg);
      }
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }

  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  .type {
    display: flex;
    align-items: start;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: #281b53;
  }

  .label {
    font-size: 1.1rem;
    line-height: 1.4;
    padding: 0 0.25rem 0 0.25rem;
    margin-bottom: 1.5rem;
    text-wrap: balance;
  }

  .dragging {
    position: absolute;
    width: 200px;
    height: 200px;
    max-width: 200px;
    max-height: 200px;
    opacity: 0.7;
    pointer-events: none;
    animation: initial-drag 0.2s ease-out;
  }

  @keyframes initial-drag {
    from {
      transform: scale(0.8);
    }
    to {
      transform: scale(1);
    }
  }

  .annotations {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: rgb(12 74 110/0.9);
  }

  .resource-source {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(4px);
    box-shadow: 0px 0.425px 0px 0px rgba(65, 58, 86, 0.25);
    padding: 0.4rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: rgb(12 74 110/0.9);

    &.hover {
      background: rgba(255, 255, 255);
      color: rgb(12 74 110);
    }
  }

  .favicon {
    width: 1rem;
    height: 1rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .summary-wrapper {
    padding: 0.5rem 1rem;
  }

  .summary {
    font-size: 1rem;
    color: rgb(12 74 110/0.9);
    letter-spacing: 0.0175rem;
    font-weight: 500;
    text-wrap: pretty;
    display: -webkit-box;
    overflow: hidden;
    line-height: 1.5;
    word-break: break-word;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-line-clamp: 15;
    -webkit-box-orient: vertical;
  }
</style>
