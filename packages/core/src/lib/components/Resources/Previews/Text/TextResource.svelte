<script lang="ts">
  import { writable, type Writable, get } from 'svelte/store'
  import { createEventDispatcher, getContext, onDestroy, onMount, tick } from 'svelte'

  import { Editor, getEditorContentText } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  import { ResourceNote, useResourceManager } from '../../../../service/resources'
  import { useDebounce, useLogScope } from '@horizon/utils'
  import CitationItem, { type CitationClickData } from '../../../Chat/CitationItem.svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { mapCitationsToText } from '@horizon/core/src/lib/service/ai/helpers'
  import { useGlobalMiniBrowser } from '@horizon/core/src/lib/service/miniBrowser'
  import { OpenInMiniBrowserEventFrom, ResourceTypes } from '@horizon/types'
  import type {
    HighlightWebviewTextEvent,
    JumpToWebviewTimestampEvent
  } from '@horizon/core/src/lib/types'

  export let resourceId: string
  export let autofocus: boolean = true
  export let showTitle: boolean = true

  const log = useLogScope('TextCard')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const globalMiniBrowser = useGlobalMiniBrowser()
  const dispatch = createEventDispatcher<{
    'update-title': string
    seekToTimestamp: JumpToWebviewTimestampEvent
    highlightWebviewText: HighlightWebviewTextEvent
  }>()

  const content = writable('')

  let initialLoad = true
  let resource: ResourceNote | null = null
  let focusEditor: () => void
  let title = ''
  let editorWrapperElem: HTMLElement

  const debouncedSaveContent = useDebounce((value: string) => {
    log.debug('saving content', value)
    // dispatch('change', $card)

    if (resource) {
      resource.updateContent(value)
    }
  }, 500)

  // prevent default drag and drop behavior (i.e. the MediaImporter handling it)
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    log.debug('dropped onto text card')

    // seems like tiptap handles text drag and drop already
  }

  const handleTitleBlur = () => {
    if (resource) {
      resource.updateMetadata({ name: title })
      dispatch('update-title', title)
    }
  }

  // FIX: This interfears with the waa we use the active state -> e.g. inside visor
  // onDestroy(
  //   activeCardId.subscribe((id) => {
  //     if (id === $card.id) {
  //       active = true
  //       tick().then(focusEditor)
  //     } else {
  //       active = false
  //     }
  //   })
  // )

  const handleCitationClick = async (e: CustomEvent<CitationClickData>) => {
    const { citationID, uniqueID, preview, source } = e.detail
    log.debug('Citation clicked', citationID, uniqueID, source, preview)

    if (!source) {
      log.error('No source found for citation', citationID)
      return
    }

    let text = ''
    if (source.metadata?.timestamp === undefined || source.metadata?.timestamp === null) {
      const contentElem = editorWrapperElem.querySelector(
        '.editor-wrapper div.tiptap'
      ) as HTMLElement
      const citationsToText = mapCitationsToText(contentElem || editorWrapperElem)
      text = citationsToText.get(uniqueID) ?? ''
      log.debug('Citation text', text)
    }

    const resource = await resourceManager.getResource(source.resource_id)
    if (!resource) {
      log.error('Resource not found', source.resource_id)
      return
    }

    log.debug('Resource linked to citation', resource)

    if (
      resource.type === ResourceTypes.PDF ||
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST)
    ) {
      if (
        resource.type === ResourceTypes.POST_YOUTUBE &&
        source.metadata?.timestamp !== undefined &&
        source.metadata?.timestamp !== null
      ) {
        const timestamp = source.metadata.timestamp
        dispatch('seekToTimestamp', {
          resourceId: resource.id,
          timestamp: timestamp,
          preview: preview ?? false
        })
      } else {
        dispatch('highlightWebviewText', {
          resourceId: resource.id,
          answerText: text,
          sourceUid: source.uid,
          preview: preview ?? false
        })
      }
    }
  }

  let unsubscribeValue: () => void
  let unsubscribeContent: () => void

  onMount(async () => {
    resource = (await resourceManager.getResource(resourceId)) as ResourceNote | null
    if (!resource) {
      log.error('Resource not found', resourceId)
      return
    }

    const value = resource.parsedData
    unsubscribeValue = value.subscribe((value) => {
      if (value) {
        content.set(value)
      }
    })

    await resource.getContent()

    initialLoad = false

    unsubscribeContent = content.subscribe((value) => {
      log.debug('content changed', value)
      debouncedSaveContent(value ?? '')
    })

    title = resource.metadata?.name ?? 'Untitled'

    // if (active) {
    //   focusEditor()
    // }
  })

  onDestroy(() => {
    if (resource) {
      resource.releaseData()
    }

    if (unsubscribeContent) {
      unsubscribeContent()
    }

    if (unsubscribeValue) {
      unsubscribeValue()
    }
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div on:drop={handleDrop} class="wrapper text-gray-900 dark:text-gray-100">
  <div class="content">
    {#if showTitle}
      <div class="details">
        <input type="text" bind:value={title} on:blur={handleTitleBlur} on:click />
      </div>
    {/if}

    {#if !initialLoad}
      <div class="notes-editor-wrapper" bind:this={editorWrapperElem}>
        <Editor
          bind:focus={focusEditor}
          bind:content={$content}
          placeholder="Jot something down…"
          citationComponent={CitationItem}
          {tabsManager}
          on:click
          on:dragstart
          on:citation-click={handleCitationClick}
          {autofocus}
        />
      </div>
    {/if}
  </div>
  <!-- <button on:click={() => copyToClipboard(JSON.stringify($value))}>
      Copy to Clipboard
    </button> -->
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    padding: 1rem;
    padding-bottom: 0;
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: center;

    :global(.dark) & {
      background: #181818;
    }

    --text-color: #1f163c;
    --text-color-dark: #fff;
  }

  .content {
    width: 100%;
    max-width: 82ch;
    height: 100%;
    overflow: hidden;
    position: relative;
    padding: 2em;
    padding-top: 4em;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 2em;
  }

  .details {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding-bottom: 0.25em;
    border-bottom: 1px dashed #ddd;

    input {
      font-size: 1.9em;
      font-weight: 600;
      border: none;
      outline: none;
      background: transparent;
      padding: 0;
      margin: 0;
      width: 100%;

      font-family: Gambarino;
      letter-spacing: 0.3px;

      color: var(--text-color);

      :global(.dark) & {
        color: var(--text-color-dark) !important;
      }
    }

    &:active,
    &:focus,
    &:focus-within {
      border-color: #aaa;
    }

    :global(.dark) & {
      border-color: #444;

      &:active,
      &:focus,
      &:focus-within {
        border-color: #777;
      }
    }
  }

  .notes-editor-wrapper {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 1em;
    overflow: hidden;
  }

  :global(.notes-editor-wrapper .editor-wrapper div.tiptap) {
    padding-bottom: 6em;
  }

  :global(.tiptap) {
    :global(*) {
      color: var(--text-color) !important;
      overscroll-behavior: auto !important;
    }

    :global(ul) {
      :global(li) {
        margin-block: 0.25em !important;
      }
    }

    :global(pre) {
      background: #f8f8f8;
    }
    :global(.dark) & {
      :global(*) {
        color: var(--text-color-dark) !important;
      }
      :global(pre) {
        background: #111;
      }
    }
  }
</style>
