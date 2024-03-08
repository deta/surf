<script lang="ts">
  import { createEventDispatcher, getContext, onDestroy, onMount, tick } from 'svelte'
  import { writable, type Writable } from 'svelte/store'

  import { Editor } from '@horizon/editor'
  import '@horizon/editor/src/editor.scss'

  import type { CardEvents, Card } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'
  import { useDebounce } from '../../../utils/debounce'
  import type { ResourceManager, ResourceNote } from '../../../service/resources'
  import type { Horizon } from '../../../service/horizon'

  export let card: Writable<Card>
  export let resourceManager: ResourceManager
  export let active: boolean = false

  const activeCardId = getContext<Horizon>('horizon').activeCardId

  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('TextCard')

  const content = writable('')

  let initialLoad = true
  let resource: ResourceNote | null = null
  let focusEditor: () => void

  const debouncedSaveContent = useDebounce((value: string) => {
    log.debug('saving content', value)
    dispatch('change', $card)

    if (resource) {
      resource.updateContent(value)
    }
  }, 500)

  const unsubscribeContent = content.subscribe((value) => {
    log.debug('content changed', value)
    if (initialLoad) return
    debouncedSaveContent(value)
  })

  // prevent default drag and drop behavior (i.e. the MediaImporter handling it)
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    log.debug('dropped onto text card')

    // seems like tiptap handles text drag and drop already
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

  onMount(async () => {
    if (!$card.resourceId) {
      log.error('No resource id found', $card)
      return
    }

    resource = (await resourceManager.getResource($card.resourceId)) as ResourceNote | null
    if (!resource) {
      log.error('Resource not found', $card.resourceId)
      return
    }

    const value = await resource.getContent()
    content.set(value)
    initialLoad = false

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
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div on:drop={handleDrop} class="text-card">
  {#if !initialLoad}
    <Editor
      bind:focus={focusEditor}
      bind:content={$content}
      placeholder="Jot something down…"
      autofocus={false}
    />
  {/if}
  <!-- <button on:click={() => copyToClipboard(JSON.stringify($value))}>
    Copy to Clipboard
  </button> -->
</div>

<style lang="scss">
  .text-card {
    width: 100%;
    height: 100%;
    position: relative;
    padding: 1rem;
    background: #fff;
  }
</style>
