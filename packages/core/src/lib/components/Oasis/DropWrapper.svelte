<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { HTMLDragZone, type DragculaDragEvent } from '@horizon/dragcula'
  import { type DragTypes } from '../../types'

  export let dragOver: boolean = false
  export let spaceId: string = crypto.randomUUID()
  export let zonePrefix: string | undefined
  export let acceptsDrag: (drag: DragculaDragEvent<DragTypes>) => boolean = () => false

  const dispatch = createEventDispatcher<{
    drop: DragEvent
    DragEnter: DragculaDragEvent
    DragLeave: DragEvent
    Drop: DragculaDragEvent
  }>()

  const handleDrop = (drag: DragculaDragEvent) => {
    dispatch('Drop', drag)
    drag.continue()
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  id={`${zonePrefix ?? ''}oasis-space-${spaceId}`}
  class="drop-wrapper bg-[#f7f7f7] dark:bg-gray-900"
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
