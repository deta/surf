<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { useLogScope } from '@horizon/utils'
  import {
    useResourceManager,
    type Resource,
    type ResourceAnnotation
  } from '../../service/resources'
  import AnnotationItem from '../Oasis/AnnotationItem.svelte'
  import {
    DeleteAnnotationEventTrigger,
    type AnnotationCommentData,
    type ResourceDataAnnotation,
    type WebViewEventAnnotation
  } from '@horizon/types'
  import { createEventDispatcher } from 'svelte'
  import { Editor, getEditorContentText } from '@horizon/editor'
  import { useToasts } from '../../service/toast'
  import { slide } from 'svelte/transition'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'

  export let resourceId: string | null = null
  export let activeAnnotation: string | null = null
  export let horizontalTabs = false

  const log = useLogScope('AnnotationsSidebar')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{
    create: { text: string; html: string; tags: string[] }
    reload: void
    close: void
  }>()
  const toast = useToasts()
  const config = useConfig()

  const userSettings = config.settings

  let loadingAnnotations = false
  let annotations: ResourceAnnotation[] = []
  let inputValue = ''
  let tags: string[] = []
  let savingNotes = false
  let editorFocused = false
  let editor: Editor

  $: sortedAnnotations = annotations.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  $: if (resourceId) {
    loadAnnotations(resourceId, true)
  }

  export const reload = async (showLoading?: boolean) => {
    if (resourceId) {
      await loadAnnotations(resourceId, showLoading)
      savingNotes = false
    }
  }

  const loadAnnotations = async (resourceId: string, showLoading = false) => {
    try {
      // Show loading state if requested, only needed on initial load and when a resource got updated to force a re-render
      if (showLoading) {
        loadingAnnotations = true
      }

      annotations = await resourceManager.getAnnotationsForResource(resourceId)
      log.debug('annotations', annotations)
    } catch (e) {
      log.error(e)
    } finally {
      loadingAnnotations = false
    }
  }

  const handleAnnotationDelete = async (e: CustomEvent<string>) => {
    const id = e.detail
    log.debug('Annotation delete', id)

    const annotation = annotations.find((annotation) => annotation.id === id)
    if (!annotation) {
      log.error('Annotation not found', id)
      toast.error('Annotation not found')
      return
    }

    const { closeType: confirmed } = await openDialog({
      message: 'Are you sure you want to delete the annotation?'
    })

    if (!confirmed) return

    const annotationData = await annotation.getParsedData()

    log.debug('Deleting annotation', id)
    annotations = annotations.filter((annotation) => annotation.id !== id)
    await resourceManager.deleteResource(id)

    toast.success('Annotation deleted!')
    await loadAnnotations(resourceId!)

    const simplifiedAnnotationType =
      (annotationData.data as AnnotationCommentData)?.content_html ||
      (annotationData.data as AnnotationCommentData)?.content_plain
        ? 'comment'
        : 'highlight'
    await resourceManager.telemetry.trackDeleteAnnotation(
      simplifiedAnnotationType,
      DeleteAnnotationEventTrigger.PageSidebar
    )
  }

  const handleAnnotationUpdate = async (e: CustomEvent<ResourceDataAnnotation>) => {
    // check if inline anchor is present
    if (e.detail.anchor) {
      dispatch('reload')
    }
  }

  const handleNotesSubmit = () => {
    savingNotes = true
    const text = getEditorContentText(inputValue)

    dispatch('create', { text, html: inputValue, tags })
    inputValue = ''
    editor.clear()
  }

  const handleInputKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleNotesSubmit()
    }
  }

  const handleHashtags = (e: CustomEvent<string[]>) => {
    log.debug('tags', e.detail)
    tags = e.detail
  }
</script>

