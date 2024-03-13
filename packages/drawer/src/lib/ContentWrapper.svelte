<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let acceptDrop: boolean = true

  const dispatch = createEventDispatcher<{ drop: DragEvent }>()

  let dragOver = false
  let counter = 0

  const handleDragEnter = (e: DragEvent) => {
    if (!acceptDrop) {
      console.log('Aborting DND')
      return
    }
    e.preventDefault()
    dragOver = true
    counter++
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    counter--

    if (counter === 0) {
      dragOver = false
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragOver = false
    dispatch('drop', e)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  class="drawer-content"
  class:dragover={dragOver}
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
    background-color: rgba(0, 0, 0, 0.1);
    opacity: 0.75;
  }
</style>
