<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { useLogScope } from '../../utils/log'

  export let acceptDrop: boolean = true
  export let dragOver: boolean = false

  const log = useLogScope('DropWrapper')
  const dispatch = createEventDispatcher<{
    drop: DragEvent
    dragenter: DragEvent
    dragleave: DragEvent
  }>()

  let counter = 0
  let dragOverTimeout: ReturnType<typeof setTimeout> | null = null

  const handleDragEnter = (e: DragEvent) => {
    if (!acceptDrop) {
      log.debug('Aborting DND')
      return
    }

    e.preventDefault()

    counter++
    if (counter === 1) {
      dragOver = true
      dispatch('dragenter', e)
    }
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

  const handleDrop = (e: DragEvent) => {
    if (!acceptDrop) {
      log.debug('Drop not accepted')
      return
    }

    e.preventDefault()
    e.stopPropagation()

    counter = 0 // Reset counter to ensure dragover is removed
    dragOver = false

    if (dragOverTimeout) {
      clearTimeout(dragOverTimeout)
    }

    dispatch('drop', e)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  class="drop-wrapper"
  class:dragover={dragOver}
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
