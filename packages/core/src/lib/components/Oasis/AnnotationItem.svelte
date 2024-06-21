<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import { useLogScope } from '../../utils/log'
  import type { ResourceAnnotation } from '../../service/resources'
  import type {
    AnnotationCommentData,
    AnnotationRangeData,
    ResourceDataAnnotation
  } from '../../types'
  import type { ResourcePreviewEvents } from '../Resources/events'
  import { Icon } from '@horizon/icons'
  import type { WebViewEventAnnotation } from '@horizon/types'
  import { getHumanDistanceToNow } from '../../utils/time'
  import { tooltip } from '@svelte-plugins/tooltips'
  import { useClipboard } from '../../utils/clipboard'
  import { truncate } from '../../utils/text'
  import { addISOWeekYears } from 'date-fns'
  import { Editor, getEditorContentText } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  export let resource: ResourceAnnotation
  export let active = false
  export let background = true

  const log = useLogScope('AnnotationItem')
  const dispatch = createEventDispatcher<{
    scrollTo: WebViewEventAnnotation
    delete: WebViewEventAnnotation
  }>()

  let annotation: ResourceDataAnnotation | null = null
  let content = ''
  let anchorText = ''
  let error = ''
  let url: URL
  let elem: HTMLDivElement
  let expandedAnchor = false
  let loadingAnnotation = false

  const { copy, copied } = useClipboard()

  $: if (active) {
    elem.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }

  $: MAX_ANCHOR_TEXT_LENGTH = annotation && annotation.type === 'highlight' ? 500 : 75
  $: truncateAnchorText = anchorText.length > MAX_ANCHOR_TEXT_LENGTH
  $: source =
    annotation?.type === 'comment' ? (annotation.data as AnnotationCommentData).source : null

  const handleScrollTo = () => {
    if (!annotation) return
    dispatch('scrollTo', { id: resource.id, data: annotation })
  }

  const handleDelete = () => {
    if (!annotation) return
    dispatch('delete', { id: resource.id, data: annotation })
  }

  const handleCopy = () => {
    if (!annotation) return
    copy(content || anchorText || '')
  }

  onMount(async () => {
    try {
      loadingAnnotation = true
      annotation = await resource.getParsedData(true)

      if (annotation.anchor?.type === 'range') {
        anchorText = (annotation.anchor.data as AnnotationRangeData).content_plain || ''
      }

      if (annotation.type === 'comment') {
        const data = annotation.data as AnnotationCommentData

        if ((data as any).content) {
          content = (data as any).content

          await resource.updateParsedData({
            ...annotation,
            data: {
              ...data,
              content_html: content,
              content_plain: getEditorContentText(content)
            }
          })

          return
        }

        content = data.content_html ?? data.content_plain ?? ''
      }

      url = new URL(resource.metadata?.sourceURI || '')
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    } finally {
      loadingAnnotation = false
    }
  })

  onDestroy(() => {
    log.debug('Releasing data')
    // resource.releaseData()
  })
</script>

<div class="link-card" bind:this={elem} class:active class:background>
  <!-- <a href={document?.url} target="_blank" class="link-card"> -->

  <div class="details">
    {#if error}
      <div class="title">{error}</div>
    {:else if annotation}
      {#if anchorText}
        <div class="anchor-text">
          {#if expandedAnchor || !truncateAnchorText}
            {anchorText}
          {:else}
            {truncate(anchorText, MAX_ANCHOR_TEXT_LENGTH)}
          {/if}
        </div>
      {/if}

      {#if content}
        <div class="content">
          <Editor {content} readOnly />
        </div>
      {/if}

      <div class="footer">
        <div
          class="metadata"
          use:tooltip={{
            content: 'Annotation Source',
            action: 'hover',
            position: 'top',
            animation: 'fade',
            delay: 500
          }}
        >
          {#if annotation.type === 'highlight'}
            <Icon name="marker" />
            <div class="from">Page Highlight - {getHumanDistanceToNow(resource.updatedAt)}</div>
          {:else if annotation.type === 'comment'}
            <Icon name="message" />
            <div class="from">
              {#if source === 'inline_ai'}
                Inline Page AI
              {:else if source === 'chat_ai'}
                Page Chat AI
              {:else}
                Comment
              {/if}

              - {getHumanDistanceToNow(resource.updatedAt)}
            </div>
          {:else}
            <Icon name="link" />
            <div class="from">Link</div>
          {/if}
        </div>

        <div class="actions">
          {#if annotation.anchor}
            <button
              on:click={handleScrollTo}
              use:tooltip={{
                content: 'View in Page',
                action: 'hover',
                position: 'left',
                animation: 'fade',
                delay: 500
              }}
            >
              <Icon name="eye" />
            </button>
          {/if}

          {#if truncateAnchorText}
            {#if expandedAnchor}
              <button
                on:click={() => (expandedAnchor = false)}
                use:tooltip={{
                  content: 'Collapse Highlight',
                  action: 'hover',
                  position: 'left',
                  animation: 'fade',
                  delay: 500
                }}
              >
                <Icon name="text-collapse" />
              </button>
            {:else}
              <button
                on:click={() => (expandedAnchor = true)}
                use:tooltip={{
                  content: 'Expand Highlight',
                  action: 'hover',
                  position: 'left',
                  animation: 'fade',
                  delay: 500
                }}
              >
                <Icon name="line-height" />
              </button>
            {/if}
          {/if}

          <button
            on:click={handleCopy}
            use:tooltip={{
              content: 'Copy Text',
              action: 'hover',
              position: 'left',
              animation: 'fade',
              delay: 500
            }}
          >
            {#if $copied}
              <Icon name="check" />
            {:else}
              <Icon name="copy" />
            {/if}
          </button>

          <button
            on:click={handleDelete}
            use:tooltip={{
              content: 'Remove Annotation',
              action: 'hover',
              position: 'left',
              animation: 'fade',
              delay: 500
            }}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
    {:else if loadingAnnotation}
      <div class="loading">
        <Icon name="spinner" />
        <div>Loading...</div>
      </div>
    {:else}
      <div>Annotation not found</div>
    {/if}
  </div>
</div>

<style lang="scss">
  .link-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    color: inherit;
    text-decoration: none;
    border-radius: 8px;
    border-bottom: 1px solid #f0f0f0;

    &:hover .actions {
      opacity: 1;
    }

    &.background {
      background: #f8f7f2;
      border-bottom: none;
    }
  }

  .link-card.active {
    background: #ffd9ef;
    border-radius: 5px;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
  }

  .favicon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .content {
    color: #000000;
    flex-shrink: 0;
    max-width: 95%;
    width: 100%;
    height: 100%;
  }

  :global(.tiptap p) {
    font-size: 1.1rem !important;
    color: #000000 !important;
  }

  .anchor-text {
    font-size: 1rem;
    line-height: 1.5rem;
    color: #3c3949;
    flex-shrink: 0;
    border-left: 3px solid #ff9cca;
    padding-left: 1rem;
    background: #ff9cca21;
    padding: 0.55rem;
    padding-left: 1rem;
    cursor: pointer;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #110a2a9e;

    button {
      background: none;
      border: none;
      color: inherit;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
    }
  }

  .metadata {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .from {
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;

    button {
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.75;

      &:hover {
        opacity: 1;
      }
    }
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }
</style>
