<script lang="ts">
  import { writable, type Writable, get } from 'svelte/store'
  import { createEventDispatcher, getContext, onDestroy, onMount, tick } from 'svelte'

  import { Editor, getEditorContentText } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  import { ResourceNote, useResourceManager } from '../../../../service/resources'
  import { useDebounce, useLogScope } from '@horizon/utils'

  export let resourceId: string

  const log = useLogScope('TextCard')
  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ 'update-title': string }>()

  const content = writable('')

  let initialLoad = true
  let resource: ResourceNote | null = null
  let focusEditor: () => void
  let title = ''

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
<div on:drop={handleDrop} class="wrapper">
  <div class="content">
    <div class="details">
      <input type="text" bind:value={title} on:blur={handleTitleBlur} />
    </div>

    {#if !initialLoad}
      <div class="notes-editor-wrapper">
        <Editor
          bind:focus={focusEditor}
          bind:content={$content}
          placeholder="Jot something down…"
          autofocus
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
  }

  .content {
    width: 100%;
    max-width: 700px;
    height: 100%;
    overflow: hidden;
    position: relative;
    padding: 2rem;
    padding-top: 4rem;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .details {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #ededed;

    input {
      font-size: 1.9rem;
      font-weight: 600;
      border: none;
      outline: none;
      background: transparent;
      padding: 0;
      margin: 0;
      width: 100%;
    }
  }

  .notes-editor-wrapper {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
  }

  :global(.notes-editor-wrapper .editor-wrapper div.tiptap) {
    padding-bottom: 6rem;
  }
</style>
