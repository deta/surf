<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { useLogScope } from '@horizon/utils'
  import { HTMLDragZone, type DragculaDragEvent } from '@horizon/dragcula'
  import { DragTypeNames, type DragTypes } from '../../types'

  export let acceptDrop: boolean = true
  export let dragOver: boolean = false
  export let spaceId: string = crypto.randomUUID()
  export let zonePrefix: string | undefined
  export let acceptsDrag: (drag: DragculaDragEvent<DragTypes>) => boolean = () => false

  const log = useLogScope('DropWrapper')
  const dispatch = createEventDispatcher<{
    drop: DragEvent
    DragEnter: DragculaDragEvent
    DragLeave: DragEvent
    Drop: DragculaDragEvent
  }>()

  /*let counter = 0
  let dragOverTimeout: ReturnType<typeof setTimeout> | null = null

  const handleDragEnter = (e: DragculaDragEvent) => {
    if (!acceptDrop) {
      log.debug('Aborting DND')
      return
    }

    const accepted = !dispatch('DragEnter', e, { cancelable: true })
    if (!accepted) return
    e.preventDefault()

    counter++
    if (counter === 1) {
      dragOver = true
      dispatch('DragEnter', e)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()

    counter--
    if (counter === 0) {
      dragOver = false
      dispatch('DragLeave', e)
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
  }*/

  const handleDrop = (drag: DragculaDragEvent) => {
    dispatch('Drop', drag)
    drag.continue()
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  id={`${zonePrefix ?? ''}oasis-space-${spaceId}`}
  class="drop-wrapper"
  class:dragover={dragOver}
  use:HTMLDragZone.action={{
    id: `${zonePrefix ?? ''}oasis-space-${spaceId}`,
    accepts: acceptsDrag
  }}
  on:Drop={handleDrop}
>
  <slot />
</div>

<style lang="scss">
  .drop-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    transition-property:
      opacity 0.2s,
      background-color 0.2s,
      border-color 175ms;
    transition-timing-function: ease-in-out;
    border: 1.5px dashed transparent;
  }

  :global(.drop-wrapper[data-drag-target]) {
    outline: 1.5px dashed gray !important;
    outline-offset: -1.5px;
  }

  .dragover {
    background-color: rgba(255, 255, 255, 1);
    opacity: 0.75;
  }
</style>
