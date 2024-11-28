<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  /**
   * A LazyLoading / Infinite scroll implementation using native browser features.
   TODO: Write
   */
  const dispatch = createEventDispatcher<{
    /// Notify parent to load more items -> number is velocity which determines
    /// how many items to load.
    /// [scrollVelocity, TODO:]
    lazyLoad: [number, number, number]
  }>()
  export let baseItemHeight = 500
  export let loadSensitivity = 1
  let canLoad = true
  let scrollContainerEl: HTMLElement
  const scrollState = {
    scrollTop: 0,
    timestamp: 0,
    velocity: 0,
    scrollRemaining: 0
  }
  let raf: number | null = null
  function handleWheel(e: WheelEvent) {
    const newScrollTop = scrollContainerEl?.scrollTop
    const newTimestamp = e.timeStamp
    if (scrollState !== undefined && newScrollTop) {
      const deltaY = newScrollTop - scrollState.scrollTop
      const deltaT = newTimestamp - scrollState.timestamp
      scrollState.velocity = deltaY / deltaT
    }
    scrollState.scrollTop = newScrollTop
    scrollState.timestamp = newTimestamp
    scrollState.velocity = scrollState ? scrollState.velocity : 0
    scrollState.scrollRemaining =
      scrollContainerEl.scrollHeight - scrollContainerEl.clientHeight - scrollState.scrollTop
    const clampedVelocity = (scrollState.velocity < 1 ? 1 : scrollState.velocity) * loadSensitivity
    const remainingAdjusted = scrollState.scrollRemaining - clampedVelocity * baseItemHeight
    if (remainingAdjusted < baseItemHeight && canLoad) {
      canLoad = false
      handleTriggerLoad(scrollState.velocity, remainingAdjusted, scrollState.scrollRemaining)
      tick().then(() => {
        canLoad = true
      })
    }
    raf = null
  }
  function handleTriggerLoad(velocity: number, remainingAdjusted: number, remaining: number) {
    dispatch('lazyLoad', [velocity, remainingAdjusted, remaining])
  }
</script>

<div
  class="lazyScroll-container"
  bind:this={scrollContainerEl}
  on:wheel|passive={(e) => {
    if (raf === null) raf = requestAnimationFrame(() => handleWheel(e))
  }}
>
  <slot />
</div>

<style lang="scss">
  .lazyScroll-container {
    position: relative;
    overflow-y: auto;
    width: 100%;
    height: 100%;
  }
</style>
