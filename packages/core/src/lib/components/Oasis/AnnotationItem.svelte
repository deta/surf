<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'

  import {
    useLogScope,
    getHumanDistanceToNow,
    useClipboard,
    truncate,
    useDebounce
  } from '@horizon/utils'
  import type { ResourceAnnotation } from '../../service/resources'
  import type {
    AnnotationCommentData,
    AnnotationRangeData,
    ResourceDataAnnotation
  } from '../../types'
  import { Icon } from '@horizon/icons'
  import type { WebViewEventAnnotation } from '@horizon/types'
  import { tooltip } from '@svelte-plugins/tooltips'
  import { Editor, getEditorContentText } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'
  import { useToasts } from '../../service/toast'
  import { slide } from 'svelte/transition'

  export let resource: ResourceAnnotation
  export let active = false
  export let background = true

  const log = useLogScope('AnnotationItem')
  const dispatch = createEventDispatcher<{
    scrollTo: WebViewEventAnnotation
    delete: string
    update: ResourceDataAnnotation
  }>()
  const toast = useToasts()

  let annotation: ResourceDataAnnotation | null = null
  let content = ''
  let anchorText = ''
  let error = ''
  let elem: HTMLDivElement
  let expandedAnchor = false
  let loadingAnnotation = false
  let didSaveContent = false
  let showCommentBox = false

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
    dispatch('delete', resource.id)
  }

  const handleCopy = () => {
    if (!annotation) return
    toast.success('Annotation copied to clipboard!')
    copy(content || anchorText || '')
  }

  const handleShowAddComment = () => {
    showCommentBox = !showCommentBox
  }

  const handleContentUpdate = useDebounce(async (e: CustomEvent<string>) => {
    const html = e.detail
    const text = getEditorContentText(html)

    await resource.updateParsedData({
      ...annotation!,
      data: {
        ...annotation!.data,
        content_html: html,
        content_plain: text
      }
    })

    dispatch('update', annotation!)

    didSaveContent = true
    setTimeout(() => {
      didSaveContent = false
    }, 3000)
  }, 500)

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
    } catch (e) {
      log.error(e)
      if (e instanceof Error) {
        error = 'Failed to load annotation: ' + e.message
      } else {
        error = 'Failed to load annotation'
      }
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
  <div class="details">
    {#if error}
      <div class="error">
        <p>
          {error}
        </p>

        <button on:click={handleDelete}>
          <Icon name="trash" />
          Delete Annotation
        </button>
      </div>
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

      {#if content || showCommentBox}
        <div class="content">
          <Editor
            bind:content
            on:update={handleContentUpdate}
            parseHashtags
            autofocus={false}
            placeholder="Jot down your thoughts…"
          />
        </div>
      {/if}

      <div class="footer">
        {#if didSaveContent}
          <div class="success">
            <Icon name="check" />
            <p>Saved!</p>
          </div>
        {:else}
          <div class="metadata">
            <div class="type">
              {#if annotation.type === 'highlight' || !content}
                <Icon name="marker" />
                <div class="from">Highlighted</div>
              {:else if annotation.type === 'comment'}
                <Icon name="message" />
                <div class="from">Commented</div>
              {:else}
                <Icon name="link" />
                <div class="from">Linked</div>
              {/if}
            </div>

            <div
              class="from"
              use:tooltip={{
                content:
                  source === 'inline_ai'
                    ? `Inline AI at ${new Date().toLocaleString()}`
                    : source === 'chat_ai'
                      ? `Page AI at ${new Date().toLocaleString()}`
                      : `At ${new Date().toLocaleString()}`,
                action: 'hover',
                position: 'top',
                animation: 'fade',
                delay: 500
              }}
            >
              {getHumanDistanceToNow(resource.updatedAt)}
            </div>
          </div>
        {/if}

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

          {#if annotation.type === 'comment' && (!content || content === '<p></p>')}
            <button
              transition:slide
              on:click={handleShowAddComment}
              use:tooltip={{
                content: 'Add Comment',
                action: 'hover',
                position: 'left',
                animation: 'fade',
                delay: 500
              }}
            >
              <Icon name="message" />
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
    border-bottom: 1px solid #f0f0f0;

    &:hover {
      .actions {
        opacity: 1;
      }

      .metadata {
        opacity: 1;
      }
    }

    &.background {
      border-bottom: 1px solid #e3e3e3;
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

  .error {
    p {
      color: #ff3d3d;
    }

    button {
      background: none;
      border: none;
      color: #3e3e46;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }
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
    gap: 0.25rem;
    opacity: 0.75;
    transition: opacity 0.2s ease-in-out;

    .type {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .from {
      font-size: 1rem;
      text-decoration: none;
    }
  }

  .success {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #4caf50;

    p {
      margin: 0;
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