<div class="flex flex-col gap-4 overflow-hidden p-4 pt-0 h-full">
  {#if !$userSettings.annotations_sidebar}
    <div class="flex items-center justify-between gap-3 px-4 py-4 border-b-2 border-sky-100 -mx-4">
      <div class="flex items-center justify-start text-lg p-1.5 font-semibold">Annotations</div>

      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        role="button"
        tabindex="0"
        on:click={() => dispatch('close')}
        class="flex items-center gap-2 p-1 text-sky-800/50 rounded-lg hover:bg-sky-100 hover:text-sky-800 group"
      >
        <Icon name="sidebar.right" class="group-hover:!hidden" size="20px" />
        <Icon name="close" class="hidden group-hover:!block" size="20px" />
      </div>
    </div>
  {/if}
  <!-- <div class="header">
    <div class="title">
      <Icon name="marker" size="28px" />
      <h1>Annotations</h1>
    </div>
  </div> -->

  <div class="content">
    {#if sortedAnnotations.length > 0}
      <!-- The key block is needed to force a re-render when the annotation data changes as it is not reactive because of the data being stored as a file under the hood -->
      {#key loadingAnnotations}
        {#each sortedAnnotations as annotation (annotation.id)}
          <AnnotationItem
            resource={annotation}
            active={annotation.id === activeAnnotation}
            on:scrollTo
            on:delete={handleAnnotationDelete}
            on:update={handleAnnotationUpdate}
          />
        {/each}
      {/key}
    {:else if loadingAnnotations}
      <div class="loading">
        <Icon name="spinner" />
        <p>Loading annotations…</p>
      </div>
    {:else}
      <div class="empty-annotations">
        <div class="empty-title">
          <Icon name="marker" />
          <h1>Nothing Annotated</h1>
        </div>
        <p>Select any text on the page and click the marker icon to highlight it.</p>
      </div>
    {/if}
  </div>

  <form on:submit|preventDefault={handleNotesSubmit} class="notes">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="editor-wrapper" on:keydown={handleInputKeydown}>
      <Editor
        bind:this={editor}
        bind:content={inputValue}
        bind:focused={editorFocused}
        on:hashtags={handleHashtags}
        parseHashtags
        autofocus={false}
        submitOnEnter
        placeholder="Jot down your thoughts…"
      />
    </div>

    {#if (inputValue && inputValue !== '<p></p>') || editorFocused}
      <button
        type="submit"
        transition:slide={{ duration: 150 }}
        disabled={savingNotes || inputValue === '<p></p>'}
        class:filled={inputValue && inputValue !== '<p></p>'}
      >
        {#if savingNotes}
          <div>Adding Note…</div>
          <Icon name="spinner" />
        {:else}
          <div>Add Note</div>
          <Icon name="arrow.right" />
        {/if}
      </button>
    {/if}
  </form>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-top: 2rem;
    height: 100%;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    overflow: auto;
    margin-top: 1rem;
    padding-bottom: 1rem;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #2b2715;
    white-space: nowrap;

    :global(.dark) & {
      color: #e0e7ff;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 500;
    }
  }

  .empty-annotations {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    opacity: 0.5;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }

    p {
      font-size: 1rem;
      color: #666;
      text-align: center;

      :global(.dark) & {
        color: #fff;
      }
    }
  }

  .empty-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    h1 {
      font-size: 1.25rem;
      font-weight: 500;
    }
  }

  .loading {
    margin: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }

  .notes {
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    border-top: 1px solid #e0e0e0;
    font-family: inherit;

    :global(.dark) & {
      border-color: #2e2e2e;
    }

    textarea {
      flex: 1;
      border: none;
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 1rem;
      resize: vertical;
      outline: none;
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      font-family: inherit;

      :global(.dark) & {
        background: #1e1e1e;
        border-color: #2e2e2e;
      }
    }

    button {
      appearance: none;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;

      transition: background-color 0.2s;
      height: min-content;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #fd1bdf40;
      color: white;
      margin-top: 1rem;

      div {
        font-size: 1rem;
      }

      &:hover {
        background: #fd1bdf69;
      }

      &.filled {
        background: #f73b95;

        &:hover {
          background: #f92d90;
        }
      }

      &:active {
        background: #f73b95;
      }
    }
  }

  .editor-wrapper {
    flex: 1;
    background: #fff;
    border: 1px solid #eeece0;
    border-radius: 12px;
    padding: 0.75rem;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;

    :global(.dark) & {
      background: #1e1e1e;
      border-color: #2e2e2e;
    }
  }
</style>
