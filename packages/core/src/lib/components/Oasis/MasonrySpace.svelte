<script lang="ts">
  import { onMount } from 'svelte'
  import { useLogScope, useThrottle } from '@horizon/utils'

  import type { Item } from './masonry/types'
  import { selection } from './utils/select'

  export let items: Item[] = []

  const LAZY_N = 6 // NOTE: seems to be the best working value from testing

  let renderedItemsN = 20
  $: renderedItems = items.slice(0, renderedItemsN)

  const log = useLogScope('MasonrySpace')

  const scheduleLoad = () => {
    if (renderedItemsN > items.length) return

    // @ts-ignore - yes, this exists!
    scheduler.postTask(
      () => {
        renderedItemsN += LAZY_N
      },
      {
        priority: 'background'
      }
    )
  }
  const throttledScheduleLoad = useThrottle(scheduleLoad, 5)

  onMount(() => {
    throttledScheduleLoad()
  })

  const handleScroll = () => {
    throttledScheduleLoad()
  }

  //let isUpdatingVisibleItems = false
  //let updateVisibleItemsRequestId: number | null = null

  //let gridContainer: HTMLElement
  /*let scrollVelocity: ScrollVelocity = {
    scrollTop: 0,
    timestamp: 0,
    velocity: 0
  }*/

  /*const INITIAL_BATCH_SIZE = 10
  let batchSize = INITIAL_BATCH_SIZE

  const UPPER_OVERSHOOT_BOUND = 1400
  const LOWER_OVERSHOOT_BOUND = 1400*/

  /*const dispatch = createEventDispatcher<{
    wheel: { event: WheelEvent; scrollTop: number }
    scroll: { scrollTop: number; viewportHeight: number }
    'load-more': number
  }>()*/

  /*function updateVisibleItems() {
    if (!gridContainer || isUpdatingVisibleItems) return

    isUpdatingVisibleItems = true

    if (updateVisibleItemsRequestId !== null) {
      cancelAnimationFrame(updateVisibleItemsRequestId)
    }

    updateVisibleItemsRequestId = requestAnimationFrame(() => {
      const scrollTop = gridContainer.scrollTop
      const viewportHeight = gridContainer.clientHeight

      dispatch('scroll', { scrollTop, viewportHeight })

      isUpdatingVisibleItems = false
      updateVisibleItemsRequestId = null

      if (isBottomReached()) {
        handleBottomReached()
      }
    })
  }*/

  /*function calculateItemsToLoad(velocity: number): number {
    if (velocity <= 0) {
      return 0
    }

    const MIN_ITEMS = 1
    const MAX_ITEMS = 100
    const VELOCITY_FACTOR = 45

    let items = Math.round(Math.log(velocity * VELOCITY_FACTOR + 1))

    return Math.max(MIN_ITEMS, Math.min(items, MAX_ITEMS))
  }*/

  /* function isBottomReached(): boolean {
    const BUFFER =
      scrollVelocity.velocity > 10
        ? 3 * gridContainer.clientHeight * (scrollVelocity.velocity / 4)
        : 3 * gridContainer.clientHeight

    if (!gridContainer) {
      throw new Error('[MasonrySpace:isBottomReached()] Grid Container not found')
    }

    return (
      gridContainer.scrollHeight - gridContainer.scrollTop <= gridContainer.clientHeight + BUFFER
    )
  }*/

  /*function handleBottomReached() {
    const itemsToLoad = calculateItemsToLoad(scrollVelocity.velocity)
    dispatch('load-more', itemsToLoad)
  }*/

  /*const handleWheel = (e: WheelEvent) => {
    const scrollTop = gridContainer.scrollTop

    dispatch('wheel', { event: e, scrollTop })
  }*/

  /*onMount(async () => {
    gridContainer?.addEventListener('scroll', updateVisibleItems)
  })

  onDestroy(() => {
    if (gridContainer) {
      gridContainer.removeEventListener('scroll', updateVisibleItems)
    }
    deselectAll()
  })*/
</script>

<!--<svelte:window
  on:wheel|passive={(event) => {
    const newScrollTop = gridContainer?.scrollTop
    const newTimestamp = event.timeStamp

    if (scrollVelocity !== undefined && newScrollTop) {
      const deltaY = newScrollTop - scrollVelocity.scrollTop
      const deltaT = newTimestamp - scrollVelocity.timestamp
      scrollVelocity.velocity = deltaY / deltaT
    }

    scrollVelocity = {
      scrollTop: newScrollTop,
      timestamp: newTimestamp,
      velocity: scrollVelocity ? scrollVelocity.velocity : 0
    }
  }}
/>-->

<div class="masonry-wrapper">
  <div
    class="masonry-grid bg-[#f7f7f7] dark:bg-gray-900"
    on:wheel|passive={handleScroll}
    use:selection
    data-container
  >
    {#each renderedItems as item, index (`${item.id}-${index}`)}
      <div class="item">
        <slot item={{ id: item.id, data: item.data }}></slot>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  :global([data-selectable].selected) {
    background-image: linear-gradient(
      to bottom right,
      rgba(0, 123, 255, 0.3),
      rgba(0, 123, 255, 0.2)
    );
    outline: 4px solid rgba(0, 123, 255, 0.4);
  }

  .masonry-wrapper {
    position: absolute;
    inset: 0;
    container-type: inline-size;
    container-name: masonry-wrapper;
  }

  .masonry-grid {
    contain: strict;
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;

    // NOTE: Using CSS Houdini Layout API -> Requires "CSSLayoutAPI" chrome flag!
    display: layout(masonry);
    --padding-inline: 46;
    --padding-block: 46;
    --columns: 4;
    --gap: 21;
  }
  .item {
    box-sizing: border-box;
    padding: 10px;
    transition:
      opacity 0s ease,
      width 0s ease,
      visibility 0.12s ease;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;

    width: 100% !important;
    height: auto;
  }

  .item:last-child {
    padding-bottom: 400px;
  }

  @container masonry-wrapper (max-width: 600px) {
    .masonry-grid {
      --columns: 1;
    }
  }

  @container masonry-wrapper (min-width: 601px) and (max-width: 900px) {
    .masonry-grid {
      --columns: 2;
    }
  }

  @container masonry-wrapper (min-width: 901px) and (max-width: 1200px) {
    .masonry-grid {
      --columns: 3;
    }
  }

  @container masonry-wrapper (min-width: 1201px) and (max-width: 1700px) {
    .masonry-grid {
      --columns: 4;
    }
  }

  @container masonry-wrapper (min-width: 1701px) {
    .masonry-grid {
      --columns: 5;
    }
  }
</style>
