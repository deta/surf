<script lang="ts" context="module">
  export type Source = {
    text: string
    imageUrl?: string
    icon?: Icons
  }

  export type Author = {
    text?: string
    imageUrl?: string
    icon?: Icons
  }

  export type Mode = 'full' | 'media' | 'content' | 'compact' | 'tiny'
  export type ContentType = 'plain' | 'rich_text' | 'html' | 'markdown'

  export type Annotation = {
    type: 'highlight' | 'comment'
    content: string
  }
</script>

<script lang="ts">
  import { getFileKind, useLogScope } from '@horizon/utils'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import Link from '../../Atoms/Link.svelte'
  import ImageView from './File/ImageView.svelte'
  import { Icon, type Icons } from '@horizon/icons'
  import Image from '../../Atoms/Image.svelte'
  import FileIcon from './File/FileIcon.svelte'
  import { Editor } from '@horizon/editor'
  import MarkdownRenderer from '../../Chat/MarkdownRenderer.svelte'
  import { ResourceTypes } from '@horizon/types'
  import FilePreview from './File/FilePreview.svelte'
  import SourceItem from './Source.svelte'
  import { createEventDispatcher } from 'svelte'

  export let resource: Resource

  export let type: string
  export let title: string | undefined = undefined
  export let image: string | Blob | undefined = undefined
  export let content: string | undefined = undefined
  export let contentType: ContentType = 'plain'
  export let annotations: Annotation[] | undefined = undefined
  export let url: string | undefined = undefined
  export let source: Source | undefined = undefined
  export let author: Author | undefined = undefined
  export let theme: [string, string] | undefined = undefined
  export let editTitle: boolean = false
  export let titleValue: string = ''
  export let interactive: boolean = false
  export let frameless: boolean = false
  export let processingText: string = 'Processing…'
  export let hideProcessing: boolean = false

  export let mode: Mode = 'full'

  const log = useLogScope('PostPreview')
  const dispatch = createEventDispatcher<{
    'edit-title': string
    'start-edit-title': void
    click: MouseEvent
  }>()

  const resourceState = resource.state

  let error = ''
  let titleInputElem: HTMLElement

  const MAX_TITLE_LENGTH = 300
  const MAX_CONTENT_LENGTH = 500

  $: showTitle = !(mode === 'media' && image)
  $: showContent =
    (mode === 'full' || mode === 'content' || (!title && !image)) &&
    !((annotations || []).length > 0 && type !== ResourceTypes.ANNOTATION)
  $: showAnnotations = mode === 'full' || mode === 'content' || (!title && !image)
  $: showMedia = mode === 'full' || mode === 'media' || (!title && !content && image)
  $: showAuthor = mode === 'full' || mode === 'content'
  $: showSource = mode !== 'tiny' && !(mode === 'media' && type.startsWith('image/'))
  $: isProcessing = $resourceState === 'post-processing' && !hideProcessing

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  const handleEditTitleBlur = () => {
    dispatch('edit-title', titleValue)
  }

  const handleTitleDoubleClick = () => {
    dispatch('start-edit-title')
  }

  // Forward clicks on the title to the parent component if not handled by the double click
  const handleTitleClick = (e: MouseEvent) => {
    if (editTitle) {
      return
    }

    setTimeout(() => {
      if (!editTitle) {
        dispatch('click', e)
      }
    }, 300)
  }

  const handleTitleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditTitleBlur()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      handleEditTitleBlur()
    }
  }

  let previousEditTitle: boolean | null = null
  $: if (editTitle && titleInputElem && previousEditTitle !== editTitle) {
    previousEditTitle = editTitle

    if (title && title !== content) {
      titleValue = title
    } else {
      titleValue = resource?.metadata?.name ?? ''
    }

    setTimeout(() => {
      titleInputElem.focus()

      // Since the elem is not a real input, we need to set the cursor to the end of the text manually
      const s = window.getSelection()
      const r = document.createRange()
      const e = titleInputElem.childElementCount > 0 ? titleInputElem.lastChild : titleInputElem
      r.setStart(e!, 1)
      r.setEnd(e!, 1)
      s?.removeAllRanges()
      s?.addRange(r)
    }, 50)
  } else if (!editTitle && previousEditTitle !== editTitle) {
    previousEditTitle = editTitle
  }

  const IFRAME_STYLES = `<style> html { font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', sans-serif; } </style>`
</script>

<div
  class="preview"
  class:interactive
  class:frame={!frameless}
  class:themed={!!theme}
  style="--color1: {theme && theme[0]}; --color2: {theme && theme[1]}"
