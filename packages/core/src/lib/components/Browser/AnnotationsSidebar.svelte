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
  import { Editor } from '@horizon/editor'

  export let resourceId: string | null = null
  export let activeAnnotation: string | null = null

  const log = useLogScope('AnnotationsSidebar')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ create: string }>()

  let loadingAnnotations = false
  let annotations: ResourceAnnotation[] = []
  let inputValue = ''
  let savingNotes = false

  $: if (resourceId) {
    loadAnnotations(resourceId)
  }

  export const reload = async () => {
    if (resourceId) {
      await loadAnnotations(resourceId)
      savingNotes = false
    }
  }

  const loadAnnotations = async (resourceId: string) => {
    try {
      loadingAnnotations = true
      annotations = await resourceManager.getAnnotationsForResource(resourceId)
      log.debug('annotations', annotations)
    } catch (e) {
      log.error(e)
    } finally {
      loadingAnnotations = false
    }
  }

  const handleAnnotationDelete = async (e: CustomEvent<WebViewEventAnnotation>) => {
    log.debug('Annotation delete', e.detail)

    const confirmed = window.confirm('Are you sure you want to delete the annotation?')
    if (!confirmed) return

    log.debug('Deleting annotation', e.detail.id)
    await resourceManager.deleteResource(e.detail.id)

    await loadAnnotations(resourceId!)
  }

  const handleNotesSubmit = () => {
    savingNotes = true
    dispatch('create', inputValue)
    inputValue = ''
  }

  const handleInputKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleNotesSubmit()
    }
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
      {#key loadingAnnotations}
        {#each annotations as annotation (annotation.id)}
          <AnnotationItem
            resource={annotation}
            active={annotation.id === activeAnnotation}
            on:scrollTo
            on:delete={handleAnnotationDelete}
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
    <div class="editor-wrapper">
      <Editor bind:content={inputValue} placeholder="Jot down your thoughts…" />
    </div>
    <!-- <textarea
      bind:value={inputValue}
      rows={1}
      use:autosize
      on:keydown={handleInputKeydown}
      placeholder="Jot down your thoughts…"
    /> -->

    <button class="" type="submit" disabled={savingNotes}>
      {#if savingNotes}
        <Icon size="24px" name="spinner" />
      {:else}
        <Icon size="24px" name="arrow.right" />
      {/if}
    </button>
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
    gap: 1rem;
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
      background: #ff4eed;
      color: #fff;
      height: min-content;
      display: flex;
      align-items: center;
      justify-content: center;

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
  }
</style>
