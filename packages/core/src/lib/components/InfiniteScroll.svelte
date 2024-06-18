<script lang="ts">
  // Source: https://svelte.dev/repl/4863a658f3584b81bbe3d9f54eb67899?version=3.32.3

  import { onDestroy, createEventDispatcher } from 'svelte'

  export let threshold = 0
  export let horizontal = false
  export let elementScroll: HTMLElement | undefined = undefined
  export let hasMore = true

  const dispatch = createEventDispatcher()
  let isLoadMore = false
  let component: HTMLElement

  $: {
    if (component || elementScroll) {
      const element = elementScroll ? elementScroll : component.parentNode

      if (!element) throw new Error('Element not found')

      element.addEventListener('scroll', onScroll)
      element.addEventListener('resize', onScroll)
    }
  }

  const onScroll = (e: Event) => {
    const element = e.target as HTMLElement

    const offset = horizontal
      ? element.scrollWidth - element.clientWidth - element.scrollLeft
      : element.scrollHeight - element.clientHeight - element.scrollTop

    if (offset <= threshold) {
      if (!isLoadMore && hasMore) {
        dispatch('loadMore')
      }
      isLoadMore = true
    } else {
      isLoadMore = false
    }
  }

  onDestroy(() => {
    if (component || elementScroll) {
      const element = elementScroll ? elementScroll : component.parentNode

      if (!element) throw new Error('Element not found')

      element.removeEventListener('scroll', null)
      element.removeEventListener('resize', null)
    }
  })
</script>

<div bind:this={component} style="width:0px" />