>
  <div class="preview-card relative">
    <!-- <div class="absolute top-1 right-1 z-50 {theme ? 'text-white/50' : 'text-black/50'}">
      {mode} {type}
    </div> -->

    <div class="inner">
      {#if error}
        <div class="title">{error}</div>
        <div class="subtitle">{url}</div>
      {:else if mode === 'tiny'}
        <div class="tiny-wrapper">
          <div class="tiny-icon">
            {#if source?.imageUrl}
              <div class="favicon">
                <Image src={source.imageUrl} alt={source.text} fallbackIcon="link" />
              </div>
            {:else if source?.icon}
              <Icon name={source.icon} />
            {:else}
              <FileIcon kind={getFileKind(type)} width="100%" height="100%" />
            {/if}
          </div>

          <div class="from">
            {title || content || source?.text || author?.text || 'Untitled'}
          </div>
        </div>
      {:else}
        {#if showMedia}
          {#if image}
            <div class="image">
              {#if typeof image === 'string'}
                <Image src={image} alt={title ?? ''} emptyOnError />
              {:else}
                <ImageView blob={image} />
              {/if}
            </div>
          {:else if ![ResourceTypes.LINK, ResourceTypes.ARTICLE, ResourceTypes.POST, ResourceTypes.DOCUMENT, ResourceTypes.ANNOTATION].some( (t) => type.startsWith(t) )}
            <FilePreview {resource} preview />
          {/if}
        {/if}

        {#if showSource || (showTitle && title) || (showContent && content) || (showAuthor && author)}
          <div class="details">
            {#if showSource && mode !== 'compact' && source}
              <div class="flex items-center justify-between gap-2 overflow-hidden">
                <div class="flex-grow overflow-hidden">
                  <SourceItem {type} {source} themed={!!theme} />
                </div>

                {#if isProcessing && !(showAuthor && author && (author.text || author.imageUrl || author.icon))}
                  <div class="processing">
                    <Icon name="spinner" size="14px" />
                    <div>{processingText}</div>
                  </div>
                {/if}
              </div>
            {/if}

            {#if showTitle}
              {#if editTitle}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  class="title edit"
                  contenteditable="true"
                  placeholder="Enter title"
                  bind:this={titleInputElem}
                  bind:textContent={titleValue}
                  on:click|stopPropagation
                  on:blur={handleEditTitleBlur}
                  on:keydown={handleTitleKeydown}
                  draggable={true}
                  on:dragstart|preventDefault|stopPropagation
                ></div>
              {:else if title}
                <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
                <div
                  class="title"
                  on:dblclick|preventDefault|stopPropagation={handleTitleDoubleClick}
                  on:click|stopPropagation={handleTitleClick}
                >
                  {truncate(title, MAX_TITLE_LENGTH)}
                </div>
              {/if}
            {/if}

            {#if showAnnotations && annotations && (annotations || []).length > 0}
              {@const annotation = annotations[0]}

              <div class="annotation">
                {#if annotation.type === 'highlight'}
                  <div class="content quote">
                    <mark>
                      {truncate(annotations[0].content, MAX_CONTENT_LENGTH)}
                    </mark>
                  </div>
                {:else}
                  <div class="icon">
                    <Icon name="message" />
                  </div>
                  <div class="content">
                    {truncate(annotations[0].content, MAX_CONTENT_LENGTH)}
                  </div>
                {/if}
              </div>
            {/if}

            {#if showContent && content}
              <div class="content">
                {#if contentType === 'plain'}
                  {truncate(content, MAX_CONTENT_LENGTH)}
                {:else if contentType === 'rich_text'}
                  <Editor content={truncate(content, MAX_CONTENT_LENGTH)} readOnly />
                {:else if contentType === 'html'}
                  <iframe
                    title="Document Preview"
                    srcdoc="{IFRAME_STYLES}{content}"
                    frameborder="0"
                    sandbox=""
                  />
                {:else if contentType === 'markdown'}
                  <MarkdownRenderer content={truncate(content, MAX_CONTENT_LENGTH)} />
                {/if}
              </div>
            {/if}

            {#if showAnnotations && annotations && annotations.length > 0}
              {#if annotations.length > 1}
                <div class="annotation-info">
                  <Icon name="marker" />
                  + {annotations.length - 1} more annotation{annotations.length > 2 ? 's' : ''}
                </div>
              {:else if annotations[0].type === 'highlight'}
                <div class="annotation-info">
                  <Icon name="marker" />
                  Your Highlight
                </div>
              {/if}
            {/if}

            {#if showSource && mode === 'compact' && source && source.text}
              <div class="flex items-center gap-2 justify-between">
                <div class="flex-grow overflow-hidden">
                  {#if type === ResourceTypes.POST_YOUTUBE}
                    <SourceItem
                      {type}
                      source={{ ...source, text: author?.text || source.text }}
                      themed={!!theme}
                    />
                  {:else}
                    <SourceItem {type} {source} themed={!!theme} />
                  {/if}
                </div>

                {#if isProcessing}
                  <div class="processing">
                    <Icon name="spinner" size="14px" />
                    <div>{processingText}</div>
                  </div>
                {/if}
              </div>
            {/if}

            {#if showAuthor && author && (author.text || author.imageUrl || author.icon)}
              <div class="metadata">
                <div class="author">
                  {#if author.imageUrl}
                    <div class="favicon">
                      <Image src={author.imageUrl} alt={author.text ?? ''} emptyOnError />
                    </div>
                  {:else if author.icon}
                    <div class="favicon">
                      <Icon name={author.icon} />
                    </div>
                  {/if}

                  {#if author.text}
                    <div class="from">
                      {author.text}
                    </div>
                  {/if}
                </div>

                {#if isProcessing}
                  <div class="processing">
                    <Icon name="spinner" size="14px" />
                    <div>{processingText}</div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .preview {
    width: 100%;
    background: rgba(255, 255, 255, 0.75);
    transition: 60ms ease-out;
    position: relative;

    &.themed {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, var(--color1) 0%, var(--color2) 100%);
    }

    &.frame {
      border-radius: 16px;
      border: 1px solid rgba(228, 228, 228, 0.75);
      box-shadow:
        0px 1px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 1px 0px rgba(0, 0, 0, 0.25);

      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }

  .frame .preview-card {
    padding: 0.65em;
  }

  .preview-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1em;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;

    &.loading {
      padding: 0 !important;
    }
  }

  .inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
  }

  .tiny-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.5em;
    font-weight: 500;
    color: #281b53;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.75em;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
    padding: 1em;
  }

  .themed {
    .title,
    .content,
    .from,
    .from,
    .processing {
      color: #ffffff;
      opacity: 1;
    }
  }

  .favicon {
    flex-shrink: 0;
    width: 1.25em;
    height: 1.25em;
    border-radius: 5.1px;
    color: #281b53;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .processing {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.85em;
    font-weight: 500;
    color: #7e7696;
    padding-left: 1em;
  }

  .author {
    display: flex;
    align-items: center;
    gap: 0.5em;
    overflow: hidden;
  }

  .from {
    font-size: 1em;
    font-weight: 500;
    text-decoration: none;
    color: #281b53;
    opacity: 0.65;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .author .from {
    font-size: 0.85em;
  }

  .tiny-icon {
    flex-shrink: 0;
    color: #281b53;
    width: 1.25em;
    height: 1.25em;
  }

  .image {
    width: 100%;
    max-height: 300px;
    position: relative;
    overflow: hidden;
    border-radius: 0.5em;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
  }

  .interactive .title {
    cursor: pointer;
    pointer-events: unset;
  }

  .title {
    font-size: 1.25em;
    line-height: 1.775em;
    letter-spacing: 0.02em;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    overflow-wrap: break-word;
    pointer-events: none;

    &.edit {
      outline: none;
      border-radius: 5px;
      background: transparent;
      width: 100%;
      max-height: 16rem;
      overflow: auto;

      &:focus {
        outline: 2px solid rgba(65, 128, 173, 0.851);
        outline-offset: 3px;
      }

      &:empty:before {
        content: attr(placeholder);
        pointer-events: none;
        display: block; /* For Firefox */
        opacity: 0.5;
      }
    }
  }

  .content {
    font-size: 1em;
    line-height: 1.5em;
    color: #281b53;
    letter-spacing: 0.02em;
    font-weight: 400;
    flex-shrink: 0;
    max-width: 95%;
    overflow-wrap: break-word;
    hyphens: auto;

    mark {
      background-color: rgb(238, 229, 251);
      color: #1c1c3b;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: none;
      user-select: none;
      pointer-events: none;
    }
  }

  .annotation {
    display: flex;
    align-items: flex-start;
    gap: 0.5em;
    font-size: 0.85em;
    color: #281b53;

    .icon {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  .annotation-info {
    font-size: 0.85em;
    color: #281b53;
    opacity: 0.65;
    display: flex;
    align-items: center;
    gap: 0.25em;
  }

  .metadata {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
  }
</style>
