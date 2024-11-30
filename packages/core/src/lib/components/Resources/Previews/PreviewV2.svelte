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

  export type ContentMode =
    | 'full' // Try to show all available content
    | 'media' // Try to only show media if available
    | 'compact' // Try to condense the content into smaller space
    | 'inline' // Try to fit everything into a horizonal layout
  export type ViewMode =
    | 'card' // Layout with auto height based on content size
    | 'responsive' // Layout filling max available width & height
    | 'inline'
  export type Origin = 'stuff' | 'stack' | 'homescreen' | 'homescreen-space'
  export type ContentType = 'plain' | 'rich_text' | 'html' | 'markdown'

  export type Annotation = {
    type: 'highlight' | 'comment'
    content: string
  }

  export type PreviewData = {
    title?: string
    media?: string | Blob
    content?: string
    contentType?: ContentType
    annotations?: Annotation[]

    url?: string

    metadata?: {
      text?: string
      icon?: Icons
      imageUrl?: string
    }[]

    status?: {
      type: 'processing' | 'static'
      icon?: Icons
      text?: string
    }
  }
</script>

<script lang="ts">
  /**
   * Our new Resource preview has 3 big sections:
   * 1. Media
   * 2. Content
   * 3. Metadata
   *
   * Any section can be hidden by setting its props to undefined.
   * NOTE: The content section is a bit more involved, as it can also show up, if e.g. annotations exist.
   */
  import { getFileKind, truncate } from '@horizon/utils'
  import { type Resource } from '@horizon/core/src/lib/service/resources'
  import ImageView from './File/ImageView.svelte'
  import { Icon, type Icons } from '@horizon/icons'
  import Image from '../../Atoms/Image.svelte'
  import FileIcon from './File/FileIcon.svelte'
  import { Editor } from '@horizon/editor'
  import MarkdownRenderer from '@horizon/editor/src/lib/components/MarkdownRenderer.svelte'
  import { ResourceTypes } from '@horizon/types'
  import FilePreview from './File/FilePreview.svelte'
  import { createEventDispatcher } from 'svelte'
  import TextResource from './Text/TextResource.svelte'
  import { useConfig } from '../../../service/config'

  const config = useConfig()
  const userConfig = config.settings

  export let resource: Resource
  export let type: string
  export let viewMode: ViewMode = 'card'

  export let origin: Origin = 'stuff'
  export let interactive: boolean = false

  export let title: string | undefined = undefined
  export let titleValue: string = ''
  export let editTitle: boolean = false

  export let media: string | Blob | undefined = undefined
  export let content: string | undefined = undefined
  export let contentType: ContentType | undefined = undefined
  export let annotations: Annotation[] | undefined = undefined
  export let url: string | undefined = undefined
  export let metadata:
    | { text: string | undefined; icon: string | undefined; imageUrl: string | undefined }[]
    | undefined = undefined

  export let status: 'processing' | 'static' | undefined = undefined
  export let statusText: string | undefined = undefined

  const resourceState = resource.state

  let hideProcessing = false

  $: isDarkMode = $userConfig.app_style === 'dark'
  $: IFRAME_STYLES = `<style> html { ${isDarkMode ? 'color: #fff !important;' : ''} font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', sans-serif; } </style>`

  const MAX_TITLE_LENGTH = 100
  const MAX_CONTENT_LENGTH = 500

  const LOADING_PHRASES = [
    'Summoning the goodies',
    'Decoding the secrets',
    'Filling in the blanks',
    'Loading the good stuff',
    'Extracting the essence',
    'Surfing the data',
    'Unpacking details'
  ]
  const randomPhrase = () => LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]

  const dispatch = createEventDispatcher<{
    'edit-title': string
    'start-edit-title': void
    click: MouseEvent
  }>()

  // Editing title
  let titleInputEl: HTMLElement
  const handleEditTitleBlur = () => dispatch('edit-title', titleValue)

  $: isProcessing =
    (status === 'processing' && !hideProcessing) ||
    ($resourceState === 'post-processing' && !hideProcessing)
  // $: failedProcessing = ($isDebugModeEnabled || failedText) && $resourceState === 'error'*/

  const handleTitleDoubleClick = () => dispatch('start-edit-title')

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
  $: if (editTitle && titleInputEl && previousEditTitle !== editTitle) {
    previousEditTitle = editTitle

    if (title && title !== content) {
      titleValue = title
    } else {
      titleValue = resource?.metadata?.name ?? ''
    }

    setTimeout(() => {
      titleInputEl.focus()

      // Since the elem is not a real input, we need to set the cursor to the end of the text manually
      const s = window.getSelection()
      const r = document.createRange()
      const e = titleInputEl.childElementCount > 0 ? titleInputEl.lastChild : titleInputEl
      r.setStart(e!, 1)
      r.setEnd(e!, 1)
      s?.removeAllRanges()
      s?.addRange(r)
    }, 50)
  } else if (!editTitle && previousEditTitle !== editTitle) {
    previousEditTitle = editTitle
  }

  /** Prettyfies any input source string which can be a name, a partial or full url and some special
   * hard coded replacements.
   * e.g:
   *   - x.com -> Twitter
   *   - youtube.com. -> YouTube
   *   - giothub.com -> GitHub
   */
  function prettifySourceUrl(str: string): string {
    let out = str
    // Common app replacementsd
    if (out.includes('x.com')) out = 'Twitter'
    else if (out.includes('github.')) out = 'GitHub'

    // Replace raw URL
    if (str.includes('://')) {
      const url = new URL(str)
      out = `${url.hostname.split('.').at(-2)} ${url.hostname.split('.').at(-1)}`
      //if (url.)
    }

    // Common TLDR replacements
    if (out.startsWith('www.')) out = `${out.split('.').slice(1).join('.')}`
    if (out.endsWith('.com')) out = `${out.split('.').slice(0, -1).join('.')}`
    if (out.endsWith('.so')) out = `${out.split('.').slice(0, -1).join('.')}`
    if (out.endsWith('.io')) out = `${out.split('.').slice(0, -1).join('.')}`
    if (out.endsWith('.org')) out = `${out.split('.').slice(0, -1).join('.')}`
    if (out.endsWith('.de')) out = `${out.split('.').slice(0, -1).join('.')}`
    // www.adamho.com

    // www.expanded.art
    // www.outkast.studio
    // https://read.cv/explore

    // Capitalize
    //if (out.includes('.')) return out
    if (out.includes('.')) out = out.split('.').join(' ')
    return `${out
      .split(' ')
      .map((e) => `${e.charAt(0).toUpperCase()}${e.slice(1)}`)
      .join(' ')}`
  }

  // HACK: Customization for compact view
  /*if (source?.text) source.text = prettifySourceUrl(source.text)
  if (mode === 'compact') {
    if (resource.type === ResourceTypes.POST_YOUTUBE) {
      // FIX: Place author first place
      if (author?.text !== undefined) title = author.text
      if (author?.icon !== undefined) source.icon = author.icon
      if (author?.imageUrl !== undefined) source.imageUrl = author.imageUrl
      author = undefined
    }
  }*/

  // States
  $: showMediaBlock =
    media !== undefined ||
    ![
      ResourceTypes.LINK,
      ResourceTypes.ARTICLE,
      ResourceTypes.POST,
      ResourceTypes.DOCUMENT,
      ResourceTypes.ANNOTATION
    ].some((t) => type.startsWith(t))

  $: showContentBlock =
    (content && content.length > 0) ||
    (title && title.length > 0) ||
    (annotations && annotations.length > 0)

  $: showMetadataBlock = (metadata && metadata.length > 0) || isProcessing
