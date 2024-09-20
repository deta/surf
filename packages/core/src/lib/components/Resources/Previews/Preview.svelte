<script lang="ts" context="module">
  export type Source = {
    text: string
    imageUrl?: string
    icon?: Icons
  }

  export type Author = {
    text?: string
    imageUrl?: string
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

  export let resource: Resource

  export let type: string
  export let title: string | undefined = undefined
  export let image: string | Blob | undefined = undefined
  export let content: string | undefined = undefined
  export let contentType: ContentType = 'plain'
  export let annotations: Annotation[] | undefined = undefined
  export let url: string | undefined = undefined
  export let source: Source
  export let author: Author | undefined
  export let theme: [string, string] | undefined

  export let mode: Mode = 'full'

  const log = useLogScope('PostPreview')

  let error = ''

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

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }
</script>

<div
  class="preview"
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
            {#if source.imageUrl}
              <img class="favicon" src={source.imageUrl} alt={source.text} />
            {:else if source.icon}
              <Icon name={source.icon} />
            {:else}
              <FileIcon kind={getFileKind(type)} width="100%" height="100%" />
            {/if}
          </div>

          <div class="from">
            {title || content || source.text}
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
              <SourceItem {type} {source} themed={!!theme} />
            {/if}

            {#if showTitle && title}
              <div class="title">
                {truncate(title, MAX_TITLE_LENGTH)}
              </div>
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
                  <iframe title="Document Preview" srcdoc={content} frameborder="0" sandbox="" />
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
              <SourceItem {type} {source} themed={!!theme} />
            {/if}

            {#if showAuthor && author && author.text}
              <div class="metadata">
                <div class="author">
                  {#if author.imageUrl}
                    <img class="favicon" src={author.imageUrl} alt={author.text} />
                  {/if}

                  <div class="from">
                    {author.text}
                  </div>
                </div>
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

    &.themed {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, var(--color1) 0%, var(--color2) 100%);
    }
  }

  .preview-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.65rem;
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
    gap: 0.5rem;
    padding: 0.5rem;
    font-weight: 500;
    color: #281b53;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
    padding: 1rem;
  }

  .themed {
    .title,
    .content,
    .from,
    .from {
      color: #ffffff;
      opacity: 1;
    }
  }

  .favicon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .author {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .from {
    font-size: 1rem;
    font-weight: 500;
    text-decoration: none;
    color: #281b53;
    opacity: 0.65;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .author .from {
    font-size: 0.85rem;
  }

  .tiny-icon {
    flex-shrink: 0;
    color: #281b53;
    width: 1.25rem;
    height: 1.25rem;
  }

  .image {
    width: 100%;
    max-height: 300px;
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
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

  .title {
    font-size: 1.25rem;
    line-height: 1.775rem;
    letter-spacing: 0.02rem;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
  }

  .content {
    font-size: 1rem;
    line-height: 1.5rem;
    color: #281b53;
    letter-spacing: 0.02rem;
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
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #281b53;

    .icon {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  .annotation-info {
    font-size: 0.85rem;
    color: #281b53;
    opacity: 0.65;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .metadata {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
</style>
