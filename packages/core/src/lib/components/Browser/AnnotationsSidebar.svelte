<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { useLogScope } from '../../utils/log'
  import {
    useResourceManager,
    type Resource,
    type ResourceAnnotation
  } from '../../service/resources'
  import AnnotationItem from '../Oasis/AnnotationItem.svelte'
  import type { ResourceDataAnnotation, WebViewEventAnnotation } from '@horizon/types'
  import { createEventDispatcher } from 'svelte'
  import autosize from 'svelte-autosize'
  import { Editor, getEditorContentText } from '@horizon/editor'
  import { useToasts } from '../../service/toast'
  import { slide } from 'svelte/transition'

  export let resourceId: string | null = null
  export let activeAnnotation: string | null = null

  const log = useLogScope('AnnotationsSidebar')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{
    create: { text: string; html: string; tags: string[] }
    reload: void
  }>()
  const toast = useToasts()

  let loadingAnnotations = false
  let annotations: ResourceAnnotation[] = []
  let inputValue = ''
  let tags: string[] = []
  let savingNotes = false
  let editorFocused = false
  let editor: Editor

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

    const confirmed = window.confirm('Are you sure you want to delete the annotation?')
    if (!confirmed) return

    log.debug('Deleting annotation', id)
    await resourceManager.deleteResource(id)

    toast.success('Annotation deleted!')

    annotations = annotations.filter((annotation) => annotation.id !== id)

    await loadAnnotations(resourceId!)
  }

  const handleAnnotationUpdate = async () => {
    dispatch('reload')
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

<div class="wrapper">
  <div class="header">
    <div class="title">
      <Icon name="message" size="28px" />
      <h1>Annotations</h1>
    </div>
  </div>

  <div class="content">
    {#if annotations.length > 0}
      <!-- The key block is needed to force a re-render when the annotation data changes as it is not reactive because of the data being stored as a file under the hood -->
      {#key loadingAnnotations}
        {#each annotations as annotation (annotation.id)}
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
        autofocus={false}
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
    }

    button {
      appearance: none;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
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

      &.filled {
        background: #ff4eed;
      }

      &:hover {
        background: #fd1bdf;
      }

      &:active {
        background: #fd1bdf;
      }
    }
  }

  .editor-wrapper {
    flex: 1;
    background: #f8f8f8;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
  }
</style>