</script>

<div
  class="preview view-{viewMode}"
  data-resource-type={type}
  data-resource-id={resource.id}
  class:interactive
  class:processing={isProcessing}
>
  <div class="inner">
    {#if showMediaBlock}
      <div class="media" class:processing={isProcessing} class:og={!type.startsWith('image/')}>
        {#if media}
          {#if typeof media === 'string'}
            <Image src={media} alt={title ?? ''} emptyOnError />
          {:else}
            <ImageView blob={media} />
          {/if}
        {:else if ![ResourceTypes.LINK, ResourceTypes.ARTICLE, ResourceTypes.POST, ResourceTypes.DOCUMENT, ResourceTypes.ANNOTATION].some( (t) => type.startsWith(t) )}
          <FilePreview {resource} preview />
        {/if}
      </div>
    {/if}

    {#if showContentBlock}
      <hgroup class="content">
        {#if title && title.length > 0}
          {#if editTitle}
            <h1
              contenteditable
              placeholder="Edit Title"
              spellcheck="false"
              bind:this={titleInputEl}
              bind:textContent={titleValue}
              on:click|stopPropagation
              on:blur={handleEditTitleBlur}
              on:keydown={handleTitleKeydown}
              draggable
              on:dragstart|preventDefault|stopPropagation={() => {}}
            >
              {title}
            </h1>
          {:else}
            <h1
              on:dblclick|preventDefault|stopPropagation={handleTitleDoubleClick}
              on:click|stopPropagation={handleTitleClick}
            >
              {title}
            </h1>
          {/if}
        {/if}

        {#if content && content.length > 0}
          {@const content = content}
          {@const contentType = contentType}
          {#if contentType === 'plain'}
            <p>
              {truncate(content, MAX_CONTENT_LENGTH)}
            </p>
          {:else if contentType === 'rich_text'}
            {#if origin === 'homescreen'}
              <TextResource
                resourceId={resource.id}
                autofocus={false}
                showTitle={false}
                on:click={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                on:dragstart={(e) => {
                  // TODO: proper prevention
                  if (['#text', 'p'].includes(e.target?.nodeName.toLowerCase())) {
                    e.preventDefault()
                    e.stopPropagation()
                  }
                }}
              />
            {:else}
              <Editor content={truncate(content, MAX_CONTENT_LENGTH)} readOnly />
            {/if}
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
        {/if}

        <!-- Annotations -->
        {#if annotations && annotations.length > 0}
          {@const annotation = annotations[0]}

          <div class="annotation">
            {#if annotation.type === 'highlight'}
              <p class="content quote">
                <mark>
                  {truncate(annotations[0].content, MAX_CONTENT_LENGTH)}
                </mark>
              </p>
            {:else}
              <div class="icon">
                <Icon name="message" size="1.15em" />
              </div>
              <div class="content">
                {truncate(annotations[0].content, MAX_CONTENT_LENGTH)}
              </div>
            {/if}
          </div>

          {#if annotations && annotations.length > 0}
            {#if annotations.length > 1}
              <div class="annotation-info">
                <Icon name="marker" size="1.15em" />
                + {annotations.length - 1} more annotation{annotations.length > 2 ? 's' : ''}
              </div>
            {:else if annotations[0].type === 'highlight'}
              <div class="annotation-info">
                <Icon name="marker" size="1.15em" />
                Your Highlight
              </div>
            {/if}
          {/if}
        {/if}
      </hgroup>
    {/if}

    {#if showMetadataBlock}
      <hgroup class="metadata">
        {#if isProcessing}
          <div class="source">
            {#if status !== 'static'}<Icon name="spinner" size="12px" />{/if}
            <span>{statusText === undefined ? randomPhrase() : statusText}</span>
          </div>
        {/if}
        {#if metadata?.length === 1 && !isProcessing}
          {@const pill = metadata[0]}
          <div class="source" style="width: 100%;justify-content: space-between;">
            {#if pill.imageUrl}
              <Image
                src={pill.imageUrl}
                alt={pill.text ?? ''}
                emptyOnError
                fallbackIcon="link"
                class="favicon"
              />
            {:else if pill.icon}
              <div class="favicon">
                <Icon name={pill.icon} size="100%" />
              </div>
            {:else}
              <div class="favicon">
                <FileIcon kind={getFileKind(type)} width="100%" height="100%" />
              </div>
            {/if}
            {#if pill.text}
              <span style="order: -1;">{pill.text}</span>
            {/if}
          </div>
        {:else}
          {#each metadata ?? [] as pill}
            <div class="source">
              {#if pill.imageUrl}
                <Image
                  src={pill.imageUrl}
                  alt={pill.text ?? ''}
                  emptyOnError
                  fallbackIcon="link"
                  class="favicon"
                />
              {:else if pill.icon}
                <div class="favicon">
                  <Icon name={pill.icon} size="100%" />
                </div>
              {:else}
                <div class="favicon">
                  <FileIcon kind={getFileKind(type)} width="100%" height="100%" />
                </div>
              {/if}
              {#if pill.text}
                <span>{pill.text}</span>
              {/if}
            </div>
          {/each}
        {/if}
        <!--{#if isProcessing}
            <hgroup class="status">
              {#if failedText}
                <span class="failed text-red-700">{failedText ?? 'Error'}</span>
              {:else}
                <span
                  ><Icon name="spinner" size="12px" />{processingText === undefined
                    ? randomPhrase()
                    : processingText}</span
                >
              {/if}
            </hgroup>
          {:else}
            {#if titleBottom}
              <div class="page-title">
                <span>{title}</span>
              </div>
            {/if}
            {#if source}
              <div class="source">
                {#if source.imageUrl}
                  <Image
                    src={source.imageUrl}
                    alt={source.text}
                    emptyOnError
                    fallbackIcon="link"
                    class="favicon"
                  />
                {:else if source.icon}
                  <div class="favicon">
                    <Icon name={source.icon} />
                  </div>
                {:else}
                  <div class="favicon">
                    <FileIcon kind={getFileKind(type)} width="100%" height="100%" />
                  </div>
                {/if}
                <span>{source.text}</span>
              </div>
            {/if}
            {#if source && author?.text}
              <!--<span class="separator">//</span>--
              <span class="separator">•</span>
            {/if}
            {#if author}
              <div class="author">
                {#if author.imageUrl}
                  <Image
                    src={author.imageUrl}
                    alt={author.text ?? ''}
                    emptyOnError
                    class="favicon"
                  />
                {:else if author.icon}
                  <div class="favicon">
                    <Icon name={author.icon} />
                  </div>
                {/if}

                {#if author.text}
                  <span>{author.text}</span>
                {/if}
              </div>
            {/if}
          {/if}-->
      </hgroup>
    {/if}
  </div>
</div>

<style lang="scss">
  /// Rest overrides from old previews throughout the app
  :global(article.preview) {
    padding: 0 !important;

    :global(.file-card) {
      border-radius: 0;
    }
  }
  :global(.preview img) {
    border-radius: 0;
  }

  .preview {
    width: 100%;
    height: 100%;

    /// Global overrides
    :global(.favicon) {
      --size: 1.25em;
      width: var(--size);
      height: var(--size);
      max-width: var(--size);
      flex-shrink: 0;
    }

    .inner .media {
      position: relative;
      z-index: 0;
    }

    &.processing > .inner .media::after {
      content: '';
      position: absolute;
      z-index: 2;
      inset: 0;
      background: radial-gradient(rgba(255, 255, 255, 0.1) 30%, rgba(255, 255, 255, 1));
      backdrop-filter: blur(12px);
      mask: radial-gradient(circle, rgba(0, 0, 0, 0.22) 0%, rgba(0, 0, 0, 0.9) 80%);
      mask-position: center;
      mix-blend-mode: lighten;
      mask-repeat: no-repeat;
      animation: breathing-blur 2.5s infinite ease-in-out;
    }

    > .inner {
      p {
        margin: 0;
        font-weight: 400;
      }
      h1 {
        margin: 0;
      }
      hgroup {
        padding-inline: var(--section-padding-inline);
      }
      > hgroup:first-child {
        margin-top: var(--section-padding-block);
      }
      > hgroup:last-child {
        margin-bottom: var(--section-padding-block);
      }

      display: flex;
      flex-direction: column;
      gap: calc(var(--section-padding-block, 0.9em) - 0.4em);

      .media {
        position: relative;
        z-index: 0;
        flex-grow: 1;
        flex-shrink: 1;
        overflow: hidden;
        &:has(+ *) {
          margin-bottom: 0.2em;
        }

        // TODO: Hovering title / metadata
        /*&::after {
          content: 'File name.jpg';
          position: absolute;
          --offset: 1.25em;
          bottom: calc(var(--offset) - 0.25em);
          left: var(--offset);
          z-index: 10;
          color: #fff;

          font-weight: 500;
          mix-blend-mode: exclusion;
        }*/

        :global(img) {
          width: 100%;
          height: auto;
        }

        &.og :global(img) {
          max-height: 30em;
          object-fit: cover;
        }
      }

      &:has(.content):has(.metadata):not(:has(.media)):not(:has(.content > p)) > .content {
        margin-bottom: -0.5em;
      }

      .content:has(.annotation-info) {
        gap: 0.4em;
      }

      .content,
      .annotation {
        display: flex;
        flex-direction: column;
        gap: 0.1em;
        flex-grow: 1;

        > h1 {
          width: fit-content;
          max-width: 100%;

          font-weight: 550;
          font-size: 1.25em;
          line-height: 1.475em;
          letter-spacing: 0.02em;

          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: var(--MAX_title_lines, 4);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow-wrap: break-word;
          text-wrap: balance;
          margin-bottom: 0.15em;
          border-bottom: 1px solid transparent;
          transition: border-bottom 125ms ease;

          // TODO: Remove pointer events when not interactive
          pointer-events: none;
          //:global(.interactive) & {
          pointer-events: unset;
          //}

          &:hover {
            border-bottom: 1px dashed rgba(50, 50, 50, 0.2);
            :global(.dark) & {
              border-color: rgba(255, 255, 255, 0.4);
            }
          }
          &:focus,
          &:active {
            outline: none;
            border: none;
            border-bottom: 1px dashed rgba(50, 50, 50, 0.75);
            cursor: text;

            :global(.dark) & {
              border-color: rgba(255, 255, 255, 0.75);
            }
          }

          &:empty:before {
            content: attr(placeholder);
            pointer-events: none;
            display: block; /* For Firefox */
            opacity: 0.5;
          }
        }
        > p {
          font-size: 1em;
          line-height: 1.425em;
          letter-spacing: 0.014em;
          opacity: 0.9;

          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: var(--MAX_content_lines, 4);
          overflow-wrap: break-word;
          text-wrap: pretty;
        }

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

      .metadata {
        display: flex;
        justify-content: space-between;
        width: 100%;
        /*border-top: 2px dotted #eee;
      padding-top: 0.75em;*/

        gap: 0.35em;
        align-items: center;

        .separator {
          font-size: 0.8em;
          opacity: var(--text-muted-opacity);
        }
      }

      .source,
      .status {
        order: 0;
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-size: 0.9em;
        max-width: 100%;
        width: min-content;

        > :global(img) {
          border-radius: 0.3em;
        }
        > span {
          font-weight: 500;
          letter-spacing: 0.2px;
          opacity: var(--text-muted-opacity);

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      }

      .annotation {
      }
      .annotation-info {
        display: flex;
        align-items: center;
        font-size: 0.9em;
        gap: 0.5em;
      }

      .status {
        width: 100%;
        padding: 0;
        &:not(:has(.failed)) {
          animation: breathe 1.75s infinite ease;
        }
        > span {
          font-size: 0.9em;

          display: flex;
          align-items: center;
          gap: 0.5em;
        }
        margin-top: 0em;
      }

      .author,
      .page-title {
        order: 1;
        display: flex;
        align-items: center;
        gap: 0.5em;
        max-width: 100%;
        width: min-content;

        > :global(img) {
          border-radius: 0.3em;
        }
        > span {
          font-size: 0.9em;
          font-weight: 500;
          letter-spacing: 0.2px;
          opacity: var(--text-muted-opacity);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    &.view-inline {
      min-height: 10ch;

      > .inner {
        flex-direction: row !important;
        align-items: center;

        > .media {
          max-width: 15ch;
          width: 100%;
          max-height: 75px;
          :global(img) {
            height: 100%;
            object-fit: cover;
          }
        }
        > .content {
          --MAX_title_lines: 2;
          height: 100%;
        }

        > .metadata {
          max-width: 20ch;
          margin-bottom: 0;
        }

        > .metadata {
          margin-bottom: calc(var(--section-padding-block) - 0.3em) !important;
        }
      }
    }

    &.content-compact {
      gap: 0.8em;
      --section-padding-block: 0.8em;

      &:has(.page-title) {
        .metadata {
          justify-content: space-between;
        }
        .page-title {
          order: -1;
          flex-shrink: 1;
          flex-grow: 1;
          max-width: 80%;
        }
        .source {
          flex-shrink: 0;
          > span {
            display: none;
          }
        }
      }
      &:not(:has(.page-title)) {
        .source {
          width: 100%;
          justify-content: space-between;
          > :global(.favicon) {
            order: 2;
          }
        }
      }
    }

    :global(article.content-responsive) & {
      > .inner {
        height: 100%;
        .media {
          height: 100%;
          :global(img) {
            height: 100%;
            width: 100%;
            object-fit: cover;
            max-height: unset !important;
          }
        }
      }
    }

    &.view-responsive {
      container: preview-card / size;
      width: 100% !important;
      height: 100% !important;

      > .inner {
        .media {
          :global(img) {
            max-height: unset !important;
            height: 100%;
          }
        }
      }

      @container preview-card (height < calc(50px * 3 + 2 * 10px)) {
        &:not(.content-media):has(.content) {
          .media {
            //display: none !important;
          }
        }
      }

      @container preview-card (height <= calc(50px * 1 + 0 * 10px)) {
        .inner {
          flex-direction: row;
          gap: 0.2em;

          .media {
            flex-shrink: 0;
            flex-grow: 0;
            width: fit-content;
            :global(img) {
              height: 100%;
              width: auto;
            }
          }
          .content {
            width: fit-content;
            justify-content: center;
            flex-grow: 1;
            flex-shrink: 1;
            > h1 {
              font-size: 0.95em;
              max-width: 100%;
              //white-space: nowrap;
            }
            > p {
              display: none;
            }
          }

          .metadata {
            flex-shrink: 0;
            width: fit-content;
            height: 100%;
          }
        }
      }
    }
  }

  // HACK:
  /// Make notion show more of the content

  // HACK: Need to fix properly
  :global([data-resource-type='application/vnd.space.document.space-note']) {
    :global(.content > .wrapper) {
      padding: 0;
      :global(.content) {
        padding: 0;
        padding-top: 1em;
        padding-inline: 0.25em;
      }

      :global(*) {
        user-select: none !important;
      }
    }
  }

  @keyframes breathe {
    0% {
      opacity: 0.8;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 0.8;
    }
  }
  @keyframes breathing-blur {
    0% {
      mask-size: 190%;
    }
    50% {
      mask-size: 125%;
    }
    100% {
      mask-size: 190%;
    }
  }

  /////////// Responsive Mode overrides
  // Not setting them when not in preview mode will nuke Masonry.

  /* @container preview-card (aspect-ratio > 1 / 1) {
    .preview.view-responsive {
      flex-direction: row !important;
      height: 100%;

      .media {
        max-width: 40%;

        > :global(img) {
          height: 100% !important;
          object-fit: cover;
        }
      }
    }
  }

  @container preview-card (aspect-ratio <= 1 / 1) {
    .preview.view-responsive {
      .media {
        height: 100%;

        > :global(img) {
          height: 100% !important;
          object-fit: cover;
        }
      }
    }
  }*/
</style>
