<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { useLogScope } from '../../utils/log'
  import { HTMLDragZone, type DragculaDragEvent } from '@horizon/dragcula'

  export let acceptDrop: boolean = true
  export let dragOver: boolean = false
  export let spaceId: string = crypto.randomUUID()

  const log = useLogScope('DropWrapper')
  const dispatch = createEventDispatcher<{
    drop: DragEvent
    dragenter: DragEvent
    dragleave: DragEvent
  }>()

  let counter = 0
  let dragOverTimeout: ReturnType<typeof setTimeout> | null = null

  const handleDragEnter = (e: DragculaDragEvent) => {
    if (!acceptDrop) {
      log.debug('Aborting DND')
      return
    }

    const cancelled = !dispatch('DragEnter', e, { cancelable: true })
    if (cancelled) {
      e.preventDefault()
    }

    /*
    e.preventDefault()

    counter++
    if (counter === 1) {
      dragOver = true
      dispatch('dragenter', e)
    }*/
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()

    counter--
    if (counter === 0) {
      dragOver = false
      dispatch('dragleave', e)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    if (!acceptDrop) {
      return
    }

    // This is necessary to allow the drop
    e.preventDefault()

    // Reset the drag over effect after a short delay to simulate continuous drag over.
    if (dragOverTimeout) {
      clearTimeout(dragOverTimeout)
    }

    dragOver = true
    dragOverTimeout = setTimeout(() => {
      dragOver = false
    }, 100) // Adjust delay as needed, 100ms is just an example
  }

  const handleDrop = (e: DragculaDragEvent) => {
    if (!acceptDrop) {
      log.debug('Drop not accepted')
      return
    }

    //e.preventDefault()
    //e.stopPropagation()

    counter = 0 // Reset counter to ensure dragover is removed
    dragOver = false

    if (dragOverTimeout) {
      clearTimeout(dragOverTimeout)
    }

    const cancelled = !dispatch('Drop', e, { cancelable: true })
    if (cancelled) {
      e.preventDefault()
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!--
on:dragleave={handleDragLeave}
  on:dragover={handleDragOver}
-->

<div
  class="drop-wrapper"
  class:dragover={dragOver}
  use:HTMLDragZone.action={{
    id: `oasis-space-${spaceId}`
  }}
  on:Drop={handleDrop}
  on:DragEnter={handleDragEnter}
>
  <slot />
</div>

<style lang="scss">
  .drop-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    transition-property: opacity background-color;
    transition-duration: 0.2s;
    transition-timing-function: ease-in-out;
  }

  .dragover {
    background-color: rgba(255, 255, 255, 1);
    opacity: 0.75;
  }
</style>
