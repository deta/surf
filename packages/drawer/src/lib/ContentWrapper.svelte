<script lang="ts">
  import { createEventDispatcher, getContext } from 'svelte'
  import { writable } from 'svelte/store'
  import { useDrawer } from './drawer'

  export let acceptDrop: boolean = true

  const drawer = useDrawer()
  const dispatch = createEventDispatcher<{ drop: DragEvent }>()

  const dragOver = writable(false)
  let counter = 0
  let dragOverTimeout: ReturnType<typeof setTimeout> | null = null

  $: if ($dragOver) {
    document.startViewTransition(async () => {
      drawer.viewState.set('chatInput')
    })
  }

  // $ : if(!$dragOver) {
  //   document.startViewTransition(async () => {
  //     viewState.set('default')
  //   })
  // }

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

    console.log('OVER THIS')

    e.preventDefault() // This is necessary to allow the drop

    // Reset the drag over effect after a short delay to simulate continuous drag over.
    if (dragOverTimeout) clearTimeout(dragOverTimeout)
    dragOver.set(true)
    dragOverTimeout = setTimeout(() => {
      dragOver.set(false)
    }, 100) // Adjust delay as needed, 100ms is just an example
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
    clearTimeout(dragOverTimeout)
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
