<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'

  export let acceptDrop: boolean = true

  const dispatch = createEventDispatcher<{ drop: DragEvent }>()

  const dragOver = writable(false)
  let counter = 0

  const handleDragEnter = (e: DragEvent) => {
    if (!acceptDrop) {
      console.log('Aborting DND')
      return
    }
    e.preventDefault()
    counter++
    if (counter === 1) {
      dragOver.set(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    counter--
    if (counter === 0) {
      dragOver.set(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    if (!acceptDrop) {
      return
    }
    e.preventDefault() // This is necessary to allow the drop
  }

  const handleDrop = (e: DragEvent) => {
    if (!acceptDrop) {
      console.log('Drop not accepted')
      return
    }
    e.preventDefault()
    e.stopPropagation()
    counter = 0 // Reset counter to ensure dragover is removed
    dragOver.set(false)
    dispatch('drop', e)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  class="drawer-content"
  class:dragover={$dragOver}
>
  <slot />
</div>

<style lang="scss">
  .drawer-content {
    flex: 1;
    padding: 3.5rem 0 1rem 0;
    padding-bottom: 12rem;
    overflow: auto;
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
